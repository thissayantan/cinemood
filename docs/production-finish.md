# Production routing — final dashboard steps

The Worker (`cinemood-api`) and the Pages project (`cinemood`) are deployed and configured for `cinemood.sayantan.cloud`. The remaining work has to happen in the Cloudflare dashboard because:

- The OAuth token wrangler is logged in with does not have `Zone:DNS:Edit` for `sayantan.cloud`, so the CLI can't create the right DNS record itself.
- The CNAME you added manually (`cinemood → cinemood.pages.dev`) targets the wrong host and bypasses the Pages Custom Domain feature, which is what the Worker routes need to be bound against.

What you actually want is to add `cinemood.sayantan.cloud` as a **Custom Domain** on the Pages project — Cloudflare then auto-creates the right DNS record, issues a cert, and wires the Worker routes to take precedence on `/api/*` and `/auth/*`.

**Heads-up before you start.** The project's `*.pages.dev` URL is `cinemood-789.pages.dev` (Cloudflare appended a 3-char suffix because the unsuffixed name was globally taken). Inside the dashboard the project is still called **`cinemood`** — that's the name you'll click on.

---

## Step 1 — Remove the manual CNAME

1. **Cloudflare dashboard** → Account home → **Websites** → click on **`sayantan.cloud`**.
2. Left-rail → **DNS** → **Records**.
3. Find the record with **Type = CNAME**, **Name = `cinemood`**, **Content = `cinemood.pages.dev`**.
4. Click the row → **Delete** (or the trash-can icon, depending on UI). Confirm.

Pages will create its own CNAME (`cinemood.pages.dev`-style target with the project's actual hostname behind it) once you do Step 2 — the manual record collides with that and is what's keeping the domain stuck.

---

## Step 2 — Add the Pages custom domain

1. Account home → **Workers & Pages** (or **Compute (Workers)** + Pages tab in some accounts).
2. In the projects list, click **`cinemood`**.
3. Top tabs → **Custom domains**.
4. **Set up a custom domain** → enter `cinemood.sayantan.cloud` → **Continue**.
5. The dashboard shows a confirmation screen with the DNS record it's about to create. Click **Activate domain**.

What Cloudflare does for you:

- Creates the right `CNAME cinemood → <project-target>` in the `sayantan.cloud` zone (the target is the project's stable Pages hostname, which is what you actually want).
- Provisions a TLS cert via HTTP-01.
- The status pill on the row will go through `Initializing → Pending → Verifying → Active` — typically <60s.

If it stalls in **Pending** with the error "CNAME record not set", the most likely cause is that the manual record from Step 1 is still there. Refresh the DNS records page and confirm.

---

## Step 3 — Verify the Worker routes are still bound

Worker routes for `cinemood-api` were attached at deploy time (`wrangler deploy --env production` recorded both routes). Custom-domain activation can sometimes leave them in an "unbound" state if the zone-level routing changes. Quick check:

1. **Workers & Pages** → click the `cinemood-api` Worker (it's the entry whose type column says **Worker**, not **Pages**).
2. Top tabs → **Settings** → **Domains & Routes**.
3. You should see two **Route** entries on the `sayantan.cloud` zone:
   - `cinemood.sayantan.cloud/api/*`
   - `cinemood.sayantan.cloud/auth/*`

If either is missing or the row says "Inactive" / has a warning icon:
- Click **Add** → **Route** → Zone = `sayantan.cloud`, Route = `cinemood.sayantan.cloud/api/*` → **Add route**.
- Repeat for `/auth/*`.

(Routes take effect within a few seconds of saving — no redeploy needed.)

---

## Step 4 — Smoke test

From any terminal:

```bash
curl -i https://cinemood.sayantan.cloud/api/health
# → HTTP/2 200, body: {"ok":true,"data":{"status":"up","ts":...}}

curl -i https://cinemood.sayantan.cloud/
# → HTTP/2 200, body: the Cinemood index.html (Pages serving the SPA)

curl -i https://cinemood.sayantan.cloud/some/random/path
# → HTTP/2 200, still serving index.html (SPA fallback via apps/web/public/_redirects)

curl -i https://cinemood.sayantan.cloud/auth/google
# → HTTP/2 302
# → Location: https://accounts.google.com/o/oauth2/v2/auth?client_id=…&redirect_uri=https%3A%2F%2Fcinemood.sayantan.cloud%2Fauth%2Fgoogle%2Fcallback&…
# → Set-Cookie: cm_oauth_state=…; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600
```

The four important signals:

- `/api/health` returns 200 with `ok:true` → Worker route on `/api/*` is bound and the Worker is reachable.
- `/` returns the SPA HTML → Pages is serving from the same hostname.
- A non-existent path returns 200 (not 404) with the same HTML → SPA fallback works (client-side router renders the 404 page).
- `/auth/google` 302's to `accounts.google.com` with a **production** `redirect_uri` and the `Secure` cookie attribute → the prod env var override (`GOOGLE_REDIRECT_URI=https://cinemood.sayantan.cloud/auth/google/callback`) is in effect and `ENVIRONMENT=production` is flipping `Secure` on.

---

## Step 5 — One end-to-end OAuth round-trip in a real browser

1. Open `https://cinemood.sayantan.cloud/` in a fresh window.
2. Click **Sign in with Google** → step through Google consent → expect to land back on `/` signed in.
3. Avatar menu → email matches the Google account → Search settings link works.
4. Save a couple of titles via the search bar to confirm TMDB and watchlist mutations work end-to-end.

The Google OAuth client (`cinemood-495916`) already has `https://cinemood.sayantan.cloud/auth/google/callback` in its authorized redirect URIs per the spec, so no Google Cloud Console change is needed.

If Google rejects the redirect, the most common causes are:
- The Google Cloud Console redirect URIs got reverted (re-add the production URI, save, wait ~30s).
- The Worker route binding from Step 3 is missing on `/auth/*`, so the request is going to Pages instead of the Worker (Pages has no `/auth/google` handler, so you'd see the SPA's 404 page rather than a 302).

---

## What I am not doing

- I am not creating, deleting, or editing any DNS records — you removed the manual one in Step 1 and the Pages flow in Step 2 creates the right one.
- I am not touching the Pages project from the CLI (no `wrangler pages deploy`, no `wrangler pages domain add` — the latter doesn't exist in wrangler 4.90 anyway).
- I am not modifying Worker secrets — they were set during the autonomous run and live in the production environment.

Once Step 5 succeeds, production is fully wired and the autonomous run is finished.
