/**
 * decide.ts — POST /api/decide/questions + POST /api/decide/pick
 *
 * Stateless swipe Q&A decider. The client echoes candidate_ids and accumulated
 * answers back to the pick endpoint — no server-side session storage.
 *
 *   POST /api/decide/questions { title_ids?, status?, count? }
 *     → { questions, candidate_ids }
 *
 *   POST /api/decide/pick { title_ids, answers, mood? }
 *     → { winner, reason, runners_up }
 */
import { Hono } from "hono";
import { z } from "zod";
import type { DecideQuestionsResponse, DecidePickResponse, WatchlistItem } from "@cinemood/shared";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import { resolveLlmConfig } from "../llm/resolve";
import { createLlmProvider } from "../llm";
import { completeJson, toLlmTitleBrief } from "../llm/structured";
import {
  QuestionsResultSchema,
  PickResultSchema,
  buildQuestionsMessages,
  buildPickMessages,
} from "../llm/decider";
import { getWatchlistItems, listWatchlist } from "../db/watchlist";
import { authGuard, validationError, llmError, readJsonBody } from "./_shared";

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

// ── POST /api/decide/questions ───────────────────────────────────────────────

const QuestionsBodySchema = z.object({
  /** Specific candidate title ids. If omitted, uses the whole watchlist (optionally filtered). */
  title_ids: z.array(z.number().int().positive()).max(100).optional(),
  status: z.enum(["pending", "watching", "watched"]).optional(),
  /** How many questions to generate. Default 5. */
  count: z.coerce.number().int().min(3).max(8).default(5),
});

app.post("/api/decide/questions", async (c) => {
  const user = authGuard(c);
  if (user instanceof Response) return user;

  const body = await readJsonBody(c);
  if (body instanceof Response) return body;
  const parsed = QuestionsBodySchema.safeParse(body);
  if (!parsed.success) return validationError(c, parsed.error.message);

  const { title_ids, status, count } = parsed.data;

  // Resolve candidate set
  let candidates: WatchlistItem[];
  if (title_ids && title_ids.length > 0) {
    candidates = await getWatchlistItems(c.env.DB, user.id, title_ids);
  } else {
    candidates = await listWatchlist(c.env.DB, user.id, status ? { status } : {});
  }

  if (candidates.length === 0) {
    return c.json({
      ok: true,
      data: { questions: [], candidate_ids: [] } satisfies DecideQuestionsResponse,
    });
  }

  // Generate questions
  let result;
  try {
    const cfg = await resolveLlmConfig(c.env, user.id);
    const provider = createLlmProvider(cfg, c.env);
    const briefs = candidates.map(toLlmTitleBrief);
    result = await completeJson(
      provider,
      QuestionsResultSchema,
      buildQuestionsMessages(briefs, count),
      { maxTokens: 1200, temperature: 0.7 },
    );
  } catch (err) {
    console.error("decide/questions llm failed", err);
    return llmError(c, err instanceof Error ? err.message : "Failed to generate questions");
  }

  const candidate_ids = candidates.map((it) => it.title.id);
  const response: DecideQuestionsResponse = {
    questions: result.questions,
    candidate_ids,
  };

  return c.json({ ok: true, data: response });
});

// ── POST /api/decide/pick ────────────────────────────────────────────────────

const PickBodySchema = z.object({
  title_ids: z
    .array(z.number().int().positive())
    .min(1)
    .max(100),
  answers: z
    .array(
      z.object({
        question_id: z.string(),
        option_id: z.string(),
      }),
    )
    .min(1),
  mood: z.string().max(500).optional(),
});

app.post("/api/decide/pick", async (c) => {
  const user = authGuard(c);
  if (user instanceof Response) return user;

  const body = await readJsonBody(c);
  if (body instanceof Response) return body;
  const parsed = PickBodySchema.safeParse(body);
  if (!parsed.success) return validationError(c, parsed.error.message);

  const { title_ids, answers, mood } = parsed.data;

  // Resolve candidate items (user-scoped)
  const candidates = await getWatchlistItems(c.env.DB, user.id, title_ids);
  if (candidates.length === 0) {
    return validationError(c, "No matching titles found in your watchlist");
  }

  const candidateIdSet = new Set(candidates.map((it) => it.title.id));
  const byId = new Map<number, WatchlistItem>(candidates.map((it) => [it.title.id, it]));

  // LLM pick
  let pickResult;
  try {
    const cfg = await resolveLlmConfig(c.env, user.id);
    const provider = createLlmProvider(cfg, c.env);
    const briefs = candidates.map(toLlmTitleBrief);
    pickResult = await completeJson(
      provider,
      PickResultSchema,
      buildPickMessages(briefs, answers, mood),
      { maxTokens: 600, temperature: 0.3 },
    );
  } catch (err) {
    console.error("decide/pick llm failed", err);
    return llmError(c, err instanceof Error ? err.message : "Failed to pick a title");
  }

  // Closed-set guard: winner must be in the candidate set
  let winnerId = pickResult.winner_id;
  if (!candidateIdSet.has(winnerId)) {
    // Fallback: highest vote_average in the candidate set
    const fallback = candidates.reduce((best, it) =>
      (it.title.vote_average ?? 0) > (best.title.vote_average ?? 0) ? it : best,
    );
    winnerId = fallback.title.id;
  }

  const winner = byId.get(winnerId)!;

  // Filter runners-up: must be in candidate set and not the winner
  const validRunnersUp = pickResult.runners_up
    .filter((r) => candidateIdSet.has(r.title_id) && r.title_id !== winnerId)
    .slice(0, 3)
    .map((r) => ({ item: byId.get(r.title_id)!, reason: r.reason }))
    .filter((r) => Boolean(r.item));

  const response: DecidePickResponse = {
    winner,
    reason: pickResult.reason,
    runners_up: validRunnersUp,
  };

  return c.json({ ok: true, data: response });
});

export default app;
