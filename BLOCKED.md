# BLOCKED — screenshots + social preview pending

The Task 2 README references five images that I can't materialise without
the user's hand. The README + meta files are otherwise committed
(`a1617c8`), and Task 3 (GitHub publish) is intentionally held back until
these land so the public repo doesn't ship with broken image links.

## Why this is blocked

- The browser MCP (claude-in-chrome) **does** see the live production
  session via the user's existing Chrome cookies (verified: navigated to
  `https://cinemood.sayantan.cloud/`, screenshotted the watchlist with
  154 real titles), but the `computer screenshot` action does not return
  a writeable file path that I can place at `docs/screenshots/`.
- The Playwright MCP runs in a separate headless browser that does NOT
  share the user's session, so it can only capture the landing page.
- The local box has no `rsvg-convert`, `convert`, `magick`, or
  `inkscape` to convert an SVG social preview to PNG, and the actual
  Fraunces font (the brand display face) isn't installed locally for
  ImageMagick to use even if it were.
- Per the task prompt: *"If you can't capture a real screenshot from the
  running stack, write BLOCKED.md asking the user for one rather than
  mocking it up."*

## What's needed (≤ 5 files, all 1600×900 unless noted)

Save into `docs/screenshots/` (already created) with these exact names so
the README references resolve:

| Filename                       | What it shows |
|--------------------------------|---|
| `01-watchlist-dark.png`        | Watchlist page in **dark** mode, populated grid (not empty), full viewport. Hero image. |
| `02-palette-find.png`          | The `⌘ K` palette in **Find** mode with a real query like *"dark sci-fi series with 8+ rating"*, results visible in the list, **and the right-side preview pane showing** a highlighted result. |
| `03-detail-dialog.png`         | Title detail dialog open over the watchlist for any film — synopsis, cast, ratings (TMDB + IMDb), providers, runtime visible. |
| `04-settings-search.png`       | `/settings/search` page showing the LLM provider selector (Cloudflare / Anthropic / OpenAI / Google) and the model dropdown. |
| `social-preview.png` (1280×640) | Social preview card. Cinemood wordmark in Fraunces, tagline "Save what you mean to watch. Find it back by mood, not by title." on the editorial-cinematic cream/ink palette with a burnt-sienna ambient glow. Will be uploaded to **GitHub → Settings → General → Social preview**. |

## How to capture quickly

The simplest path (≈ 2 minutes):

1. Visit `https://cinemood.sayantan.cloud/` in your existing browser.
2. Make sure dark theme is active (toggle in the top bar).
3. F12 → device toolbar (`Ctrl+Shift+M`) → set 1600×900.
4. F12 device toolbar → ⋮ → **Capture screenshot** for each of the four
   states above. Move files to `docs/screenshots/` with the names above.
5. For the social preview: open `https://www.canva.com/` (or Figma /
   any tool you like), 1280×640 canvas, cream background `#F2EBDD`,
   Fraunces wordmark "Cinemood" in `#1A1814`, tagline in `#1A1814` at
   72% opacity, optionally a soft burnt-sienna radial glow behind the
   wordmark (`#C4691E` at ~20%). Export PNG → `docs/social-preview.png`.

## After you drop them in

Reply "screenshots in" or similar and I'll continue with:

1. A commit `📝 docs: add screenshots and social preview`.
2. Task 3: GitHub publish (repo create, push, topics, settings, social
   preview upload instructions).
