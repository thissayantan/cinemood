import { useEffect, useState } from "react";
import { api } from "./api";

/** Setup-status snapshot shape — kept in sync with
 *  `apps/api/src/lib/setup-status.ts`. Booleans only — the API never
 *  returns the secret values themselves. */
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

export type SetupStatusState =
  | { status: "loading" }
  | { status: "ok"; status_data: SetupStatus }
  | { status: "err" };

/** Polls /api/setup-status once on mount. Public endpoint (no auth),
 *  used by the landing page so a freshly-forked deploy can render an
 *  actionable "Setup incomplete" panel listing exactly which secrets
 *  still need to be set via `wrangler secret put`. */
export function useSetupStatus(): SetupStatusState {
  const [state, setState] = useState<SetupStatusState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api<SetupStatus>("/api/setup-status");
      if (cancelled) return;
      if (res.ok) setState({ status: "ok", status_data: res.data });
      else setState({ status: "err" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export const SETUP_SECRET_LABELS: Record<
  SetupSecretName,
  { name: string; hint: string }
> = {
  google_oauth: {
    name: "Google OAuth",
    hint:
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI — create an OAuth client at console.cloud.google.com",
  },
  session_signing_key: {
    name: "Session signing key",
    hint: "SESSION_SIGNING_KEY — any random 32-byte hex string (openssl rand -hex 32)",
  },
  llm_config_key: {
    name: "LLM config key",
    hint:
      "LLM_CONFIG_KEY — random 32-byte hex used to AES-GCM-encrypt user-supplied LLM API keys at rest",
  },
  tmdb_api_key: {
    name: "TMDB API key",
    hint: "TMDB_API_KEY — themoviedb.org/settings/api",
  },
  omdb_api_key: {
    name: "OMDB API key",
    hint: "OMDB_API_KEY — omdbapi.com/apikey.aspx (for IMDb rating fallback)",
  },
};
