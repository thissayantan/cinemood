/**
 * _shared.ts — common helpers for Hono route handlers.
 *
 * Extracted so the four new AI feature route files (recommend, compare,
 * decide, tokens) don't each copy-paste the same pattern. The existing
 * routes (watchlist, settings, etc.) keep their own local copies to
 * avoid churn — this file is for new routes only.
 */
import type { Context } from "hono";
import type { Env } from "../env";
import type { User } from "@cinemood/shared";
import type { AuthVars } from "../middleware/auth";

export type Ctx = Context<{ Bindings: Env; Variables: AuthVars }>;

/** Returns the authenticated user or a 401 JSON Response. */
export function authGuard(c: Ctx): User | Response {
  const user = c.get("user");
  if (!user) {
    return c.json(
      { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required" } },
      401,
    );
  }
  return user;
}

/** Returns a 400 JSON Response with a VALIDATION error code. */
export function validationError(c: Ctx, message: string): Response {
  return c.json(
    { ok: false, error: { code: "VALIDATION", message } },
    400,
  );
}

/** Returns a 502 JSON Response for LLM failures. */
export function llmError(c: Ctx, message = "AI request failed"): Response {
  return c.json(
    { ok: false, error: { code: "LLM_ERROR", message } },
    502,
  );
}

/** Parse the request JSON body; returns a 400 Response on parse failure. */
export async function readJsonBody(c: Ctx): Promise<unknown | Response> {
  try {
    return await c.req.json();
  } catch {
    return validationError(c, "Invalid JSON body");
  }
}
