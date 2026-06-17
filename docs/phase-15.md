# Phase 15 — MCP Server (`@cinemood/mcp`)

## What was built

A stdio MCP server exposing the Cinemood API to Claude Desktop, OpenAI, and any other MCP-compatible client. The server authenticates with a Phase-14 personal access token sent as an `Authorization: Bearer` header on every API call — no session cookie, no browser required.

## Workspace

`apps/mcp` — a new Bun workspace under `apps/*` (auto-picked up by the root `workspaces: ["apps/*"]` config). Language: TypeScript. Transport: stdio. Target runtime: Node.js 18+.

### Dependencies
- `@modelcontextprotocol/sdk@1.29.0` — MCP TypeScript SDK (`McpServer`, `StdioServerTransport`)
- `zod@4.4.3` — input schema validation

## Tools

| Tool | Endpoint | Annotations |
|------|----------|-------------|
| `list_watchlist` | `GET /api/watchlist` | readOnly |
| `search_watchlist` | `POST /api/search` | readOnly |
| `add_to_watchlist` | TMDB search + `POST /api/watchlist` | write |
| `set_status` | `PATCH /api/watchlist/:id` | idempotent, write |
| `remove_from_watchlist` | `DELETE /api/watchlist/:id` | destructive |
| `recommend` | `POST /api/recommend` | readOnly (LLM) |
| `compare_titles` | `POST /api/compare` | readOnly (LLM) |
| `decide_questions` | `POST /api/decide/questions` | readOnly (LLM) |
| `decide_pick` | `POST /api/decide/pick` | readOnly (LLM) |

`add_to_watchlist` has two modes:
1. **Title search**: TMDB lookup → auto-add the top hit (`auto_add: true`, default), or return top 5 for caller to pick (`auto_add: false`).
2. **Direct**: pass `tmdb_id` + `tmdb_type` to skip the search.

## Authentication

The server reads `CINEMOOD_TOKEN` from the environment and sends it as `Authorization: Bearer <token>` on every `cineMoodFetch`. The token must be created at `/settings/tokens` (Phase 14). Token management routes are cookie-only — a compromised token cannot mint more tokens.

Startup check: if `CINEMOOD_TOKEN` is unset, the server logs a human-readable error and exits with code 1 before opening stdio.

## Error handling

`cineMoodFetch` throws on `res.data.ok === false`; the MCP SDK catches thrown errors and surfaces them as tool-call errors. Every error message comes from the API envelope (`json.error.message`) or a fallback `"API error: <status>"`.

## How to use (Claude Desktop)

```json
{
  "mcpServers": {
    "cinemood": {
      "command": "npx",
      "args": ["-y", "@cinemood/mcp"],
      "env": { "CINEMOOD_TOKEN": "cmt_…" }
    }
  }
}
```

## How it was tested

- `npx tsc --project tsconfig.json --noEmit` — clean.
- `bun run build` — compiles to `dist/index.js` without error.
- Root `bun run typecheck` (web + api) — unchanged, both clean.
- Manual smoke: `CINEMOOD_TOKEN=cmt_… node dist/index.js` starts the server and awaits stdio; connection from MCP Inspector confirms all tools are listed with correct schemas.
