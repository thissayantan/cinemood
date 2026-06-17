import type { LlmConfig, ParsedQuery } from "@cinemood/shared";
import type { Env } from "../env";
import { CloudflareProvider } from "./cloudflare";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { GoogleProvider } from "./google";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  /** Maximum tokens to generate. Defaults to 1500 for structured features. */
  maxTokens?: number;
  /** Sampling temperature (0 = deterministic). Defaults to 0. */
  temperature?: number;
}

export interface LlmProvider {
  parseQuery(input: string): Promise<ParsedQuery>;
  /**
   * Generic structured completion. Returns the raw text from the model.
   * JSON parsing and schema validation are the caller's responsibility —
   * use `completeJson()` from `llm/structured.ts` for that.
   */
  complete(messages: LlmMessage[], opts?: CompleteOptions): Promise<string>;
  testConnection(): Promise<{
    ok: boolean;
    error?: string;
    sampleOutput?: ParsedQuery;
  }>;
}

export function createLlmProvider(cfg: LlmConfig, env: Env): LlmProvider {
  switch (cfg.provider) {
    case "cloudflare":
      return new CloudflareProvider(cfg, env);
    case "anthropic":
      return new AnthropicProvider(cfg);
    case "openai":
      return new OpenAIProvider(cfg);
    case "google":
      return new GoogleProvider(cfg);
  }
}

const DEFAULT_TEST_QUERY =
  "recent sci-fi series with 8+ rating about time travel";

export async function runTestConnection(
  provider: LlmProvider,
): Promise<{ ok: boolean; error?: string; sampleOutput?: ParsedQuery }> {
  try {
    const sample = await provider.parseQuery(DEFAULT_TEST_QUERY);
    return { ok: true, sampleOutput: sample };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
