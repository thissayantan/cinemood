export interface Env {
  // Bindings
  DB: D1Database;
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  INDEX_BUCKET: R2Bucket;
  AI: Ai;
  // Static assets binding — present in production where the Worker also
  // serves the SPA build from apps/web/dist via wrangler `[assets]`.
  // Unbound in local dev (Vite serves the frontend separately on :5173).
  // Routing happens before user code: run_worker_first routes /api/* and
  // /auth/* here, everything else is served by the asset router. The
  // binding is declared so the type stays accurate, but the Worker code
  // never needs to call it manually.
  ASSETS?: Fetcher;

  // Vars / secrets
  ENVIRONMENT: "development" | "production";
  // Optional origin to redirect OAuth callbacks back to. In dev this is the
  // Vite server (http://localhost:5173) because the Worker doesn't serve "/".
  // In prod the Worker and Pages share an origin, so it can stay empty and
  // the worker emits relative redirects.
  WEB_ORIGIN?: string;
  TMDB_API_KEY: string;
  OMDB_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  SESSION_SIGNING_KEY: string;
  LLM_CONFIG_KEY: string;
}
