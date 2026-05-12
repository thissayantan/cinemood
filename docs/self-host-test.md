# Self-host smoke test

A click-by-click run-through for someone who's never seen this repo, going from "I just landed on the README" to "I am signed in to my own Cinemood instance." Run this end-to-end before announcing a release; every failure mode along the way is what the Deploy-to-Cloudflare button promises to handle.

> Each step lists what to do, what should happen, and how to recover if it doesn't. If you hit something the doc doesn't cover, capture it (screenshot + URL + Worker tail) and add a new row.

---

## Pre-flight

You need:

- A GitHub account.
- A Cloudflare account (free tier is enough).
- Anti-bored patience for the OAuth client setup — ~5 minutes in Google Cloud Console.
- A spare email address you don't mind logging into Google with for the smoke test (so the real account's session isn't reused).

Estimated total: **15 minutes**, of which ~10 is just waiting for Google's OAuth client to propagate.

---

## Step 1 — Land on the README

1. Open https://github.com/thissayantan/cinemood in a private/incognito window (so cached auth doesn't muddy the test).
2. **Expected**: README renders. The badge row shows the live demo, deploy status, "Built with Cloudflare", React 18, TypeScript 5, MIT, stars, last-commit.
3. **Expected**: Directly below the badge row, the Deploy-to-Cloudflare button is visible. The short paragraph under it mentions the five Worker secrets and links to the Self-hosting setup section.
4. **Recover if missing**: the button image is hosted at `deploy.workers.cloudflare.com/button`. Network block? Try with the corporate proxy turned off.

## Step 2 — Click the button

1. Click **Deploy to Cloudflare**.
2. **Expected**: `deploy.workers.cloudflare.com/?url=https://github.com/thissayantan/cinemood` opens. The page identifies the repo as a Workers project and walks through three substeps: (a) authorize GitHub, (b) authorize Cloudflare, (c) name the project + pick an account.
3. Authorize both. Pick the Cloudflare account where you want the Worker to live. Accept the default project name `cinemood` (or rename — the rest of this doc assumes `cinemood`).
4. **Expected**: a status panel shows "Forking repository → Provisioning resources → Running first deploy" and updates live. Forking is a few seconds; resource provisioning is ~30s; first deploy is 60–120s.
5. **Recover**: if the deploy fails with "missing CLOUDFLARE_API_TOKEN", the GitHub Actions side of the connection didn't complete — re-run the connection from the Cloudflare dashboard → Workers & Pages → your project → Settings → Builds.

## Step 3 — First deploy completes

1. **Expected**: the panel shows "Deploy complete" with a button labelled "Open Worker" pointing at `https://cinemood.<your-subdomain>.workers.dev`.
2. **Expected**: clicking through to the Worker URL renders the Cinemood landing page (cream/ink editorial design). The wordmark loads. The filmstrip rails are visible.
3. **Recover if 1014 / route error**: this should not happen on a fresh deploy because the button doesn't set up a custom route — only the `workers.dev` host. If it does, the Worker was likely renamed mid-deploy; re-run the workflow from the Actions tab on the fork.

## Step 4 — Setup-incomplete panel renders

1. **Expected**: instead of a "Sign in with Google" button, the landing page shows the **Setup incomplete** panel. The panel lists all five secrets (`Google OAuth`, `Session signing key`, `LLM config key`, `TMDB API key`, `OMDB API key`) with one-line hints next to each. The headline reads "Setup incomplete" in small mono caps with a small accent dot.
2. **Expected**: opening the network tab, `GET /api/setup-status` returns 200 with `{ ok: true, data: { ready: false, missing: ["google_oauth", "session_signing_key", "llm_config_key", "tmdb_api_key", "omdb_api_key"], secrets: { ...all false } } }`. No secret values are present in the response, anywhere.
3. **Recover if empty page or 500**: the first build's D1 migrations may not have run. Open the fork's Actions tab → latest Deploy run → "Apply D1 migrations" step. If it failed (rare — wrangler-action sometimes throttles on auth), re-run the job; the migrations are idempotent.

## Step 5 — Force the "wrong" sign-in click

1. Click **Sign in with Google** is hidden in step 4 — instead, manually visit `https://cinemood.<sub>.workers.dev/auth/google` to simulate a bookmarked link.
2. **Expected**: the page redirects to `/?setup_error=google_oauth_not_configured`. The Setup incomplete panel renders an extra paragraph at the top: "Google OAuth isn't configured on this deployment yet, so sign-in can't run. Finish the setup below and reload."
3. **Critical**: at no point should Google's own domain show a "redirect_uri_mismatch" or similar — the bounce must happen on the Cinemood side. If Google's page ever appears, the auth guard in `/auth/google` is broken.

## Step 6 — TMDB call returns structured 503

1. While still signed-out, hit `https://cinemood.<sub>.workers.dev/api/search/tmdb?q=arrival` directly.
2. **Expected**: `401 AUTH_REQUIRED` (because no session cookie). This is fine — it shows auth runs first.
3. To verify the upstream-not-configured path, you'll need to be signed in. Defer this check to step 11 below, after sign-in works.

## Step 7 — Set the two random keys

From your fork, locally:

```bash
git clone https://github.com/<you>/cinemood
cd cinemood
bun install

openssl rand -hex 32 | bunx wrangler --cwd apps/api secret put SESSION_SIGNING_KEY --env production
openssl rand -hex 32 | bunx wrangler --cwd apps/api secret put LLM_CONFIG_KEY --env production
```

1. **Expected**: each command prints "✨ Success! Uploaded secret SESSION_SIGNING_KEY" (or similar) and exits 0.
2. **Recover**: if wrangler asks for auth, run `bunx wrangler login` first. If it complains about a missing account id, copy it from `wrangler.toml` or the Cloudflare dashboard.

## Step 8 — Get TMDB + OMDB keys

1. Visit https://www.themoviedb.org/settings/api, create a free account if needed, request a v3 API key. Approval is automatic for personal use. Copy the v3 API key (NOT the v4 read-access token).
2. Visit http://www.omdbapi.com/apikey.aspx, request a free key. They email it within a few minutes.
3. Set both:

```bash
bunx wrangler --cwd apps/api secret put TMDB_API_KEY --env production
# paste value when prompted

bunx wrangler --cwd apps/api secret put OMDB_API_KEY --env production
# paste value when prompted
```

## Step 9 — Create the Google OAuth client

1. Open https://console.cloud.google.com/apis/credentials.
2. Create a new project (or pick an existing personal project).
3. Click **+ Create credentials → OAuth client ID**.
4. Application type: **Web application**.
5. **Authorized JavaScript origins**: `https://cinemood.<sub>.workers.dev` (or your custom domain).
6. **Authorized redirect URIs**: `https://cinemood.<sub>.workers.dev/auth/google/callback` (must match `GOOGLE_REDIRECT_URI` exactly — trailing slash, scheme, port, all of it).
7. Click **Create**. Copy the Client ID and Client Secret from the dialog.
8. Set all three secrets:

```bash
bunx wrangler --cwd apps/api secret put GOOGLE_CLIENT_ID --env production
bunx wrangler --cwd apps/api secret put GOOGLE_CLIENT_SECRET --env production
bunx wrangler --cwd apps/api secret put GOOGLE_REDIRECT_URI --env production
# paste the full callback URL for the third
```

**Expected**: `bunx wrangler --cwd apps/api secret list --env production` lists all seven secret names. **Critical**: this listing should never show values — only names. If it does, something is very wrong.

## Step 10 — Verify the setup-status flip

1. Hit `https://cinemood.<sub>.workers.dev/api/setup-status` (no auth needed).
2. **Expected**: `{ ok: true, data: { ready: true, missing: [], secrets: { google_oauth: true, session_signing_key: true, llm_config_key: true, tmdb_api_key: true, omdb_api_key: true } } }`.
3. Reload the landing page in your private window.
4. **Expected**: the Setup incomplete panel is gone. The **Sign in with Google** button is back.
5. **Recover**: secrets are picked up on the next request, no Worker restart needed. If `ready: false` persists, double-check the secret was set on `--env production` (not the default env, which is `cinemood` without the prod suffix).

## Step 11 — Sign in

1. Click **Sign in with Google**.
2. **Expected**: redirects to `accounts.google.com/o/oauth2/...` with the consent screen. Pick an account and click Continue.
3. **Expected**: bounces back to `/auth/google/callback` then forward to `/`. The page now renders the watchlist home (empty state with the Lottie film-reel placeholder + "Add your first title" copy).
4. **Recover if `?auth_error=db_write_failed`**: the D1 migrations didn't run. Check Actions → latest deploy → "Apply D1 migrations" step output. Re-run the workflow; the next deploy provisions the schema.
5. **Recover if `?auth_error=oauth_failed` with a detail of `redirect_uri_mismatch`**: the value of `GOOGLE_REDIRECT_URI` doesn't match what's in Google Cloud Console exactly. Re-check and re-set the secret.

## Step 12 — Add a title via ⌘ K

1. Press ⌘ K (or Ctrl K on Linux/Windows).
2. **Expected**: the command palette opens. The default mode is **Add**. Type "arrival".
3. **Expected**: search results render after ~300ms. The right pane shows the preview for the highlighted result.
4. **If you instead see** "TMDB not configured" or an `UPSTREAM_NOT_CONFIGURED` error: the TMDB key isn't picked up. Re-run `wrangler secret put TMDB_API_KEY --env production` and confirm `setup-status` shows `tmdb_api_key: true`.
5. Press Enter on a result. The title is added to your watchlist.

## Step 13 — Verify health endpoint

1. Hit `https://cinemood.<sub>.workers.dev/api/health`.
2. **Expected**: `{ ok: true, data: { status: "up", ts: <ms-epoch> } }` with HTTP 200.

---

## Certification checklist

A self-host smoke test counts as **passing** when all of these are true. Tick each one as you verify it:

- [ ] Step 1: README renders with Deploy button + Built-with-Cloudflare badge.
- [ ] Step 3: First deploy completes; Worker is reachable at `*.workers.dev`.
- [ ] Step 4: Landing renders Setup-incomplete panel listing all 5 missing secrets. `setup-status` returns booleans only, no values.
- [ ] Step 5: `/auth/google` bounces to `/?setup_error=google_oauth_not_configured` while Google OAuth is unconfigured. Never reaches Google's domain.
- [ ] Step 7–9: All seven secrets settable via `wrangler secret put` without error.
- [ ] Step 10: After all secrets are set, `setup-status` flips to `ready: true` with `missing: []`. Sign-in button reappears.
- [ ] Step 11: Sign-in completes — Google consent, callback, watchlist home renders.
- [ ] Step 12: ⌘ K Add mode returns TMDB results; adding a title succeeds.
- [ ] Step 13: `/api/health` returns `{ ok: true, status: "up" }`.
- [ ] No secret values appear in: HTTP responses, browser network tab, Worker tail logs, GitHub Actions logs.
- [ ] Total elapsed time from button-click to authenticated home: under 20 minutes (10 of which is Google OAuth setup, not Cinemood).

---

## When this test fails

If a step fails in a way the doc doesn't already cover, capture:

1. The exact URL where it failed.
2. The HTTP status code and response body (sanitised — never log secret values).
3. Last 100 lines of `bunx wrangler --cwd apps/api tail cinemood --env production` from the moment of failure.
4. Relevant GitHub Actions log slice if the failure was at deploy time.

Open an issue against `thissayantan/cinemood` with that bundle. Update this doc to make the failure mode and recovery explicit, so the next person who runs the smoke test doesn't hit it cold.
