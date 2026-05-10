import type { LlmConfig, ParsedQuery } from "@cinemood/shared";
import type { LlmProvider } from "./index";
import {
  SYSTEM_PROMPT,
  tryParseJsonObject,
  validateParsedQuery,
} from "./parser";
import { runTestConnection } from "./index";

interface OpenAIChatResponse {
  choices: { message: { content: string | null } }[];
}

export class OpenAIProvider implements LlmProvider {
  private model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(cfg: Extract<LlmConfig, { provider: "openai" }>) {
    this.model = cfg.model;
    this.apiKey = cfg.apiKey;
    this.baseUrl = cfg.baseUrl ?? "https://api.openai.com/v1";
  }

  async parseQuery(input: string): Promise<ParsedQuery> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input },
        ],
        response_format: { type: "json_object" },
        max_tokens: 512,
        temperature: 0,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`openai_${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as OpenAIChatResponse;
    const text = json.choices[0]?.message.content ?? "";
    if (!text) throw new Error("openai_empty_response");
    const obj = tryParseJsonObject(text);
    return validateParsedQuery(obj);
  }

  testConnection() {
    return runTestConnection(this);
  }
}
