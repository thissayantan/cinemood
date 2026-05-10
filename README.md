# Cinemood

Movies and series, found by mood. A personal watchlist with natural-language search, built on Cloudflare's edge.

## Stack
React 18 + Vite + Tailwind v4 (frontend) · Cloudflare Workers + Hono (API) · D1 + KV + R2 + Workers AI · Orama hybrid search · pluggable LLM (Cloudflare default; per-user Anthropic / OpenAI / Google).

## Layout
- `apps/web` — Vite React frontend (Cloudflare Pages).
- `apps/api` — Hono Worker (`/api/*`, `/auth/*`).
- `packages/shared` — types shared by web + api.

## Local dev

```bash
git clone …
cd cinemood
bun install
cp .dev.vars.example apps/api/.dev.vars   # then fill values
bun run dev
```

That single `bun run dev` from the repo root starts the Worker and the Vite dev server in parallel via `concurrently`, with prefixed colour-coded output (`api` blue, `web` magenta). Ctrl+C tears both down. The API listens on `:8787`, the web app on `:5173`, and Vite proxies `/api/*` and `/auth/*` to the Worker.

Per-side scripts are kept around for the rare case you want only one half: `bun run dev:api` and `bun run dev:web`.

## Conventions
See `CLAUDE.md` and `claude-instructions.md` for hard rules and the build plan.
