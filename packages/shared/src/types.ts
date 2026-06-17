export type TitleType = "movie" | "series";
export type WatchStatus = "pending" | "watching" | "watched";

export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface TitleSummary {
  id: number;
  type: TitleType;
  title: string;
  release_date: string | null;
  poster_path: string | null;
  vote_average: number | null;
}

export interface Title extends TitleSummary {
  original_title: string | null;
  overview: string | null;
  backdrop_path: string | null;
  vote_count: number | null;
  runtime: number | null;
  genres: string[];
  cast: { name: string; character?: string }[];
  keywords: string[];
  providers: Record<string, unknown> | null;
  imdb_id: string | null;
  imdb_rating: number | null;
}

export interface WatchlistItem {
  title: Title;
  status: WatchStatus;
  added_at: number;
  started_at: number | null;
  watched_at: number | null;
  notes: string | null;
  /** Per-user catalog number (Criterion-spine style). Auto-assigned on insert. */
  catalog_no: number;
}

export type WatchlistSort =
  | "added_desc"
  | "added_asc"
  | "title_asc"
  | "year_desc"
  | "year_asc"
  | "rating_desc"
  | "catalog_desc"
  | "started_desc";

export interface WatchlistFilters {
  status?: WatchStatus;
  type?: TitleType;
  genre?: string;
  year?: string;
  year_min?: number;
  year_max?: number;
  min_rating?: number;
  runtime_min?: number;
  runtime_max?: number;
  providers?: string[];
  sort?: WatchlistSort;
}

export type LlmProviderId = "cloudflare" | "anthropic" | "openai" | "google";

export type LlmConfig =
  | { provider: "cloudflare"; model: string }
  | { provider: "anthropic"; model: string; apiKey: string }
  | { provider: "openai"; model: string; apiKey: string; baseUrl?: string }
  | { provider: "google"; model: string; apiKey: string };

export interface LlmConfigPublic {
  provider: LlmProviderId;
  model: string;
  hasKey: boolean;
}

export interface ParsedQueryFilters {
  type?: TitleType[];
  genres?: string[];
  min_rating?: number;
  max_rating?: number;
  release_after?: string;
  release_before?: string;
  cast?: string[];
  keywords?: string[];
  providers?: string[];
  exclude_genres?: string[];
}

export interface ParsedQuery {
  filters: ParsedQueryFilters;
  semantic_query: string;
}

// ─── Recommendation (mood picker) ───────────────────────────────────────────

export interface SwipeAnswer {
  question_id: string;
  option_id: string;
}

export interface Recommendation {
  title_id: number;
  score: number;
  reason: string;
}

export interface RecommendResponse {
  recommendations: Recommendation[];
  items: WatchlistItem[];
  mood: string;
}

// ─── Compare table ───────────────────────────────────────────────────────────

export interface CompareCell {
  title_id: number;
  // Deterministic columns (from titles table)
  title: string;
  year: string | null;
  type: TitleType;
  runtime: number | null;
  genres: string[];
  providers: string[];
  vote_average: number | null;
  imdb_rating: number | null;
  // AI-generated columns
  mood: string;
  pacing: string;
  tone: string;
  critical_consensus: string;
  watch_if_you_liked: string[];
}

export interface CompareResponse {
  rows: CompareCell[];
}

// ─── Swipe Q&A decider ───────────────────────────────────────────────────────

export interface SwipeOption {
  id: string;
  label: string;
}

export interface SwipeQuestion {
  id: string;
  prompt: string;
  options: SwipeOption[];
}

export interface DecideQuestionsResponse {
  questions: SwipeQuestion[];
  candidate_ids: number[];
}

export interface DecidePickResponse {
  winner: WatchlistItem;
  reason: string;
  runners_up: { item: WatchlistItem; reason: string }[];
}

// ─── Personal access tokens ───────────────────────────────────────────────────

export interface AccessTokenPublic {
  id: string;
  name: string;
  prefix: string;
  created_at: number;
  last_used_at: number | null;
  expires_at: number | null;
}

export type ApiOk<T> = { ok: true; data: T };
export type ApiError = {
  ok: false;
  error: {
    code:
      | "AUTH_REQUIRED"
      | "NOT_FOUND"
      | "VALIDATION"
      | "RATE_LIMITED"
      | "UPSTREAM_ERROR"
      | "LLM_ERROR"
      | "INTERNAL";
    message: string;
  };
};
export type ApiResponse<T> = ApiOk<T> | ApiError;
