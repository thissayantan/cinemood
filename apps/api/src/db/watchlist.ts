import type { WatchStatus, WatchlistItem } from "@cinemood/shared";
import { rowToTitle, type TitleRow } from "./titles";

interface WatchlistRow extends TitleRow {
  status: WatchStatus;
  added_at: number;
  watched_at: number | null;
  notes: string | null;
}

const SELECT_BASE = `
  SELECT t.id, t.type, t.title, t.original_title, t.overview, t.release_date,
         t.poster_path, t.backdrop_path, t.vote_average, t.vote_count, t.runtime,
         t.genres, t.cast_json, t.keywords, t.providers, t.imdb_id, t.imdb_rating,
         w.status, w.added_at, w.watched_at, w.notes
    FROM watchlist w
    INNER JOIN titles t ON t.id = w.title_id
   WHERE w.user_id = ?1`;

export async function listWatchlist(
  db: D1Database,
  userId: string,
  filters: {
    status?: WatchStatus;
    type?: "movie" | "series";
    genre?: string;
    year?: string;
  } = {},
): Promise<WatchlistItem[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [userId];
  if (filters.status) {
    clauses.push(`AND w.status = ?${binds.length + 1}`);
    binds.push(filters.status);
  }
  if (filters.type) {
    clauses.push(`AND t.type = ?${binds.length + 1}`);
    binds.push(filters.type);
  }
  if (filters.year) {
    clauses.push(`AND substr(t.release_date, 1, 4) = ?${binds.length + 1}`);
    binds.push(filters.year);
  }
  if (filters.genre) {
    clauses.push(`AND t.genres LIKE ?${binds.length + 1}`);
    binds.push(`%"${filters.genre}"%`);
  }

  const sql = `${SELECT_BASE} ${clauses.join(" ")} ORDER BY w.added_at DESC LIMIT 500`;
  const result = await db
    .prepare(sql)
    .bind(...binds)
    .all<WatchlistRow>();

  return (result.results ?? []).map((row) => ({
    title: rowToTitle(row),
    status: row.status,
    added_at: row.added_at,
    watched_at: row.watched_at,
    notes: row.notes,
  }));
}

export async function getWatchlistItem(
  db: D1Database,
  userId: string,
  titleId: number,
): Promise<WatchlistItem | null> {
  const row = await db
    .prepare(`${SELECT_BASE} AND w.title_id = ?2 LIMIT 1`)
    .bind(userId, titleId)
    .first<WatchlistRow>();
  if (!row) return null;
  return {
    title: rowToTitle(row),
    status: row.status,
    added_at: row.added_at,
    watched_at: row.watched_at,
    notes: row.notes,
  };
}

export async function addToWatchlist(
  db: D1Database,
  userId: string,
  titleId: number,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO watchlist (user_id, title_id, status, added_at)
       VALUES (?1, ?2, 'pending', ?3)
       ON CONFLICT(user_id, title_id) DO NOTHING`,
    )
    .bind(userId, titleId, now)
    .run();
}

export async function removeFromWatchlist(
  db: D1Database,
  userId: string,
  titleId: number,
): Promise<void> {
  await db
    .prepare(`DELETE FROM watchlist WHERE user_id = ?1 AND title_id = ?2`)
    .bind(userId, titleId)
    .run();
}

export async function setWatchlistStatus(
  db: D1Database,
  userId: string,
  titleId: number,
  status: WatchStatus,
): Promise<void> {
  const watchedAt = status === "watched" ? Math.floor(Date.now() / 1000) : null;
  await db
    .prepare(
      `UPDATE watchlist
          SET status = ?3,
              watched_at = ?4
        WHERE user_id = ?1 AND title_id = ?2`,
    )
    .bind(userId, titleId, status, watchedAt)
    .run();
}

export async function listWatchlistTitleIds(
  db: D1Database,
  userId: string,
): Promise<number[]> {
  const result = await db
    .prepare(`SELECT title_id FROM watchlist WHERE user_id = ?1`)
    .bind(userId)
    .all<{ title_id: number }>();
  return (result.results ?? []).map((r) => r.title_id);
}
