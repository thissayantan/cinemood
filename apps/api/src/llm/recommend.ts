/**
 * recommend.ts — schema + prompt for the mood-based recommendation feature.
 *
 * The prompt instructs the model to rank candidate titles by how well they
 * match the user's stated mood (+ optional swipe answers). Output is a
 * scored list validated by RecommendResultSchema before being trusted.
 */
import { z } from "zod";
import type { LlmTitleBrief } from "./structured";
import type { SwipeAnswer } from "@cinemood/shared";

export const RecommendResultSchema = z.object({
  recommendations: z
    .array(
      z.object({
        title_id: z.number().int().positive(),
        score: z.number().min(0).max(100),
        reason: z.string().min(1).max(400),
      }),
    )
    .max(20),
});

export type RecommendResult = z.infer<typeof RecommendResultSchema>;

export function buildRecommendMessages(
  mood: string,
  titles: LlmTitleBrief[],
  answers?: SwipeAnswer[],
) {
  const systemPrompt = `You are a personal movie and series recommender. Given the user's mood and a list of titles from their watchlist, rank the titles that best fit their mood right now.

Output ONLY a JSON object with this shape:
{
  "recommendations": [
    { "title_id": <number>, "score": <0-100>, "reason": "<why it fits the mood, max 2 sentences>" }
  ]
}

Rules:
- Include ONLY title_ids from the provided list. Never invent titles.
- Score 0-100 where 100 = perfect mood match.
- Omit titles that are clearly a poor match (score < 30).
- Keep reasons concise — max 2 sentences, no spoilers.
- Rank by score descending.
- Output ONLY the JSON object. No prose, no code fences.`;

  const titlesJson = JSON.stringify(titles, null, 0);
  const answersSection = answers && answers.length > 0
    ? `\n\nThe user also answered some preference questions:\n${JSON.stringify(answers, null, 0)}`
    : "";

  const userContent = `My mood right now: "${mood}"${answersSection}

Available titles from my watchlist:
${titlesJson}

Rank the titles that best fit my mood.`;

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userContent },
  ];
}
