import { z } from "zod";
import type { ParsedQuery } from "@cinemood/shared";

export const ParsedQuerySchema = z.object({
  filters: z
    .object({
      type: z.array(z.enum(["movie", "series"])).optional(),
      genres: z.array(z.string().min(1)).optional(),
      exclude_genres: z.array(z.string().min(1)).optional(),
      min_rating: z.number().min(0).max(10).optional(),
      max_rating: z.number().min(0).max(10).optional(),
      release_after: z
        .string()
        .regex(/^\d{4}(-\d{2}-\d{2})?$/)
        .optional(),
      release_before: z
        .string()
        .regex(/^\d{4}(-\d{2}-\d{2})?$/)
        .optional(),
      cast: z.array(z.string().min(1)).optional(),
      keywords: z.array(z.string().min(1)).optional(),
      providers: z.array(z.string().min(1)).optional(),
    })
    .default({}),
  semantic_query: z.string().default(""),
});

export const SYSTEM_PROMPT = `You are a search-query parser for a personal movie and series watchlist.

Convert the user's natural-language query into a single JSON object that follows this exact TypeScript shape:

interface ParsedQuery {
  filters: {
    type?: ("movie" | "series")[];
    genres?: string[];           // canonical TMDB genres, e.g. ["Science Fiction", "Drama"]
    exclude_genres?: string[];   // for negations, e.g. "no horror"
    min_rating?: number;         // 0..10, TMDB-style
    max_rating?: number;
    release_after?: string;      // "YYYY" or "YYYY-MM-DD"
    release_before?: string;
    cast?: string[];             // actor names
    keywords?: string[];         // thematic keywords like "time travel", "heist"
    providers?: string[];        // streaming services like "Apple TV+", "Netflix", "Max"
  };
  semantic_query: string;        // the residual vibe / topic to do similarity search on
}

Rules:
- Output ONLY a JSON object. No prose, no markdown, no code fences.
- Omit any filter that the user didn't mention. Do NOT invent values.
- "recent" without a year means release_after = current year minus 2.
- "8+ rating", "above 8", "8/10 or higher" → min_rating = 8.
- "no horror", "not horror", "without horror" → exclude_genres += ["Horror"].
- "by/with/starring <name>" → cast += ["<name>"].
- "on Netflix" / "Apple TV+" → providers.
- Keep semantic_query short (≤ 8 words). It captures the vibe/topic only — not the filters.
- If the user just types a movie title, put the title in semantic_query and leave filters minimal.
- Map common synonyms: "sci-fi" → "Science Fiction", "rom-com" → ["Romance","Comedy"], "thrillers" → "Thriller".

Examples:
"recent sci-fi series with 8+ rating about time travel"
{"filters":{"type":["series"],"genres":["Science Fiction"],"min_rating":8,"release_after":"2023"},"semantic_query":"time travel"}

"dark Apple TV+ thrillers with Jeremy Strong"
{"filters":{"genres":["Thriller"],"providers":["Apple TV+"],"cast":["Jeremy Strong"]},"semantic_query":"dark"}

"feel-good comedies from the 90s, no horror"
{"filters":{"genres":["Comedy"],"exclude_genres":["Horror"],"release_after":"1990","release_before":"1999"},"semantic_query":"feel-good"}

"blade runner"
{"filters":{},"semantic_query":"blade runner"}`;

export function tryParseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("empty_llm_output");
  // Strip code fences if any
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const cleaned = fenceMatch?.[1] ?? trimmed;

  // Scan for the first top-level balanced JSON object (skip braces inside strings).
  const start = cleaned.indexOf("{");
  if (start === -1) throw new Error("no_json_object_in_output");
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const candidate = cleaned.slice(start, i + 1);
        return JSON.parse(candidate);
      }
    }
  }
  throw new Error("unterminated_json_object");
}

export function validateParsedQuery(value: unknown): ParsedQuery {
  const parsed = ParsedQuerySchema.parse(value);
  return parsed as ParsedQuery;
}
