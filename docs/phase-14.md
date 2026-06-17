# Phase 14 — Personal Access Tokens

## What was built

Bearer-token authentication layer for Cinemood, enabling MCP and Android clients to authenticate without the interactive Google OAuth cookie flow. Tokens use a `cmt_` prefix, are identified by SHA-256 hash, returned once, and tie into the existing logout-everywhere revocation watermark.

### Backend

**Migration `0005_access_tokens.sql`**
- `access_tokens(id, user_id FK CASCADE, name, token_hash UNIQUE, prefix, created_at, last_used_at, expires_at)`
- Indexes on `user_id` (list query) and `token_hash` (auth hot path).

**`apps/api/src/lib/access-token.ts`**
- `generateRawToken()` — `cmt_` + base64url(32 cryptographically-random bytes). **Never stored.**
- `hashToken(raw)` — SHA-256 hex via `crypto.subtle.digest`. This is stored.
- `tokenPrefix(raw)` — first 12 chars (e.g. `cmt_XXXXXXXX`) shown in UI for identification.

**`apps/api/src/db/access-tokens.ts`**
- `createAccessToken`, `listAccessTokens` (public fields only — `token_hash` never returned), `findUserByTokenHash` (joins `users` for `min_issued_at` in one query), `revokeAccessToken`.

**`apps/api/src/middleware/auth.ts`** — now a two-path middleware:
1. **Bearer path** (checked first): `Authorization: Bearer cmt_…` → SHA-256 hash → DB lookup → validate expiry + `created_at >= user.min_issued_at` watermark. Sets `authMethod = "bearer"`. Invalid Bearer → 401 immediately (does **not** fall through to cookie — avoids confusion).
2. **Cookie path** (unchanged): existing HMAC-signed `cm_session` flow.
3. `waitUntil(touchLastUsed)` fires after response on every valid Bearer request (non-blocking last-used update).

**`apps/api/src/routes/tokens.ts`**
- `GET /api/settings/tokens` — list all tokens (public fields).
- `POST /api/settings/tokens` `{ name, expires_in_days? }` — create; returns `{ ...tokenPublic, raw }` with the raw token once. Raw is never logged, cached, or re-retrievable.
- `DELETE /api/settings/tokens/:id` — revoke.
- All three routes use `cookieOnlyGuard` — Bearer-authed requests are rejected with 403 to prevent a compromised token from minting more tokens.

### Frontend

**`apps/web/src/pages/settings-tokens.tsx`**
- Two-column layout on large screens (token list left, create form right).
- **Token list**: each row shows `prefix…` + name + created/last-used/expires dates + "Revoke" button.
- **One-time reveal**: when a token is created, an amber warning panel slides in with the raw token in a monospace code block + "Copy" button (turns green with "Copied ✓"). The panel can be manually dismissed. Navigating away or closing the panel removes the token from the DOM forever.
- **Create form**: name (required) + expiry dropdown (never / 30 / 90 / 365 days) + "Generate token" button.
- Claude Desktop config snippet in the sidebar as a practical onboarding hint.
- Linked from `settings-account.tsx` → new "API tokens" entry in the settings nav.

**`apps/web/src/app.tsx`** — `/settings/tokens` route under `AuthedShell`.

## How it was tested

- `bun run typecheck` — all clean.
- `bun run build` — passes.
- Migration: `wrangler d1 migrations apply cinemood --local` — `0005_access_tokens.sql ✅`.
- Token create flow: create → amber panel appears with raw token → copy → dismiss.
- API smoke: `curl -H "Authorization: Bearer cmt_…" /api/watchlist` returns the watchlist list.
- Revoke smoke: token deleted, subsequent Bearer request returns 401.
- Logout-everywhere: `min_issued_at` bump invalidates tokens created before that watermark.

## Security decisions

- **Hash only**: raw token never touches the database. Even a full DB dump reveals no usable tokens.
- **Watermark reuse**: logout-everywhere already bumps `min_issued_at` on the users table; tokens respect the same watermark for free. One nuke kills both sessions and tokens.
- **Cookie-only management**: the tokens CRUD routes reject Bearer auth — a leaked token cannot mint more tokens or revoke others.
- **Non-blocking last-used**: `waitUntil(UPDATE)` — the response is not delayed for the accounting write.
