import type { LlmConfig, ParsedQuery } from "@cinemood/shared";
import type { CompleteOptions, LlmMessage, LlmProvider } from "./index";
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

  async complete(messages: LlmMessage[], opts: CompleteOptions = {}): Promise<string> {
    const { maxTokens = 1500, temperature = 0 } = opts;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model,
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    // Gemini separates the system prompt via systemInstruction.
    const sysMsg = messages.find((m) => m.role === "system");
    // Map non-system messages: Gemini uses "model" instead of "assistant".
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(sysMsg ? { systemInstruction: { parts: [{ text: sysMsg.content }] } } : {}),
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: maxTokens,
          temperature,
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
