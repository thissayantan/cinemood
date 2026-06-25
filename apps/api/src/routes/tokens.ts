/**
 * tokens.ts — personal access token management API.
 *
 *   GET    /api/settings/tokens           — list all tokens for the user
 *   POST   /api/settings/tokens           — create a token; returns raw once
 *   DELETE /api/settings/tokens/:id       — revoke a token
 *
 * All three routes require cookie auth (`authMethod === "cookie"`).
 * A token cannot mint, list, or revoke other tokens — this prevents
 * a compromised token from escalating to full account control.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { AccessTokenPublic } from "@cinemood/shared";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import { authGuard, validationError, readJsonBody, type Ctx } from "./_shared";
import {
  createAccessToken,
  listAccessTokens,
  revokeAccessToken,
} from "../db/access-tokens";
import { generateRawToken, hashToken, tokenPrefix } from "../lib/access-token";

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

/** Guard: must be signed in AND via a session cookie (not a Bearer token). */
function cookieOnlyGuard(c: Ctx) {
  const user = authGuard(c);
  if (user instanceof Response) return user;
  if (c.get("authMethod") !== "cookie") {
    return c.json(
      {
        ok: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "Token management requires session authentication",
        },
      },
      403,
    );
  }
  return user;
}

// ── GET /api/settings/tokens ──────────────────────────────────────────────────

app.get("/api/settings/tokens", async (c) => {
  const user = cookieOnlyGuard(c);
  if (user instanceof Response) return user;

  const tokens = await listAccessTokens(c.env.DB, user.id);
  return c.json({ ok: true, data: tokens });
});

// ── POST /api/settings/tokens ─────────────────────────────────────────────────

const CreateBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  expires_in_days: z.coerce.number().int().min(1).max(3650).optional(),
});

app.post("/api/settings/tokens", async (c) => {
  const user = cookieOnlyGuard(c);
  if (user instanceof Response) return user;

  const body = await readJsonBody(c);
  if (body instanceof Response) return body;
  const parsed = CreateBodySchema.safeParse(body);
  if (!parsed.success) return validationError(c, parsed.error.message);

  const { name, expires_in_days } = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = expires_in_days
    ? now + expires_in_days * 86400
    : null;

  const raw = generateRawToken();
  const hash = await hashToken(raw);
  const prefix = tokenPrefix(raw);
  const id = crypto.randomUUID();

  const tokenPublic: AccessTokenPublic = await createAccessToken(c.env.DB, {
    id,
    userId: user.id,
    name,
    tokenHash: hash,
    prefix,
    createdAt: now,
    expiresAt,
  });

  // Return the raw token ONCE — it is never stored or retrievable again.
  return c.json(
    {
      ok: true,
      data: {
        ...tokenPublic,
        // Non-redisplayable after this response. Never log or cache this.
        raw,
      },
    },
    201,
  );
});

// ── DELETE /api/settings/tokens/:id ──────────────────────────────────────────

app.delete("/api/settings/tokens/:id", async (c) => {
  const user = cookieOnlyGuard(c);
  if (user instanceof Response) return user;

  const tokenId = c.req.param("id");
  const deleted = await revokeAccessToken(c.env.DB, user.id, tokenId);

  if (!deleted) {
    return c.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Token not found" } },
      404,
    );
  }
  return c.json({ ok: true, data: null });
});

export default app;
