import type { Env } from "../env";

/** Setup-status snapshot — booleans only, never values.
 *
 *  Returned by `/api/setup-status` (public, no auth required) so a fresh
 *  Deploy-to-Cloudflare fork can render an actionable "Setup incomplete"
 *  panel on the landing page instead of dead-ending at an opaque 500 or
 *  a sign-in button that loops on a misconfigured OAuth client.
 *
 *  Anything sensitive — TMDB / OMDB keys, OAuth client secret, session
 *  signing key, LLM config key — is collapsed to a boolean before
 *  serialisation. Presence is fact; the value never leaves the worker. */
export interface SetupStatus {
  ready: boolean;
  missing: SetupSecretName[];
  secrets: Record<SetupSecretName, boolean>;
}

export type SetupSecretName =
  | "google_oauth"
  | "session_signing_key"
  | "llm_config_key"
  | "tmdb_api_key"
  | "omdb_api_key";

function present(v: string | undefined | null): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export function checkSetupStatus(env: Env): SetupStatus {
  const secrets: Record<SetupSecretName, boolean> = {
    // Google OAuth is a tuple — all three must be present to do the flow.
    google_oauth:
      present(env.GOOGLE_CLIENT_ID) &&
      present(env.GOOGLE_CLIENT_SECRET) &&
      present(env.GOOGLE_REDIRECT_URI),
    session_signing_key: present(env.SESSION_SIGNING_KEY),
    llm_config_key: present(env.LLM_CONFIG_KEY),
    tmdb_api_key: present(env.TMDB_API_KEY),
    omdb_api_key: present(env.OMDB_API_KEY),
  };
  const missing = (
    Object.entries(secrets) as [SetupSecretName, boolean][]
  )
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  return { ready: missing.length === 0, missing, secrets };
}
