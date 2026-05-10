import type { LlmProviderId } from "@cinemood/shared";

export const MODEL_CATALOG = {
  cloudflare: [
    { id: "@cf/openai/gpt-oss-20b", label: "GPT-OSS 20B (fast, default)" },
    { id: "@cf/openai/gpt-oss-120b", label: "GPT-OSS 120B (high quality)" },
    {
      id: "@cf/moonshotai/kimi-k2.5",
      label: "Kimi K2.5 (best for structured output)",
    },
    {
      id: "@cf/meta/llama-4-scout-17b-16e-instruct",
      label: "Llama 4 Scout",
    },
    {
      id: "@cf/mistralai/mistral-small-3.1-24b-instruct",
      label: "Mistral Small 3.1",
    },
  ],
  anthropic: [
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fast)" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-7", label: "Claude Opus 4.7 (best)" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini (fast)" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-5-mini", label: "GPT-5 mini" },
    { id: "gpt-5", label: "GPT-5" },
  ],
  google: [
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (fast)" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  ],
} as const satisfies Record<
  LlmProviderId,
  ReadonlyArray<{ id: string; label: string }>
>;

export const DEFAULT_MODEL: Record<LlmProviderId, string> = {
  cloudflare: "@cf/openai/gpt-oss-20b",
  anthropic: "claude-haiku-4-5",
  openai: "gpt-4o-mini",
  google: "gemini-2.5-flash",
};

export function isValidModel(provider: LlmProviderId, model: string): boolean {
  return MODEL_CATALOG[provider].some((m) => m.id === model);
}
