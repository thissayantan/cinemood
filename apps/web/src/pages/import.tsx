import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { ApiResponse, User } from "@cinemood/shared";
import { api } from "@/lib/api";
import { posterUrl } from "@/lib/tmdb";
import { useMotionConfig } from "@/lib/motion";
import {
  parseCsvImport,
  parseTakeoutJson,
  parseTextarea,
  type ImportCandidate,
  type TitleType,
} from "@/lib/import-parsers";
import { AvatarMenu } from "@/components/avatar-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { RouteTitle } from "@/components/route-title";
import { FilmstripProgress } from "@/components/filmstrip-progress";
import { cn } from "@/lib/utils";

interface TmdbHit {
  id: number;
  type: TitleType;
  title: string;
  release_date: string | null;
  poster_path: string | null;
  overview: string | null;
  vote_average: number | null;
}

interface ResolvedHit {
  raw: string;
  status: "matched" | "ambiguous" | "unmatched";
  confidence: number;
  best?: TmdbHit;
  alternatives: TmdbHit[];
}

type Mode = "paste" | "csv" | "takeout";

export default function ImportPage({ user }: { user: User }) {
  const m = useMotionConfig();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("paste");
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [resolved, setResolved] = useState<ResolvedHit[] | null>(null);
  const [picks, setPicks] = useState<Record<string, TmdbHit | null>>({});
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [parseInfo, setParseInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  function reset() {
    setText("");
    setCandidates([]);
    setResolved(null);
    setPicks({});
    setError(null);
    setParseInfo(null);
    setProgress(null);
  }

  function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function handlePasteParse() {
    const items = parseTextarea(text);
    setCandidates(items);
    setParseInfo(`${items.length} line${items.length === 1 ? "" : "s"} detected`);
  }

  async function handleFile(file: File, kind: "csv" | "takeout") {
    const body = await file.text();
    if (kind === "csv") {
      const { candidates: items, detected } = parseCsvImport(body);
      setCandidates(items);
      setParseInfo(`${items.length} rows · detected format: ${detected}`);
    } else {
      const items = parseTakeoutJson(body);
      setCandidates(items);
      setParseInfo(`${items.length} items found in JSON`);
    }
  }

  async function runResolve() {
    if (candidates.length === 0) return;
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: candidates.length });

    // Resolve in 25-item chunks. The server-side resolver issues 1–3 TMDB
    // searches per candidate (× ~3 subreqs each: KV get + fetch + KV put);
    // 25 items × ~3 subreqs = ~75 worst case, safely under the Worker
    // per-invocation subrequest cap on both production AND the wrangler-dev
    // preview environment (where the cap is much lower).
    const all: ResolvedHit[] = [];
    for (const batch of chunk(candidates, 25)) {
      const res = (await api<{ resolved: ResolvedHit[] }>("/api/import/resolve", {
        method: "POST",
        body: JSON.stringify({ items: batch }),
      })) as ApiResponse<{ resolved: ResolvedHit[] }>;
      if (!res.ok) {
        setLoading(false);
        setProgress(null);
        setError(res.error.message);
        return;
      }
      all.push(...res.data.resolved);
      setProgress({ done: all.length, total: candidates.length });
    }
    setLoading(false);
    setProgress(null);
    setResolved(all);
    const initialPicks: Record<string, TmdbHit | null> = {};
    for (const r of all) {
      initialPicks[r.raw] = r.status === "unmatched" ? null : r.best ?? null;
    }
    setPicks(initialPicks);
  }

  async function commit() {
    if (!resolved) return;
    // Dedupe by (tmdb_id, type) — duplicate raw lines collapse to the same
    // pick, so the commit array should match the visible "Add X to catalog"
    // count instead of including the same title N times.
    const items: { tmdb_id: number; type: TitleType }[] = [];
    const seen = new Set<string>();
    for (const r of resolved) {
      const pick = picks[r.raw];
      if (!pick) continue;
      const key = `${pick.type}:${pick.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ tmdb_id: pick.id, type: pick.type });
    }
    if (items.length === 0) return;
    setCommitting(true);
    setError(null);
    setProgress({ done: 0, total: items.length });

    // Commit in 25-item chunks — each chunk fans out TMDB+OMDB at
    // concurrency 8 on the server and batches D1 writes + a single index
    // update via waitUntil, so 25 items per chunk stays well under the
    // Worker subrequest cap even when every title needs a fresh fetch.
    let ok = 0;
    for (const batch of chunk(items, 25)) {
      const res = (await api<{
        outcomes: { tmdb_id: number; ok: boolean }[];
      }>("/api/import/commit", {
        method: "POST",
        body: JSON.stringify({ items: batch }),
      })) as ApiResponse<{ outcomes: { tmdb_id: number; ok: boolean }[] }>;
      if (!res.ok) {
        setCommitting(false);
        setProgress(null);
        setError(res.error.message);
        return;
      }
      ok += res.data.outcomes.filter((o) => o.ok).length;
      setProgress({ done: ok, total: items.length });
    }
    setCommitting(false);
    setProgress(null);
    nav("/?imported=" + ok);
  }

  const selectedCount = Object.values(picks).filter(Boolean).length;

  // The sticky sidebar preview shows whichever row the user last hovered (or
  // focused via keyboard). It never auto-clears — flicker-free, persistent.
  // Initialised to the first picked row so the sidebar isn't blank on entry.
  const [previewItem, setPreviewItem] = useState<{
    pick: TmdbHit;
    raw: string;
  } | null>(null);
  useEffect(() => {
    if (previewItem) return;
    if (!resolved) return;
    for (const r of resolved) {
      const p = picks[r.raw];
      if (p) {
        setPreviewItem({ pick: p, raw: r.raw });
        break;
      }
    }
  }, [resolved, picks, previewItem]);

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <RouteTitle title="Import" />
      <header className="border-b border-[var(--rule)]">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-5 md:px-8">
          <Link
            to="/"
            className="font-display-md text-[24px] leading-none text-[var(--ink)]"
            style={{ fontVariationSettings: '"opsz" 36, "wght" 800, "SOFT" 20' }}
          >
            Cinemood
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AvatarMenu user={user} />
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto px-5 pb-24 pt-10 md:px-8",
          // Widen when the review step is up so the sticky preview sidebar
          // sits next to the list without compressing it.
          resolved ? "max-w-[1120px]" : "max-w-[860px]",
        )}
      >
        <motion.div
          initial={m.reduced ? false : { opacity: 0, y: m.fadeY }}
          animate={{ opacity: 1, y: 0 }}
          transition={m.reduced ? { duration: 0 } : m.springEntry}
        >
          <Link
            to="/"
            className="font-label text-[10px] text-[var(--paper-faint)] hover:text-[var(--ink)]"
          >
            ← Back to your collection
          </Link>
          <h1
            className="mt-3 font-display text-[44px] leading-[1.02] text-[var(--ink)]"
            style={{ fontVariationSettings: '"opsz" 72, "wght" 800, "SOFT" 20' }}
          >
            Import a list
          </h1>
          <p className="mt-3 max-w-[60ch] text-[15px] text-[var(--paper-dim)]">
            Paste titles, upload a Letterboxd / Trakt / IMDb CSV, or drop in a Google Takeout JSON. Each entry is resolved against TMDB and shown for review before anything is added to your catalog.
          </p>
        </motion.div>

        {!resolved && (
          <motion.div
            initial={m.reduced ? false : { opacity: 0, y: m.fadeY }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              m.reduced ? { duration: 0 } : { ...m.springEntry, delay: 0.05 }
            }
            className="mt-8 rounded-2xl border border-[var(--rule)] bg-[var(--paper-2)] p-7"
          >
            <div className="mb-5 flex flex-wrap gap-2">
              {(["paste", "csv", "takeout"] as Mode[]).map((mm) => (
                <button
                  key={mm}
                  type="button"
                  onClick={() => { setMode(mm); reset(); }}
                  aria-pressed={mode === mm}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] transition",
                    mode === mm
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)]"
                      : "border-[var(--rule)] text-[var(--paper-dim)] hover:text-[var(--ink)]",
                  )}
                >
                  {mm === "paste" ? "Paste list" : mm === "csv" ? "Upload CSV" : "Google Takeout"}
                </button>
              ))}
            </div>

            {mode === "paste" && (
              <div className="space-y-3">
                <textarea
                  rows={10}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    "One title per line — year in parentheses optional.\n\nE.g.\nBlade Runner (1982)\nSeverance\nPast Lives (2023)"
                  }
                  className="w-full rounded-xl border border-[var(--rule)] bg-[var(--paper)] px-4 py-3 font-mono text-[12.5px] text-[var(--ink)] placeholder:text-[var(--paper-faint)] outline-none transition focus:border-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={handlePasteParse}
                  disabled={!text.trim()}
                  className="rounded-full border border-[var(--rule)] bg-[var(--paper)] px-4 py-2 text-[12.5px] text-[var(--paper-dim)] transition hover:text-[var(--ink)] disabled:opacity-50"
                >
                  Parse
                </button>
              </div>
            )}

            {mode === "csv" && (
              <FileInput
                label="Letterboxd / Trakt / IMDb / generic CSV"
                accept=".csv,text/csv"
                onFile={(f) => handleFile(f, "csv")}
              />
            )}

            {mode === "takeout" && (
              <FileInput
                label="Google Takeout JSON (YouTube watchlist, Google TV, etc.)"
                accept=".json,application/json"
                onFile={(f) => handleFile(f, "takeout")}
              />
            )}

            {parseInfo && (
              <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
                {parseInfo}
              </p>
            )}

            {candidates.length > 0 && (
              <div className="mt-6 border-t border-[var(--rule)] pt-5">
                {loading && progress ? (
                  <FilmstripProgress
                    label="Resolving against TMDB"
                    done={progress.done}
                    total={progress.total}
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--paper-dim)]">
                      Ready to resolve {candidates.length} title{candidates.length === 1 ? "" : "s"} against TMDB.
                    </span>
                    <button
                      type="button"
                      onClick={runResolve}
                      disabled={loading}
                      className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-[12.5px] text-[var(--paper)] transition hover:opacity-90 disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-md border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-2 text-[11.5px] text-[var(--accent)]">
                {error}
              </div>
            )}
          </motion.div>
        )}

        {resolved && (
          <motion.div
            initial={m.reduced ? false : { opacity: 0, y: m.fadeY }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              m.reduced ? { duration: 0 } : { ...m.springEntry, delay: 0.05 }
            }
            className="mt-8 rounded-2xl border border-[var(--rule)] bg-[var(--paper-2)] p-4"
          >
            <div className="mb-3 flex items-center justify-between px-2">
              <h2 className="font-label text-[10px] text-[var(--paper-faint)]">
                Review & pick — {selectedCount} of {resolved.length} selected
              </h2>
              <button
                type="button"
                onClick={reset}
                className="font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)] hover:text-[var(--ink)]"
              >
                Start over
              </button>
            </div>
            <div
              className="md:grid md:grid-cols-[minmax(0,1fr)_320px] md:gap-6"
              onMouseLeave={() => setPreviewItem(null)}
            >
              <ul className="divide-y divide-[var(--rule)]">
                {resolved.map((r) => (
                  <ResolvedRow
                    key={r.raw}
                    row={r}
                    pick={picks[r.raw] ?? null}
                    onPick={(hit) => {
                      setPicks((prev) => ({ ...prev, [r.raw]: hit }));
                      if (hit) setPreviewItem({ pick: hit, raw: r.raw });
                    }}
                    onPreview={(hit) => {
                      if (hit) setPreviewItem({ pick: hit, raw: r.raw });
                    }}
                  />
                ))}
              </ul>

              {/* Sticky preview sidebar — desktop only. Always rendered while
                  the review step is up; content swaps on each row's hover or
                  keyboard focus. Hidden on mobile where the dropdown alone
                  is the affordance. */}
              <aside className="hidden md:block">
                <div className="sticky top-4">
                  {previewItem ? (
                    <PickPreview
                      pick={previewItem.pick}
                      raw={previewItem.raw}
                    />
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[var(--rule)] p-6 text-center font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
                      Hover a row to preview
                    </div>
                  )}
                </div>
              </aside>
            </div>
            <div className="mt-5 border-t border-[var(--rule)] pt-5">
              {committing && progress ? (
                <FilmstripProgress
                  label="Adding to your catalog"
                  done={progress.done}
                  total={progress.total}
                />
              ) : (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
                    Unselected items can be re-tried by editing the input.
                  </span>
                  <button
                    type="button"
                    onClick={commit}
                    disabled={committing || selectedCount === 0}
                    className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-[12.5px] text-[var(--paper)] transition hover:opacity-90 disabled:opacity-50"
                  >
                    {`Add ${selectedCount} to catalog`}
                  </button>
                </div>
              )}
            </div>
            {error && (
              <div className="mt-4 rounded-md border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-2 text-[11.5px] text-[var(--accent)]">
                {error}
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}

function ResolvedRow({
  row,
  pick,
  onPick,
  onPreview,
}: {
  row: ResolvedHit;
  pick: TmdbHit | null;
  onPick: (hit: TmdbHit | null) => void;
  /** Notify the parent that this row was just hovered / focused so the
   *  sticky preview sidebar can swap its content. Fires only when there's
   *  an actual pick to show. */
  onPreview: (hit: TmdbHit | null) => void;
}) {
  const candidates = [row.best, ...row.alternatives].filter(
    (h): h is TmdbHit => Boolean(h),
  );

  return (
    <li
      className="flex items-center gap-3 px-2 py-3 transition-colors hover:bg-[var(--paper-3)]/30 focus-within:bg-[var(--paper-3)]/30"
      onMouseEnter={() => onPreview(pick)}
      onFocus={() => onPreview(pick)}
    >
      <input
        type="checkbox"
        checked={Boolean(pick)}
        onChange={(e) =>
          onPick(e.target.checked ? candidates[0] ?? null : null)
        }
        className="h-4 w-4 accent-[var(--accent)]"
        aria-label={`Include ${row.raw}`}
      />
      <div className="grid h-12 w-8 shrink-0 overflow-hidden rounded bg-[var(--paper-3)]">
        {pick && pick.poster_path ? (
          <img
            src={posterUrl(pick.poster_path, "w185") ?? ""}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-[9px] text-[var(--paper-faint)]">
            ·
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-[var(--ink)]">{row.raw}</div>
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider">
          {row.status === "matched" && (
            <span className="text-[var(--accent)]">
              matched · {Math.round(row.confidence * 100)}%
            </span>
          )}
          {row.status === "ambiguous" && (
            <span className="text-[var(--paper-dim)]">
              ambiguous · {Math.round(row.confidence * 100)}%
            </span>
          )}
          {row.status === "unmatched" && (
            <span className="text-[var(--paper-faint)]">no match</span>
          )}
        </div>
      </div>
      {candidates.length > 0 ? (
        <select
          value={pick?.id ?? ""}
          onChange={(e) => {
            const id = Number(e.target.value);
            const hit = candidates.find((h) => h.id === id) ?? null;
            onPick(hit);
          }}
          className="max-w-[14rem] rounded-md border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 text-[11.5px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
        >
          <option value="" className="bg-[var(--paper-2)]">— skip —</option>
          {candidates.map((h) => (
            <option key={h.id} value={h.id} className="bg-[var(--paper-2)]">
              {h.title}
              {h.release_date ? ` (${h.release_date.slice(0, 4)})` : ""} · {h.type}
            </option>
          ))}
        </select>
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">no candidates</span>
      )}
    </li>
  );
}

function PickPreview({ pick, raw }: { pick: TmdbHit; raw: string }) {
  const poster = posterUrl(pick.poster_path, "w342");
  const year = pick.release_date ? pick.release_date.slice(0, 4) : "—";
  const rating =
    typeof pick.vote_average === "number" && pick.vote_average > 0
      ? pick.vote_average.toFixed(1)
      : null;
  return (
    <div className="rounded-2xl border border-[var(--rule)] bg-[var(--paper)] p-4 shadow-[var(--shadow-card)]">
      <div
        className="mx-auto overflow-hidden rounded-md border border-[var(--rule)] bg-[var(--paper-3)]"
        style={{ width: "100%", maxWidth: 200, aspectRatio: "2 / 3" }}
      >
        {poster ? (
          <img
            src={poster}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="grid h-full place-items-center font-label text-[10px] text-[var(--paper-faint)]">
            no poster
          </div>
        )}
      </div>
      <div className="mt-4">
        <h3
          className="font-display-sm leading-tight text-[var(--ink)]"
          style={{ fontVariationSettings: '"opsz" 28, "wght" 700, "SOFT" 30' }}
        >
          {pick.title}
        </h3>
        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-dim)]">
          {year} · {pick.type}
          {rating ? <span className="ml-1">· ★ {rating}</span> : null}
        </div>
        <p className="mt-3 line-clamp-6 text-[12.5px] leading-snug text-[var(--paper-dim)]">
          {pick.overview || (
            <span className="italic text-[var(--paper-faint)]">
              No synopsis on file.
            </span>
          )}
        </p>
        <div className="mt-3 border-t border-[var(--rule)] pt-3 font-mono text-[9px] uppercase tracking-wider text-[var(--paper-faint)]">
          picked for &ldquo;{raw}&rdquo;
        </div>
      </div>
    </div>
  );
}

function FileInput({
  label,
  accept,
  onFile,
}: {
  label: string;
  accept: string;
  onFile: (f: File) => void;
}) {
  return (
    <label className="flex flex-col items-start gap-2">
      <span className="font-label text-[10px] text-[var(--paper-faint)]">{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
        className="block rounded-xl border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-[13px] text-[var(--paper-dim)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--ink)] file:px-3 file:py-1.5 file:text-[12px] file:text-[var(--paper)] hover:file:opacity-90"
      />
    </label>
  );
}
