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
bun install
cp .dev.vars.example apps/api/.dev.vars   # then fill values
bun run dev
```

Frontend runs on `:5173`, API on `:8787`. Vite proxies `/api` and `/auth` to the Worker.

## Conventions
See `CLAUDE.md` and `claude-instructions.md` for hard rules and the build plan.
