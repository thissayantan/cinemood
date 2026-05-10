import type { User } from "@cinemood/shared";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  created_at: number;
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
