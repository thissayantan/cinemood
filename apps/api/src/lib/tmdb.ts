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

// Episode/season shapes shared between detail and season-fetch output
export interface TmdbEpisodeSummary {
  air_date: string | null;
  episode_number: number;
  season_number: number;
  name: string | null;
  still_path: string | null;
  overview: string | null;
  runtime: number | null;
  vote_average: number | null;
}

export interface TmdbSeasonSummary {
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  overview: string | null;
}

export interface TmdbSeasonDetail {
  series_id: number;
  season_number: number;
  name: string;
  overview: string | null;
  air_date: string | null;
  poster_path: string | null;
  episodes: TmdbEpisodeSummary[];
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
  cast: { id: number; name: string; character?: string; profile_path?: string | null }[];
  keywords: string[];
  providers: Record<string, unknown> | null;
  imdb_id: string | null;
  raw: unknown;
  // Series-only episode/season metadata (null/undefined for movies)
  number_of_seasons?: number | null;
  number_of_episodes?: number | null;
  seasons?: TmdbSeasonSummary[] | null;
  next_episode_to_air?: TmdbEpisodeSummary | null;
  last_episode_to_air?: TmdbEpisodeSummary | null;
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
    cast?: { id: number; name: string; character?: string; order?: number; profile_path?: string | null }[];
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
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: Array<{
    season_number: number;
    name: string;
    episode_count: number;
    air_date: string | null;
    poster_path: string | null;
    overview: string | null;
  }>;
  next_episode_to_air?: {
    air_date: string | null;
    episode_number: number;
    season_number: number;
    name: string | null;
    still_path: string | null;
    overview: string | null;
    runtime: number | null;
    vote_average: number | null;
  } | null;
  last_episode_to_air?: {
    air_date: string | null;
    episode_number: number;
    season_number: number;
    name: string | null;
    still_path: string | null;
    overview: string | null;
    runtime: number | null;
    vote_average: number | null;
  } | null;
}

export async function fetchTmdbDetail(
  apiKey: string,
  cache: KVNamespace,
  type: TitleType,
  id: number,
  opts?: { force?: boolean },
): Promise<TmdbDetail> {
  const cacheKey = `tmdb:detail:${type}:${id}`;
  if (!opts?.force) {
    const cached = await cache.get(cacheKey, "json");
    if (cached) return cached as TmdbDetail;
  }

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
    .map((c) => ({ id: c.id, name: c.name, character: c.character, profile_path: c.profile_path ?? null }));

  // Normalise movie/tv shape differences (title vs name, release_date vs
  // first_air_date, runtime vs episode_run_time, keywords.keywords vs
  // keywords.results) into a single TmdbDetail.
  let title: string;
  let originalTitle: string | null;
  let releaseDate: string | null;
  let runtime: number | null;
  let keywords: string[];
  // Series-only episode metadata
  let numberOfSeasons: number | null = null;
  let numberOfEpisodes: number | null = null;
  let seasons: TmdbSeasonSummary[] | null = null;
  let nextEpisodeToAir: TmdbEpisodeSummary | null = null;
  let lastEpisodeToAir: TmdbEpisodeSummary | null = null;

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
    numberOfSeasons = t.number_of_seasons ?? null;
    numberOfEpisodes = t.number_of_episodes ?? null;
    seasons = (t.seasons ?? []).map((s) => ({
      season_number: s.season_number,
      name: s.name,
      episode_count: s.episode_count,
      air_date: s.air_date,
      poster_path: s.poster_path,
      overview: s.overview,
    }));
    const mapEp = (ep: NonNullable<TmdbTvDetail["next_episode_to_air"]> | null | undefined): TmdbEpisodeSummary | null => {
      if (!ep) return null;
      return {
        air_date: ep.air_date,
        episode_number: ep.episode_number,
        season_number: ep.season_number,
        name: ep.name,
        still_path: ep.still_path,
        overview: ep.overview,
        runtime: ep.runtime,
        vote_average: ep.vote_average,
      };
    };
    nextEpisodeToAir = mapEp(t.next_episode_to_air);
    lastEpisodeToAir = mapEp(t.last_episode_to_air);
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
    number_of_seasons: numberOfSeasons,
    number_of_episodes: numberOfEpisodes,
    seasons,
    next_episode_to_air: nextEpisodeToAir,
    last_episode_to_air: lastEpisodeToAir,
  };

  await kvPutSafe(cache, cacheKey, JSON.stringify(detail), {
    expirationTtl: DETAIL_TTL,
  });
  return detail;
}

// ── Person / Actor detail ─────────────────────────────────────────────────────

export interface TmdbPersonCredit {
  id: number;
  type: TitleType;
  title: string;
  poster_path: string | null;
  character: string | null;
  release_date: string | null;
  vote_average: number | null;
  popularity: number | null;
}

export interface TmdbPersonDetail {
  id: number;
  name: string;
  biography: string | null;
  profile_path: string | null;
  birthday: string | null;
  known_for_department: string | null;
  place_of_birth: string | null;
  credits: TmdbPersonCredit[];
}

interface TmdbPersonRaw {
  id: number;
  name: string;
  biography: string | null;
  profile_path: string | null;
  birthday: string | null;
  known_for_department: string | null;
  place_of_birth: string | null;
  combined_credits?: {
    cast?: Array<{
      id: number;
      media_type: string;
      title?: string;
      name?: string;
      poster_path?: string | null;
      character?: string;
      release_date?: string;
      first_air_date?: string;
      vote_average?: number;
      popularity?: number;
    }>;
  };
}

export async function getPersonDetail(
  apiKey: string,
  cache: KVNamespace,
  personId: number,
): Promise<TmdbPersonDetail> {
  const cacheKey = `tmdb:person:${personId}`;
  const cached = await cache.get(cacheKey, "json");
  if (cached) return cached as TmdbPersonDetail;

  const url = new URL(`${TMDB_BASE}/person/${personId}`);
  url.searchParams.set("append_to_response", "combined_credits");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`tmdb_person_failed: ${personId} ${res.status}`);
  }
  const json = (await res.json()) as TmdbPersonRaw;

  // Build credits: dedupe by id, sort by popularity desc, cap at 20
  const seen = new Set<number>();
  const credits: TmdbPersonCredit[] = [];
  const rawCast = json.combined_credits?.cast ?? [];
  rawCast
    .filter((c) => c.media_type === "movie" || c.media_type === "tv")
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .forEach((c) => {
      if (seen.has(c.id)) return;
      seen.add(c.id);
      if (credits.length < 20) {
        credits.push({
          id: c.id,
          type: c.media_type === "movie" ? "movie" : "series",
          title: c.title ?? c.name ?? "",
          poster_path: c.poster_path ?? null,
          character: c.character ?? null,
          release_date: c.release_date ?? c.first_air_date ?? null,
          vote_average: c.vote_average ?? null,
          popularity: c.popularity ?? null,
        });
      }
    });

  const detail: TmdbPersonDetail = {
    id: json.id,
    name: json.name,
    biography: json.biography ?? null,
    profile_path: json.profile_path ?? null,
    birthday: json.birthday ?? null,
    known_for_department: json.known_for_department ?? null,
    place_of_birth: json.place_of_birth ?? null,
    credits,
  };

  await kvPutSafe(cache, cacheKey, JSON.stringify(detail), {
    expirationTtl: DETAIL_TTL,
  });
  return detail;
}

// ── Season episode list ───────────────────────────────────────────────────────

interface TmdbSeasonRaw {
  id: number;
  name: string;
  season_number: number;
  air_date: string | null;
  overview: string | null;
  poster_path: string | null;
  episodes?: Array<{
    id: number;
    episode_number: number;
    season_number: number;
    name: string | null;
    overview: string | null;
    still_path: string | null;
    air_date: string | null;
    runtime: number | null;
    vote_average: number | null;
  }>;
}

export async function fetchTmdbSeason(
  apiKey: string,
  cache: KVNamespace,
  seriesId: number,
  seasonNumber: number,
): Promise<TmdbSeasonDetail> {
  const cacheKey = `tmdb:season:${seriesId}:${seasonNumber}`;
  const cached = await cache.get(cacheKey, "json");
  if (cached) return cached as TmdbSeasonDetail;

  const url = new URL(`${TMDB_BASE}/tv/${seriesId}/season/${seasonNumber}`);
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`tmdb_season_failed: ${seriesId}/season/${seasonNumber} ${res.status}`);
  }
  const json = (await res.json()) as TmdbSeasonRaw;

  const detail: TmdbSeasonDetail = {
    series_id: seriesId,
    season_number: json.season_number,
    name: json.name,
    overview: json.overview ?? null,
    air_date: json.air_date ?? null,
    poster_path: json.poster_path ?? null,
    episodes: (json.episodes ?? []).map((ep) => ({
      air_date: ep.air_date ?? null,
      episode_number: ep.episode_number,
      season_number: ep.season_number,
      name: ep.name ?? null,
      still_path: ep.still_path ?? null,
      overview: ep.overview ?? null,
      runtime: ep.runtime ?? null,
      vote_average: ep.vote_average ?? null,
    })),
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
