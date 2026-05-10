import type { Title, TitleType } from "@cinemood/shared";
import type { TmdbDetail } from "../lib/tmdb";

export async function upsertTitle(
  db: D1Database,
  detail: TmdbDetail,
  imdbRating: number | null,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO titles (
        id, type, title, original_title, overview, release_date,
        poster_path, backdrop_path, vote_average, vote_count, runtime,
        genres, cast_json, keywords, providers, imdb_id, imdb_rating,
        raw_tmdb, fetched_at
      ) VALUES (
        ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
        ?15, ?16, ?17, ?18, ?19
      )
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        title = excluded.title,
        original_title = excluded.original_title,
        overview = excluded.overview,
        release_date = excluded.release_date,
        poster_path = excluded.poster_path,
        backdrop_path = excluded.backdrop_path,
        vote_average = excluded.vote_average,
        vote_count = excluded.vote_count,
        runtime = excluded.runtime,
        genres = excluded.genres,
        cast_json = excluded.cast_json,
        keywords = excluded.keywords,
        providers = excluded.providers,
        imdb_id = excluded.imdb_id,
        imdb_rating = COALESCE(excluded.imdb_rating, titles.imdb_rating),
        raw_tmdb = excluded.raw_tmdb,
        fetched_at = excluded.fetched_at`,
    )
    .bind(
      detail.id,
      detail.type,
      detail.title,
      detail.original_title,
      detail.overview,
      detail.release_date,
      detail.poster_path,
      detail.backdrop_path,
      detail.vote_average,
      detail.vote_count,
      detail.runtime,
      JSON.stringify(detail.genres),
      JSON.stringify(detail.cast),
      JSON.stringify(detail.keywords),
      detail.providers ? JSON.stringify(detail.providers) : null,
      detail.imdb_id,
      imdbRating,
      JSON.stringify(detail.raw),
      now,
    )
    .run();
}

interface TitleRow {
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
  genres: string | null;
  cast_json: string | null;
  keywords: string | null;
  providers: string | null;
  imdb_id: string | null;
  imdb_rating: number | null;
}

export function rowToTitle(row: TitleRow): Title {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    original_title: row.original_title,
    overview: row.overview,
    release_date: row.release_date,
    poster_path: row.poster_path,
    backdrop_path: row.backdrop_path,
    vote_average: row.vote_average,
    vote_count: row.vote_count,
    runtime: row.runtime,
    genres: parseJsonArray(row.genres),
    cast: parseJsonArray(row.cast_json),
    keywords: parseJsonArray(row.keywords),
    providers: row.providers
      ? (JSON.parse(row.providers) as Record<string, unknown>)
      : null,
    imdb_id: row.imdb_id,
    imdb_rating: row.imdb_rating,
  };
}

function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

export async function getTitle(
  db: D1Database,
  id: number,
): Promise<Title | null> {
  const row = await db
    .prepare(
      `SELECT id, type, title, original_title, overview, release_date,
              poster_path, backdrop_path, vote_average, vote_count, runtime,
              genres, cast_json, keywords, providers, imdb_id, imdb_rating
         FROM titles WHERE id = ?1`,
    )
    .bind(id)
    .first<TitleRow>();
  return row ? rowToTitle(row) : null;
}

export type { TitleRow };
