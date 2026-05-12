import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import { checkSetupStatus } from "../lib/setup-status";

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

// Public, auth-not-required. The landing page polls this before
// rendering the sign-in CTA so a freshly-forked deploy (which lands
// without TMDB / OMDB / Google OAuth secrets configured) can show a
// "Setup incomplete" panel listing exactly which secrets are missing
// instead of failing opaquely.
//
// Response shape:
//   { ok: true, data: { ready: bool, missing: string[], secrets: { name: bool, ... } } }
//
// Values are NEVER returned — only booleans. The secret names returned
// match the wrangler secret put argument verbatim, so the panel can
// render exact copy-paste commands.
app.get("/api/setup-status", (c) => {
  return c.json({ ok: true, data: checkSetupStatus(c.env) });
});

export default app;
