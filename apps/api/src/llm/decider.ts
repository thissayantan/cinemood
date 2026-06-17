/**
 * decider.ts — schemas + prompts for the swipe Q&A decider feature.
 *
 * Two schemas / two prompt-builders:
 *   1. `buildQuestionsMessages` → generate N preference questions upfront.
 *   2. `buildPickMessages`      → pick the winner given accumulated answers.
 *
 * Questions are generated in a single batch (not iteratively), which is
 * cheaper and produces a coherent deck. The client echoes candidate_ids +
 * answers back with the pick request (stateless API, no session storage).
 */
import { z } from "zod";
import type { LlmTitleBrief } from "./structured";
import type { SwipeAnswer } from "@cinemood/shared";

// ── Generate questions ───────────────────────────────────────────────────────

export const QuestionsResultSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string().min(1).max(32),
        prompt: z.string().min(5).max(120),
        options: z
          .array(
            z.object({
              id: z.string().min(1).max(32),
              label: z.string().min(1).max(60),
            }),
          )
          .min(2)
          .max(4),
      }),
    )
    .min(1)
    .max(8),
});

export type QuestionsResult = z.infer<typeof QuestionsResultSchema>;

export function buildQuestionsMessages(
  titles: LlmTitleBrief[],
  count: number,
) {
  const systemPrompt = `You are a thoughtful movie recommender helping a user decide what to watch next. Given a list of titles from their watchlist, generate exactly ${count} fun, preference-revealing questions that will help you narrow down the best pick for them tonight.

Output ONLY a JSON object with this shape:
{
  "questions": [
    {
      "id": "q1",
      "prompt": "<question text, conversational tone, max 80 chars>",
      "options": [
        { "id": "q1_a", "label": "<option, max 40 chars>" },
        { "id": "q1_b", "label": "<option, max 40 chars>" }
      ]
    }
  ]
}

Rules:
- Generate exactly ${count} questions.
- Each question must have 2–4 options.
- Questions should probe: mood, energy level, desired runtime, genre appetite, preferred endings (happy/ambiguous/sad), want to think or just relax, etc.
- Questions must be grounded in the actual candidate titles — don't ask generic questions, make them relevant to distinguishing between the actual options.
- IDs must be unique slugs (e.g. "q1", "q2", "q1_a", "q1_b").
- Do NOT reveal or name specific titles in the question prompts — the point is to reveal the user's preferences, not to ask them to pick directly.
- Keep questions concise and conversational.
- Output ONLY the JSON object. No prose, no code fences.`;

  const titlesJson = JSON.stringify(titles, null, 0);
  const userContent = `Available titles from my watchlist:\n${titlesJson}\n\nGenerate ${count} questions to help decide what I should watch.`;

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userContent },
  ];
}

// ── Pick winner ──────────────────────────────────────────────────────────────

export const PickResultSchema = z.object({
  winner_id: z.number().int().positive(),
  reason: z.string().min(1).max(400),
  runners_up: z
    .array(
      z.object({
        title_id: z.number().int().positive(),
        reason: z.string().min(1).max(200),
      }),
    )
    .max(3),
});

export type PickResult = z.infer<typeof PickResultSchema>;

export function buildPickMessages(
  titles: LlmTitleBrief[],
  answers: SwipeAnswer[],
  mood?: string,
) {
  const systemPrompt = `You are a movie recommender. Given a user's watchlist and their answers to preference questions, pick the single best title for them to watch right now.

Output ONLY a JSON object with this shape:
{
  "winner_id": <number — must be a title_id from the provided list>,
  "reason": "<why this is the perfect pick for them tonight, 1–2 sentences, max 150 words>",
  "runners_up": [
    { "title_id": <number>, "reason": "<one sentence>" }
  ]
}

Rules:
- winner_id MUST be a title_id from the provided candidate list. Never invent a title.
- runners_up: up to 3 alternatives, also from the candidate list only.
- Use the preference answers to weight your decision — the answers are the most important signal.
- Output ONLY the JSON object. No prose, no code fences.`;

  const titlesJson = JSON.stringify(titles, null, 0);
  const answersJson = JSON.stringify(answers, null, 0);
  const moodSection = mood ? `\nUser's stated mood: "${mood}"` : "";

  const userContent = `Available titles from my watchlist:\n${titlesJson}\n\nMy preference answers:\n${answersJson}${moodSection}\n\nWhich should I watch tonight?`;

  return [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userContent },
  ];
}
