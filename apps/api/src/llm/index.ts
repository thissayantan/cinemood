import type { LlmConfig, ParsedQuery } from "@cinemood/shared";
import type { Env } from "../env";
import { CloudflareProvider } from "./cloudflare";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { GoogleProvider } from "./google";

export interface LlmProvider {
  parseQuery(input: string): Promise<ParsedQuery>;
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
