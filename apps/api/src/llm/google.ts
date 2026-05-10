import type { LlmConfig, ParsedQuery } from "@cinemood/shared";
import type { LlmProvider } from "./index";
import {
  SYSTEM_PROMPT,
  tryParseJsonObject,
  validateParsedQuery,
} from "./parser";
import { runTestConnection } from "./index";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

export class GoogleProvider implements LlmProvider {
  private model: string;
  private apiKey: string;

  constructor(cfg: Extract<LlmConfig, { provider: "google" }>) {
    this.model = cfg.model;
    this.apiKey = cfg.apiKey;
  }

  async parseQuery(input: string): Promise<ParsedQuery> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model,
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: input }] }],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 512,
          temperature: 0,
        },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`google_${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as GeminiResponse;
    if (json.error?.message) throw new Error(`google: ${json.error.message}`);
    const text =
      json.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("") ?? "";
    if (!text) throw new Error("google_empty_response");
    const obj = tryParseJsonObject(text);
    return validateParsedQuery(obj);
  }

  testConnection() {
    return runTestConnection(this);
  }
}
