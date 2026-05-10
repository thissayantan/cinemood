import type { LlmConfig } from "@cinemood/shared";
import type { Env } from "../env";
import { DEFAULT_MODEL } from "./catalog";

interface AppSettingsRow {
  default_llm_provider: LlmConfig["provider"];
  default_llm_model: string;
}

/**
 * Resolve which LlmConfig to use for the given user.
 * Phase 4: only the global app_settings row is consulted (Cloudflare default).
 * Phase 5 will add per-user encrypted overrides via KV `user:{id}:llm_config`.
 */
export async function resolveLlmConfig(
  env: Env,
  _userId: string,
): Promise<LlmConfig> {
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
