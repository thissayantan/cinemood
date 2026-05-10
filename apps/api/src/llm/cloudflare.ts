import type { LlmConfig, ParsedQuery } from "@cinemood/shared";
import type { Env } from "../env";
import type { LlmProvider } from "./index";
import {
  SYSTEM_PROMPT,
  tryParseJsonObject,
  validateParsedQuery,
} from "./parser";
import { runTestConnection } from "./index";

// Workers AI returns one of several shapes depending on the model family.
// We probe each known shape rather than ship per-model branching.
function extractText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;

  if (typeof r.response === "string") return r.response;
  if (
    r.result &&
    typeof r.result === "object"
  ) {
    const inner = (r.result as Record<string, unknown>).response;
    if (typeof inner === "string") return inner;
  }
  if (Array.isArray(r.choices) && r.choices.length > 0) {
    const msg = (r.choices[0] as { message?: { content?: string } }).message;
    if (msg && typeof msg.content === "string") return msg.content;
  }
  if (Array.isArray(r.output)) {
    const parts: string[] = [];
    for (const block of r.output as unknown[]) {
      if (!block || typeof block !== "object") continue;
      const b = block as { content?: unknown };
      if (Array.isArray(b.content)) {
        for (const seg of b.content as unknown[]) {
          if (seg && typeof seg === "object") {
            const s = seg as { text?: unknown; type?: string };
            if (typeof s.text === "string") parts.push(s.text);
          }
        }
      }
    }
    if (parts.length > 0) return parts.join("");
  }
  if (typeof r.output_text === "string") return r.output_text;
  return "";
}

export class CloudflareProvider implements LlmProvider {
  private model: string;
  private env: Env;

  constructor(cfg: Extract<LlmConfig, { provider: "cloudflare" }>, env: Env) {
    this.model = cfg.model;
    this.env = env;
  }

  async parseQuery(input: string): Promise<ParsedQuery> {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: input },
    ];

    // gpt-oss models accept the OpenAI Responses-API shape via `input` and
    // a top-level `instructions`; everything else uses chat-style `messages`.
    const isGptOss = this.model.startsWith("@cf/openai/gpt-oss");
    const payload = isGptOss
      ? {
          instructions: SYSTEM_PROMPT,
          input,
          reasoning: { effort: "low" },
        }
      : { messages, max_tokens: 512, temperature: 0 };

    const result = await this.env.AI.run(this.model as never, payload as never);
    const text = extractText(result);
    if (!text) {
      throw new Error(
        `cloudflare_ai_empty_response: shape=${
          typeof result === "object"
            ? Object.keys(result as object).join(",")
            : typeof result
        }`,
      );
    }
    const obj = tryParseJsonObject(text);
    return validateParsedQuery(obj);
  }

  testConnection() {
    return runTestConnection(this);
  }
}
