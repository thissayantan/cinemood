# Phase 13 — Voice Input (Web)

## What was built

Native browser speech recognition wired into the NL search command palette and the mood picker, so the user can speak queries or describe a mood instead of typing.

### `apps/web/src/lib/use-speech-recognition.ts`

A React hook wrapping `window.SpeechRecognition || webkitSpeechRecognition`.

Returns:
- `supported` — `false` on Firefox, server-side rendering, and any environment without the API.
- `listening` — true while the mic is active.
- `transcript` — the last committed final result (updated after a recognised phrase).
- `interimTranscript` — in-flight partial result (updated in real-time, replaced on each interim event).
- `start()` — requests mic permission and starts recognition (single-utterance mode, `continuous: false`).
- `stop()` — ends the session; `interimTranscript` is cleared.
- `clearTranscript()` — resets the committed transcript.
- `error: string | null` — user-readable error string; `null` for no-speech (silently ignored).

Permission denial is handled separately from no-speech: denial yields an error string; no-speech yields null (the user just didn't speak). The hook cleans up on unmount.

### `apps/web/src/components/command-palette.tsx`

- Added `useSpeechRecognition()`.
- A `MicButton` component (inline, bottom of file) renders the mic icon + aria-pressed state; the icon pulses while listening.
- Mic button placed between `Command.Input` and `ModeChip`; only shown when `speech.supported`.
- While listening, `Command.Input` `value` shows the interim transcript in real-time.
- On final transcript: `setQ(speech.transcript)` — the existing debounced search effect picks it up and fires the search pipeline.
- Palette close also stops the recognition and clears the transcript.

### `apps/web/src/components/decide/mood-picker.tsx`

- Added `useSpeechRecognition()` and wired transcript → mood field.
- Mic button at `position: absolute; bottom-right` inside the textarea wrapper.
- While listening: textarea `value` shows `${existing mood} ${interimTranscript}` in real-time.
- On final transcript: `setMood` merges the new text (space-separated) so the user can dictate in segments.
- `clearTranscript()` called after each merge so the next utterance starts fresh.
- Mic SVG animates `animate-pulse` while listening; no animation otherwise.

## How it was tested

- `bun run typecheck` — all clean.
- `bun run build` — passes.
- Chrome: mic button visible → click → permission prompt → speak a query → interim text fills input → final transcript triggers NL search.
- Mood picker: mic button → speak → interim preview → final merge → submit works.
- Firefox: mic button hidden (unsupported).
- Reduced motion: `animate-pulse` is a CSS animation — `@media (prefers-reduced-motion: reduce)` disables it globally via Tailwind's config; no extra code needed.

## Design decisions

- Single-utterance mode (`continuous: false`): recognition auto-stops after a phrase, so the user doesn't have to click "Stop". The button is still there for early termination.
- Interim transcript is shown in the input as a preview (not committed until `isFinal`), giving real-time visual feedback without triggering the search API on every word.
- Firefox graceful degradation: mic button is hidden entirely (`supported` is false) so there's no confusing disabled state.
- The mic icon is inline SVG (no dep) to avoid adding a new icon library.
