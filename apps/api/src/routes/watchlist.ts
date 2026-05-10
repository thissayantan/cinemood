import { Hono, type Context } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";

type Ctx = Context<{ Bindings: Env; Variables: AuthVars }>;
import { fetchTmdbDetail } from "../lib/tmdb";
import { fetchOmdbRating } from "../lib/omdb";
import { getTitle, upsertTitle } from "../db/titles";
import {
  addToWatchlist,
  getWatchlistItem,
  listWatchlist,
  listWatchlistTitleIds,
  removeFromWatchlist,
  setWatchlistStatus,
} from "../db/watchlist";
import { addTitleToIndex, removeTitleFromIndex } from "../lib/orama-index";

const PostSchema = z.object({
  tmdb_id: z.coerce.number().int().positive(),
  type: z.enum(["movie", "series"]),
});

const PatchSchema = z.object({
  status: z.enum(["pending", "watched"]),
});

const ListQuerySchema = z.object({
  status: z.enum(["pending", "watched"]).optional(),
  type: z.enum(["movie", "series"]).optional(),
  genre: z.string().min(1).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
});

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

function authGuard(c: Ctx) {
  const user = c.get("user");
  if (!user) {
    return c.json(
      { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required" } },
      401,
    );
  }
  return user;
}

app.get("/api/watchlist", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json(
      { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required" } },
      401,
    );
  }
  const parsed = ListQuerySchema.safeParse({
    status: c.req.query("status"),
    type: c.req.query("type"),
    genre: c.req.query("genre"),
    year: c.req.query("year"),
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
  const items = await listWatchlist(c.env.DB, user.id, parsed.data);
  return c.json({ ok: true, data: items });
});

app.get("/api/watchlist/ids", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json(
      { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required" } },
      401,
    );
  }
  const ids = await listWatchlistTitleIds(c.env.DB, user.id);
  return c.json({ ok: true, data: ids });
});

app.post("/api/watchlist", async (c) => {
  const user = authGuard(c);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { ok: false, error: { code: "VALIDATION", message: "Invalid JSON" } },
      400,
    );
  }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: { code: "VALIDATION", message: parsed.error.message },
      },
      400,
    );
  }

  try {
    const detail = await fetchTmdbDetail(
      c.env.TMDB_API_KEY,
      c.env.CACHE,
      parsed.data.type,
      parsed.data.tmdb_id,
    );
    const imdbRating = detail.imdb_id
      ? await fetchOmdbRating(c.env.OMDB_API_KEY, c.env.CACHE, detail.imdb_id)
      : null;
    await upsertTitle(c.env.DB, detail, imdbRating);
    await addToWatchlist(c.env.DB, user.id, parsed.data.tmdb_id);
    const item = await getWatchlistItem(c.env.DB, user.id, parsed.data.tmdb_id);

    const fullTitle = await getTitle(c.env.DB, parsed.data.tmdb_id);
    if (fullTitle) {
      c.executionCtx.waitUntil(
        addTitleToIndex(c.env, user.id, fullTitle).catch((err) => {
          console.error("index add failed", err);
        }),
      );
    }

    return c.json({ ok: true, data: item });
  } catch (err) {
    console.error("watchlist add failed", err);
    return c.json(
      {
        ok: false,
        error: { code: "UPSTREAM_ERROR", message: "Add failed" },
      },
      502,
    );
  }
});

app.delete("/api/watchlist/:id", async (c) => {
  const user = authGuard(c);
  if (user instanceof Response) return user;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { ok: false, error: { code: "VALIDATION", message: "Bad id" } },
      400,
    );
  }
  await removeFromWatchlist(c.env.DB, user.id, id);
  c.executionCtx.waitUntil(
    removeTitleFromIndex(c.env, user.id, id).catch((err) => {
      console.error("index remove failed", err);
    }),
  );
  return c.json({ ok: true, data: { removed: id } });
});

app.patch("/api/watchlist/:id", async (c) => {
  const user = authGuard(c);
  if (user instanceof Response) return user;
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return c.json(
      { ok: false, error: { code: "VALIDATION", message: "Bad id" } },
      400,
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
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        ok: false,
        error: { code: "VALIDATION", message: parsed.error.message },
      },
      400,
    );
  }
  await setWatchlistStatus(c.env.DB, user.id, id, parsed.data.status);
  const item = await getWatchlistItem(c.env.DB, user.id, id);
  return c.json({ ok: true, data: item });
});

export default app;
