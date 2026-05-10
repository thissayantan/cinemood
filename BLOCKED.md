# BLOCKED — DNS verification on production domain

The Worker and Pages project are both deployed; Phase 7 cannot be smoke-tested end-to-end on `cinemood.sayantan.cloud` because the DNS CNAME for the subdomain has not been created and the wrangler OAuth token in this session lacks `dns_records:edit` scope.

This trips condition #4 of `CLAUDE.md` "Autonomous execution mode" (Phase 7 production deploy needs DNS verification).

## What's already done

- Worker `cinemood-api` is live on production with the right bindings and routes:
  - `cinemood.sayantan.cloud/api/*`
  - `cinemood.sayantan.cloud/auth/*`
  - Version: `c27bb148-2be3-4607-9301-327879ee96fe`
- All seven production secrets uploaded via `wrangler secret put --env production`: `TMDB_API_KEY`, `OMDB_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (set to `https://cinemood.sayantan.cloud/auth/google/callback`), `SESSION_SIGNING_KEY`, `LLM_CONFIG_KEY`.
- Pages project `cinemood` created (`production-branch=main`, compat date `2025-04-01`) and a deployment uploaded.
  - Default URL is live: <https://cinemood-789.pages.dev/>
  - Latest deployment URL: <https://5d1988a1.cinemood-789.pages.dev/>
  - `_redirects` is in place so client-side routes (`/import`, `/settings/search`, etc.) all serve `index.html` with a 200.
- The custom-domain attachment was registered against the Pages project via the Cloudflare API (domain id `fcc62560-fe34-491c-938a-d28ea1c92240`). Pages is currently reporting `status: "pending"` with `verification_data.error_message: "CNAME record not set"`.

## What's needed

A single DNS record on the `sayantan.cloud` zone:

| Type  | Name      | Target              | Proxy   | TTL  |
|-------|-----------|---------------------|---------|------|
| CNAME | cinemood  | `cinemood.pages.dev` | Proxied | Auto |

This is the same shape used by the other `*.sayantan.cloud` Pages projects in the account (`indian-tourists`, `next-medical-admin`, etc.). Once it propagates, both the Pages frontend and the Worker routes for `/api/*` and `/auth/*` will resolve, since the route patterns take precedence over Pages on the matching paths.

## What's been tried

- `bunx wrangler pages domain add` — no such subcommand in wrangler 4.90.0; only `project` / `deployment` / `secret` / `dev` / `download`.
- `POST /accounts/{acct}/pages/projects/cinemood/domains` (Cloudflare API, OAuth bearer) — `success: true`, but the API tells us the CNAME is missing.
- `POST /zones/{zone}/dns_records` (Cloudflare API, OAuth bearer with the same token) — `Authentication error` (code 10000). The wrangler OAuth scope list (per `wrangler whoami`) includes `zone (read)` but not `dns_records (edit)`, so we can't create or modify DNS records from this session.
- `GET /zones/{zone}/dns_records?name=cinemood.sayantan.cloud` — same `Authentication error`, so we couldn't even confirm the absence of a record via API; we relied on the Pages domain status message.

## How to unblock

Either of the following lets the autonomous run resume:

1. **Recommended.** Add the CNAME above through the Cloudflare dashboard (Zones → `sayantan.cloud` → DNS → Add record). Pages will pick it up within ~30s and flip the domain to `active`; HTTP-01 cert provisioning happens automatically.
2. Re-run `wrangler login` with a User-API-Token that includes `Zone:DNS:Edit` for `sayantan.cloud`, then run:
   ```bash
   curl -X POST "https://api.cloudflare.com/client/v4/zones/5b9c991135aa11cabba08321f6a1fdc4/dns_records" \
     -H "Authorization: Bearer $TOKEN" \
     -H "content-type: application/json" \
     -d '{"type":"CNAME","name":"cinemood","content":"cinemood.pages.dev","proxied":true,"ttl":1}'
   ```

After that, the only remaining smoke test is the Google OAuth round-trip — open <https://cinemood.sayantan.cloud/>, click "Sign in with Google", and confirm `/api/me` returns the user. The Google Cloud project (`cinemood-495916`) already has `https://cinemood.sayantan.cloud/auth/google/callback` listed as an authorized redirect URI per the spec.
