import type { LlmConfig } from "@cinemood/shared";
import type { Env } from "../env";
import { decryptJson, encryptJson } from "./crypto";

export function userLlmKey(userId: string): string {
  return `user:${userId}:llm_config`;
}

export async function readUserLlmConfig(
  env: Env,
  userId: string,
): Promise<LlmConfig | null> {
  const blob = await env.SESSIONS.get(userLlmKey(userId));
  if (!blob) return null;
  try {
    return await decryptJson<LlmConfig>(env.LLM_CONFIG_KEY, blob);
  } catch (err) {
    console.error("decrypt llm config failed", err);
    return null;
  }
}

export async function writeUserLlmConfig(
  env: Env,
  userId: string,
  cfg: LlmConfig,
): Promise<void> {
  const blob = await encryptJson(env.LLM_CONFIG_KEY, cfg);
  await env.SESSIONS.put(userLlmKey(userId), blob);
}

export async function deleteUserLlmConfig(
  env: Env,
  userId: string,
): Promise<void> {
  await env.SESSIONS.delete(userLlmKey(userId));
}
