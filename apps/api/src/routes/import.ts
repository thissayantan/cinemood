import { Hono, type Context } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import { resolveBatch } from "../lib/import-resolve";
import { fetchTmdbDetail, type TmdbDetail } from "../lib/tmdb";
import { fetchOmdbRating } from "../lib/omdb";
import { getTitlesById, upsertTitleStmt } from "../db/titles";
import { addManyToWatchlist, listWatchlistTitleIds } from "../db/watchlist";
import { addTitlesToIndex } from "../lib/orama-index";

type Ctx = Context<{ Bindings: Env; Variables: AuthVars }>;

function authError(c: Ctx) {
  return c.json(
    { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required" } },
    401,
  );
}

function validationError(c: Ctx, message: string) {
  return c.json(
    { ok: false, error: { code: "VALIDATION", message } },
    400,
  );
}

async function readJsonBody(c: Ctx): Promise<unknown | Response> {
  try {
    return await c.req.json();
  } catch {
    return validationError(c, "Invalid JSON");
  }
}

const TITLE_FRESH_SECONDS = 60 * 60 * 24 * 7; // 7 days — same as KV detail TTL

const ResolveBody = z.object({
  items: z
    .array(
      z.object({
        raw: z.string().min(1).max(400),
        title: z.string().min(1).max(300),
        year: z.number().int().min(1880).max(2100).optional(),
        type: z.enum(["movie", "series"]).optional(),
      }),
    )
    .min(1)
    .max(500),
});

const CommitBody = z.object({
  items: z
    .array(
      z.object({
        tmdb_id: z.coerce.number().int().positive(),
        type: z.enum(["movie", "series"]),
      }),
    )
    .min(1)
    .max(500),
});

interface CommitOutcome {
  tmdb_id: number;
  type: "movie" | "series";
  ok: boolean;
  /** True iff the row actually went into the watchlist on this call.
   *  False when ON CONFLICT DO NOTHING fired (already in catalog) — lets
   *  the UI honestly report "X added · Y were already there" instead of
   *  the old behaviour where every duplicate counted as a "success". */
  inserted?: boolean;
  error?: string;
}

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

app.post("/api/import/resolve", async (c) => {
  const user = c.get("user");
  if (!user) return authError(c);
  const body = await readJsonBody(c);
  if (body instanceof Response) return body;
  const parsed = ResolveBody.safeParse(body);
  if (!parsed.success) return validationError(c, parsed.error.message);
  const resolved = await resolveBatch(c.env, parsed.data.items);
  // Server-side "already in catalog" tagging so the FE doesn't race a
  // parallel watchlist-ids fetch against the resolve POST. Cheap query —
  // one indexed SELECT for the whole user.
  const existing = new Set(await listWatchlistTitleIds(c.env.DB, user.id));
  for (const r of resolved) {
    if (r.best && existing.has(r.best.id)) r.in_catalog = true;
  }
  return c.json({ ok: true, data: { resolved } });
});

app.post("/api/import/commit", async (c) => {
  const user = c.get("user");
  if (!user) return authError(c);
  const body = await readJsonBody(c);
  if (body instanceof Response) return body;
  const parsed = CommitBody.safeParse(body);
  if (!parsed.success) return validationError(c, parsed.error.message);

  // The naive per-item pipeline (TMDB → OMDB → D1 upsert → D1 catalog query
  // → D1 watchlist insert → D1 read → waitUntil(addTitleToIndex)) blew the
  // Worker's per-invocation subrequest cap on real Takeout imports of
  // 200+ items. New shape:
  //   1. Skip TMDB/OMDB for items already cached in titles (≤7d old).
  //   2. Fan out remaining TMDB+OMDB fetches with concurrency 8.
  //   3. Batch every D1 write (title upserts + watchlist inserts) in a
  //      single env.DB.batch() round-trip.
  //   4. Schedule ONE addTitlesToIndex(allTitles) via waitUntil — one
  //      Workers AI embed for the whole batch + one R2 persist instead
  //      of N serialised mutations.

  const now = Math.floor(Date.now() / 1000);
  const items = parsed.data.items;
  console.log("[import.commit]", {
    user: user.id,
    chunkSize: items.length,
    ids: items.map((i) => i.tmdb_id),
  });
  const outcomes: CommitOutcome[] = items.map((it) => ({
    tmdb_id: it.tmdb_id,
    type: it.type,
    ok: false,
  }));

  // (1) Which items already have a fresh titles row?
  const existing = await getTitlesById(
    c.env.DB,
    items.map((i) => i.tmdb_id),
  );
  const toFetch: typeof items = [];
  // Track full Title objects we'll hand to the index step.
  const titlesByTmdbId = new Map<number, import("@cinemood/shared").Title>();
  for (const item of items) {
    const cached = existing.get(item.tmdb_id);
    if (cached && now - cached.fetched_at < TITLE_FRESH_SECONDS) {
      titlesByTmdbId.set(item.tmdb_id, cached.title);
    } else {
      toFetch.push(item);
    }
  }

  // (2) Parallel TMDB detail + OMDB rating with concurrency 8.
  interface Fetched {
    item: (typeof items)[number];
    detail: TmdbDetail;
    imdbRating: number | null;
  }
  const fetched: Fetched[] = [];
  const failed = new Set<number>();
  if (toFetch.length > 0) {
    const queue = toFetch.slice();
    const concurrency = Math.min(8, queue.length);
    async function worker() {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) return;
        try {
          const detail = await fetchTmdbDetail(
            c.env.TMDB_API_KEY,
            c.env.CACHE,
            item.type,
            item.tmdb_id,
          );
          const imdbRating = detail.imdb_id
            ? await fetchOmdbRating(c.env.OMDB_API_KEY, c.env.CACHE, detail.imdb_id)
            : null;
          fetched.push({ item, detail, imdbRating });
        } catch (err) {
          console.error("commit fetch failed", item.tmdb_id, err);
          failed.add(item.tmdb_id);
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  }

  // (3) Batched D1 writes: title upserts in one round-trip, watchlist
  //     inserts in another (catalog_no is pre-allocated in addManyToWatchlist).
  //     Then re-read the freshly-upserted rows so the index step gets
  //     fully hydrated Title objects (cast/keywords/providers parsed).
  if (fetched.length > 0) {
    const stmts = fetched.map((f) =>
      upsertTitleStmt(c.env.DB, f.detail, f.imdbRating),
    );
    await c.env.DB.batch(stmts);

    const fresh = await getTitlesById(
      c.env.DB,
      fetched.map((f) => f.item.tmdb_id),
    );
    for (const f of fetched) {
      const row = fresh.get(f.item.tmdb_id);
      if (row) titlesByTmdbId.set(f.item.tmdb_id, row.title);
    }
  }

  const successfulIds: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (failed.has(item.tmdb_id)) {
      outcomes[i] = { tmdb_id: item.tmdb_id, type: item.type, ok: false, error: "fetch_failed" };
    } else if (titlesByTmdbId.has(item.tmdb_id)) {
      outcomes[i] = { tmdb_id: item.tmdb_id, type: item.type, ok: true };
      successfulIds.push(item.tmdb_id);
    } else {
      outcomes[i] = { tmdb_id: item.tmdb_id, type: item.type, ok: false, error: "missing_title" };
    }
  }

  if (successfulIds.length > 0) {
    const insertedIds = await addManyToWatchlist(
      c.env.DB,
      user.id,
      successfulIds,
    );
    const insertedSet = new Set(insertedIds);
    console.log("[import.commit] inserts", {
      user: user.id,
      requested: successfulIds.length,
      inserted: insertedIds.length,
      skipped: successfulIds.length - insertedIds.length,
      failed: items.length - successfulIds.length,
    });
    // Annotate per-item `inserted` so the UI can distinguish "added" from
    // "already in catalog" (the latter still returns ok:true because the
    // title row itself was upserted successfully, just no new watchlist
    // row was created).
    for (let i = 0; i < outcomes.length; i++) {
      const o = outcomes[i]!;
      if (o.ok) o.inserted = insertedSet.has(o.tmdb_id);
    }

    // Only index the freshly-inserted titles — re-indexing an already-
    // -present title wastes the Workers AI embed budget.
    const titlesForIndex = insertedIds
      .map((id) => titlesByTmdbId.get(id))
      .filter((t): t is import("@cinemood/shared").Title => Boolean(t));
    if (titlesForIndex.length > 0) {
      c.executionCtx.waitUntil(
        addTitlesToIndex(c.env, user.id, titlesForIndex).catch((err) => {
          console.error("import batch index add failed", err);
        }),
      );
    }
  }

  return c.json({ ok: true, data: { outcomes } });
});

export default app;
