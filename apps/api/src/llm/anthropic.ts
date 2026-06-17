import type { LlmConfig, ParsedQuery } from "@cinemood/shared";
import type { CompleteOptions, LlmMessage, LlmProvider } from "./index";
import {
  SYSTEM_PROMPT,
  tryParseJsonObject,
  validateParsedQuery,
} from "./parser";
import { runTestConnection } from "./index";

interface AnthropicResponse {
  type: "message";
  content: { type: string; text?: string }[];
}

export class AnthropicProvider implements LlmProvider {
  private model: string;
  private apiKey: string;

  constructor(cfg: Extract<LlmConfig, { provider: "anthropic" }>) {
    this.model = cfg.model;
    this.apiKey = cfg.apiKey;
  }

  async complete(messages: LlmMessage[], opts: CompleteOptions = {}): Promise<string> {
    const { maxTokens = 1500, temperature = 0 } = opts;
    // Anthropic separates the system prompt from the messages array.
    const sysMsg = messages.find((m) => m.role === "system");
    const nonSys = messages.filter((m) => m.role !== "system");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        ...(sysMsg ? { system: sysMsg.content } : {}),
        messages: nonSys.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`anthropic_${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as AnthropicResponse;
    const text = (json.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
    if (!text) throw new Error("anthropic_empty_response");
    return text;
  }

  async parseQuery(input: string): Promise<ParsedQuery> {
    const messages: LlmMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: input },
    ];
    const text = await this.complete(messages, { maxTokens: 512, temperature: 0 });
    const obj = tryParseJsonObject(text);
    return validateParsedQuery(obj);
  }

  testConnection() {
    return runTestConnection(this);
  }
}
