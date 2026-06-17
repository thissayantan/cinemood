/**
 * compare-table.tsx — side-by-side title comparison dialog.
 *
 * Design:
 *   Desktop (≥ md): a horizontally scrollable table.
 *     - Columns = titles (portrait poster + name header).
 *     - Rows = attributes.
 *     - Frozen first column = row labels.
 *   Mobile (< md): stacked cards — one per title, each listing all rows.
 *
 * Aesthetic: editorial paper-&-ink; hairline rules between rows; AI rows
 * get a subtle sparkle prefix to distinguish them from deterministic data.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CompareCell, CompareResponse } from "@cinemood/shared";
import { api } from "@/lib/api";
import { useMotionConfig } from "@/lib/motion";
import { Dialog, AnimatedDialogContent, DialogTitle } from "@/components/dialog";
import { posterUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleIds: number[];
  /** Optional item metadata for rendering poster thumbnails inline. */
  posterPaths?: Record<number, string | null>;
  titleNames?: Record<number, string>;
}

// ── Row definitions ─────────────────────────────────────────────────────────

interface RowDef {
  key: keyof CompareCell;
  label: string;
  ai?: boolean;
  render?: (v: unknown, row: CompareCell) => React.ReactNode;
}

const ROWS: RowDef[] = [
  {
    key: "year",
    label: "Year",
    render: (v): React.ReactNode => (v != null ? String(v) : "—"),
  },
  {
    key: "type",
    label: "Type",
    render: (v) => (v === "movie" ? "Film" : "Series"),
  },
  {
    key: "runtime",
    label: "Runtime",
    render: (v) => (typeof v === "number" ? `${v} min` : "—"),
  },
  {
    key: "genres",
    label: "Genres",
    render: (v) => {
      const genres = v as string[];
      if (!genres.length) return <span className="text-[var(--paper-faint)]">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {genres.slice(0, 3).map((g) => (
            <span
              key={g}
              className="rounded border border-[var(--rule)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--paper-dim)]"
            >
              {g}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    key: "vote_average",
    label: "TMDB",
    render: (v) => (typeof v === "number" && v > 0 ? `★ ${v.toFixed(1)}` : "—"),
  },
  {
    key: "imdb_rating",
    label: "IMDb",
    render: (v) => (typeof v === "number" && v > 0 ? `★ ${v.toFixed(1)}` : "—"),
  },
  {
    key: "providers",
    label: "Stream on",
    render: (v) => {
      const ps = v as string[];
      if (!ps.length) return <span className="text-[var(--paper-faint)]">—</span>;
      return ps.slice(0, 3).join(", ");
    },
  },
  // AI rows
  {
    key: "mood",
    label: "Mood",
    ai: true,
    render: (v) => v ? String(v) : <span className="italic text-[var(--paper-faint)]">—</span>,
  },
  {
    key: "pacing",
    label: "Pacing",
    ai: true,
    render: (v) =>
      v ? (
        <span className="capitalize">{String(v).replace(/-/g, "‑")}</span>
      ) : (
        <span className="italic text-[var(--paper-faint)]">—</span>
      ),
  },
  {
    key: "tone",
    label: "Tone",
    ai: true,
    render: (v) =>
      v ? (
        <span className="capitalize">{String(v)}</span>
      ) : (
        <span className="italic text-[var(--paper-faint)]">—</span>
      ),
  },
  {
    key: "critical_consensus",
    label: "Consensus",
    ai: true,
    render: (v): React.ReactNode =>
      v ? (
        <span className="text-[var(--paper-dim)]">{String(v)}</span>
      ) : (
        <span className="italic text-[var(--paper-faint)]">—</span>
      ),
  },
  {
    key: "watch_if_you_liked",
    label: "If you liked…",
    ai: true,
    render: (v) => {
      const items = v as string[];
      if (!items.length) return <span className="italic text-[var(--paper-faint)]">—</span>;
      return items.join(", ");
    },
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export function CompareTable({
  open,
  onOpenChange,
  titleIds,
  posterPaths = {},
  titleNames = {},
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatedDialogContent
        open={open}
        side="center"
        title="Compare titles"
      >
        <CompareBody
          titleIds={titleIds}
          posterPaths={posterPaths}
          titleNames={titleNames}
        />
      </AnimatedDialogContent>
    </Dialog>
  );
}

function CompareBody({
  titleIds,
  posterPaths,
  titleNames,
}: {
  titleIds: number[];
  posterPaths: Record<number, string | null>;
  titleNames: Record<number, string>;
}) {
  const m = useMotionConfig();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompareResponse | null>(null);

  // Fetch on mount
  useState(() => {
    let cancelled = false;
    (async () => {
      const res = await api<CompareResponse>("/api/compare", {
        method: "POST",
        body: JSON.stringify({ title_ids: titleIds }),
      });
      if (cancelled) return;
      setLoading(false);
      if (res.ok) setData(res.data);
      else setError(res.error.message);
    })();
    return () => { cancelled = true; };
  });

  const fadeT = m.reduced ? { duration: 0 } : { duration: m.durBase, ease: m.easeOutQuint };

  return (
    <div className="flex flex-col" style={{ maxHeight: "90vh" }}>
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--rule)] px-6 pb-4 pt-5 sm:px-8">
        <DialogTitle
          className="font-display-md text-[22px] leading-tight text-[var(--ink)] sm:text-[28px]"
          style={{ fontVariationSettings: '"opsz" 36, "wght" 800, "SOFT" 20' }}
        >
          Compare
        </DialogTitle>
        <p className="mt-1 text-[12px] text-[var(--paper-faint)]">
          <SparkleIcon className="mr-1 inline-block" />
          <span className="italic">AI rows</span> are generated — deterministic data from the TMDB record above.
        </p>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={fadeT}
              className="flex items-center justify-center py-16"
            >
              <span className="font-label text-[11px] uppercase tracking-widest text-[var(--paper-faint)]">
                Analysing…
              </span>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={fadeT}
              className="px-6 py-8 sm:px-8"
            >
              <p className="text-[13px] text-red-500">{error}</p>
            </motion.div>
          ) : data ? (
            <motion.div
              key="data"
              initial={m.reduced ? {} : { opacity: 0, y: m.fadeY }}
              animate={{ opacity: 1, y: 0 }}
              transition={fadeT}
            >
              {/* Desktop table */}
              <div className="hidden md:block">
                <DesktopTable
                  rows={data.rows}
                  posterPaths={posterPaths}
                  titleNames={titleNames}
                />
              </div>
              {/* Mobile stacked cards */}
              <div className="md:hidden">
                <MobileCards
                  rows={data.rows}
                  posterPaths={posterPaths}
                  titleNames={titleNames}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Desktop: horizontal table ────────────────────────────────────────────────

function DesktopTable({
  rows,
  posterPaths,
  titleNames,
}: {
  rows: CompareCell[];
  posterPaths: Record<number, string | null>;
  titleNames: Record<number, string>;
}) {
  const colW = 180;
  const labelW = 120;

  return (
    <div className="overflow-x-auto px-6 pb-6 sm:px-8">
      <table
        className="min-w-max border-collapse text-left"
        style={{ tableLayout: "fixed" }}
      >
        {/* Column headers = poster + title */}
        <thead>
          <tr>
            {/* Frozen label col */}
            <th
              style={{ width: labelW, minWidth: labelW }}
              className="sticky left-0 bg-[var(--paper)] pb-4 pr-6 pt-5 align-bottom"
            />
            {rows.map((col) => {
              const poster = posterPaths[col.title_id]
                ? posterUrl(posterPaths[col.title_id] ?? null, "w185")
                : null;
              const name = titleNames[col.title_id] ?? col.title;
              return (
                <th
                  key={col.title_id}
                  style={{ width: colW, minWidth: colW }}
                  className="pb-4 pr-4 pt-5 align-bottom font-normal"
                >
                  <div className="flex flex-col items-start gap-2">
                    <div
                      className="overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--paper-3)]"
                      style={{ width: 60, aspectRatio: "2/3" }}
                    >
                      {poster && (
                        <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <span
                      className="line-clamp-2 font-display-sm text-[13px] leading-snug text-[var(--ink)]"
                      style={{ fontVariationSettings: '"opsz" 14, "wght" 600, "SOFT" 40' }}
                    >
                      {name}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((rowDef, rowIdx) => {
            const isAi = rowDef.ai;
            const isFirstAi = ROWS.findIndex((r) => r.ai) === rowIdx;
            return (
              <>
                {/* Divider before first AI row */}
                {isFirstAi && (
                  <tr key={`divider-${rowIdx}`}>
                    <td
                      colSpan={rows.length + 1}
                      className="py-2 pr-4"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-px flex-1 bg-[var(--rule)]" />
                        <span className="flex items-center gap-1 font-label text-[9px] uppercase tracking-widest text-[var(--paper-faint)]">
                          <SparkleIcon className="opacity-60" />
                          AI analysis
                        </span>
                        <span className="h-px flex-1 bg-[var(--rule)]" />
                      </div>
                    </td>
                  </tr>
                )}
                <tr
                  key={rowDef.key}
                  className={cn(
                    "border-t border-[var(--rule)]",
                    isAi && "bg-[var(--paper-2)]/40",
                  )}
                >
                  {/* Row label */}
                  <td
                    className="sticky left-0 bg-[var(--paper)] py-3 pr-6"
                    style={{ width: labelW, minWidth: labelW }}
                  >
                    <span className="flex items-center gap-1.5 font-label text-[10px] uppercase tracking-widest text-[var(--paper-faint)]">
                      {isAi && <SparkleIcon className="opacity-50" />}
                      {rowDef.label}
                    </span>
                  </td>
                  {/* Data cells */}
                  {rows.map((col) => (
                    <td
                      key={col.title_id}
                      className="py-3 pr-4 text-[13px] text-[var(--ink)] align-top"
                      style={{ width: colW, minWidth: colW }}
                    >
                      {rowDef.render
                        ? rowDef.render(col[rowDef.key], col)
                        : String(col[rowDef.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Mobile: stacked cards per title ─────────────────────────────────────────

function MobileCards({
  rows,
  posterPaths,
  titleNames,
}: {
  rows: CompareCell[];
  posterPaths: Record<number, string | null>;
  titleNames: Record<number, string>;
}) {
  return (
    <div className="space-y-5 px-5 pb-6 pt-4">
      {rows.map((col) => {
        const poster = posterPaths[col.title_id]
          ? posterUrl(posterPaths[col.title_id] ?? null, "w185")
          : null;
        const name = titleNames[col.title_id] ?? col.title;
        const detRows = ROWS.filter((r) => !r.ai);
        const aiRows = ROWS.filter((r) => r.ai);
        return (
          <div
            key={col.title_id}
            className="overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--paper-2)]"
          >
            {/* Card header */}
            <div className="flex items-center gap-3 border-b border-[var(--rule)] p-4">
              <div
                className="shrink-0 overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--paper-3)]"
                style={{ width: 44, aspectRatio: "2/3" }}
              >
                {poster && (
                  <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </div>
              <span
                className="font-display-sm text-[15px] leading-snug text-[var(--ink)]"
                style={{ fontVariationSettings: '"opsz" 14, "wght" 600, "SOFT" 40' }}
              >
                {name}
              </span>
            </div>
            {/* Deterministic rows */}
            {detRows.map((rowDef) => (
              <div key={rowDef.key} className="flex items-start gap-2 border-t border-[var(--rule)] px-4 py-2.5">
                <span className="w-20 shrink-0 font-label text-[10px] uppercase tracking-widest text-[var(--paper-faint)]">
                  {rowDef.label}
                </span>
                <span className="text-[13px] text-[var(--ink)]">
                  {rowDef.render ? rowDef.render(col[rowDef.key], col) : String(col[rowDef.key] ?? "—")}
                </span>
              </div>
            ))}
            {/* AI rows */}
            <div className="border-t border-[var(--rule)] bg-[var(--paper-2)]/60 px-4 py-2.5">
              <span className="flex items-center gap-1 font-label text-[9px] uppercase tracking-widest text-[var(--paper-faint)]">
                <SparkleIcon className="opacity-60" /> AI analysis
              </span>
            </div>
            {aiRows.map((rowDef) => (
              <div key={rowDef.key} className="flex items-start gap-2 border-t border-[var(--rule)] px-4 py-2.5">
                <span className="w-20 shrink-0 font-label text-[10px] uppercase tracking-widest text-[var(--paper-faint)]">
                  {rowDef.label}
                </span>
                <span className="text-[13px] text-[var(--ink)]">
                  {rowDef.render ? rowDef.render(col[rowDef.key], col) : String(col[rowDef.key] ?? "—")}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path d="M8 2v2M8 12v2M2 8h2M12 8h2M4.2 4.2l1.4 1.4M10.4 10.4l1.4 1.4M4.2 11.8l1.4-1.4M10.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
