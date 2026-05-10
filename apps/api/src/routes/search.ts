import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import { searchTmdb } from "../lib/tmdb";

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

app.get("/api/search/tmdb", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json(
      { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required" } },
      401,
    );
  }
  const q = c.req.query("q") ?? "";
  if (!q.trim()) return c.json({ ok: true, data: [] });

  try {
    const results = await searchTmdb(c.env.TMDB_API_KEY, c.env.CACHE, q);
    return c.json({ ok: true, data: results });
  } catch (err) {
    console.error("tmdb search failed", err);
    return c.json(
      {
        ok: false,
        error: { code: "UPSTREAM_ERROR", message: "TMDB search failed" },
      },
      502,
    );
  }
});

export default app;
