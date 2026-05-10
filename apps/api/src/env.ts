export interface Env {
  // Bindings
  DB: D1Database;
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  INDEX_BUCKET: R2Bucket;
  AI: Ai;

  // Vars / secrets
  ENVIRONMENT: "development" | "production";
  TMDB_API_KEY: string;
  OMDB_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  SESSION_SIGNING_KEY: string;
  LLM_CONFIG_KEY: string;
}
