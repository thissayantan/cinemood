import type { TitleType } from "@cinemood/shared";

const TMDB_BASE = "https://api.themoviedb.org/3";
const SEARCH_TTL = 60 * 60 * 24; // 1 day
const DETAIL_TTL = 60 * 60 * 24 * 7; // 7 days

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

  await cache.put(cacheKey, JSON.stringify(results), {
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
  cast: { name: string; character?: string }[];
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
    cast?: { name: string; character?: string; order?: number }[];
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
    .map((c) => ({ name: c.name, character: c.character }));

  const keywords =
    type === "movie"
      ? (json.keywords?.keywords ?? []).map((k) => k.name)
      : (json.keywords?.results ?? []).map((k) => k.name);

  const detail: TmdbDetail = {
    id: json.id,
    type,
    title:
      type === "movie"
        ? (json as TmdbMovieDetail).title
        : (json as TmdbTvDetail).name,
    original_title:
      type === "movie"
        ? (json as TmdbMovieDetail).original_title
        : (json as TmdbTvDetail).original_name,
    overview: json.overview,
    release_date:
      type === "movie"
        ? (json as TmdbMovieDetail).release_date
        : (json as TmdbTvDetail).first_air_date,
    poster_path: json.poster_path,
    backdrop_path: json.backdrop_path,
    vote_average: json.vote_average,
    vote_count: json.vote_count,
    runtime:
      type === "movie"
        ? (json as TmdbMovieDetail).runtime
        : ((json as TmdbTvDetail).episode_run_time?.[0] ?? null),
    genres: (json.genres ?? []).map((g) => g.name),
    cast,
    keywords,
    providers: json["watch/providers"]?.results ?? null,
    imdb_id: json.external_ids?.imdb_id ?? json.imdb_id ?? null,
    raw: json,
  };

  await cache.put(cacheKey, JSON.stringify(detail), {
    expirationTtl: DETAIL_TTL,
  });
  return detail;
}
