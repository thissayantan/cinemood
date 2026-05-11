import type { User } from "@cinemood/shared";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: number;
  min_issued_at?: number;
}

export async function upsertUser(
  db: D1Database,
  user: { id: string; email: string; name: string | null; picture: string | null },
): Promise<User> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(
      `INSERT INTO users (id, email, name, picture, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         picture = excluded.picture`,
    )
    .bind(user.id, user.email, user.name, user.picture, now)
    .run();
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
  };
}

export async function getUser(
  db: D1Database,
  id: string,
): Promise<User | null> {
  const row = await db
    .prepare(`SELECT id, email, name, picture, created_at FROM users WHERE id = ?1`)
    .bind(id)
    .first<UserRow>();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
  };
}

/** Same as getUser, but also returns the session revocation watermark
 *  (`min_issued_at`). Used by the auth middleware to enforce
 *  "sign me out everywhere" — sessions whose payload `issuedAt` is
 *  strictly less than this watermark are rejected even with a valid
 *  signature. Kept separate from getUser so the public User type
 *  doesn't carry auth internals. */
export async function getUserForAuth(
  db: D1Database,
  id: string,
): Promise<{ user: User; minIssuedAt: number } | null> {
  const row = await db
    .prepare(
      `SELECT id, email, name, picture, created_at, min_issued_at
         FROM users WHERE id = ?1`,
    )
    .bind(id)
    .first<UserRow>();
  if (!row) return null;
  return {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      picture: row.picture,
    },
    minIssuedAt: row.min_issued_at ?? 0,
  };
}

/** Bump the user's revocation watermark to "now". Every previously-
 *  issued session token (regardless of its expiresAt) is invalid from
 *  this point on — the user has to sign in again on every device. */
export async function revokeAllSessions(
  db: D1Database,
  id: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare(`UPDATE users SET min_issued_at = ?2 WHERE id = ?1`)
    .bind(id, now)
    .run();
}
