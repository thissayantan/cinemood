import { Hono, type Context } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import { resolveLlmConfig } from "../llm/resolve";
import { createLlmProvider } from "../llm";
import { rebuildIndex, searchIndex } from "../lib/orama-index";
import { listWatchlist } from "../db/watchlist";
import type { ParsedQuery, WatchlistItem } from "@cinemood/shared";

type Ctx = Context<{ Bindings: Env; Variables: AuthVars }>;

function authError(c: Ctx) {
  return c.json(
    { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required" } },
    401,
  );
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

const BodySchema = z.object({ query: z.string().min(1).max(500) });

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

app.post("/api/search", async (c) => {
  const user = c.get("user");
  if (!user) return authError(c);

  const body = await readJsonBody(c);
  if (body instanceof Response) return body;
  const parsedBody = BodySchema.safeParse(body);
  if (!parsedBody.success) return validationError(c, parsedBody.error.message);

  let parsedQuery: ParsedQuery;
  try {
    const cfg = await resolveLlmConfig(c.env, user.id);
    const provider = createLlmProvider(cfg, c.env);
    parsedQuery = await provider.parseQuery(parsedBody.data.query);
  } catch (err) {
    console.error("llm parse failed", err);
    return c.json(
      {
        ok: false,
        error: {
          code: "LLM_ERROR",
          message: err instanceof Error ? err.message : "LLM error",
        },
      },
      502,
    );
  }

  let hits;
  try {
    hits = await searchIndex(c.env, user.id, parsedQuery);
  } catch (err) {
    console.error("orama search failed", err);
    return c.json(
      {
        ok: false,
        error: { code: "INTERNAL", message: "Search failed" },
      },
      500,
    );
  }

  // Hydrate hits with full WatchlistItem entries.
  const items = await listWatchlist(c.env.DB, user.id);
  const byId = new Map<number, WatchlistItem>(
    items.map((it) => [it.title.id, it]),
  );
  const ranked = hits
    .map((h) => byId.get(h.tmdb_id))
    .filter((x): x is WatchlistItem => Boolean(x));

  return c.json({
    ok: true,
    data: {
      parsed: parsedQuery,
      results: ranked,
    },
  });
});

app.post("/api/search/reindex", async (c) => {
  const user = c.get("user");
  if (!user) return authError(c);
  try {
    const result = await rebuildIndex(c.env, user.id);
    return c.json({ ok: true, data: result });
  } catch (err) {
    console.error("reindex failed", err);
    return c.json(
      {
        ok: false,
        error: {
          code: "INTERNAL",
          message: err instanceof Error ? err.message : "Reindex failed",
        },
      },
      500,
    );
  }
});

export default app;
