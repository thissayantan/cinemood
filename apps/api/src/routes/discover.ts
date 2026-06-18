/**
 * POST /api/discover
 *
 * Translates a natural-language query into new-title recommendations from TMDB.
 * This is the Discover counterpart to /api/search which only searches the
 * user's saved library. Discover always returns titles from the broader TMDB
 * catalogue — the user can then add them to their watchlist.
 *
 * Flow: LLM parse → discoverTmdb (structured /discover/* or keyword fallback)
 * → return { parsed, results: TmdbSearchResult[] }
 *
 * Limitation (documented in docs/decisions.md): "more like Arrival" similarity
 * is out of scope; semantic-only queries fall back to /search/multi keyword search.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import {
  authGuard,
  readJsonBody,
  validationError,
  llmError,
  type Ctx,
} from "./_shared";
import { resolveLlmConfig } from "../llm/resolve";
import { createLlmProvider } from "../llm";
import { discoverTmdb } from "../lib/tmdb";
import type { ParsedQuery } from "@cinemood/shared";

const BodySchema = z.object({ query: z.string().min(1).max(500) });

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

app.post("/api/discover", async (c: Ctx) => {
  const user = authGuard(c);
  if (user instanceof Response) return user;

  // Guard: TMDB key required for discover
  if (!c.env.TMDB_API_KEY || !c.env.TMDB_API_KEY.trim()) {
    return c.json(
      {
        ok: false,
        error: {
          code: "UPSTREAM_NOT_CONFIGURED",
          message:
            "TMDB API key is not configured on this deployment. Set TMDB_API_KEY via wrangler secret put.",
        },
      },
      503,
    );
  }

  const body = await readJsonBody(c);
  if (body instanceof Response) return body;

  const parsedBody = BodySchema.safeParse(body);
  if (!parsedBody.success) {
    return validationError(c, parsedBody.error.message);
  }

  // Parse the query with the user's LLM provider
  let parsed: ParsedQuery;
  try {
    const cfg = await resolveLlmConfig(c.env, user.id);
    const provider = createLlmProvider(cfg, c.env);
    parsed = await provider.parseQuery(parsedBody.data.query);
  } catch (err) {
    console.error("discover llm parse failed", err);
    return llmError(
      c,
      err instanceof Error ? err.message : "AI parsing failed",
    );
  }

  // Discover matching titles from TMDB
  let results;
  try {
    results = await discoverTmdb(c.env.TMDB_API_KEY, c.env.CACHE, parsed);
  } catch (err) {
    console.error("tmdb discover failed", err);
    return c.json(
      {
        ok: false,
        error: {
          code: "UPSTREAM_ERROR",
          message: "TMDB discover failed",
        },
      },
      502,
    );
  }

  return c.json({
    ok: true,
    data: {
      parsed,
      results,
    },
  });
});

export default app;
