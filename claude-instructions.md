# Cinemood — Claude Code Init Spec

> **Movies and series, found by mood.**
> A personal watchlist with natural-language search, built on Cloudflare's edge.

This document is the kickoff brief for Claude Code. Read it end-to-end, ask clarifying questions only on genuine ambiguities, then execute Phase 0.

---

## 1. Product in one paragraph

Cinemood lets a signed-in user build a watchlist of movies and series, import existing lists (CSV, textarea, Google Takeout), and find things back using natural language — *"recent sci-fi series with 8+ rating about time travel"*, *"dark Apple TV+ thrillers with Jeremy Strong"*. The wedge feature is search, not social. No feeds, no reviews, no followers. Save → find → mark watched. That's the loop.

---

## 2. Deployment topology (resolved)

**Single-domain routing on `cinemood.sayantan.cloud`:**

- **Frontend** → Cloudflare Pages, serves all paths *except* `/api/*` and `/auth/*`.
- **API + auth** → Cloudflare Worker, mounted via Worker route on `cinemood.sayantan.cloud/api/*` and `cinemood.sayantan.cloud/auth/*`. The Worker route takes precedence over Pages.
- **No CORS, no cross-site cookies** — everything is same-origin. Session cookies use `SameSite=Lax`, `Secure`, `HttpOnly`, `Path=/`.

**OAuth callback URL (production):** `https://cinemood.sayantan.cloud/auth/google/callback`
**OAuth callback URL (local dev):** `http://localhost:8787/auth/google/callback` (the Wrangler dev server). Vite dev server runs on `:5173` and proxies `/api/*` and `/auth/*` to `:8787`.

**Google Cloud project:** `cinemood-495916`
- Authorized JavaScript origins: `https://cinemood.sayantan.cloud`, `http://localhost:5173`, `http://localhost:8787`
- Authorized redirect URIs: `https://cinemood.sayantan.cloud/auth/google/callback`, `http://localhost:8787/auth/google/callback`

---

## 3. Tech stack (locked)

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui (via MCP) |
| Animation | Framer Motion |
| Design inspiration | 21st.dev (via MCP) |
| Auth | Google OAuth (Sign in with Google) |
| Backend | Cloudflare Workers (Hono router) |
| Database | Cloudflare D1 (SQLite) |
| KV | Cloudflare KV (sessions, rate limits, TMDB cache, user LLM config) |
| Object storage | Cloudflare R2 (Orama index snapshots) |
| Search | **Orama** (hybrid full-text + vector) |
| Embeddings | Cloudflare Workers AI: `@cf/baai/bge-base-en-v1.5` (768-dim) |
| LLM (query parser) | **Pluggable** — see §6.1. Default: `@cf/openai/gpt-oss-20b` |
| External data | TMDB (primary), OMDB (fallback / extra ratings) |
| Hosting | Cloudflare Pages (frontend) + Workers (API) |
| Package manager | `bun` |

**Do not introduce new dependencies without flagging them.** No Next.js, no Prisma, no Postgres, no Redis, no Auth.js. Ask first.

---

## 4. Repo layout

Monorepo with two workspaces:

```
cinemood/
├── apps/
│   ├── web/                      # React + Vite + Tailwind frontend (Cloudflare Pages)
│   │   ├── src/
│   │   │   ├── components/       # kebab-case files
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── styles/
│   │   ├── index.html
│   │   ├── vite.config.ts        # proxy /api and /auth to localhost:8787 in dev
│   │   └── tailwind.config.ts
│   │
│   └── api/                      # Cloudflare Worker (Hono)
│       ├── src/
│       │   ├── routes/           # auth, watchlist, search, import, settings
│       │   ├── lib/              # tmdb-client, orama-index, query-parser
│       │   ├── llm/              # provider abstraction (see §6.1)
│       │   │   ├── index.ts            # factory + LlmProvider interface
│       │   │   ├── catalog.ts          # supported models per provider
│       │   │   ├── cloudflare.ts
│       │   │   ├── anthropic.ts
│       │   │   ├── openai.ts
│       │   │   └── google.ts
│       │   ├── db/               # schema, migrations, queries
│       │   └── index.ts
│       ├── wrangler.toml
│       └── migrations/
│
├── packages/
│   └── shared/                   # types shared by web + api
│       └── src/types.ts
│
├── CLAUDE.md                     # rules + learned lessons (self-improving)
├── claude-instructions.md        # this file
├── .dev.vars.example             # template for apps/api/.dev.vars
├── .graphifyignore
├── package.json                  # bun workspaces
└── README.md
```

**Filename rule:** kebab-case for every file. `qr-login.tsx` ✅, `QRLogin.tsx` ❌. Component default exports inside the file may still be PascalCase.

---

## 5. Data model (D1)

```sql
-- users
CREATE TABLE users (
  id TEXT PRIMARY KEY,                   -- google sub
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  created_at INTEGER NOT NULL
);

-- titles  (canonical movie/series cache, shared across users)
CREATE TABLE titles (
  id INTEGER PRIMARY KEY,                -- tmdb id
  type TEXT NOT NULL CHECK (type IN ('movie','series')),
  title TEXT NOT NULL,
  original_title TEXT,
  overview TEXT,
  release_date TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  vote_average REAL,
  vote_count INTEGER,
  runtime INTEGER,
  genres TEXT,                           -- json array
  cast_json TEXT,                        -- json: top 10 cast
  keywords TEXT,                         -- json array
  providers TEXT,                        -- json: streaming providers per region
  imdb_id TEXT,
  imdb_rating REAL,                      -- from omdb
  raw_tmdb TEXT,                         -- full json blob
  fetched_at INTEGER NOT NULL
);

-- watchlist  (user x title)
CREATE TABLE watchlist (
  user_id TEXT NOT NULL,
  title_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','watched')),
  added_at INTEGER NOT NULL,
  watched_at INTEGER,
  notes TEXT,
  PRIMARY KEY (user_id, title_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (title_id) REFERENCES titles(id)
);

CREATE INDEX idx_watchlist_user ON watchlist(user_id, status);
CREATE INDEX idx_titles_release ON titles(release_date);

-- app_settings  (single-row defaults set by the deployer)
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  default_llm_provider TEXT NOT NULL DEFAULT 'cloudflare',
  default_llm_model TEXT NOT NULL DEFAULT '@cf/openai/gpt-oss-20b',
  updated_at INTEGER NOT NULL
);
INSERT INTO app_settings (id, updated_at) VALUES (1, strftime('%s','now'));
```

Sessions live in KV: `session:{id}` → `{userId, expiresAt}`, 30-day TTL.
Per-user LLM config lives in KV: `user:{userId}:llm_config` → AES-GCM-encrypted JSON (§6.1.3).

---

## 6. Search architecture (Phase 4 — read carefully)

### 6.0 The pipeline

```
┌─ user query ─────────────────────────────────────────────────┐
│  "recent sci-fi series with 8+ rating about time travel"     │
└──────────────────────────────────────────────────────────────┘
          │
          ▼
┌─ LLM (configurable, see §6.1) ──────────────────────────────┐
│  System prompt: "Convert to JSON. Schema: {...}"             │
│  Output:                                                     │
│  {                                                           │
│    filters: {                                                │
│      type: ["series"],                                       │
│      genres: ["Science Fiction"],                            │
│      min_rating: 8,                                          │
│      release_after: "2024-01-01"                             │
│    },                                                        │
│    semantic_query: "time travel"                             │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
          │
          ▼
┌─ Orama hybrid search ───────────────────────────────────────┐
│  index.search({                                              │
│    term: semantic_query,                                     │
│    mode: 'hybrid',                                           │
│    where: filters,                                           │
│    limit: 50                                                 │
│  })                                                          │
└──────────────────────────────────────────────────────────────┘
          │
          ▼
       results (with snippets + scores)
```

**Embedding strategy:** when a title is added to the watchlist for the first time, embed `title + overview + keywords + top-cast-names` using `@cf/baai/bge-base-en-v1.5` (768-dim) and store in the Orama index as the `embedding` field. Embeddings are **not** pluggable — keeping them on Cloudflare keeps cost predictable and avoids embedding-model drift across re-indexes.

**Index persistence:** Orama is in-memory. `persist()` → JSON → R2 object `index/{userId}.json`. On Worker cold start for a given user, load from R2 into module-scope cache. Re-persist on every mutation (debounced 5s).

### 6.1 LLM provider abstraction (the configurable bit)

The query parser is the **only** LLM call site, and it must be swappable without code changes.

#### 6.1.1 Provider interface

```ts
// apps/api/src/llm/index.ts
export interface LlmProvider {
  parseQuery(input: string): Promise<ParsedQuery>;
  testConnection(): Promise<{ok: boolean; error?: string; sampleOutput?: ParsedQuery}>;
}

export type LlmConfig =
  | { provider: 'cloudflare'; model: string }                                  // uses env.AI binding
  | { provider: 'anthropic';  model: string; apiKey: string }
  | { provider: 'openai';     model: string; apiKey: string; baseUrl?: string }
  | { provider: 'google';     model: string; apiKey: string };

export function createLlmProvider(cfg: LlmConfig, env: Env): LlmProvider {
  switch (cfg.provider) {
    case 'cloudflare': return new CloudflareProvider(cfg, env);
    case 'anthropic':  return new AnthropicProvider(cfg);
    case 'openai':     return new OpenAIProvider(cfg);
    case 'google':     return new GoogleProvider(cfg);
  }
}
```

**Always validate LLM JSON output with zod after parsing — never trust raw LLM output.**

#### 6.1.2 Supported models (curated catalog)

```ts
// apps/api/src/llm/catalog.ts
export const MODEL_CATALOG = {
  cloudflare: [
    { id: '@cf/openai/gpt-oss-20b',    label: 'GPT-OSS 20B (fast, default)' },
    { id: '@cf/openai/gpt-oss-120b',   label: 'GPT-OSS 120B (high quality)' },
    { id: '@cf/moonshotai/kimi-k2.5',  label: 'Kimi K2.5 (best for structured output)' },
    { id: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout' },
    { id: '@cf/mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral Small 3.1' },
  ],
  anthropic: [
    { id: 'claude-haiku-4-5',          label: 'Claude Haiku 4.5 (fast)' },
    { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6' },
    { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7 (best)' },
  ],
  openai: [
    { id: 'gpt-4o-mini',               label: 'GPT-4o mini (fast)' },
    { id: 'gpt-4o',                    label: 'GPT-4o' },
    { id: 'gpt-5-mini',                label: 'GPT-5 mini' },
    { id: 'gpt-5',                     label: 'GPT-5' },
  ],
  google: [
    { id: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash (fast)' },
    { id: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro' },
  ],
} as const;
```

> **Verify exact model IDs at first use** — names change. The Cloudflare list comes from `https://developers.cloudflare.com/workers-ai/models/`; verify each entry returns 200 on first wire-up. If any tag 404s, surface the error in Settings rather than crashing the parse.

#### 6.1.3 Per-user config storage

KV key: `user:{userId}:llm_config`
Value: AES-GCM-encrypted JSON `{provider, model, apiKey}` using `env.LLM_CONFIG_KEY` (32-byte secret).

Resolution at request time:
1. User-specific config in KV (decrypted) → use it.
2. Otherwise → `app_settings` row (Cloudflare default, no key needed).

#### 6.1.4 Settings UI (`/settings/search`)

- **Provider** dropdown (Cloudflare / Anthropic / OpenAI / Google)
- **Model** dropdown (filtered by provider, from catalog)
- **API key** input (only for non-Cloudflare; masked; "Saved" badge if already set)
- **Test connection** → `POST /api/settings/llm/test` → shows parsed JSON or error
- **Save** → encrypts and writes to KV
- **Reset to default** → deletes the KV key

---

## 7. Phased build plan

Each phase ends with a working, committed, deployed artifact. **Do not start the next phase until the previous one is green and committed.**

### Phase 0 — Bootstrap (≈30 min)
- **First, verify the required MCP servers are reachable** by listing them (e.g. via `claude mcp list` if available, or by attempting a trivial call to each). Required: `shadcn` and `21st-magic`. If either is missing or failing, write `BLOCKED.md` with the exact registration commands the user should run and stop. Do not proceed to scaffolding.
- `bun init` monorepo with workspaces.
- Scaffold `apps/web` (Vite React TS), `apps/api` (`bun create cloudflare`), `packages/shared`.
- Wire Tailwind v4 + shadcn (via MCP) + Framer Motion + Google Sans from Google Fonts.
- Configure `apps/web/vite.config.ts` to proxy `/api` and `/auth` to `http://localhost:8787` in dev.
- Set up `wrangler.toml` bindings: `DB` (D1), `SESSIONS` (KV), `CACHE` (KV), `INDEX_BUCKET` (R2), `AI` (Workers AI).
- Run initial D1 migration (schema in §5).
- Commit: `🎉 init: bootstrap monorepo`.

### Phase 1 — Auth (≈45 min)
- Google OAuth flow at `/auth/google` and `/auth/google/callback` on the Worker.
- Issue session cookie (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`); value is a KV session id.
- `GET /api/me` returns the current user or 401.
- Frontend: landing page (logged out) with "Sign in with Google" → redirects to `/auth/google`. Logged-in home with avatar + sign-out.
- Commit: `✨ feat(auth): add google oauth and session middleware`.

### Phase 2 — Add to watchlist (≈1 hr)
- TMDB search proxy: `GET /api/search/tmdb?q=...` (caches results in KV for 1 day).
- Detail fetch: `GET /api/title/:tmdb_id` (hydrates from TMDB + OMDB, upserts into `titles`).
- `POST /api/watchlist` `{tmdb_id, type}` → upserts `titles`, inserts `watchlist`.
- `DELETE /api/watchlist/:tmdb_id`, `PATCH /api/watchlist/:tmdb_id` `{status}`.
- Frontend: search bar with debounce → poster grid → click adds to watchlist.
- Commit: `✨ feat(watchlist): add tmdb search and add-to-list flow`.

### Phase 3 — Watchlist view + filters (≈45 min)
- `GET /api/watchlist?status=&genre=&year=&type=` (server-side filtering on D1).
- Frontend: poster grid with filter chips, status toggle (pending / watched / all), responsive.
- Glassmorphism cards, framer-motion stagger on mount.
- Commit: `💄 ui(web): add watchlist grid with filters and motion`.

### Phase 4 — NL search (≈3 hr — **the hard one**)
- Build LLM provider abstraction (§6.1.1) with all four providers behind a clean interface.
- Build query-parser with prompt + zod schema, unit-test with 12 hand-written queries (genre+rating, actor+provider, decade+vibe, negation, bare title lookup).
- Build Orama index loader with R2 persistence + module-scope cache.
- Backfill embeddings for any existing watchlist items via `@cf/baai/bge-base-en-v1.5`.
- `POST /api/search` `{query}` runs the full pipeline, returns ranked watchlist items + parsed-filter chips.
- Frontend: dedicated search input above the grid; show parsed filters as removable chips.
- Commit: `✨ feat(search): pluggable llm parser and orama hybrid search`.

### Phase 5 — Settings page (≈1 hr)
- KV plumbing for per-user config + AES-GCM encryption helper.
- `GET/PUT /api/settings/llm` (encrypts/decrypts with `env.LLM_CONFIG_KEY`).
- `POST /api/settings/llm/test` — runs parser against a fixed query, returns parsed JSON or structured error.
- Frontend: `/settings/search` page (§6.1.4).
- Commit: `✨ feat(settings): add configurable llm provider per user`.

### Phase 6 — Bulk import (≈1 hr)
- Textarea: one title per line → backend resolves each via TMDB (best match, with confidence score), shows a confirmation table, user accepts.
- CSV: same flow, accepts Letterboxd / Trakt / IMDb / generic single-column formats.
- Google Takeout: parse the YouTube/Google TV watchlist JSON shape.
- Re-embed all imported items.
- Commit: `✨ feat(import): csv, textarea, and google takeout import`.

### Phase 7 — Polish + deploy (≈1 hr)
- Light/dark theme toggle (system default).
- Empty / loading / error states for every screen.
- 404 page, basic SEO, favicon.
- Configure Cloudflare Pages project for `apps/web`, custom domain `cinemood.sayantan.cloud`.
- Configure Worker route `cinemood.sayantan.cloud/api/*` and `cinemood.sayantan.cloud/auth/*` pointing to the deployed Worker (the Worker route takes precedence over Pages on those paths).
- `wrangler deploy` with all secrets set via `wrangler secret put`.
- Smoke test the OAuth round-trip on production.
- Commit: `🚀 deploy: production release v0.1.0`.

After Phase 7, run `/graphify .` to build the codebase knowledge graph.

---

## 8. Conventions

### File naming
**kebab-case for all files, no exceptions.** Component default exports may be PascalCase inside the file.

### Git
Atomic commits. One logical change each. Build must pass (`bun run build`) before commit. Format:

```
<gitmoji> <type>(<scope>): <description>
```

Scopes: `web`, `api`, `db`, `auth`, `search`, `settings`, `import`, `ui`, `config`, `shared`.

Never commit `.env`, `.dev.vars`, `node_modules/`, `.wrangler/`, `dist/`.

### TypeScript
Strict mode on. No `any` without a `// eslint-disable-next-line` and a comment explaining why.

### API
- All routes return `{ok: true, data}` or `{ok: false, error: {code, message}}`.
- Error codes: `AUTH_REQUIRED`, `NOT_FOUND`, `VALIDATION`, `RATE_LIMITED`, `UPSTREAM_ERROR`, `LLM_ERROR`, `INTERNAL`.
- Validate inputs with `zod`. Schemas live next to routes.
- **LLM JSON output is validated with zod, always.** Never pass raw LLM output to Orama.

### Secrets
Use `.dev.vars` locally, `wrangler secret put` in production. **Never** put TMDB / OMDB / Google client secret / `LLM_CONFIG_KEY` in source. **Never** echo secrets into chat or commit messages.

---

## 9. Design system

### Authority
**Anthropic's `frontend-design` skill is the authoritative design driver** for this project. Load it before any UI work. The skill's directive — commit to a BOLD aesthetic direction and execute it with precision — overrides any generic "minimal glassmorphism" suggestion that may appear earlier in this spec or in git history. The original spec's reference image is *one* possible direction, not a binding constraint.

The aesthetic direction must be chosen and documented in `docs/design-plan.md` before implementation begins, and it must apply consistently across every screen.

### Typography
Google Sans (Google Fonts) is the default body font. The `frontend-design` skill may pair it with a distinctive display font if the chosen aesthetic calls for one (a refined-cinematic direction might pair with a serif like Cormorant or Tiempos; an editorial direction with something like Reckless). Document the pairing in the design plan.

### Components
Lean on shadcn/ui via the MCP. Don't roll custom dropdowns / dialogs / sheets / command palettes when shadcn provides them. For novel surfaces (NL search input, model selector with API-key field, import wizard), the `@21st-dev/magic` MCP is available for component *generation* — but it is not an authority on design direction. The `frontend-design` skill leads; 21st.dev is a tool.

### Motion — subtle, purposeful, accessible

Animation in Cinemood is subtle and purposeful — it confirms actions, smooths transitions, and adds personality where the moment justifies it. It never demands attention or competes with content.

**Hard rules (apply everywhere, no exceptions):**
- **`prefers-reduced-motion: reduce` is respected globally.** Use Framer Motion's `useReducedMotion` hook at app boundaries; in reduced-motion mode, transitions collapse to ≤50ms or disable entirely.
- **Duration ceiling: 300ms** for any component-level transition. 150–250ms is the sweet spot. Longer feels sluggish.
- **Easing default:** Framer Motion spring `{stiffness: 240, damping: 24}` for entrances, `cubic-bezier(0.16, 1, 0.3, 1)` for non-spring tweens.
- **No decorative motion.** No pulsing CTAs at idle. No moving gradients. No floating shapes. No parallax. No scroll-triggered "wow" reveals. No typewriter text effects. No rotating elements unless the rotation represents real waiting state (e.g. a spinner).
- **No bouncing UI elements** except where bounce is the actual affordance (drag-release).

**Where motion appears:**
| Surface | Motion |
|---|---|
| Page / route transitions | Cross-fade, 200ms |
| Modal / dialog open | Spring-in + backdrop fade with blur ramp |
| Card hover (desktop) | scale 1.02 + shadow lift, 150ms ease-out |
| Card tap (mobile) | Brief scale 0.98 press, 100ms |
| Filter chip add / remove | `LayoutGroup` reflow, 200ms |
| Grid mount | Stagger 60–80ms per item, fade-up 8px |
| Watched/unwatched toggle | Checkmark draw-in, 250ms |
| Theme toggle | Full-surface cross-fade, 250ms |
| Command palette open | Backdrop blur + content spring-in |
| Toast / status feedback | Slide-in 200ms, auto-dismiss 3s |

### Lottie animations

Lottie is reserved for the small set of moments where a static illustration would feel dead but a heavy custom motion design would be overkill. Used sparingly — overuse cheapens it.

**Library:** `@lottiefiles/react-lottie-player`
**Source:** lottiefiles.com (filter by free + commercial-use license). Always include the source URL in a code comment next to the JSON import.

**Required Lottie placements:**
- **Empty watchlist state.** Cinematic motif consistent with the chosen aesthetic direction (film reel, projector beam, popcorn-and-couch, marquee lights — pick one that fits).
- **404 page.**
- **First-time sign-in welcome moment.** Plays once per user, then disabled on subsequent sessions (track in localStorage).

**Optional Lottie placements (use only if the placement is otherwise dead and the file is <60KB):**
- Success state after the first watchlist add (small inline Lottie next to the toast, ≤2s, doesn't loop).
- NL search "thinking" state — only if the LLM parse takes >500ms; smaller models that respond in <500ms get a simple shimmer, not a Lottie.

**Hard rules for every Lottie:**
- Loops only for steady states (empty list = loop; welcome = play once; success = play once).
- Respects `prefers-reduced-motion`: pauses on the first frame when reduced motion is set.
- Lazy-loaded JSON. Never blocks initial paint.
- Max file size: **80KB compressed** per Lottie. Run through lottie-optimizer; reject anything larger and replace it.
- Document the LottieFiles source URL and license in a comment in the importing component.

---

## 10. MCP servers

```json
{
  "mcpServers": {
    "shadcn": { "command": "npx", "args": ["shadcn@latest", "mcp"] },
    "@21st-dev/magic": {
      "command": "npx",
      "args": ["-y", "@21st-dev/magic@latest"],
      "env": { "API_KEY": "<set in claude code config, not in source>" }
    }
  }
}
```

---

## 11. External skills

### Required
- **Anthropic `frontend-design` skill** — installed locally as a Claude Code plugin (`/plugin install frontend-design@anthropic`). MUST be engaged for any frontend work. See §9 — this skill is the authoritative design driver.

### Optional, on demand
- https://github.com/ComposioHQ/awesome-claude-skills — directory; check for OAuth or Cloudflare Workers skills if a specific phase needs them.
- https://github.com/vercel-labs/agent-browser — only if needed for import-flow automation.

### Removed
The previously-listed `ui-ux-pro-max-skill` and "21st.dev as a design source" have been removed. They did not engage during the initial build and the design lacked rigor as a result. Do not re-introduce them.

If a skill provides a direct, drop-in pattern, use it. If it conflicts with this spec, **this spec wins** unless flagged.

---

## 12. Local environment

Copy `.dev.vars.example` to `apps/api/.dev.vars` and fill in the values. **Never commit `.dev.vars`.**

```
# apps/api/.dev.vars   (gitignored)
TMDB_API_KEY=...
OMDB_API_KEY=...
GOOGLE_CLIENT_ID=1061373460290-...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...                          # ROTATED secret from google cloud console
GOOGLE_REDIRECT_URI=http://localhost:8787/auth/google/callback
SESSION_SIGNING_KEY=...                           # openssl rand -base64 32
LLM_CONFIG_KEY=...                                # openssl rand -base64 32
```

For production: `wrangler secret put GOOGLE_CLIENT_SECRET`, `wrangler secret put SESSION_SIGNING_KEY`, `wrangler secret put LLM_CONFIG_KEY`, etc. The production `GOOGLE_REDIRECT_URI` should be `https://cinemood.sayantan.cloud/auth/google/callback` and the Worker should detect environment to choose the right one.

---

## 13. Self-improving CLAUDE.md (mandatory)

After every mistake or correction:

> *"Reflect on this mistake. Abstract and generalize the learning. Write it to CLAUDE.md."*

Append to the **Learned Rules** section in `CLAUDE.md`. Rules: project-specific, ≤5 lines, start with **NEVER** or **ALWAYS**, lead with *why*.

---

## 14. Definition of done (per phase)

- [ ] `bun run typecheck` passes in both `apps/web` and `apps/api`.
- [ ] `bun run build` passes.
- [ ] At least one happy-path manual test executed and screenshotted into `/docs/phase-N.md`.
- [ ] Commit made in the gitmoji format.
- [ ] If a mistake was made and corrected during the phase, a Learned Rule was appended to `CLAUDE.md`.

---

## 15. Resolved decisions

All open questions are answered. Proceed to Phase 0 immediately on confirmation.

- ✅ App name: **Cinemood**
- ✅ Production frontend: `https://cinemood.sayantan.cloud` (Cloudflare Pages)
- ✅ Production API + auth: same domain via Worker route on `/api/*` and `/auth/*`
- ✅ Google OAuth client created in project `cinemood-495916` (the user has rotated the secret after our chat handoff)
- ✅ LLM default: `@cf/openai/gpt-oss-20b` on Cloudflare; per-user override via Settings page
