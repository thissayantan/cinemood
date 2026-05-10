import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import { fetchTmdbDetail } from "../lib/tmdb";
import { fetchOmdbRating } from "../lib/omdb";
import { getTitle, upsertTitle } from "../db/titles";

const ParamsSchema = z.object({
  type: z.enum(["movie", "series"]),
  id: z.coerce.number().int().positive(),
});

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

app.get("/api/title/:type/:id", async (c) => {
  const parsed = ParamsSchema.safeParse({
    type: c.req.param("type"),
    id: c.req.param("id"),
  });
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: { code: "VALIDATION", message: parsed.error.message },
      },
      400,
    );
  }
  const { type, id } = parsed.data;
  const user = c.get("user");
  if (!user) {
    return c.json(
      { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required" } },
      401,
    );
  }

  const cached = await getTitle(c.env.DB, id);
  if (cached) {
    return c.json({ ok: true, data: cached });
  }

  try {
    const detail = await fetchTmdbDetail(c.env.TMDB_API_KEY, c.env.CACHE, type, id);
    const imdbRating = detail.imdb_id
      ? await fetchOmdbRating(c.env.OMDB_API_KEY, c.env.CACHE, detail.imdb_id)
      : null;
    await upsertTitle(c.env.DB, detail, imdbRating);
    const fresh = await getTitle(c.env.DB, id);
    return c.json({ ok: true, data: fresh });
  } catch (err) {
    console.error("title detail failed", err);
    return c.json(
      {
        ok: false,
        error: { code: "UPSTREAM_ERROR", message: "Title fetch failed" },
      },
      502,
    );
  }
});

export default app;
