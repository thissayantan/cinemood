# Simplification report

Anthropic Code Simplifier plugin (`code-simplifier:code-simplifier`) was
run against the Cinemood codebase in six batched passes, one batch = one
commit. Each batch ran scoped to a non-overlapping file set with a strict
no-touch list and per-batch hard rules. After each batch:

- Reviewed the diff against the no-touch list and the Learned Rules in
  CLAUDE.md.
- `bun run typecheck` (all three workspaces).
- `bun run --filter '@cinemood/web' build` for batches touching frontend.
- Commit with the kinds of changes summarised in the body.

The no-touch list (each entry has a Learned Rule or deliberate-design note
in CLAUDE.md):

- `apps/api/src/llm/*` — provider abstraction, intentionally polymorphic.
- `apps/api/src/lib/orama-index.ts` — per-user serialization queue + drift
  self-heal.
- `apps/api/src/lib/kv-safe.ts` — swallow-on-quota cache write helper.
- `apps/api/src/lib/session.ts` — stateless signed-cookie codec.
- `apps/api/src/lib/import-resolve.ts` — scoring + query expansion.

## Per-batch results

| # | Scope                                | Files | +ins  | -del  | Touched | Commit |
|--:|--------------------------------------|------:|------:|------:|--------:|:-------|
| 1 | Frontend UI primitives               | 8     | 180   | 150   | 330     | `487998a` |
| 2 | Frontend hooks / lib                 | 6     | 173   | 136   | 309     | `c3262bb` |
| 3 | Frontend feature components          | 10    | 194   | 160   | 354     | `f369692` |
| 4 | Frontend pages                       | 5     | 199   | 147   | 346     | `021d29d` |
| 5 | Backend route handlers               | 6     | 140   | 257   | 397     | `5cacd5b` |
| 6 | Shared types + small backend helpers | 4     | 111   | 159   | 270     | `24b9e15` |
| **Σ** |                                  | **39** | **997** | **1009** | **2006** | |

Net source-line growth: **−12 lines**. The codebase is effectively the
same size after six passes; "touched lines" is dominated by helper
extractions that show up as deletions of N inline blocks and an insertion
of one named helper.

(Batch 5 has a pause point — see "Resume after the line budget" below.)

## Kinds of changes, batch by batch

### Batch 1 — UI primitives (8 files)
- `dialog.tsx` — extracted `CENTER_VARIANTS` const + `rightVariants()` /
  `pickTransition()` helpers; flattened the body-pointer-events
  `useEffect`; folded the dup `blur` style string. Preserved the
  AnimatePresence body-pointer-events comment.
- `dropdown.tsx` — extracted `indexOfValue()` (two call sites);
  renamed event handlers to `handleX`; switch over key chain.
- `toast.tsx` — added a why-comment on the intentional `message`
  effect-dep (consecutive-trigger countdown reset).
- `slider.tsx` — extracted `resolveThumbs()` typed helper.
- `hover-card.tsx` — hoisted initial/transition into named locals.
- `lottie-loop.tsx` — renamed `c → channels`, `obs → observer`, added
  `CREAM_TOLERANCE` const, extracted `isDocumentDark()` (two call
  sites). The cream→ink recolor walk and the `isCream` tolerance check
  left intact (load-bearing).
- `filmstrip-progress.tsx` — hoisted `PERFS` to module scope; extracted
  `barTransition` + `showShimmer` locals to kill an in-JSX nested
  ternary.
- `theme-toggle.tsx` — `if/if/return` chain in `Glyph` → exhaustive
  switch over `ThemePref`.
- Untouched: `avatar.tsx`, `sheet.tsx`, `route-title.tsx`.

### Batch 2 — Frontend hooks / lib (6 files)
- `import-parsers.ts` — extracted `buildCandidate()` to dedupe year
  normalisation + raw-label assembly across `parseCsvImport` and
  `parseTakeoutJson`; renamed terse args; preserved the subtle
  skip-push-AND-recurse short-circuit on duplicate titles (caught a
  near-regression mid-edit; added a why-comment).
- `providers.ts` — extracted `flatrateOf()` + `toRow()` +
  `rowsForRegion()` to kill the IN / US / union triple duplication.
- `theme.ts` — nested ternary in `cycle` → `nextPref()` switch.
- `use-keyboard-shortcuts.ts` — three "g x" branches → `G_ROUTES` map;
  named the magic 1500ms; folded a return-true/false ladder.
- `use-watchlist-ids.ts` — introduced `updateIds()` for the
  optimistic-clone pattern; `add`/`remove` are one-liners.
- `use-watchlist.ts` — `buildQuery` got `setStr`/`setNum` helpers,
  killing 5x typeof-number guards; `deriveFacets` extracted
  `collectProviderNames()` for the deep provider-shape walk.
- Untouched: `api.ts`, `tmdb.ts`, `utils.ts`, `use-debounce.ts`,
  `use-user.ts`. `motion.tsx` is a documented contract (Learned Rule)
  and was not touched.

### Batch 3 — Frontend feature components (10 files)
- `command-palette.tsx` — unwound nested ternaries for
  `findHighlightItem` / `previewHit` / `previewDetail` into
  `resolveFindHighlight()` + `resolvePreviewHit()` + flat `??` chain;
  extracted `formatRuntime()` and `addRowStatus()`; added `MONO_FAINT`
  const for the 6x-repeated mono caption className. The
  `looksLikeFindQuery` heuristic, Tab-toggles-mode handler, and
  ESC/outside-click dismiss path preserved.
- `poster-card.tsx` — `PROVIDER_BADGE_SHADOW` const (the three-layer
  shadow stack composition itself unchanged). De-IIFE'd the providers
  block. Folded the four repeated motion-transition shapes into named
  locals.
- `filter-rail.tsx` — `RUNTIME_MIN`/`MAX` constants; `pillClass`
  helper folds active/inactive border-bg-text across genre, decade,
  streaming pills. `PillGroup` and Slider props untouched (deliberate
  sizing).
- `avatar-menu.tsx` — `MENU_ITEM_CLASS` const. Avatar's
  `referrerPolicy="no-referrer"` flows through and is preserved.
- `welcome-overlay.tsx`, `empty-watchlist.tsx` — named motion-prop
  locals replace inline reduced-motion ternaries.
- `shortcuts-sheet.tsx` — `KBD_CLASS` const matched to the palette's
  empty-state kbd.
- `title-detail-dialog.tsx` — tightened `pickProvidersUS` (redundant
  cast + redundant `in` check).
- `top-bar.tsx` — removed a no-op `cn(single-string)`.
- `active-chips.tsx` — renamed terse `p → provider`.

### Batch 4 — Frontend pages (5 files)
- `import.tsx` — `modeLabel(mode)` switch helper for the inline nested
  ternary in the mode selector. `fadeUpInitial` / `entryTransition` /
  `delayedEntry` / `previewTransition` locals replace four motion-prop
  blocks. Extracted `RowStatusBadge` and `CandidatePicker`
  sub-components so `ResolvedRow`'s ladders read as named branches.
- `home.tsx` — renamed `(it, i) → (item, index)`; collapsed single-line
  if blocks in the imported-toast effect.
- `settings-account.tsx` — `running → signingOut`; motion-prop helper
  locals.
- `settings-search.tsx` — same motion-prop locals; renamed shadowing
  `m` inside a `useEffect` callback (was shadowing the motion config);
  terse `(p)` and `(mm)` mappers renamed.
- `landing.tsx` — `fadeUpInitial` + `entryTransition` locals.
- Preserved (pinned per the batch brief): `localStorage` persistence
  flow, both `console.info("[import] commit start|done")` diagnostics,
  the `selectedCount` and `breakdown` IIFEs, 25-item chunking, the
  `failedOutcomes` flow, the `r.in_catalog` short-circuit, every
  Framer Motion transition reading from `useMotionConfig()`.

### Batch 5 — Backend route handlers (6 files)
- `auth.ts` — folded duplicated state-cookie construction (build +
  clear) into `stateCookie(value, maxAge, isProd)`. Folded the
  granular oauth-callback `errorRedirect(code, err)`; labels and
  per-step `console.error` calls remain distinct.
- `import.ts` — `authError(c)` / `validationError(c, msg)` /
  `readJsonBody(c)` helpers. Commit pipeline body untouched.
- `nl-search.ts` — `authError(c)` helper extracted.
- `settings.ts` — same helper trio applied across four handlers;
  largest single-file win.
- `title.ts` — single-line zod-error tightening.
- `watchlist.ts` — `authGuard` extended to GET handlers (was inlined);
  `validationError` + `readJsonBody` across POST/PATCH/DELETE.
  `waitUntil(...).catch(console.error)` calls preserved.
- Did not dive into the no-touch lib modules.

### Batch 6 — Shared types + small backend helpers (4 files)
- `db/titles.ts` — extracted `UPSERT_TITLE_SQL` + `bindUpsertTitle()`;
  `upsertTitle` and `upsertTitleStmt` delegate, killing ~60 lines of
  SQL+bind duplication. Removed the inline `import("../lib/tmdb")`
  type ref.
- `db/watchlist.ts` — `where(clauseFn, ...values)` helper handles
  bind-and-renumber atomically. `INSERT_WATCHLIST_SQL` constant
  shared by `addToWatchlist` and `addManyToWatchlist`. The load-bearing
  `forEach`-and-collect-inserted-ids pattern in `addManyToWatchlist`
  preserved verbatim.
- `db/queries.ts` — `rowToUser(row)` helper for the User projection
  shared by `getUser` and `getUserForAuth`.
- `lib/tmdb.ts` — replaced six repeated
  `type === "movie" ? (json as Movie).X : (json as Tv).Y` ternaries in
  `fetchTmdbDetail` with one if/else that narrows the union once.
- Untouched (clean, pinned by hard rules, or too tight): `types.ts`,
  `oauth.ts`, `crypto.ts`, `embeddings.ts`, `omdb.ts`, `user-llm.ts`,
  `middleware/auth.ts`, `env.ts`, `index.ts`.

## Considered and rejected

- **Inlining helpers with multiple call sites.** Rule throughout —
  `indexOfValue`, `isDocumentDark`, `buildCandidate`, `flatrateOf`,
  `toRow`, `rowsForRegion`, `collectProviderNames`, `nextPref`,
  `updateIds`, `MotionConfig`, `selectProviders`, `chunk`, `modeLabel`,
  `RowStatusBadge`, `CandidatePicker`, `authError`, `validationError`,
  `readJsonBody`, `rowToUser`, `bindUpsertTitle`, `where`. All have ≥2
  call sites.
- **Collapsing the OTT-badge box-shadow stack** in `poster-card.tsx`
  — load-bearing per CLAUDE.md (the three layers are the design
  solution to "edge visible on every poster background regardless of
  theme").
- **Stripping any `referrerPolicy="no-referrer"`** — Learned Rule.
- **Stripping any `console.info("[import] ...")` diagnostic** — kept
  on purpose per the brief.
- **Refactoring `selectedCount`/`breakdown` IIFEs into `useMemo`** —
  pinned in the Batch 4 brief.
- **Folding `localStorage` persistence into a custom hook** — pinned.
- **Touching the no-touch lib files** (`import-resolve`,
  `orama-index`, `kv-safe`, `session`, `llm/*`) — explicit hard rule.
- **Collapsing `addManyToWatchlist`'s forEach-and-collect into a
  filter-by-meta-changes** — would change the shape from
  "deterministic positional walk" to "filtered array" and obscure the
  `D1 meta.changes` reasoning. Load-bearing per the Batch 6 brief.
- **Replacing the `useMotionConfig()` return shape** — documented
  contract; not touched.

## Resume after the line budget

After Batch 5 the cumulative touched-line count hit **1,736**, just over
the prompt's "~1,500 hard stop". I wrote `BLOCKED.md` summarising the
state and the three options. The user approved continuing Batch 6.

Final cumulative totals: **+997 / −1009 = 2,006 touched lines, −12 net**
across 39 files (3 deduplicated across batches: a few files were touched
in two batches as their scopes overlapped at the lib/component
boundary).

The total touched count is high because the simplifier's bread and butter
is **helper extraction** — fold one or two new lines, delete five
inline copies — which inflates both `+ins` and `-del`. The net delta of
−12 lines confirms the codebase didn't grow.

## Regressions

Zero behavioural regressions caught. All six batches typechecked and built
green on the first attempt; no batch had to be narrowed file-by-file or
reverted. The one near-regression caught during Batch 2 (the subtle
skip-push-AND-recurse short-circuit on duplicate titles in
`parseTakeoutJson`) was caught mid-edit by the simplifier itself and
preserved with a why-comment.

## Patterns worth a Learned Rule

One pattern emerged across multiple batches that's worth pinning into
CLAUDE.md: when the simplifier suggests refactoring a `forEach`-and-
collect into a `filter`/`map` chain, that's usually fine for value
transforms but is **net-negative** when the collection step depends on
the call-site index (D1 batch result `meta.changes`, server-side
`outcomes[i]` index alignment in the import commit path). A Learned Rule
captures this.
