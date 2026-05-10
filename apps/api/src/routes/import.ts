import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import { resolveBatch } from "../lib/import-resolve";
import { fetchTmdbDetail } from "../lib/tmdb";
import { fetchOmdbRating } from "../lib/omdb";
import { getTitle, upsertTitle } from "../db/titles";
import { addToWatchlist } from "../db/watchlist";
import { addTitleToIndex } from "../lib/orama-index";

const ResolveBody = z.object({
  items: z
    .array(
      z.object({
        raw: z.string().min(1).max(400),
        title: z.string().min(1).max(300),
        year: z.number().int().min(1880).max(2100).optional(),
        type: z.enum(["movie", "series"]).optional(),
      }),
    )
    .min(1)
    .max(200),
});

const CommitBody = z.object({
  items: z
    .array(
      z.object({
        tmdb_id: z.coerce.number().int().positive(),
        type: z.enum(["movie", "series"]),
      }),
    )
    .min(1)
    .max(200),
});

interface CommitOutcome {
  tmdb_id: number;
  type: "movie" | "series";
  ok: boolean;
  error?: string;
}

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

app.post("/api/import/resolve", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json(
      { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required" } },
      401,
    );
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { ok: false, error: { code: "VALIDATION", message: "Invalid JSON" } },
      400,
    );
  }
  const parsed = ResolveBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: { code: "VALIDATION", message: parsed.error.message },
      },
      400,
    );
  }
  const resolved = await resolveBatch(c.env, parsed.data.items);
  return c.json({ ok: true, data: { resolved } });
});

app.post("/api/import/commit", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json(
      { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required" } },
      401,
    );
  }
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { ok: false, error: { code: "VALIDATION", message: "Invalid JSON" } },
      400,
    );
  }
  const parsed = CommitBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: { code: "VALIDATION", message: parsed.error.message },
      },
      400,
    );
  }

  const outcomes: CommitOutcome[] = [];
  for (const item of parsed.data.items) {
    try {
      const detail = await fetchTmdbDetail(
        c.env.TMDB_API_KEY,
        c.env.CACHE,
        item.type,
        item.tmdb_id,
      );
      const imdbRating = detail.imdb_id
        ? await fetchOmdbRating(c.env.OMDB_API_KEY, c.env.CACHE, detail.imdb_id)
        : null;
      await upsertTitle(c.env.DB, detail, imdbRating);
      await addToWatchlist(c.env.DB, user.id, item.tmdb_id);
      const fullTitle = await getTitle(c.env.DB, item.tmdb_id);
      if (fullTitle) {
        c.executionCtx.waitUntil(
          addTitleToIndex(c.env, user.id, fullTitle).catch((err) => {
            console.error("import index add failed", err);
          }),
        );
      }
      outcomes.push({ tmdb_id: item.tmdb_id, type: item.type, ok: true });
    } catch (err) {
      outcomes.push({
        tmdb_id: item.tmdb_id,
        type: item.type,
        ok: false,
        error: err instanceof Error ? err.message : "import_failed",
      });
    }
  }

  return c.json({ ok: true, data: { outcomes } });
});

export default app;
