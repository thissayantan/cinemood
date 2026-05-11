import type { WatchlistFilters } from "@cinemood/shared";
import { motion, AnimatePresence } from "framer-motion";
import { useMotionConfig } from "@/lib/motion";

interface Chip {
  key: string;
  label: string;
  clear: () => void;
}

interface Props {
  filters: WatchlistFilters;
  total: number;
  onPatch: <K extends keyof WatchlistFilters>(
    key: K,
    value: WatchlistFilters[K],
  ) => void;
  onReset: () => void;
}

export function ActiveChips({ filters, total, onPatch, onReset }: Props) {
  const m = useMotionConfig();
  const chips: Chip[] = [];

  if (filters.type) {
    chips.push({
      key: `type-${filters.type}`,
      label: filters.type === "movie" ? "Movies" : "Series",
      clear: () => onPatch("type", undefined),
    });
  }
  if (filters.status) {
    chips.push({
      key: `status-${filters.status}`,
      label: filters.status === "watched" ? "Watched" : "To watch",
      clear: () => onPatch("status", undefined),
    });
  }
  if (filters.genre) {
    chips.push({
      key: `genre-${filters.genre}`,
      label: filters.genre,
      clear: () => onPatch("genre", undefined),
    });
  }
  if (filters.year_min !== undefined || filters.year_max !== undefined) {
    const lo = filters.year_min ?? "…";
    const hi = filters.year_max ?? "…";
    chips.push({
      key: "year",
      label: `${lo} – ${hi}`,
      clear: () => {
        onPatch("year_min", undefined);
        onPatch("year_max", undefined);
      },
    });
  }
  if (typeof filters.min_rating === "number") {
    chips.push({
      key: "rating",
      label: `★ ≥ ${filters.min_rating.toFixed(1)}`,
      clear: () => onPatch("min_rating", undefined),
    });
  }
  if (filters.runtime_min !== undefined || filters.runtime_max !== undefined) {
    const lo = filters.runtime_min ?? 0;
    const hi = filters.runtime_max ?? 240;
    chips.push({
      key: "runtime",
      label: `${lo}–${hi}m`,
      clear: () => {
        onPatch("runtime_min", undefined);
        onPatch("runtime_max", undefined);
      },
    });
  }
  if (filters.providers && filters.providers.length > 0) {
    for (const p of filters.providers) {
      chips.push({
        key: `provider-${p}`,
        label: p,
        clear: () => {
          const next = (filters.providers ?? []).filter((x) => x !== p);
          onPatch("providers", next.length > 0 ? next : undefined);
        },
      });
    }
  }

  // The top bar already shows the title count. Repeat it here only when
  // filters are *narrowing* the visible set — that's the genuinely new
  // information ("N of M titles match"). The sort label was redundant
  // with the Sort dropdown two inches away in the rail.
  const isFiltered = chips.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--rule)] px-1 py-3">
      {isFiltered ? (
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--paper-faint)]">
          {total} {total === 1 ? "match" : "matches"}
        </span>
      ) : null}

      {chips.length > 0 && total !== undefined && (
        <span aria-hidden className="h-3 w-px bg-[var(--rule)]" />
      )}

      <AnimatePresence>
        {chips.map((c) => (
          <motion.button
            key={c.key}
            layout
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: m.durBase, ease: m.easeOutQuint }}
            type="button"
            onClick={c.clear}
            className="group flex items-center gap-1.5 rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-2.5 py-1 text-[11.5px] text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <span>{c.label}</span>
            <span
              aria-hidden
              className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[var(--paper-3)] text-[var(--paper-dim)] group-hover:bg-[var(--accent)] group-hover:text-[var(--paper)]"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
          </motion.button>
        ))}
      </AnimatePresence>

      {chips.length > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="ml-auto font-label text-[10px] text-[var(--paper-faint)] underline-offset-4 hover:text-[var(--accent)] hover:underline"
        >
          Reset all
        </button>
      )}
    </div>
  );
}
