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

### Hono context types
**ALWAYS** declare an explicit `Context<{Bindings; Variables}>` alias for shared route helpers — never derive it via `Parameters<typeof app.get>` or similar.
- Why: Hono overloads route methods so `Parameters<...>` collapses to `never` and your helper silently breaks every call site with `Argument of type Context is not assignable to parameter of type never`.
- How to apply: at the top of any `apps/api/src/routes/*.ts` that needs a `requireUser`-style helper, add `type Ctx = Context<{Bindings: Env; Variables: AuthVars}>` and type helpers `(c: Ctx)`.

### Workers AI response shapes vary per model family
**ALWAYS** route every `env.AI.run(...)` chat result through a shape-probing extractor — never assume `result.response` exists.
- Why: `@cf/openai/gpt-oss-*` returns the OpenAI Responses-API shape (`output[].content[].text`) with `instructions`+`input` request keys; `@cf/meta/llama-*` and friends return `{response}` with `messages`+`max_tokens` request keys. A single hard-coded shape produces silent empty-string responses.
- How to apply: keep `extractText(result)` in `apps/api/src/llm/cloudflare.ts` covering `response`, `result.response`, `choices[0].message.content`, `output[].content[].text`, `output_text`. If you add a model whose family differs from the existing branches, also branch the request payload (`isGptOss` pattern).

### Orama 3.x where/properties pitfalls
**ALWAYS** keep Orama's where-clause shapes and full-text `properties` aligned with the schema types.
- Why: (1) `properties: ['title', 'overview']` only accepts `string`/`string[]` fields — passing an `enum[]` like `keywords` throws `Invalid property name`. (2) `where` on `enum` needs `{eq}` or `{in: [...]}` — bare arrays throw `Invalid operation`. (3) Numeric ranges combine via `{between: [a,b]}`; mixing `{gte, lte}` throws `You can only use one operation per filter`.
- How to apply: in `apps/api/src/lib/orama-index.ts`, restrict full-text `properties` to true string fields and rely on the embedding for keyword/cast recall; use `{eq}`/`{in}` for enums, `{containsAny}` for `enum[]`, and collapse `min`+`max` into `{between}`.

### One-command monorepo dev
**ALWAYS** expose a single root `bun run dev` for monorepo dev. Two-terminal flows are a tax we've decided not to pay.
- Why: starting `apps/api` and `apps/web` separately is fiddly, easy to forget, and turns "did you start both?" into a recurring question; a single command eliminates an entire class of self-inflicted bugs.
- How to apply: keep `concurrently -n api,web -c blue,magenta --kill-others-on-fail "bun --filter @cinemood/api dev" "bun --filter @cinemood/web dev"` as the root `dev` script and add `concurrently` to root devDependencies. Per-side `dev:api`/`dev:web` may exist as escape hatches but never as the documented default.

### Per-user serialization for Orama index mutations
**ALWAYS** funnel `addTitleToIndex` / `removeTitleFromIndex` for the same userId through a per-user `Promise` queue.
- Why: multiple `c.executionCtx.waitUntil(addTitleToIndex(...))` from back-to-back POSTs share the module-scope cache and the Orama db reference, then interleave at every `await` boundary; in our smoke this consistently left the first item's `embedding` empty and the index unsearchable. The waitUntil tasks must be serialized per-user — the global cache is not concurrency-safe.
- How to apply: keep `serializePerUser(userId, async () => { … })` in `apps/api/src/lib/orama-index.ts` wrapping both mutators. Reads (search) need not be locked.

### Orama insert mutates the doc in place
**ALWAYS** pass a `structuredClone(doc)` to `insert(db, doc)` whenever the doc is also stored in your own cache and later JSON-serialised.
- Why: Orama 3.x rewrites `vector[N]` fields into a typed-array view during insert; the original reference's `embedding` then `JSON.stringify`s as `null`, which permanently corrupts the persisted R2 snapshot.
- How to apply: in `orama-index.ts`'s `addTitleToIndex` and `buildFromDocs`, store the original IndexDoc in `cached.docs` and hand `structuredClone(doc)` to Orama. Don't share refs between "what we own" and "what Orama owns."

### Avoid Orama 3.x `mode: "hybrid"` with `where` filters
**ALWAYS** pick a single Orama search mode based on what we have, never `"hybrid"` with where-clauses.
- Why: in Orama 3.1.18 a hybrid search collapses to zero hits whenever the where-filter narrows the candidate set, even when the vector half clearly matches and the filtered docs exist. Bare-title queries that match by token still work; everything else loses recall.
- How to apply: in `searchIndex`, use `mode: "vector"` (with `similarity: 0`, optional `term`) when we have a query embedding, `mode: "fulltext"` (with `properties: ["title","overview"]`) when we only have a term, and the default filter-only mode when there is no term — never `"hybrid"` with a where.
