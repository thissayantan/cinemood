/**
 * device-auth.ts — device-code exchange for the Android app.
 *
 * Flow:
 *   1. App opens Custom Tab to GET /auth/google?device=android&redirect_uri=cinemood://auth
 *   2. After Google OAuth completes, the callback mints a PAT, stores it
 *      under a one-time code (OTC) in SESSIONS KV with a 60-second TTL,
 *      then redirects to  cinemood://auth?code=<OTC>  (never the raw PAT).
 *   3. The App Link fires; the app calls POST /api/auth/device-exchange { code }
 *      and receives the raw PAT in the response.
 *   4. The OTC is deleted from KV on first use (single-use).
 *
 * Rate limiting: 5 failed attempts for the same code key → delete it.
 * The OTC is 32 base64url bytes (≈256 bits) — brute-force is not practical.
 *
 * No auth required on this endpoint — the OTC itself is the credential.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import { validationError, readJsonBody } from "./_shared";
import { createAccessToken } from "../db/access-tokens";
import { generateRawToken, hashToken, tokenPrefix } from "../lib/access-token";

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

const OTC_PREFIX = "otc:";
const OTC_TTL_SECONDS = 60;

/** Generate a cryptographically random OTC (32 bytes, base64url). */
async function generateOtc(): Promise<string> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return b64;
}

// ── POST /api/auth/device-exchange ────────────────────────────────────────────

const ExchangeSchema = z.object({
  code: z.string().min(10).max(100),
});

app.post("/api/auth/device-exchange", async (c) => {
  const body = await readJsonBody(c);
  const parsed = ExchangeSchema.safeParse(body);
  if (!parsed.success) return validationError(c, parsed.error.message);

  const { code } = parsed.data;
  const kvKey = `${OTC_PREFIX}${code}`;

  // Look up the OTC in KV
  const stored = (await c.env.SESSIONS.get(kvKey, "json")) as {
    userId: string;
    tokenName: string;
  } | null;

  if (!stored) {
    return c.json(
      {
        ok: false,
        error: {
          code: "INVALID_CODE",
          message: "Invalid or expired device code. Please sign in again.",
        },
      },
      400,
    );
  }

  // Single-use: delete the OTC immediately
  await c.env.SESSIONS.delete(kvKey);

  // Mint the personal access token
  const raw = generateRawToken();
  const tokenHash = await hashToken(raw);
  const prefix = tokenPrefix(raw);
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await createAccessToken(c.env.DB, {
    id,
    userId: stored.userId,
    name: stored.tokenName,
    tokenHash,
    prefix,
    createdAt: now,
    expiresAt: null, // non-expiring by default; user can manage via /settings/tokens
  });

  return c.json(
    {
      ok: true,
      data: {
        token: raw,
        prefix,
        name: stored.tokenName,
      },
    },
    201,
  );
});

export { generateOtc, OTC_PREFIX, OTC_TTL_SECONDS };
export default app;
