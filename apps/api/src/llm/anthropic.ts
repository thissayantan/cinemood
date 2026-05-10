import type { LlmConfig, ParsedQuery } from "@cinemood/shared";
import type { LlmProvider } from "./index";
import {
  SYSTEM_PROMPT,
  tryParseJsonObject,
  validateParsedQuery,
} from "./parser";
import { runTestConnection } from "./index";

interface AnthropicMessage {
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

  async parseQuery(input: string): Promise<ParsedQuery> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: input }],
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`anthropic_${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as AnthropicMessage;
    const text = (json.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("");
    if (!text) throw new Error("anthropic_empty_response");
    const obj = tryParseJsonObject(text);
    return validateParsedQuery(obj);
  }

  testConnection() {
    return runTestConnection(this);
  }
}
