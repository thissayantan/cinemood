import { create, insert, remove, search } from "@orama/orama";
import type { ParsedQuery, Title, TitleType } from "@cinemood/shared";
import type { Env } from "../env";
import { listWatchlist } from "../db/watchlist";
import {
  buildIndexText,
  embedText,
  embedTexts,
  EMBEDDING_DIM,
} from "./embeddings";

const ORAMA_SCHEMA = {
  tmdb_id: "number",
  type: "enum",
  title: "string",
  overview: "string",
  release_date: "string",
  year: "number",
  vote_average: "number",
  imdb_rating: "number",
  genres: "enum[]",
  keywords: "enum[]",
  cast_names: "enum[]",
  providers: "enum[]",
  embedding: `vector[${EMBEDDING_DIM}]`,
} as const;

export interface IndexDoc {
  id: string;
  tmdb_id: number;
  type: TitleType;
  title: string;
  overview: string;
  release_date: string;
  year: number;
  vote_average: number;
  imdb_rating: number;
  genres: string[];
  keywords: string[];
  cast_names: string[];
  providers: string[];
  embedding: number[];
}

interface PersistedIndex {
  version: 1;
  docs: IndexDoc[];
}

interface CachedIndex {
  docs: Map<number, IndexDoc>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

const CACHE = new Map<string, CachedIndex>();

// Per-user serialization queue. Ensures index mutations for a given userId
// run one at a time inside an isolate; concurrent waitUntil tasks otherwise
// interleave on the shared Orama db/docs Map and corrupt the embeddings.
const QUEUES = new Map<string, Promise<unknown>>();

async function serializePerUser<T>(
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = QUEUES.get(userId) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  QUEUES.set(
    userId,
    next.catch(() => undefined),
  );
  return next;
}

function r2Key(userId: string): string {
  return `index/${userId}.json`;
}

async function newDb(): Promise<CachedIndex["db"]> {
  // The schema literal has a runtime shape Orama accepts; cast to any to avoid
  // the deeply-generic CreateArguments type inference fight.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return create({ schema: ORAMA_SCHEMA as any });
}

function flattenProviders(providers: Title["providers"]): string[] {
  if (!providers || typeof providers !== "object") return [];
  const set = new Set<string>();
  for (const region of Object.values(providers)) {
    if (!region || typeof region !== "object") continue;
    for (const bucket of Object.values(region as Record<string, unknown>)) {
      if (!Array.isArray(bucket)) continue;
      for (const entry of bucket) {
        if (entry && typeof entry === "object" && "provider_name" in entry) {
          const name = (entry as { provider_name?: string }).provider_name;
          if (typeof name === "string" && name) set.add(name);
        }
      }
    }
  }
  return [...set];
}

export function titleToIndexDoc(
  title: Title,
  embedding: number[],
): IndexDoc {
  const year = title.release_date
    ? Number(title.release_date.slice(0, 4)) || 0
    : 0;
  return {
    id: String(title.id),
    tmdb_id: title.id,
    type: title.type,
    title: title.title,
    overview: title.overview ?? "",
    release_date: title.release_date ?? "",
    year,
    vote_average: title.vote_average ?? 0,
    imdb_rating: title.imdb_rating ?? 0,
    genres: title.genres,
    keywords: title.keywords,
    cast_names: (title.cast ?? []).map((c) => c.name),
    providers: flattenProviders(title.providers),
    embedding,
  };
}

async function persistIndex(
  env: Env,
  userId: string,
  cached: CachedIndex,
): Promise<void> {
  const payload: PersistedIndex = {
    version: 1,
    docs: [...cached.docs.values()],
  };
  await env.INDEX_BUCKET.put(r2Key(userId), JSON.stringify(payload), {
    httpMetadata: { contentType: "application/json" },
  });
}

async function buildFromDocs(docs: IndexDoc[]): Promise<CachedIndex> {
  const db = await newDb();
  const map = new Map<number, IndexDoc>();
  for (const doc of docs) {
    map.set(doc.tmdb_id, doc);
    // Pass a clone to Orama — insert() converts vector fields to typed arrays
    // in place, which would null-out the embedding when we later JSON-stringify
    // cached.docs.values() back to R2.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await insert(db, structuredClone(doc) as any);
  }
  return { docs: map, db };
}

async function backfillFromWatchlist(
  env: Env,
  userId: string,
): Promise<CachedIndex> {
  const items = await listWatchlist(env.DB, userId);
  if (items.length === 0) return { docs: new Map(), db: await newDb() };

  const titles = items.map((i) => i.title);
  const texts = titles.map((t) =>
    buildIndexText({
      title: t.title,
      original_title: t.original_title,
      overview: t.overview,
      genres: t.genres,
      keywords: t.keywords,
      cast: t.cast,
    }),
  );
  const vectors = await embedTexts(env, texts);
  const docs = titles.map((t, i) => titleToIndexDoc(t, vectors[i]!));
  const cached = await buildFromDocs(docs);
  await persistIndex(env, userId, cached);
  return cached;
}

export async function loadIndex(
  env: Env,
  userId: string,
): Promise<CachedIndex> {
  const memo = CACHE.get(userId);
  if (memo) return memo;

  const obj = await env.INDEX_BUCKET.get(r2Key(userId));
  if (!obj) {
    const built = await backfillFromWatchlist(env, userId);
    CACHE.set(userId, built);
    return built;
  }
  const text = await obj.text();
  let parsed: PersistedIndex | null = null;
  try {
    parsed = JSON.parse(text) as PersistedIndex;
  } catch {
    parsed = null;
  }
  const docs = parsed?.docs ?? [];
  const cached = await buildFromDocs(docs);
  CACHE.set(userId, cached);
  return cached;
}

/** Batched index add: embed N titles in one Workers AI call, insert all,
 *  persist R2 once. Bulk imports must use this instead of N x
 *  addTitleToIndex — the per-item path otherwise blows the Worker's
 *  per-invocation subrequest cap. */
export function addTitlesToIndex(
  env: Env,
  userId: string,
  titles: Title[],
): Promise<void> {
  if (titles.length === 0) return Promise.resolve();
  return serializePerUser(userId, async () => {
    const cached = await loadIndex(env, userId);
    const texts = titles.map((t) =>
      buildIndexText({
        title: t.title,
        original_title: t.original_title,
        overview: t.overview,
        genres: t.genres,
        keywords: t.keywords,
        cast: t.cast,
      }),
    );
    const vectors = await embedTexts(env, texts);
    for (let i = 0; i < titles.length; i++) {
      const doc = titleToIndexDoc(titles[i]!, vectors[i]!);
      if (cached.docs.has(doc.tmdb_id)) {
        try {
          await remove(cached.db, doc.id);
        } catch {
          /* not present */
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await insert(cached.db, structuredClone(doc) as any);
      cached.docs.set(doc.tmdb_id, doc);
    }
    await persistIndex(env, userId, cached);
  });
}

export function addTitleToIndex(
  env: Env,
  userId: string,
  title: Title,
): Promise<void> {
  return serializePerUser(userId, async () => {
    const cached = await loadIndex(env, userId);
    const text = buildIndexText({
      title: title.title,
      original_title: title.original_title,
      overview: title.overview,
      genres: title.genres,
      keywords: title.keywords,
      cast: title.cast,
    });
    const embedding = await embedText(env, text);
    const doc = titleToIndexDoc(title, embedding);

    if (cached.docs.has(doc.tmdb_id)) {
      try {
        await remove(cached.db, doc.id);
      } catch {
        /* doc not in db; fine */
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await insert(cached.db, structuredClone(doc) as any);
    cached.docs.set(doc.tmdb_id, doc);
    await persistIndex(env, userId, cached);
  });
}

export function removeTitleFromIndex(
  env: Env,
  userId: string,
  tmdbId: number,
): Promise<void> {
  return serializePerUser(userId, async () => {
    const cached = await loadIndex(env, userId);
    if (!cached.docs.has(tmdbId)) return;
    try {
      await remove(cached.db, String(tmdbId));
    } catch {
      /* ignore */
    }
    cached.docs.delete(tmdbId);
    await persistIndex(env, userId, cached);
  });
}

export interface IndexHit {
  tmdb_id: number;
  score: number;
}

export async function searchIndex(
  env: Env,
  userId: string,
  parsed: ParsedQuery,
): Promise<IndexHit[]> {
  const cached = await loadIndex(env, userId);
  if (cached.docs.size === 0) return [];

  const term = parsed.semantic_query.trim();
  const where: Record<string, unknown> = {};
  const f = parsed.filters;
  if (f.type && f.type.length > 0) {
    where.type = f.type.length === 1 ? { eq: f.type[0] } : { in: f.type };
  }
  if (f.genres && f.genres.length > 0)
    where.genres = { containsAny: f.genres };
  if (f.cast && f.cast.length > 0) where.cast_names = { containsAny: f.cast };
  if (f.providers && f.providers.length > 0)
    where.providers = { containsAny: f.providers };
  if (f.keywords && f.keywords.length > 0)
    where.keywords = { containsAny: f.keywords };
  if (typeof f.min_rating === "number" && typeof f.max_rating === "number") {
    where.vote_average = { between: [f.min_rating, f.max_rating] };
  } else if (typeof f.min_rating === "number") {
    where.vote_average = { gte: f.min_rating };
  } else if (typeof f.max_rating === "number") {
    where.vote_average = { lte: f.max_rating };
  }

  const yearAfter = f.release_after
    ? Number(f.release_after.slice(0, 4))
    : null;
  const yearBefore = f.release_before
    ? Number(f.release_before.slice(0, 4))
    : null;
  if (Number.isFinite(yearAfter) && Number.isFinite(yearBefore)) {
    where.year = { between: [yearAfter as number, yearBefore as number] };
  } else if (Number.isFinite(yearAfter)) {
    where.year = { gte: yearAfter as number };
  } else if (Number.isFinite(yearBefore)) {
    where.year = { lte: yearBefore as number };
  }

  let queryEmbedding: number[] | null = null;
  if (term) {
    try {
      queryEmbedding = await embedText(env, term);
    } catch (err) {
      console.error("query embed failed", err);
    }
  }

  // Orama 3.x's `mode: "hybrid"` collapses to zero hits when the term is not
  // a literal title token even though the where filter and vector both have
  // matches. Pick the strongest single mode for the inputs:
  //   - vector + where (when we have an embedding) for semantic matching
  //   - fulltext + where (when we only have a term) for bare-title lookups
  //   - filter-only when there is no term at all.
  const params: Record<string, unknown> = { limit: 100, where };
  let mode: "vector" | "fulltext" | "filter" = "filter";
  if (queryEmbedding) {
    mode = "vector";
    params.mode = "vector";
    params.vector = { value: queryEmbedding, property: "embedding" };
    params.similarity = 0;
    if (term) params.term = term;
  } else if (term) {
    mode = "fulltext";
    params.term = term;
    params.properties = ["title", "overview"];
  } else {
    params.term = "";
    params.exact = false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (await search(cached.db, params as any)) as {
    hits: { id: string; score: number }[];
  };
  console.log(
    `[search] term="${term}" mode=${mode} where=${JSON.stringify(where)} cache_size=${cached.docs.size} raw_hits=${results.hits.length}`,
  );
  // Filter out exclude_genres in JS — Orama lacks a direct "containsNone".
  const exclude = new Set(f.exclude_genres ?? []);
  return results.hits
    .map((h) => {
      const id = Number(h.id);
      const doc = cached.docs.get(id);
      if (!doc) return null;
      if (exclude.size > 0 && doc.genres.some((g) => exclude.has(g))) {
        return null;
      }
      return { tmdb_id: id, score: h.score };
    })
    .filter((x): x is IndexHit => x !== null)
    .slice(0, 50);
}

export function clearIndexCache(userId?: string) {
  if (userId) CACHE.delete(userId);
  else CACHE.clear();
}
