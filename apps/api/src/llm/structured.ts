/**
 * structured.ts — validated, schema-typed LLM completions.
 *
 * This is the single chokepoint for every AI feature beyond the query parser.
 * All calls must go through `completeJson()` so LLM output is always validated
 * by a zod schema before being trusted — per the CLAUDE.md hard rule.
 */
import { z } from "zod";
import type { WatchlistItem } from "@cinemood/shared";
import type { CompleteOptions, LlmMessage, LlmProvider } from "./index";
import { tryParseJsonObject } from "./parser";

/**
 * Run a structured completion through `provider.complete()`, parse the raw
 * text as JSON, and validate it against `schema`. Throws a zod
 * `ZodError` on validation failure (same pattern as `validateParsedQuery`).
 */
export async function completeJson<T>(
  provider: LlmProvider,
  schema: z.ZodType<T>,
  messages: LlmMessage[],
  opts?: CompleteOptions,
): Promise<T> {
  const text = await provider.complete(messages, opts);
  const obj = tryParseJsonObject(text);
  return schema.parse(obj);
}

/**
 * Compact representation of a watchlist item for LLM prompts.
 * Sends only the fields relevant for reasoning; never includes `raw_tmdb`
 * or the full providers blob to keep context small.
 */
export interface LlmTitleBrief {
  title_id: number;
  title: string;
  year: string | null;
  type: "movie" | "series";
  genres: string[];
  keywords: string[];
  vote_average: number | null;
  imdb_rating: number | null;
  runtime: number | null;
  overview: string;
}

export function toLlmTitleBrief(item: WatchlistItem): LlmTitleBrief {
  const t = item.title;
  return {
    title_id: t.id,
    title: t.title,
    year: t.release_date ? t.release_date.slice(0, 4) : null,
    type: t.type,
    genres: t.genres,
    keywords: t.keywords,
    vote_average: t.vote_average ?? null,
    imdb_rating: t.imdb_rating ?? null,
    runtime: t.runtime ?? null,
    // Cap at 200 characters to keep prompt tokens under control.
    overview: (t.overview ?? "").slice(0, 200),
  };
}
