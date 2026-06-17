# Phase 12 — Swipe Q&A Decider

## What was built

A stateless Tinder-style card deck that generates 5 preference questions about the user's watchlist, collects answers (via tap-buttons or swipe), and returns one chosen title with a personalized explanation.

### Backend

**`POST /api/decide/questions`** (`apps/api/src/routes/decide.ts`)
- Accepts `{ title_ids?, status?, count? (3–8, default 5) }`.
- Resolves candidates from `getWatchlistItems` (if `title_ids` provided) or `listWatchlist` (with optional status filter).
- Calls `completeJson(provider, QuestionsResultSchema, …, {maxTokens:1200, temperature:0.7})` to generate all questions in a single batch (cheaper and coherent vs iterative).
- Returns `{questions, candidate_ids}` — `candidate_ids` is echoed back by the client to the pick endpoint, keeping the API stateless.

**`POST /api/decide/pick`** (`apps/api/src/routes/decide.ts`)
- Accepts `{ title_ids, answers: [{question_id, option_id}]+ , mood? }`.
- Resolves candidates (user-scoped) and calls `completeJson(provider, PickResultSchema, …)`.
- **Closed-set guard:** if `winner_id` is not in the candidate set, falls back to the title with the highest `vote_average`.
- Filters `runners_up` to only those also in the candidate set and not equal to the winner.
- Returns `{ winner: WatchlistItem, reason, runners_up: [{item, reason}]≤3 }`.

**`apps/api/src/llm/decider.ts`**
- `QuestionsResultSchema` — validates generated questions (2–4 options each, unique id slugs).
- `PickResultSchema` — validates `{winner_id, reason, runners_up}`.
- `buildQuestionsMessages()` — system prompt explicitly forbids naming titles in questions (reveals preferences, not direct picks) and grounds questions in the actual candidates.
- `buildPickMessages()` — makes the preference answers the primary weighting signal.

### Frontend

**`apps/web/src/components/decide/swipe-deck.tsx`**
- **State machine** (`useReducer`): `loading → questions → picking → result` (or `error` anywhere).
- **Questions fetch** on mount via `useEffect`; pick request fires when state transitions to `"picking"`.
- **Answers accumulation**: stored in `answersRef` (mutable ref, not state) to avoid stale-closure bugs in the `useEffect` pick trigger.
- **QuestionCard** — the physical card:
  - Ghost cards (2 semi-transparent cards behind) for a deck/depth effect.
  - `drag="x"` on the active card (Framer Motion); `onDrag` updates `dragX`.
  - Tilt: `rotate: dragProgress * 8°` (max 8° in either direction).
  - Lift: `box-shadow` deepens with `|dragProgress|` — the "lifting a card off the table" signature.
  - Swipe threshold 100px; binary questions (2 options) only use swipe; 3–4 option questions show tap-only.
  - Swipe intent overlays: subtle sky/accent tint fades in on left/right drag (directional cue).
  - **Reduced motion**: no `drag`, no tilt, no shadow change — instant cross-fade between cards.
- **Progress indicators**: pill-shaped dots at the top of the dialog (filled=answered, medium=current, faint=pending).
- **RevealScreen** — shows winner poster, "Tonight's pick" eyebrow, display-face title + reason, runners-up as tappable rows (opens detail dialog). "Try again" dismisses.

**`apps/web/src/components/decide/decide-hub.tsx`**
- Centered dialog with 3 entries: Mood picker, Q&A decider, Compare titles.
- Each entry has an icon (SVG inline) + label + subtitle.
- Options stagger in with a small delay sequence.
- Compare entry closes the hub — the user then hovers cards to see checkboxes.

**`apps/web/src/pages/home.tsx`**
- `decideOpen` now controls the Decide Hub (not the Mood Picker directly).
- `moodOpen` + `swipeOpen` are separate state booleans.
- SwipeDeck receives `titleIds={wl.all?.map(it => it.title.id) ?? []}` (whole watchlist).
- Opening an item from the reveal screen closes the deck and opens the detail dialog.

## How it was tested

- TypeScript typecheck: `bun run typecheck` — all clean.
- Build: `bun run build` — passes.
- Manual flow: Decide Hub → Q&A decider → 5 cards load → answer each (tap) → "Deciding…" → reveal screen with winner + reason + 2 runners-up — all title_ids were from the watchlist.
- Swipe manual test: drag card past 100px → next question.
- Closed-set guard: if LLM hallucinates a winner_id, the fallback logic fires correctly.

## Design decisions

- **Stateless API:** the client echoes `candidate_ids` back to `/api/decide/pick`, eliminating any server-side session storage.
- **Batch generation:** all questions in one LLM call (not iterative) for cost + coherence.
- **Swipe = enhancement, tap = primary:** questions can have 2–4 options; Tinder-style swipe (left/right) only applies to binary questions. Tap buttons are always present.
- **Deck depth effect:** 2 ghost cards with scale + opacity steps create the physical card-stack feel without actual `z-index` stacking of interactive elements.
- **Signature motion:** the shadow deepening on drag is the "one bold thing" — everything else (tilt, overlays) is quiet support for it.
