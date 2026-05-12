# Deployment

Every push to `main` deploys the Worker (+ bundled SPA) to production automatically via the `.github/workflows/deploy.yml` GitHub Actions workflow.

## What triggers a deploy

- **Any push to `main`.** PR merges, direct pushes, anything that lands a new commit on `main` kicks off the workflow.
- **Manual re-runs.** GitHub → Actions tab → **Deploy** workflow → **Run workflow** dropdown → branch `main` → **Run**. Useful for redeploying a known-good SHA after a flaky third-party (TMDB / Workers AI / npm registry) caused an earlier run to fail.

The `concurrency: deploy-main` group cancels in-flight deploys if a newer push lands on `main` — fix-up commits don't queue behind slow previous runs.

## What the workflow does

1. Checks out the commit at the head of `main`.
2. Sets up Bun (latest) and installs dependencies with `--frozen-lockfile`.
3. **Gate:** `bun run typecheck` across all workspaces. Fails the run on any TS error.
4. **Gate:** `bun run --filter '@cinemood/web' build`. Produces `apps/web/dist/` — the SPA bundle the Worker serves via `[env.production.assets] directory = "../web/dist"` in `apps/api/wrangler.toml`.
5. **Deploy:** `cloudflare/wrangler-action@v3` runs `wrangler deploy --env production` from `apps/api/`. Wrangler picks up the freshly-built `apps/web/dist`, uploads any changed assets, and rolls out the new Worker version on the route `cinemood.sayantan.cloud/*`.
6. **Smoke:** curls `https://cinemood.sayantan.cloud/api/health` up to 5 times with a 5s delay and asserts HTTP 200. A green deploy with a red app is the worst kind of silent failure; this step makes that loud.

A run takes ≈ 2 minutes when everything's healthy.

## Required GitHub secrets

These two secrets must exist in **Settings → Secrets and variables → Actions → Repository secrets** before the first run will succeed:

| Name | Value | How to create |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Custom API token (see permissions below) | Cloudflare dashboard → My Profile → API Tokens → **Create Token** → **Custom token** |
| `CLOUDFLARE_ACCOUNT_ID` | The account id that owns the Worker + zone | Cloudflare dashboard → Workers & Pages → right sidebar → **Account ID** |

### CLOUDFLARE_API_TOKEN — required permissions

Build a custom token (NOT the global API key, NOT the default "Edit Workers" template — those over-grant). Use these exact scopes:

**Account permissions** (on the account that hosts the Worker):
- **Workers Scripts** → **Edit**
- **Workers KV Storage** → **Edit**
- **Workers R2 Storage** → **Edit**
- **Workers AI** → **Read**
- **D1** → **Edit**
- **Account Settings** → **Read**

**Zone permissions** (on the `sayantan.cloud` zone, or whatever zone hosts your production hostname):
- **Workers Routes** → **Edit**

**Zone resources:** specify the zone (`sayantan.cloud`).
**Account resources:** specify the account.

Click **Continue to summary → Create Token**. Copy the value; you'll only see it once. Paste it into the `CLOUDFLARE_API_TOKEN` repo secret.

## Worker secrets are NOT in the workflow

The 7 Worker secrets used at runtime — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `SESSION_SIGNING_KEY`, `LLM_CONFIG_KEY`, `TMDB_API_KEY`, `OMDB_API_KEY` — are set **once** on the production Worker via:

```bash
bunx wrangler --cwd apps/api secret put <NAME> --env production
```

They persist across `wrangler deploy` calls — `wrangler deploy` only ships the script and the static assets; it does not touch the secrets store. Verified with `wrangler secret list --env production`.

Putting them in the GitHub workflow would either (a) leak them into the workflow YAML diff, (b) require a redundant `wrangler secret put` step on every run that's slow + flaky, or (c) reset them to invalid values on a misconfigured run. None of those are wins.

To rotate a Worker secret:

```bash
bunx wrangler --cwd apps/api secret put GOOGLE_CLIENT_SECRET --env production
# paste the new value when prompted
```

Then the next push triggers a deploy that picks it up (the Worker reads secrets fresh on each invocation; no manual restart needed).

## Reading the logs

GitHub → **Actions** tab → **Deploy** workflow → click the latest run → expand each step. The two most-likely-to-fail steps:

- **Typecheck** — TS error somewhere. Fix the code, push.
- **Smoke /api/health** — the deploy succeeded but the Worker isn't healthy. Either an env-var was rotated to an invalid value, a binding is misconfigured, or a recently-introduced runtime error is throwing at module load. Check `wrangler tail cinemood --env production` for the actual exception.

## Rolling back

Three options, fastest to most-involved:

1. **Re-run a known-good workflow run.** Actions → Deploy → pick the last green run → **Re-run all jobs**. This redeploys the SHA from that run, even if `main` has moved past it.
2. **`wrangler rollback` locally.** From `apps/api/`:
   ```bash
   bunx wrangler --cwd apps/api rollback --env production
   ```
   This is the fastest path during an active incident — bypasses the build / typecheck / deploy chain entirely and points the route at the previous Worker version.
3. **Revert the bad commit on `main`.** `git revert <bad-sha>`, push. The workflow runs again and deploys the reverted code. Slowest, but leaves the cleanest history.

## Notes on the route + DNS

The production Worker is bound to `cinemood.sayantan.cloud/*` via `[env.production.routes]` in `wrangler.toml`. There is **no Cloudflare Pages project** — the Worker serves both `/api/*` (Hono routes) and everything else (SPA assets from `apps/web/dist` with SPA fallback to `/index.html`). DNS just needs any proxied placeholder record on the zone; the route intercepts before origin resolution. See the README's deployment section for the rationale.

## Worker name

The Worker is named **`cinemood`** — matches the product name. Visible in the Cloudflare dashboard as `cinemood`. Set in `apps/api/wrangler.toml` at both `name = "cinemood"` (top-level for dev) and `[env.production]` `name = "cinemood"`.

## Pre-deploy cleanup (no action needed for forks, kept here as context)

The original development cycle created a Cloudflare Pages project called `cinemood` (default URL `cinemood-789.pages.dev`). That project was deleted on 2026-05-12 after the single-Worker topology landed; it was serving a stale, never-updated build and confused anyone who landed there. Deletion via `bunx wrangler --cwd apps/api pages project delete cinemood --yes`.

Separately, the Worker was originally called `cinemood-api` (from when there was a Pages project beside it). The Worker was renamed to `cinemood` on 2026-05-12; the old `cinemood-api` Worker was deleted after verifying the new one served production cleanly. Bindings (D1, KV, R2, Workers AI) are referenced by ID in `wrangler.toml`, so no data migration was needed — the new Worker shares all bindings with the old one. Secrets (the 7 from above) do not transfer between Workers and were re-set on the new Worker post-rename.
