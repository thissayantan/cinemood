/**
 * access-tokens.ts — D1 CRUD for the access_tokens table.
 *
 * Important: `listAccessTokens` and `createAccessToken` never return the
 * `token_hash` column — only the public fields defined in AccessTokenPublic.
 * The raw token is handled exclusively in routes/tokens.ts.
 */
import type { AccessTokenPublic } from "@cinemood/shared";

interface TokenRow {
  id: string;
  user_id: string;
  name: string;
  prefix: string;
  created_at: number;
  last_used_at: number | null;
  expires_at: number | null;
}

function rowToPublic(row: TokenRow): AccessTokenPublic {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
  };
}

export async function createAccessToken(
  db: D1Database,
  token: {
    id: string;
    userId: string;
    name: string;
    tokenHash: string;
    prefix: string;
    createdAt: number;
    expiresAt: number | null;
  },
): Promise<AccessTokenPublic> {
  await db
    .prepare(
      `INSERT INTO access_tokens (id, user_id, name, token_hash, prefix, created_at, last_used_at, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7)`,
    )
    .bind(
      token.id,
      token.userId,
      token.name,
      token.tokenHash,
      token.prefix,
      token.createdAt,
      token.expiresAt,
    )
    .run();

  return {
    id: token.id,
    name: token.name,
    prefix: token.prefix,
    created_at: token.createdAt,
    last_used_at: null,
    expires_at: token.expiresAt,
  };
}

export async function listAccessTokens(
  db: D1Database,
  userId: string,
): Promise<AccessTokenPublic[]> {
  const rows = await db
    .prepare(
      `SELECT id, user_id, name, prefix, created_at, last_used_at, expires_at
       FROM access_tokens
       WHERE user_id = ?1
       ORDER BY created_at DESC`,
    )
    .bind(userId)
    .all<TokenRow>();
  return (rows.results ?? []).map(rowToPublic);
}

/** Used by auth middleware — includes token_hash + user fields for validation. */
export interface TokenAuthRow {
  userId: string;
  minIssuedAt: number;
  user: import("@cinemood/shared").User;
  tokenCreatedAt: number;
  tokenExpiresAt: number | null;
}

export async function findUserByTokenHash(
  db: D1Database,
  hash: string,
): Promise<TokenAuthRow | null> {
  const row = await db
    .prepare(
      `SELECT t.id AS token_id, t.user_id, t.created_at AS token_created_at,
              t.expires_at AS token_expires_at,
              u.id, u.email, u.name, u.picture, u.min_issued_at
       FROM access_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ?1
       LIMIT 1`,
    )
    .bind(hash)
    .first<{
      token_id: string;
      user_id: string;
      token_created_at: number;
      token_expires_at: number | null;
      id: string;
      email: string;
      name: string | null;
      picture: string | null;
      min_issued_at: number;
    }>();

  if (!row) return null;

  return {
    userId: row.user_id,
    minIssuedAt: row.min_issued_at,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      picture: row.picture,
    },
    tokenCreatedAt: row.token_created_at,
    tokenExpiresAt: row.token_expires_at,
  };
}

export async function touchTokenLastUsed(
  db: D1Database,
  tokenId: string,
  now: number,
): Promise<void> {
  await db
    .prepare(`UPDATE access_tokens SET last_used_at = ?1 WHERE id = ?2`)
    .bind(now, tokenId)
    .run();
}

export async function revokeAccessToken(
  db: D1Database,
  userId: string,
  tokenId: string,
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM access_tokens WHERE id = ?1 AND user_id = ?2`)
    .bind(tokenId, userId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
