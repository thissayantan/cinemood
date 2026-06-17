/**
 * mood-picker.tsx — "What are you in the mood for?" dialog.
 *
 * Opens as a center dialog. The user describes their mood in free text;
 * the AI ranks their watchlist titles by fit and shows a scrollable list
 * of picks with one-line reasons.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RecommendResponse, WatchStatus, WatchlistItem } from "@cinemood/shared";
import { api } from "@/lib/api";
import { useMotionConfig } from "@/lib/motion";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { Dialog, AnimatedDialogContent, DialogTitle } from "@/components/dialog";
import { posterUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenItem: (item: WatchlistItem) => void;
}

type StatusFilter = WatchStatus | undefined;

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: "All", value: undefined },
  { label: "To watch", value: "pending" },
  { label: "Watching", value: "watching" },
  { label: "Watched", value: "watched" },
];

export function MoodPicker({ open, onOpenChange, onOpenItem }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatedDialogContent
        open={open}
        side="center"
        title="What are you in the mood for?"
      >
        <MoodPickerBody onClose={() => onOpenChange(false)} onOpenItem={onOpenItem} />
      </AnimatedDialogContent>
    </Dialog>
  );
}

function MoodPickerBody({
  onClose,
  onOpenItem,
}: {
  onClose: () => void;
  onOpenItem: (item: WatchlistItem) => void;
}) {
  const m = useMotionConfig();
  const [mood, setMood] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const speech = useSpeechRecognition();

  // Pump final speech transcript into mood field
  useEffect(() => {
    if (speech.transcript) {
      setMood((prev) => (prev ? `${prev} ${speech.transcript}` : speech.transcript).trim());
      speech.clearTranscript();
    }
  }, [speech.transcript]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = mood.trim().length > 0 && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const res = await api<RecommendResponse>("/api/recommend", {
      method: "POST",
      body: JSON.stringify({
        mood: mood.trim(),
        ...(statusFilter ? { status: statusFilter } : {}),
        limit: 8,
      }),
    });

    setLoading(false);
    if (res.ok) {
      setResult(res.data);
    } else {
      setError(res.error.message);
    }
  }

  function handleReset() {
    setMood("");
    setResult(null);
    setError(null);
  }

  const fadeTransition = m.reduced
    ? { duration: 0 }
    : { duration: m.durBase, ease: m.easeOutQuint };

  return (
    <div className="relative">
      {/* Header */}
      <div className="border-b border-[var(--rule)] px-6 pb-5 pt-6 sm:px-8">
        <DialogTitle
          className="font-display-md text-[24px] leading-tight text-[var(--ink)] sm:text-[32px]"
          style={{ fontVariationSettings: '"opsz" 36, "wght" 800, "SOFT" 20' }}
        >
          What are you in the mood for?
        </DialogTitle>
        <p className="mt-1.5 text-[13px] text-[var(--paper-dim)]">
          Describe how you're feeling and I'll find something from your watchlist.
        </p>
      </div>

      {/* Body */}
      <div className="px-6 pb-6 pt-5 sm:px-8">
        {/* Show results or the input form */}
        <AnimatePresence mode="wait">
          {result ? (
            <motion.div
              key="results"
              initial={m.reduced ? {} : { opacity: 0, y: m.fadeY }}
              animate={{ opacity: 1, y: 0 }}
              transition={fadeTransition}
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-[13px] text-[var(--paper-dim)]">
                  <span className="text-[var(--ink)]">{result.items.length}</span>{" "}
                  pick{result.items.length !== 1 ? "s" : ""} for{" "}
                  <span className="italic text-[var(--ink)]">"{result.mood}"</span>
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="font-label text-[10px] uppercase tracking-widest text-[var(--paper-faint)] underline-offset-4 hover:text-[var(--accent)] hover:underline"
                >
                  Try another mood
                </button>
              </div>

              {result.items.length === 0 ? (
                <p className="py-8 text-center text-[14px] text-[var(--paper-dim)]">
                  Nothing matched that mood — try something different.
                </p>
              ) : (
                <ul className="space-y-3 overflow-y-auto" style={{ maxHeight: "55vh" }}>
                  {result.items.map((item, i) => {
                    const rec = result.recommendations.find(
                      (r) => r.title_id === item.title.id,
                    );
                    return (
                      <RecommendationRow
                        key={item.title.id}
                        item={item}
                        reason={rec?.reason ?? ""}
                        rank={i + 1}
                        onOpen={() => {
                          onOpenItem(item);
                          onClose();
                        }}
                      />
                    );
                  })}
                </ul>
              )}
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={m.reduced ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={fadeTransition}
              onSubmit={handleSubmit}
            >
              {/* Mood text area + optional mic button */}
              <div className="relative">
                <textarea
                  value={speech.listening && speech.interimTranscript
                    ? (mood ? `${mood} ${speech.interimTranscript}` : speech.interimTranscript)
                    : mood}
                  onChange={(e) => setMood(e.target.value)}
                  placeholder={speech.listening ? "Listening…" : "e.g. something light and funny, or a slow-burn thriller, or I'm feeling nostalgic…"}
                  rows={3}
                  autoFocus
                  className="w-full resize-none rounded-xl border border-[var(--rule)] bg-[var(--paper-2)] px-4 py-3 pr-12 text-[14px] text-[var(--ink)] placeholder:text-[var(--paper-faint)] focus:border-[var(--accent)] focus:outline-none"
                />
                {speech.supported && (
                  <button
                    type="button"
                    aria-label={speech.listening ? "Stop listening" : "Describe your mood by voice"}
                    aria-pressed={speech.listening}
                    onClick={() => {
                      if (speech.listening) {
                        speech.stop();
                      } else {
                        speech.clearTranscript();
                        speech.start();
                      }
                    }}
                    className={cn(
                      "absolute bottom-3 right-3 grid h-7 w-7 place-items-center rounded-full border transition",
                      speech.listening
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                        : "border-[var(--rule)] text-[var(--paper-faint)] hover:border-[var(--accent)]/60 hover:text-[var(--accent)]",
                    )}
                  >
                    <svg
                      width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden
                      className={speech.listening ? "animate-pulse" : undefined}
                    >
                      <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M3 8a5 5 0 0 0 10 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      <path d="M8 13v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Status filter pills */}
              <div className="mt-4">
                <span className="font-label text-[10px] uppercase tracking-widest text-[var(--paper-faint)]">
                  Search in
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((opt) => {
                    const active = statusFilter === opt.value;
                    return (
                      <button
                        key={String(opt.value ?? "_all")}
                        type="button"
                        onClick={() => setStatusFilter(opt.value)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[11.5px] transition",
                          active
                            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)]"
                            : "border-[var(--rule)] text-[var(--paper-dim)] hover:text-[var(--ink)]",
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="mt-3 text-[12px] text-red-500">{error}</p>
              )}

              {/* Submit */}
              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    "rounded-full border px-5 py-2 text-[13px] transition",
                    canSubmit
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)] hover:opacity-90"
                      : "cursor-not-allowed border-[var(--rule)] text-[var(--paper-faint)] opacity-50",
                  )}
                >
                  {loading ? "Finding…" : "Find for me"}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RecommendationRow({
  item,
  reason,
  rank,
  onOpen,
}: {
  item: WatchlistItem;
  reason: string;
  rank: number;
  onOpen: () => void;
}) {
  const t = item.title;
  const poster = posterUrl(t.poster_path, "w185");
  const year = t.release_date ? t.release_date.slice(0, 4) : "—";

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-start gap-4 rounded-xl border border-[var(--rule)] bg-[var(--paper-2)] p-3 text-left transition hover:border-[var(--accent)]/50 hover:bg-[var(--paper-3)]"
      >
        {/* Rank badge */}
        <span className="mt-0.5 shrink-0 font-mono text-[18px] font-bold leading-none text-[var(--accent)] opacity-40">
          {rank}
        </span>

        {/* Poster thumbnail */}
        <div
          className="relative shrink-0 overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--paper-3)]"
          style={{ width: 48, aspectRatio: "2/3" }}
        >
          {poster ? (
            <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : null}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span
              className="truncate font-display-sm text-[14px] leading-tight text-[var(--ink)]"
              style={{ fontVariationSettings: '"opsz" 14, "wght" 600, "SOFT" 40' }}
            >
              {t.title}
            </span>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
              {year}
            </span>
          </div>
          {reason && (
            <p className="mt-1 text-[12px] leading-snug text-[var(--paper-dim)]">{reason}</p>
          )}
        </div>
      </button>
    </li>
  );
}
