/**
 * compare.ts — POST /api/compare
 *
 * Accepts 2–6 title_ids from the user's watchlist. Returns a side-by-side
 * comparison table: deterministic columns from stored metadata merged with
 * AI-generated "feel" columns (mood, pacing, tone, critical_consensus,
 * watch_if_you_liked) from a single completeJson call.
 *
 * If the LLM omits a title or fails to parse a row, that row's AI columns
 * fall back to empty strings — the deterministic data always wins and the
 * table never fails outright because of a bad AI response.
 */
import { Hono } from "hono";
import { z } from "zod";
import type { CompareCell } from "@cinemood/shared";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import { resolveLlmConfig } from "../llm/resolve";
import { createLlmProvider } from "../llm";
import { completeJson, toLlmTitleBrief } from "../llm/structured";
import { buildCompareMessages, CompareAiSchema } from "../llm/compare";
import { getWatchlistItems } from "../db/watchlist";
import { selectProviderNames } from "../lib/providers";
import { authGuard, validationError, readJsonBody } from "./_shared";

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

const BodySchema = z.object({
  title_ids: z
    .array(z.number().int().positive())
    .min(2, "Select at least 2 titles to compare")
    .max(6, "Select at most 6 titles"),
});

app.post("/api/compare", async (c) => {
  const user = authGuard(c);
  if (user instanceof Response) return user;

  const body = await readJsonBody(c);
  if (body instanceof Response) return body;
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return validationError(c, parsed.error.message);

  const { title_ids } = parsed.data;

  // ── 1. Resolve candidate items (user-scoped) ─────────────────────────────
  const candidates = await getWatchlistItems(c.env.DB, user.id, title_ids);

  if (candidates.length === 0) {
    return c.json({ ok: true, data: { rows: [] } });
  }

  // ── 2. Build deterministic columns ───────────────────────────────────────
  const detMap = new Map<number, Omit<CompareCell, "mood" | "pacing" | "tone" | "critical_consensus" | "watch_if_you_liked">>();
  for (const item of candidates) {
    const t = item.title;
    detMap.set(t.id, {
      title_id: t.id,
      title: t.title,
      year: t.release_date ? t.release_date.slice(0, 4) : null,
      type: t.type,
      runtime: t.runtime ?? null,
      genres: t.genres,
      providers: selectProviderNames(t.providers),
      vote_average: t.vote_average ?? null,
      imdb_rating: t.imdb_rating ?? null,
    });
  }

  // ── 3. AI columns ─────────────────────────────────────────────────────────
  const emptyAi = {
    mood: "",
    pacing: "",
    tone: "",
    critical_consensus: "",
    watch_if_you_liked: [] as string[],
  };

  let aiRows: Map<number, typeof emptyAi>;
  try {
    const cfg = await resolveLlmConfig(c.env, user.id);
    const provider = createLlmProvider(cfg, c.env);
    const briefs = candidates.map(toLlmTitleBrief);
    const result = await completeJson(provider, CompareAiSchema, buildCompareMessages(briefs), {
      maxTokens: 2000,
      temperature: 0.3,
    });

    aiRows = new Map(
      result.rows.map((r) => [
        r.title_id,
        {
          mood: r.mood ?? "",
          pacing: r.pacing ?? "",
          tone: r.tone ?? "",
          critical_consensus: r.critical_consensus ?? "",
          watch_if_you_liked: r.watch_if_you_liked ?? [],
        },
      ]),
    );
  } catch (err) {
    console.error("compare llm failed", err);
    // Non-fatal: fall back to empty AI columns rather than erroring the table.
    aiRows = new Map();
  }

  // ── 4. Merge deterministic + AI, preserving request order ─────────────────
  const requestOrder = title_ids.filter((id) => detMap.has(id));
  const rows: CompareCell[] = requestOrder.map((id) => ({
    ...(detMap.get(id)!),
    ...(aiRows.get(id) ?? emptyAi),
  }));

  return c.json({ ok: true, data: { rows } });
});

export default app;
