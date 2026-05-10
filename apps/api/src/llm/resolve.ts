import type { LlmConfig } from "@cinemood/shared";
import type { Env } from "../env";
import { DEFAULT_MODEL } from "./catalog";
import { readUserLlmConfig } from "../lib/user-llm";

interface AppSettingsRow {
  default_llm_provider: LlmConfig["provider"];
  default_llm_model: string;
}

export async function resolveLlmConfig(
  env: Env,
  userId: string,
): Promise<LlmConfig> {
  const userCfg = await readUserLlmConfig(env, userId);
  if (userCfg) return userCfg;

  const row = await env.DB.prepare(
    `SELECT default_llm_provider, default_llm_model FROM app_settings WHERE id = 1`,
  ).first<AppSettingsRow>();

  if (row && row.default_llm_provider === "cloudflare") {
    return {
      provider: "cloudflare",
      model: row.default_llm_model || DEFAULT_MODEL.cloudflare,
    };
  }
  return { provider: "cloudflare", model: DEFAULT_MODEL.cloudflare };
}
