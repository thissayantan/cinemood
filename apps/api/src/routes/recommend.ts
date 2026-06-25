/**
 * recommend.ts — POST /api/recommend
 *
 * Mood-based recommendation: given a mood string (and optional candidate
 * title ids / status filter), returns watchlist titles ranked by how well
 * they match the user's stated mood. Uses the user's configured LLM
 * provider through the completeJson() chokepoint in llm/structured.ts.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import { resolveLlmConfig } from "../llm/resolve";
import { createLlmProvider } from "../llm";
import { completeJson, toLlmTitleBrief } from "../llm/structured";
import { RecommendResultSchema, buildRecommendMessages } from "../llm/recommend";
import { getWatchlistItems, listWatchlist } from "../db/watchlist";
import { authGuard, validationError, llmError, readJsonBody } from "./_shared";
import type { WatchlistItem } from "@cinemood/shared";

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

const BodySchema = z.object({
  /** Specific title ids to consider. If omitted, uses the whole watchlist. */
  title_ids: z.array(z.number().int().positive()).max(100).optional(),
  /** Filter by status when title_ids is absent. */
  status: z.enum(["pending", "watching", "watched"]).optional(),
  /** Free-text mood description. Required. */
  mood: z.string().min(1).max(500),
  /** Accumulated swipe answers (from the decide flow). */
  answers: z
    .array(z.object({ question_id: z.string(), option_id: z.string() }))
    .optional(),
  /** How many recommendations to return. Defaults to 5, max 20. */
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

app.post("/api/recommend", async (c) => {
  const user = authGuard(c);
  if (user instanceof Response) return user;

  const body = await readJsonBody(c);
  if (body instanceof Response) return body;
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return validationError(c, parsed.error.message);

  const { title_ids, status, mood, answers, limit } = parsed.data;

  // ── 1. Resolve candidate set ─────────────────────────────────────────────
  let candidates: WatchlistItem[];
  if (title_ids && title_ids.length > 0) {
    candidates = await getWatchlistItems(c.env.DB, user.id, title_ids);
  } else {
    candidates = await listWatchlist(c.env.DB, user.id, status ? { status } : {});
  }

  if (candidates.length === 0) {
    return c.json({ ok: true, data: { recommendations: [], items: [], mood } });
  }

  // ── 2. Call LLM ──────────────────────────────────────────────────────────
  const briefs = candidates.map(toLlmTitleBrief);
  const candidateIdSet = new Set(candidates.map((it) => it.title.id));
  const byId = new Map<number, WatchlistItem>(candidates.map((it) => [it.title.id, it]));

  let llmResult;
  try {
    const cfg = await resolveLlmConfig(c.env, user.id);
    const provider = createLlmProvider(cfg, c.env);
    const messages = buildRecommendMessages(mood, briefs, answers);
    llmResult = await completeJson(provider, RecommendResultSchema, messages, {
      maxTokens: 1500,
      temperature: 0.4,
    });
  } catch (err) {
    console.error("recommend llm failed", err);
    return llmError(c, err instanceof Error ? err.message : "Recommendation failed");
  }

  // ── 3. Closed-set validation + hydration ─────────────────────────────────
  // The LLM must only return title_ids from the candidate set. Filter any
  // hallucinated ids before building the response.
  const validRecs = llmResult.recommendations
    .filter((r) => candidateIdSet.has(r.title_id))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const items = validRecs
    .map((r) => byId.get(r.title_id))
    .filter((x): x is WatchlistItem => Boolean(x));

  return c.json({
    ok: true,
    data: { recommendations: validRecs, items, mood },
  });
});

export default app;
