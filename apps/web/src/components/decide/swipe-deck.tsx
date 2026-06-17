/**
 * swipe-deck.tsx — the Tinder-style swipe Q&A decider.
 *
 * Flow:
 *   1. Loads from the Decide hub with candidate title_ids (from selection or
 *      whole watchlist). Fetches questions via POST /api/decide/questions.
 *   2. Shows a card deck. Each card = one question + tap-button options.
 *      On non-reduced-motion + touch/mouse devices: drag left/right also
 *      answers the first/last option (binary swipe affordance).
 *   3. After all questions answered, POSTs to /api/decide/pick → reveals
 *      the winning title: poster, reason, runners-up.
 *
 * Design:
 *   - Cards stack with 2 ghost cards behind (progressively smaller + lighter).
 *   - Active card tilts slightly on drag; box-shadow deepens as if being
 *     lifted off the table (the one signature motion moment of this feature).
 *   - Reduced-motion: no drag, no tilt — just instant cross-fade between cards.
 *   - Progress dots at the top (filled = answered, outline = pending).
 *   - Reveal: poster centred, display-face reason, runners-up below.
 */
import { useEffect, useReducer, useRef, useState } from "react";
import { AnimatePresence, motion, PanInfo } from "framer-motion";
import type {
  DecidePickResponse,
  DecideQuestionsResponse,
  SwipeAnswer,
  WatchlistItem,
} from "@cinemood/shared";
import { api } from "@/lib/api";
import { useMotionConfig } from "@/lib/motion";
import { posterUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { Dialog, AnimatedDialogContent, DialogTitle } from "@/components/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleIds: number[];
  onOpenItem: (item: WatchlistItem) => void;
}

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "questions"; questions: DecideQuestionsResponse; currentIdx: number; answers: SwipeAnswer[] }
  | { kind: "picking" }
  | { kind: "result"; result: DecidePickResponse };

type Action =
  | { type: "loaded"; q: DecideQuestionsResponse }
  | { type: "error"; msg: string }
  | { type: "answer"; questionId: string; optionId: string }
  | { type: "picking" }
  | { type: "result"; r: DecidePickResponse };

function reducer(state: Phase, action: Action): Phase {
  switch (action.type) {
    case "loaded":
      return { kind: "questions", questions: action.q, currentIdx: 0, answers: [] };
    case "error":
      return { kind: "error", message: action.msg };
    case "answer": {
      if (state.kind !== "questions") return state;
      const answers = [
        ...state.answers,
        { question_id: action.questionId, option_id: action.optionId },
      ];
      const nextIdx = state.currentIdx + 1;
      if (nextIdx >= state.questions.questions.length) {
        return { kind: "picking" };
      }
      return { ...state, currentIdx: nextIdx, answers };
    }
    case "picking":
      return { kind: "picking" };
    case "result":
      return { kind: "result", result: action.r };
    default:
      return state;
  }
}

export function SwipeDeck({ open, onOpenChange, titleIds, onOpenItem }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatedDialogContent open={open} side="center" title="Decide what to watch">
        <SwipeDeckBody
          titleIds={titleIds}
          onOpenItem={onOpenItem}
          onClose={() => onOpenChange(false)}
        />
      </AnimatedDialogContent>
    </Dialog>
  );
}

function SwipeDeckBody({
  titleIds,
  onOpenItem,
  onClose,
}: {
  titleIds: number[];
  onOpenItem: (item: WatchlistItem) => void;
  onClose: () => void;
}) {
  const m = useMotionConfig();
  const [state, dispatch] = useReducer(reducer, { kind: "loading" });
  // Capture answers state for use after questions phase ends
  const answersRef = useRef<SwipeAnswer[]>([]);

  // Load questions on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api<DecideQuestionsResponse>("/api/decide/questions", {
        method: "POST",
        body: JSON.stringify({ title_ids: titleIds, count: 5 }),
      });
      if (cancelled) return;
      if (res.ok) dispatch({ type: "loaded", q: res.data });
      else dispatch({ type: "error", msg: res.error.message });
    })();
    return () => { cancelled = true; };
  }, [titleIds.join(",")]); // stable dep

  // When state transitions to "picking", fire the pick request
  useEffect(() => {
    if (state.kind !== "picking") return;
    let cancelled = false;
    (async () => {
      const res = await api<DecidePickResponse>("/api/decide/pick", {
        method: "POST",
        body: JSON.stringify({
          title_ids: titleIds,
          answers: answersRef.current,
        }),
      });
      if (cancelled) return;
      if (res.ok) dispatch({ type: "result", r: res.data });
      else dispatch({ type: "error", msg: res.error.message });
    })();
    return () => { cancelled = true; };
  }, [state.kind]);

  const fadeT = m.reduced ? { duration: 0 } : { duration: m.durBase, ease: m.easeOutQuint };

  function handleAnswer(questionId: string, optionId: string) {
    // Collect answers before state transition so the ref is always fresh
    answersRef.current = [
      ...answersRef.current,
      { question_id: questionId, option_id: optionId },
    ];
    dispatch({ type: "answer", questionId, optionId });
  }

  return (
    <div className="flex flex-col" style={{ minHeight: 480 }}>
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--rule)] px-6 pb-4 pt-5 sm:px-8">
        <DialogTitle
          className="font-display-md text-[22px] leading-tight text-[var(--ink)] sm:text-[28px]"
          style={{ fontVariationSettings: '"opsz" 36, "wght" 800, "SOFT" 20' }}
        >
          What should you watch?
        </DialogTitle>
        {state.kind === "questions" && (
          <div className="mt-3 flex items-center gap-1.5">
            {state.questions.questions.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i < state.currentIdx
                    ? "w-4 bg-[var(--accent)]"
                    : i === state.currentIdx
                    ? "w-4 bg-[var(--ink)]"
                    : "w-1.5 bg-[var(--paper-faint)]",
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 sm:px-8">
        <AnimatePresence mode="wait">
          {state.kind === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fadeT}
              className="text-center"
            >
              <span className="font-label text-[11px] uppercase tracking-widest text-[var(--paper-faint)]">
                Preparing questions…
              </span>
            </motion.div>
          )}

          {state.kind === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={fadeT}
              className="text-center"
            >
              <p className="text-[14px] text-red-500">{state.message}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 font-label text-[11px] uppercase tracking-widest text-[var(--paper-dim)] underline"
              >
                Close
              </button>
            </motion.div>
          )}

          {state.kind === "questions" && (
            <motion.div
              key={`q-${state.currentIdx}`}
              initial={m.reduced ? {} : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={m.reduced ? {} : { opacity: 0, y: -24 }}
              transition={fadeT}
              className="w-full max-w-sm"
            >
              {state.questions.questions[state.currentIdx] && (
                <QuestionCard
                  question={state.questions.questions[state.currentIdx]!}
                  totalCount={state.questions.questions.length}
                  currentIdx={state.currentIdx}
                  onAnswer={handleAnswer}
                  candidateIds={state.questions.candidate_ids}
                />
              )}
            </motion.div>
          )}

          {state.kind === "picking" && (
            <motion.div
              key="picking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fadeT}
              className="text-center"
            >
              <span className="font-label text-[11px] uppercase tracking-widest text-[var(--paper-faint)]">
                Deciding…
              </span>
            </motion.div>
          )}

          {state.kind === "result" && (
            <motion.div
              key="result"
              initial={m.reduced ? {} : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={m.reduced ? { duration: 0 } : { ...m.springEntry }}
              className="w-full max-w-sm"
            >
              <RevealScreen
                result={state.result}
                onOpenItem={(item) => {
                  onOpenItem(item);
                  onClose();
                }}
                onRestart={onClose}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Question card with optional swipe ────────────────────────────────────────

function QuestionCard({
  question,
  totalCount,
  currentIdx,
  onAnswer,
  candidateIds: _candidateIds,
}: {
  question: { id: string; prompt: string; options: { id: string; label: string }[] };
  totalCount: number;
  currentIdx: number;
  onAnswer: (questionId: string, optionId: string) => void;
  candidateIds: number[];
}) {
  const m = useMotionConfig();
  const [dragX, setDragX] = useState(0);
  const isBinary = question.options.length === 2;

  const SWIPE_THRESHOLD = 100; // px

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (!isBinary) return;
    if (info.offset.x > SWIPE_THRESHOLD) {
      const last = question.options[question.options.length - 1];
      if (last) onAnswer(question.id, last.id);
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      const first = question.options[0];
      if (first) onAnswer(question.id, first.id);
    }
    setDragX(0);
  }

  // Normalize drag to [-1, 1] for visual feedback
  const dragProgress = Math.max(-1, Math.min(1, dragX / SWIPE_THRESHOLD));
  const tilt = m.reduced ? 0 : dragProgress * 8; // max 8deg tilt
  const liftShadow = m.reduced
    ? "0 1px 3px rgba(0,0,0,0.08)"
    : `0 ${4 + Math.abs(dragProgress) * 12}px ${12 + Math.abs(dragProgress) * 20}px rgba(0,0,0,${0.08 + Math.abs(dragProgress) * 0.10})`;

  // Ghost cards (depth effect behind the active card)
  const ghostCount = Math.min(2, totalCount - currentIdx - 1);

  return (
    <div className="relative" style={{ paddingBottom: ghostCount * 10 }}>
      {/* Ghost cards (behind active) */}
      {Array.from({ length: ghostCount }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-2xl border border-[var(--rule)] bg-[var(--paper-2)]"
          style={{
            bottom: -(i + 1) * 10,
            left: (i + 1) * 6,
            right: (i + 1) * 6,
            opacity: 0.5 - i * 0.15,
            transform: `scale(${1 - (i + 1) * 0.03})`,
            zIndex: -(i + 1),
          }}
        />
      ))}

      {/* Active question card */}
      <motion.div
        drag={!m.reduced && isBinary ? "x" : false}
        dragConstraints={{ left: -180, right: 180 }}
        dragElastic={0.2}
        onDrag={(_, info) => setDragX(info.offset.x)}
        onDragEnd={handleDragEnd}
        style={{
          rotate: tilt,
          boxShadow: liftShadow,
        }}
        className="relative z-10 cursor-grab select-none rounded-2xl border border-[var(--rule)] bg-[var(--paper)] px-6 py-7 active:cursor-grabbing"
      >
        {/* Swipe intent indicators (binary questions only) */}
        {isBinary && !m.reduced && (
          <>
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl bg-sky-500/10 transition-opacity"
              style={{ opacity: Math.max(0, dragProgress) }}
            />
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl bg-[var(--accent)]/10 transition-opacity"
              style={{ opacity: Math.max(0, -dragProgress) }}
            />
          </>
        )}

        {/* Question number */}
        <p className="mb-3 font-label text-[10px] uppercase tracking-widest text-[var(--paper-faint)]">
          Question {currentIdx + 1} of {totalCount}
        </p>

        {/* Question prompt */}
        <p
          className="font-display-sm text-[20px] leading-snug text-[var(--ink)] sm:text-[22px]"
          style={{ fontVariationSettings: '"opsz" 24, "wght" 700, "SOFT" 20' }}
        >
          {question.prompt}
        </p>

        {/* Options */}
        <div className="mt-6 flex flex-col gap-2.5">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onAnswer(question.id, opt.id)}
              className="w-full rounded-xl border border-[var(--rule)] bg-[var(--paper-2)] px-4 py-3 text-left text-[14px] text-[var(--ink)] transition hover:border-[var(--accent)]/60 hover:bg-[var(--paper-3)] active:scale-[0.98]"
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Swipe hint for binary questions */}
        {isBinary && !m.reduced && (
          <p className="mt-4 text-center font-label text-[10px] uppercase tracking-widest text-[var(--paper-faint)]">
            Or swipe left / right
          </p>
        )}
      </motion.div>
    </div>
  );
}

// ── Reveal screen ─────────────────────────────────────────────────────────────

function RevealScreen({
  result,
  onOpenItem,
  onRestart,
}: {
  result: DecidePickResponse;
  onOpenItem: (item: WatchlistItem) => void;
  onRestart: () => void;
}) {
  const m = useMotionConfig();
  const winner = result.winner;
  const poster = posterUrl(winner.title.poster_path, "w342");
  const year = winner.title.release_date?.slice(0, 4) ?? "—";

  return (
    <div className="text-center">
      {/* Label */}
      <p className="mb-4 font-label text-[10px] uppercase tracking-widest text-[var(--accent)]">
        Tonight's pick
      </p>

      {/* Winner poster */}
      <button
        type="button"
        onClick={() => onOpenItem(winner)}
        className="mx-auto block"
      >
        <motion.div
          initial={m.reduced ? {} : { y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={m.reduced ? { duration: 0 } : { ...m.springEntry, delay: 0.05 }}
          className="mx-auto overflow-hidden rounded-xl border border-[var(--rule)] shadow-lg"
          style={{ width: 130, aspectRatio: "2/3" }}
        >
          {poster ? (
            <img src={poster} alt={winner.title.title} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-[var(--paper-3)] text-[var(--paper-faint)]">
              <span className="font-label text-[10px]">No poster</span>
            </div>
          )}
        </motion.div>
      </button>

      {/* Title + year */}
      <motion.div
        initial={m.reduced ? {} : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={m.reduced ? { duration: 0 } : { duration: m.durBase, delay: 0.15 }}
        className="mt-4"
      >
        <button
          type="button"
          onClick={() => onOpenItem(winner)}
          className="group"
        >
          <h3
            className="font-display-md text-[22px] leading-tight text-[var(--ink)] group-hover:text-[var(--accent)]"
            style={{ fontVariationSettings: '"opsz" 24, "wght" 800, "SOFT" 20' }}
          >
            {winner.title.title}
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
            {year}
          </span>
        </button>
      </motion.div>

      {/* Reason */}
      <motion.p
        initial={m.reduced ? {} : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={m.reduced ? { duration: 0 } : { duration: m.durBase, delay: 0.22 }}
        className="mx-auto mt-4 max-w-xs text-[13px] leading-snug text-[var(--paper-dim)]"
      >
        {result.reason}
      </motion.p>

      {/* Runners-up */}
      {result.runners_up.length > 0 && (
        <motion.div
          initial={m.reduced ? {} : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={m.reduced ? { duration: 0 } : { duration: m.durBase, delay: 0.3 }}
          className="mt-6 border-t border-[var(--rule)] pt-4"
        >
          <p className="mb-2 font-label text-[9px] uppercase tracking-widest text-[var(--paper-faint)]">
            Also good tonight
          </p>
          <div className="flex flex-col gap-2">
            {result.runners_up.map(({ item, reason }) => (
              <button
                key={item.title.id}
                type="button"
                onClick={() => onOpenItem(item)}
                className="flex items-center gap-3 rounded-xl border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-2 text-left transition hover:border-[var(--accent)]/50 hover:bg-[var(--paper-3)]"
              >
                <div
                  className="shrink-0 overflow-hidden rounded-md border border-[var(--rule)] bg-[var(--paper-3)]"
                  style={{ width: 32, aspectRatio: "2/3" }}
                >
                  {item.title.poster_path && (
                    <img
                      src={posterUrl(item.title.poster_path, "w185") ?? ""}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span
                    className="truncate block font-display-sm text-[13px] text-[var(--ink)]"
                    style={{ fontVariationSettings: '"opsz" 13, "wght" 600, "SOFT" 40' }}
                  >
                    {item.title.title}
                  </span>
                  <span className="block truncate text-[11px] text-[var(--paper-faint)]">{reason}</span>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Try again */}
      <button
        type="button"
        onClick={onRestart}
        className="mt-6 font-label text-[10px] uppercase tracking-widest text-[var(--paper-faint)] underline-offset-4 hover:text-[var(--accent)] hover:underline"
      >
        Try again
      </button>
    </div>
  );
}
