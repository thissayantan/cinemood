/**
 * compare.ts — schema + prompt for the compare-table feature.
 *
 * Given 2–6 watchlist titles the user wants to compare, the model fills in
 * four subjective "feel" columns per title: mood, pacing, tone, and a
 * critical consensus blurb. Deterministic columns (year, runtime, genres,
 * rating, providers) are built from stored data before this runs, and
 * merged in the route handler by title_id.
 */
import { z } from "zod";
import type { LlmTitleBrief } from "./structured";

export const CompareAiRowSchema = z.object({
  title_id: z.number().int().positive(),
  mood: z.string().max(80).default(""),
  pacing: z.string().max(80).default(""),
  tone: z.string().max(80).default(""),
  critical_consensus: z.string().max(200).default(""),
  watch_if_you_liked: z.array(z.string().max(60)).max(4).default([]),
});

export const CompareAiSchema = z.object({
  rows: z.array(CompareAiRowSchema).max(6),
});

export type CompareAiResult = z.infer<typeof CompareAiSchema>;

export function buildCompareMessages(titles: LlmTitleBrief[]) {
  const systemPrompt = `You are a film and TV critic. Given a list of titles, produce a JSON comparison table with four subjective columns per title.

Output ONLY a JSON object with this shape:
{
  "rows": [
    {
      "title_id": <number>,
      "mood": "<emotional atmosphere in ≤6 words, e.g. 'tense, brooding, claustrophobic'>",
      "pacing": "<one of: slow-burn | methodical | balanced | brisk | relentless>",
      "tone": "<one of: lighthearted | bittersweet | darkly comic | dramatic | bleak | uplifting | satirical | romantic>",
      "critical_consensus": "<one sentence, ≤30 words, what critics and audiences agree on>",
      "watch_if_you_liked": ["<title 1>", "<title 2>"] // up to 4 comparable titles
    }
  ]
}

Rules:
- Include a row for EVERY title_id provided. Never omit a title.
- Keep each field terse and precise — this is a table cell, not an essay.
- Output ONLY the JSON object. No prose, no code fences.`;

  const titlesJson = JSON.stringify(titles, null, 0);
  const userContent = `Compare these titles:\n${titlesJson}`;

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userContent },
  ];
}
