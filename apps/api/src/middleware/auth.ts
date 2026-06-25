/**
 * auth.ts — auth middleware for the Hono Worker.
 *
 * Two auth paths, checked in order:
 *   1. Bearer token:  `Authorization: Bearer cmt_…`
 *      - Hash the raw token → look up in access_tokens table
 *      - Validate: exists, not expired, `token.created_at >= user.min_issued_at`
 *      - Sets `authMethod = "bearer"` on the context
 *   2. Session cookie: `cm_session`
 *      - HMAC-verified session → look up user + watermark check
 *      - Sets `authMethod = "cookie"` on the context
 *
 * Routes that manage tokens themselves must reject bearer-authed requests
 * (a token cannot mint more tokens).
 */
import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "../env";
import type { User } from "@cinemood/shared";
import { readCookie, readSession, SESSION_COOKIE } from "../lib/session";
import { getUserForAuth } from "../db/queries";
import { hashToken } from "../lib/access-token";
import { findUserByTokenHash } from "../db/access-tokens";

export type AuthVars = {
  user: User | null;
  /** How the current request was authenticated. Null when unauthenticated. */
  authMethod: "cookie" | "bearer" | null;
  /** Database token id for touchTokenLastUsed (bearer-authed requests only). */
  _bearerTokenId?: string;
};

export const authMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: AuthVars;
}> = async (c, next) => {
  // ── 1. Bearer token path ────────────────────────────────────────────────
  const authHeader = c.req.header("Authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const raw = authHeader.slice(7).trim();
    if (raw) {
      const hash = await hashToken(raw);
      const tokenAuth = await findUserByTokenHash(c.env.DB, hash);

      if (tokenAuth) {
        const now = Math.floor(Date.now() / 1000);
        const expired = tokenAuth.tokenExpiresAt !== null && tokenAuth.tokenExpiresAt < now;
        const revoked = tokenAuth.tokenCreatedAt < tokenAuth.minIssuedAt;

        if (!expired && !revoked) {
          c.set("user", tokenAuth.user);
          c.set("authMethod", "bearer");
          // Touch last_used_at asynchronously (waitUntil so the response isn't delayed).
          // UPDATE by hash (not id) — findUserByTokenHash doesn't return token.id, and
          // the WHERE is a no-op if the row was revoked in the meantime.
          c.executionCtx?.waitUntil(
            c.env.DB
              .prepare(`UPDATE access_tokens SET last_used_at = ?1 WHERE token_hash = ?2`)
              .bind(now, hash)
              .run(),
          );
          await next();
          return;
        }
      }

      // Bearer header present but invalid → 401 (don't fall through to cookie)
      c.set("user", null);
      c.set("authMethod", null);
      return c.json(
        { ok: false, error: { code: "AUTH_REQUIRED", message: "Invalid or expired token" } },
        401,
      );
    }
  }

  // ── 2. Session cookie path ───────────────────────────────────────────────
  const sid = readCookie(c.req.header("cookie") ?? null, SESSION_COOKIE);
  if (!sid) {
    c.set("user", null);
    c.set("authMethod", null);
    await next();
    return;
  }
  const session = await readSession(c.env.SESSION_SIGNING_KEY, sid);
  if (!session) {
    c.set("user", null);
    c.set("authMethod", null);
    await next();
    return;
  }
  const auth = await getUserForAuth(c.env.DB, session.userId);
  if (!auth || session.issuedAt < auth.minIssuedAt) {
    c.set("user", null);
    c.set("authMethod", null);
    await next();
    return;
  }
  c.set("user", auth.user);
  c.set("authMethod", "cookie");
  await next();
};

export function requireUser(
  c: Context<{ Bindings: Env; Variables: AuthVars }>,
): User | Response {
  const user = c.get("user");
  if (!user) {
    return c.json(
      {
        ok: false,
        error: { code: "AUTH_REQUIRED", message: "Sign in required" },
      },
      401,
    );
  }
  return user;
}
