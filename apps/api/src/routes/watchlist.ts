import { Hono, type Context } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
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

type Ctx = Context<{ Bindings: Env; Variables: AuthVars }>;

const PostSchema = z.object({
  tmdb_id: z.coerce.number().int().positive(),
  type: z.enum(["movie", "series"]),
});

const PatchSchema = z.object({
  status: z.enum(["pending", "watching", "watched"]),
});

const ListQuerySchema = z.object({
  status: z.enum(["pending", "watching", "watched"]).optional(),
  type: z.enum(["movie", "series"]).optional(),
  genre: z.string().min(1).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
  year_min: z.coerce.number().int().min(1800).max(2200).optional(),
  year_max: z.coerce.number().int().min(1800).max(2200).optional(),
  min_rating: z.coerce.number().min(0).max(10).optional(),
  runtime_min: z.coerce.number().int().min(0).max(1000).optional(),
  runtime_max: z.coerce.number().int().min(0).max(1000).optional(),
  sort: z
    .enum([
      "added_desc",
      "added_asc",
      "title_asc",
      "year_desc",
      "year_asc",
      "rating_desc",
      "catalog_desc",
      "started_desc",
    ])
    .optional(),
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

function validationError(c: Ctx, message: string) {
  return c.json(
    { ok: false, error: { code: "VALIDATION", message } },
    400,
  );
}

async function readJsonBody(c: Ctx): Promise<unknown | Response> {
  try {
    return await c.req.json();
  } catch {
    return validationError(c, "Invalid JSON");
  }
}

/** Parse the `:id` path param as a positive integer; return a 400 Response
 *  when it's missing or malformed. Two call sites (DELETE/PATCH). */
function parseIdParam(c: Ctx): number | Response {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return validationError(c, "Bad id");
  return id;
}

app.get("/api/watchlist", async (c) => {
  const user = authGuard(c);
  if (user instanceof Response) return user;
  const parsed = ListQuerySchema.safeParse({
    status: c.req.query("status"),
    type: c.req.query("type"),
    genre: c.req.query("genre"),
    year: c.req.query("year"),
    year_min: c.req.query("year_min"),
    year_max: c.req.query("year_max"),
    min_rating: c.req.query("min_rating"),
    runtime_min: c.req.query("runtime_min"),
    runtime_max: c.req.query("runtime_max"),
    sort: c.req.query("sort"),
  });
  if (!parsed.success) return validationError(c, parsed.error.message);
  const providers = c.req.queries("provider") ?? undefined;
  const items = await listWatchlist(c.env.DB, user.id, {
    ...parsed.data,
    providers: providers && providers.length > 0 ? providers : undefined,
  });
  return c.json({ ok: true, data: items });
});

app.get("/api/watchlist/ids", async (c) => {
  const user = authGuard(c);
  if (user instanceof Response) return user;
  const ids = await listWatchlistTitleIds(c.env.DB, user.id);
  return c.json({ ok: true, data: ids });
});

app.post("/api/watchlist", async (c) => {
  const user = authGuard(c);
  if (user instanceof Response) return user;

  const body = await readJsonBody(c);
  if (body instanceof Response) return body;
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return validationError(c, parsed.error.message);

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
  const id = parseIdParam(c);
  if (id instanceof Response) return id;
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
  const id = parseIdParam(c);
  if (id instanceof Response) return id;
  const body = await readJsonBody(c);
  if (body instanceof Response) return body;
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return validationError(c, parsed.error.message);
  await setWatchlistStatus(c.env.DB, user.id, id, parsed.data.status);
  const item = await getWatchlistItem(c.env.DB, user.id, id);
  return c.json({ ok: true, data: item });
});

export default app;
