# CLAUDE.md — Cinemood

> Read this at the start of every session. It contains the project's hard rules and a growing list of lessons learned from real mistakes.

---

## META — Self-Improving CLAUDE.md
> Adapted from https://github.com/aviadr1/claude-meta

### The Magic Prompt
When Claude Code makes a mistake during development, after correcting it, use:
> **"Reflect on this mistake. Abstract and generalize the learning. Write it to CLAUDE.md."**

### Writing Effective Rules
1. Use absolute directives — Start with **NEVER** or **ALWAYS**.
2. Lead with why — Explain the problem before the solution (1–3 bullets max).
3. Be concrete — Include actual commands, code, or file paths.
4. Minimize examples — One clear point per code block.
5. Bullets over paragraphs — Keep explanations concise.
6. Must be project-specific — General coding advice doesn't belong here.
7. Must be expressible in ≤5 lines.

---

## Project rules

### Deployment topology
- **Single domain**: `cinemood.sayantan.cloud`. Cloudflare Pages serves the frontend; a Worker route handles `/api/*` and `/auth/*`.
- **Same-origin only.** No CORS configuration is needed and none should be added — if you find yourself reaching for CORS headers, the route or proxy config is wrong.
- **Cookies:** `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. Same-origin makes Lax sufficient.

### Autonomous execution mode
This project runs Claude Code with `--dangerously-skip-permissions`. The user expects the session to drive itself end-to-end without interactive prompts.

**Default behavior:** keep working. Finish each phase, commit, write `/docs/phase-N.md` summarizing what was done and how it was tested, then immediately start the next phase. Do not ask "should I continue?" — assume yes.

**Pause only for these reasons.** When one of these is hit, write `BLOCKED.md` at the repo root with a precise description of what's needed and what's been tried, then stop:
1. A real secret or credential is missing from `.dev.vars` and cannot be scaffolded around (e.g. Phase 1 needs to actually log in to Google).
2. The same root-cause build/test failure has survived three independent fix attempts.
3. About to do something destructive that wasn't in the spec — `git push --force`, `DROP TABLE` on production, deleting files outside the repo, rewriting history of pushed commits, deleting Cloudflare resources.
4. Phase 7 production deploy needs `wrangler login` (interactive browser flow) or DNS verification.

**Trial and error is fine — silent ambiguity is not.** If the spec doesn't cover something small, pick the most defensible option, document it in `/docs/decisions.md` (one paragraph: question, choice, why), and continue. Do not stop for a coin-flip.

**Self-improving loop is mandatory, not optional.** After every mistake corrected during a phase, append a Learned Rule to `CLAUDE.md` *before* moving on. The rules section is the project's main quality gate during autonomous runs.

**Resource creation is autonomous.** `wrangler d1 create`, `wrangler kv namespace create`, `wrangler r2 bucket create` — capture the IDs from stdout and write them straight into `wrangler.toml`. Don't pause to ask the user to copy-paste IDs.

### File naming
**kebab-case for ALL files. No exceptions.** Component default exports inside files may be PascalCase.

```
watchlist-grid.tsx     ✅
WatchlistGrid.tsx       ❌
use-orama-index.ts     ✅
query-parser.ts        ✅
llm-provider.ts        ✅
```

### Workspace boundaries
- `apps/web` → frontend only. **NEVER** import from `apps/api`.
- `apps/api` → Worker only. **NEVER** import from `apps/web`.
- Shared types only via `packages/shared`.

### Secrets — non-negotiable
- **NEVER** commit `.env`, `.dev.vars`, OAuth secrets, signing keys, or `LLM_CONFIG_KEY`.
- **NEVER** print secret values into chat, logs, error messages, or commit messages.
- Production secrets via `wrangler secret put`. Local via `.dev.vars` (gitignored).
- User-supplied API keys (Anthropic / OpenAI / Google) are AES-GCM encrypted with `LLM_CONFIG_KEY` before being written to KV. **NEVER** log the plaintext key.
- If a secret is ever exposed (chat, screenshot, accidental commit), **rotate it immediately** and treat the old one as compromised.

### LLM provider rules
- The query parser is the **only** LLM call site. **ALWAYS** route through `apps/api/src/llm/index.ts` — never call `env.AI` or any external LLM SDK from anywhere else.
- **ALWAYS** validate LLM output with the zod schema before passing it to Orama. The LLM can hallucinate fields, miss types, or return prose around the JSON.
- Default provider is Cloudflare. If a user has a per-user config in KV, decrypt and use it instead.

### Design rules
- **ALWAYS engage the `frontend-design` skill before any UI work.** The first Cinemood build produced generic stacked-section AI-slop because no design skill was loaded. The skill is the authority on aesthetic direction; load it before planning, not after.
- **ALWAYS use subtle, purposeful motion** — durations 150–300ms, no decorative animation, no pulsing CTAs, no moving gradients, no parallax. See `claude-instructions.md` §9 for the full motion contract. **`prefers-reduced-motion: reduce` is respected globally**, never as an afterthought.
- **Lottie placements are required at**: empty watchlist state, 404 page, first-time sign-in welcome. They are optional (and only used if a static fallback would feel dead) at: post-add success toast, NL-search waiting state if >500ms. Hard rules: max 80KB per Lottie, loop only for steady states, lazy-load, respect reduced-motion.
- **NEVER use the removed skills:** `ui-ux-pro-max-skill` is gone from this project; "21st.dev as a design source" is gone too. 21st.dev MCP may still be used for *component generation* but not as design philosophy.

### Tech stack lock
**NEVER** introduce a new top-level dependency without flagging in chat first. Specifically forbidden without explicit approval: Next.js, Prisma, Postgres, Redis, Auth.js, Express, Apollo, langchain, llama-index. Stay on the stack defined in `claude-instructions.md` §3.

### Build before commit
**ALWAYS** run before any `git commit`:
```bash
bun run typecheck && bun run build
```
If either fails, fix or revert — do not commit broken code.

---

## Git Commit Convention

### Format
```
<gitmoji> <type>(<scope>): <description>
```

### Gitmoji
| Emoji | Type | Use |
|-------|------|-----|
| ✨ | feat | New feature |
| 🐛 | fix | Bug fix |
| 📝 | docs | Documentation |
| ♻️ | refactor | Refactoring |
| ⚡ | perf | Performance |
| ✅ | test | Tests |
| 🔒 | security | Security fix |
| 🔧 | chore | Config / tooling |
| 🗑️ | remove | Removing code/files |
| 🏗️ | arch | Architecture |
| 💄 | ui | UI / style changes |
| 🌐 | i18n | Internationalization |
| 🚀 | deploy | Deployment |
| 🎉 | init | Initial commit |

### Scopes
`web`, `api`, `db`, `auth`, `search`, `settings`, `import`, `ui`, `config`, `shared`

### Rules
1. **Atomic commits** — one logical change per commit.
2. **Group related files only** — different purposes = separate commits.
3. **Subject line under 72 chars.**
4. **Present tense, lowercase** — "add feature" not "Added feature".
5. **Build check** — `bun run build` passes before committing.
6. **No secrets in messages or code.**
7. **No artifacts** — never commit `node_modules/`, `dist/`, `.wrangler/`.

### Commit Command
```bash
git commit -m "$(cat <<'EOF'
<gitmoji> <type>(<scope>): <short description>

<optional body>

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Examples
```
🎉 init: bootstrap monorepo
✨ feat(auth): add google oauth and session middleware
✨ feat(search): pluggable llm parser and orama hybrid search
✨ feat(settings): add configurable llm provider per user
🔒 security(settings): aes-gcm encrypt user llm api keys
💄 ui(web): add glassmorphism cards to watchlist grid
🚀 deploy: production release v0.1.0
```

---

## Codebase Knowledge Graph (Graphify)
> https://github.com/safishamsi/graphify

### When to use
- After Phase 7 ships, build the initial graph.
- Before any major refactor.
- When tracing data flow (e.g. CSV import → D1 → embedding → Orama → search response).

### Usage
```bash
/graphify .
/graphify query "what connects the import flow to the orama index?"
/graphify query "which modules depend on db/queries.ts?"
/graphify . --update
```

### .graphifyignore
```
node_modules/
dist/
.wrangler/
logs/
graphify-out/
apps/web/dist/
```

---

## Learned Rules (Append Below)

_This section grows over time. Each entry is a lesson learned from a real mistake during development. Use the Magic Prompt to add new ones._

<!-- New rules will be appended below this line. -->

### Engage the design skill before any UI work
**ALWAYS** load the `frontend-design` skill via Skill before planning a UI; never default to "minimal glassmorphism" or the spec's reference image.
- Why: the first Cinemood build defaulted to gradient-mesh glassmorphism with no aesthetic commitment, no motion system, and no Lottie placements, producing the generic AI-slop the user explicitly called out.
- How to apply: at the start of any task that touches `apps/web/src`, invoke `Skill(skill="frontend-design:frontend-design")`, commit the chosen direction to `docs/design-plan.md`, and do not write a line of UI code until that plan exists.

### Google avatar needs no-referrer
**ALWAYS** render Google profile pictures with `referrerPolicy="no-referrer"` (or shadcn `<Avatar>` whose `<AvatarImage>` carries the same attribute, with `<AvatarFallback>` for initials).
- Why: `lh3.googleusercontent.com` rejects requests that send a Referer header to a non-Google origin; the previous `<img src={user.picture}>` rendered blank without warning.
- How to apply: every place that renders `user.picture` (currently `avatar-menu.tsx`) must set `referrerPolicy="no-referrer"`; the menu's grey-initial fallback stays as the second line of defence when the URL itself is null.

### Gate every Framer Motion transition through useReducedMotion
**ALWAYS** wire `useReducedMotion()` at the App root and read it (directly or via a `useMotionConfig()` helper) at every motion site — never hardcode `{type:'spring', stiffness:240, damping:24}` inline.
- Why: the previous build hardcoded the same spring on every page and ignored `prefers-reduced-motion`, which §9's hard rules explicitly forbid; users with reduced motion still got the full animation suite.
- How to apply: export a `useMotionConfig()` from `apps/web/src/lib/motion.ts` that returns `{transition, staggerDelay, fadeY}` collapsed to instant/zero when `useReducedMotion()` is true; replace every literal Framer Motion `transition={...}` with the value from that hook.

### Android Kotlin serialization plugin is mandatory
**ALWAYS** include `alias(libs.plugins.kotlin.serialization)` in `apps/android/app/build.gradle.kts` and its entry in `libs.versions.toml`. **NEVER** add a `@Serializable` data class without verifying the plugin is already applied.
- Why: without the compiler plugin, `@Serializable` is a no-op annotation — no serializer code is generated. All `json.decodeFromString<T>()` and Ktor `.body<T>()` calls fail at runtime with "Serializer for class X is not found." The missing plugin caused the entire Android login flow to silently break.
- How to apply: after adding any new `@Serializable` class, run a debug build and confirm no "Serializer for class" errors appear in logcat. If they do, the plugin is missing.

### Ktor ContentNegotiation fails on generic types on non-2xx response paths
**ALWAYS** use `bodyAsText() + json.decodeFromString<ApiResponse<T>>()` for the device-code exchange endpoint instead of `.body<ApiResponse<T>>()`.
- Why: on 400 responses Ktor's ContentNegotiation pipeline attempts to resolve `ApiResponse<T>` using runtime reflection, failing with SerializationException even when the plugin IS applied. `bodyAsText()` reads the raw string first and delegates parsing to kotlinx.serialization directly, which uses the generated serializer and works on any status code.
- How to apply: any `CinemoodApi` method that may receive a non-2xx response with a JSON body should follow the same pattern as `exchangeDeviceCode` (`CinemoodApi.kt`).

### Preserve index-aligned forEach-and-collect loops
**NEVER** let a refactor (or a code-simplifier suggestion) collapse a positional `results.forEach((res, i) => { if (cond(res)) out.push(input[i]) })` pattern into a `filter`/`map` chain when the predicate depends on the call-site index.
- Why: this codebase has two such loops where the index is load-bearing — `addManyToWatchlist`'s D1 batch result (`meta.changes > 0` filters inserted ids, the index links back to `titleIds[i]`) and the import-commit handler's `outcomes[i]` index-aligned mutation (each `items[i]` maps 1:1 to `outcomes[i]` so the result array order is the request order). Collapsing either into a chain throws away the index and silently corrupts the post-condition.
- How to apply: when reviewing simplifier output (or your own factoring) on `apps/api/src/db/watchlist.ts` `addManyToWatchlist` and `apps/api/src/routes/import.ts` commit pipeline, reject any change that drops the explicit `forEach((x, i) => …)` shape or the per-index assignment to `outcomes[i] = …`.
