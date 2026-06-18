import type { ParsedQuery, TitleType } from "@cinemood/shared";
import { kvPutSafe } from "./kv-safe";

const TMDB_BASE = "https://api.themoviedb.org/3";
const SEARCH_TTL = 60 * 60 * 24; // 1 day
const DETAIL_TTL = 60 * 60 * 24 * 7; // 7 days
const DISCOVER_TTL = 60 * 60 * 24; // 1 day

// ── Genre name → TMDB genre id maps ──────────────────────────────────────────
// The LLM parser emits canonical TMDB genre names (e.g. "Science Fiction",
// "Action"). These maps translate them to numeric IDs for the /discover API.
// Movie and TV use different genre systems for several genres.

const MOVIE_GENRE_IDS: Record<string, number> = {
  "Action": 28,
  "Adventure": 12,
  "Animation": 16,
  "Comedy": 35,
  "Crime": 80,
  "Documentary": 99,
  "Drama": 18,
  "Family": 10751,
  "Fantasy": 14,
  "History": 36,
  "Horror": 27,
  "Music": 10402,
  "Musical": 10402,
  "Mystery": 9648,
  "Romance": 10749,
  "Science Fiction": 878,
  "Sci-Fi": 878,
  "Thriller": 53,
  "War": 10752,
  "Western": 37,
};

const TV_GENRE_IDS: Record<string, number> = {
  "Action": 10759,
  "Action & Adventure": 10759,
  "Adventure": 10759,
  "Animation": 16,
  "Comedy": 35,
  "Crime": 80,
  "Documentary": 99,
  "Drama": 18,
  "Family": 10751,
  "Kids": 10762,
  "Mystery": 9648,
  "Reality": 10764,
  "Science Fiction": 10765,
  "Sci-Fi & Fantasy": 10765,
  "Sci-Fi": 10765,
  "War": 10768,
  "War & Politics": 10768,
  "Western": 37,
};

function resolveGenreIds(
  genres: string[],
  map: Record<string, number>,
): number[] {
  const ids = new Set<number>();
  for (const g of genres) {
    const id = map[g];
    if (id != null) ids.add(id);
  }
  return [...ids];
}

interface TmdbSearchMovie {
  id: number;
  media_type: "movie";
  title: string;
  original_title: string | null;
  release_date: string | null;
  poster_path: string | null;
  overview: string | null;
  vote_average: number | null;
  vote_count: number | null;
  popularity?: number;
}

interface TmdbSearchTv {
  id: number;
  media_type: "tv";
  name: string;
  original_name: string | null;
  first_air_date: string | null;
  poster_path: string | null;
  overview: string | null;
  vote_average: number | null;
  vote_count: number | null;
  popularity?: number;
}

interface TmdbSearchPerson {
  id: number;
  media_type: "person";
}

type TmdbSearchHit = TmdbSearchMovie | TmdbSearchTv | TmdbSearchPerson;

interface TmdbSearchResponse {
  results: TmdbSearchHit[];
}

export interface TmdbSearchResult {
  id: number;
  type: TitleType;
  title: string;
  release_date: string | null;
  poster_path: string | null;
  overview: string | null;
  vote_average: number | null;
}

export async function searchTmdb(
  apiKey: string,
  cache: KVNamespace,
  query: string,
): Promise<TmdbSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const cacheKey = `tmdb:search:${trimmed.toLowerCase()}`;
  const cached = await cache.get(cacheKey, "json");
  if (cached) return cached as TmdbSearchResult[];

  const url = new URL(`${TMDB_BASE}/search/multi`);
  url.searchParams.set("query", trimmed);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`tmdb_search_failed: ${res.status}`);
  }
  const json = (await res.json()) as TmdbSearchResponse;

  const results: TmdbSearchResult[] = json.results
    .filter(
      (r): r is TmdbSearchMovie | TmdbSearchTv =>
        r.media_type === "movie" || r.media_type === "tv",
    )
    .map((r) => {
      if (r.media_type === "movie") {
        return {
          id: r.id,
          type: "movie" as const,
          title: r.title,
          release_date: r.release_date ?? null,
          poster_path: r.poster_path,
          overview: r.overview,
          vote_average: r.vote_average,
        };
      }
      return {
        id: r.id,
        type: "series" as const,
        title: r.name,
        release_date: r.first_air_date ?? null,
        poster_path: r.poster_path,
        overview: r.overview,
        vote_average: r.vote_average,
      };
    })
    .slice(0, 20);

  await kvPutSafe(cache, cacheKey, JSON.stringify(results), {
    expirationTtl: SEARCH_TTL,
  });
  return results;
}

export interface TmdbDetail {
  id: number;
  type: TitleType;
  title: string;
  original_title: string | null;
  overview: string | null;
  release_date: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number | null;
  vote_count: number | null;
  runtime: number | null;
  genres: string[];
  cast: { name: string; character?: string; profile_path?: string | null }[];
  keywords: string[];
  providers: Record<string, unknown> | null;
  imdb_id: string | null;
  raw: unknown;
}

interface TmdbCommonDetail {
  id: number;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number | null;
  vote_count: number | null;
  genres?: { id: number; name: string }[];
  credits?: {
    cast?: { name: string; character?: string; order?: number; profile_path?: string | null }[];
  };
  keywords?: {
    keywords?: { name: string }[];
    results?: { name: string }[];
  };
  "watch/providers"?: { results: Record<string, unknown> };
  external_ids?: { imdb_id?: string | null };
  imdb_id?: string | null;
}

interface TmdbMovieDetail extends TmdbCommonDetail {
  title: string;
  original_title: string | null;
  release_date: string | null;
  runtime: number | null;
}

interface TmdbTvDetail extends TmdbCommonDetail {
  name: string;
  original_name: string | null;
  first_air_date: string | null;
  episode_run_time?: number[];
}

export async function fetchTmdbDetail(
  apiKey: string,
  cache: KVNamespace,
  type: TitleType,
  id: number,
): Promise<TmdbDetail> {
  const cacheKey = `tmdb:detail:${type}:${id}`;
  const cached = await cache.get(cacheKey, "json");
  if (cached) return cached as TmdbDetail;

  const path = type === "movie" ? "movie" : "tv";
  const url = new URL(`${TMDB_BASE}/${path}/${id}`);
  url.searchParams.set(
    "append_to_response",
    "credits,keywords,watch/providers,external_ids",
  );
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`tmdb_detail_failed: ${type}/${id} ${res.status}`);
  }
  const json = (await res.json()) as TmdbMovieDetail | TmdbTvDetail;

  const cast = (json.credits?.cast ?? [])
    .slice()
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .slice(0, 10)
    .map((c) => ({ name: c.name, character: c.character, profile_path: c.profile_path ?? null }));

  // Normalise movie/tv shape differences (title vs name, release_date vs
  // first_air_date, runtime vs episode_run_time, keywords.keywords vs
  // keywords.results) into a single TmdbDetail.
  let title: string;
  let originalTitle: string | null;
  let releaseDate: string | null;
  let runtime: number | null;
  let keywords: string[];
  if (type === "movie") {
    const m = json as TmdbMovieDetail;
    title = m.title;
    originalTitle = m.original_title;
    releaseDate = m.release_date;
    runtime = m.runtime;
    keywords = (m.keywords?.keywords ?? []).map((k) => k.name);
  } else {
    const t = json as TmdbTvDetail;
    title = t.name;
    originalTitle = t.original_name;
    releaseDate = t.first_air_date;
    runtime = t.episode_run_time?.[0] ?? null;
    keywords = (t.keywords?.results ?? []).map((k) => k.name);
  }

  const detail: TmdbDetail = {
    id: json.id,
    type,
    title,
    original_title: originalTitle,
    overview: json.overview,
    release_date: releaseDate,
    poster_path: json.poster_path,
    backdrop_path: json.backdrop_path,
    vote_average: json.vote_average,
    vote_count: json.vote_count,
    runtime,
    genres: (json.genres ?? []).map((g) => g.name),
    cast,
    keywords,
    providers: json["watch/providers"]?.results ?? null,
    imdb_id: json.external_ids?.imdb_id ?? json.imdb_id ?? null,
    raw: json,
  };

  await kvPutSafe(cache, cacheKey, JSON.stringify(detail), {
    expirationTtl: DETAIL_TTL,
  });
  return detail;
}

// ── discoverTmdb ──────────────────────────────────────────────────────────────
// Translates a ParsedQuery (from the LLM parser) into TMDB /discover results.
// If the query has structural filters (genres, type, rating, date range), it
// uses /discover/movie and/or /discover/tv for precise results.
// For pure keyword/semantic queries it falls back to /search/multi.
// Returns up to 20 results merged and deduped, sorted by popularity.

interface TmdbDiscoverResponse {
  results: Array<{
    id: number;
    title?: string;          // movie
    name?: string;           // tv
    release_date?: string;   // movie
    first_air_date?: string; // tv
    poster_path: string | null;
    overview: string | null;
    vote_average: number | null;
  }>;
}

export async function discoverTmdb(
  apiKey: string,
  cache: KVNamespace,
  parsed: ParsedQuery,
): Promise<TmdbSearchResult[]> {
  const f = parsed.filters;
  const hasStructure = Boolean(
    (f.genres && f.genres.length > 0) ||
    (f.type && f.type.length > 0) ||
    typeof f.min_rating === "number" ||
    f.release_after ||
    f.release_before,
  );

  // Pure keyword/semantic → fall back to /search/multi
  if (!hasStructure) {
    const q = parsed.semantic_query || "";
    if (!q.trim()) return [];
    return searchTmdb(apiKey, cache, q);
  }

  // Build a stable cache key from all relevant filter params
  const cacheKey = `tmdb:discover:${JSON.stringify({
    genres: (f.genres ?? []).slice().sort(),
    type: (f.type ?? []).slice().sort(),
    min_rating: f.min_rating ?? null,
    max_rating: f.max_rating ?? null,
    after: f.release_after ?? null,
    before: f.release_before ?? null,
  })}`;

  const cached = await cache.get(cacheKey, "json");
  if (cached) return cached as TmdbSearchResult[];

  // Determine which endpoints to call based on type filter
  const types: TitleType[] =
    f.type && f.type.length > 0
      ? (f.type as TitleType[])
      : ["movie", "series"];

  const results: TmdbSearchResult[] = [];

  for (const mediaType of types) {
    const endpoint = mediaType === "movie" ? "movie" : "tv";
    const url = new URL(`${TMDB_BASE}/discover/${endpoint}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("sort_by", "popularity.desc");
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("page", "1");

    // Genre filter
    if (f.genres && f.genres.length > 0) {
      const genreMap = mediaType === "movie" ? MOVIE_GENRE_IDS : TV_GENRE_IDS;
      const ids = resolveGenreIds(f.genres, genreMap);
      if (ids.length > 0) {
        url.searchParams.set("with_genres", ids.join(","));
      }
    }

    // Rating filter
    if (typeof f.min_rating === "number" && f.min_rating > 0) {
      url.searchParams.set("vote_average.gte", String(f.min_rating));
      // Require a minimum number of votes to avoid obscure low-vote titles
      url.searchParams.set("vote_count.gte", "100");
    }
    if (typeof f.max_rating === "number") {
      url.searchParams.set("vote_average.lte", String(f.max_rating));
    }

    // Date range filter
    if (f.release_after) {
      const d = f.release_after.length === 4
        ? `${f.release_after}-01-01`
        : f.release_after;
      if (mediaType === "movie") {
        url.searchParams.set("primary_release_date.gte", d);
      } else {
        url.searchParams.set("first_air_date.gte", d);
      }
    }
    if (f.release_before) {
      const d = f.release_before.length === 4
        ? `${f.release_before}-12-31`
        : f.release_before;
      if (mediaType === "movie") {
        url.searchParams.set("primary_release_date.lte", d);
      } else {
        url.searchParams.set("first_air_date.lte", d);
      }
    }

    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      console.warn(`tmdb_discover_${endpoint}_failed: ${res.status}`);
      continue;
    }
    const json = (await res.json()) as TmdbDiscoverResponse;

    for (const r of json.results.slice(0, 12)) {
      results.push({
        id: r.id,
        type: mediaType,
        title: r.title ?? r.name ?? "",
        release_date: r.release_date ?? r.first_air_date ?? null,
        poster_path: r.poster_path,
        overview: r.overview,
        vote_average: r.vote_average,
      });
    }
  }

  // Dedup by id (shouldn't happen but defensive)
  const seen = new Set<number>();
  const deduped = results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  const final = deduped.slice(0, 20);

  await kvPutSafe(cache, cacheKey, JSON.stringify(final), {
    expirationTtl: DISCOVER_TTL,
  });

  return final;
}
