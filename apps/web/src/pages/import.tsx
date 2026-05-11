import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { ApiResponse, Title, User } from "@cinemood/shared";
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
import { Dialog, AnimatedDialogContent } from "@/components/dialog";
import { cn } from "@/lib/utils";
import { selectProviders } from "@/lib/providers";
import { useWatchlistIds } from "@/lib/use-watchlist-ids";

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
  /** Server-tagged: best.id is already in the user's watchlist. */
  in_catalog?: boolean;
}

type Mode = "paste" | "csv" | "takeout";

function modeLabel(mode: Mode): string {
  switch (mode) {
    case "paste": return "Paste list";
    case "csv": return "Upload CSV";
    case "takeout": return "Google Takeout";
  }
}

// LocalStorage persistence for the review state. Lets the user survive
// failed commits (network blip, validation error, server hiccup) without
// having to re-resolve and re-pick every row. Cleared once a commit
// fully succeeds.
type Pick = { hit: TmdbHit; included: boolean };
interface PersistedState {
  resolved: ResolvedHit[];
  picks: Record<string, Pick | null>;
  // Last failure surface from a commit attempt — restored so the user can
  // see what went wrong on the previous try.
  lastError?: string;
  // Per-tmdb_id failure reasons from the most recent commit, so the user
  // can see exactly which rows fell through.
  failedOutcomes?: { tmdb_id: number; type: TitleType; reason: string }[];
  savedAt: number;
}
const STORAGE_KEY = "cinemood:import:v2";
function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.resolved || !Array.isArray(parsed.resolved)) return null;
    return parsed;
  } catch {
    return null;
  }
}
function savePersisted(state: PersistedState | null) {
  try {
    if (!state) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / privacy mode — non-fatal
  }
}

export default function ImportPage({ user }: { user: User }) {
  const m = useMotionConfig();
  const fadeUpInitial = m.reduced ? false : { opacity: 0, y: m.fadeY };
  const entryTransition = m.reduced ? { duration: 0 } : m.springEntry;
  const delayedEntry = m.reduced
    ? { duration: 0 }
    : { ...m.springEntry, delay: 0.05 };
  const previewTransition = m.reduced
    ? { duration: 0 }
    : { duration: 0.15, ease: m.easeOutQuint };
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("paste");
  const [text, setText] = useState("");
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [resolved, setResolved] = useState<ResolvedHit[] | null>(null);
  // Per-row state has two independent dimensions: which TMDB candidate the
  // user has chosen (`hit`) and whether to include this row in the commit
  // (`included`). The checkbox controls `included`; the dropdown controls
  // `hit`. Unchecking no longer loses the candidate selection, and the
  // "— skip —" pseudo-option that used to confuse the dropdown is gone.
  const [picks, setPicks] = useState<Record<string, Pick | null>>({});
  // Per-tmdb_id failures from the previous commit attempt — surfaced as
  // a row badge so the user can see which items the server rejected.
  const [failedOutcomes, setFailedOutcomes] = useState<
    { tmdb_id: number; type: TitleType; reason: string }[]
  >([]);
  // The user's existing watchlist ids — drives the "already in catalog"
  // badge so re-imports of the same Takeout file don't surprise-add
  // duplicates. Switching candidates via the dropdown to a different year /
  // movie vs series re-evaluates against this set, so a same-name-different
  // -year title can still be imported.
  const { ids: existingIds, reload: reloadWatchlistIds } = useWatchlistIds();
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [parseInfo, setParseInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // Banner offering to restore an unfinished prior import. We only mount
  // the banner once on first render; the user opts in to restore or
  // discard.
  const [restoreOffer, setRestoreOffer] = useState<PersistedState | null>(null);

  // On mount: if there's an unfinished review state in localStorage, offer
  // to restore it instead of making the user re-parse + re-resolve.
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted && persisted.resolved.length > 0) {
      setRestoreOffer(persisted);
    }
  }, []);

  function restorePersisted(p: PersistedState) {
    setResolved(p.resolved);
    setPicks(p.picks);
    setFailedOutcomes(p.failedOutcomes ?? []);
    setError(p.lastError ?? null);
    setRestoreOffer(null);
  }

  function discardPersisted() {
    savePersisted(null);
    setRestoreOffer(null);
  }

  // Persist whenever the review state changes. Debounce-free is fine —
  // localStorage writes for ~200 rows are < 1ms.
  useEffect(() => {
    if (!resolved || resolved.length === 0) return;
    savePersisted({
      resolved,
      picks,
      lastError: error ?? undefined,
      failedOutcomes,
      savedAt: Date.now(),
    });
  }, [resolved, picks, error, failedOutcomes]);

  function reset() {
    setText("");
    setCandidates([]);
    setResolved(null);
    setPicks({});
    setError(null);
    setParseInfo(null);
    setProgress(null);
    setFailedOutcomes([]);
    savePersisted(null);
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
    const initialPicks: Record<string, Pick | null> = {};
    for (const r of all) {
      if (r.status === "unmatched" || !r.best) {
        initialPicks[r.raw] = null;
      } else {
        // Default-uncheck items already in the user's catalog so a casual
        // "Add 200 to catalog" click doesn't silently no-op on duplicates.
        // Trust the server-tagged `in_catalog` flag (the FE's parallel
        // useWatchlistIds fetch could race against resolve and leave this
        // off, which made re-imports look like "everything skipped").
        initialPicks[r.raw] = {
          hit: r.best,
          included: !(r.in_catalog || existingIds.has(r.best.id)),
        };
      }
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
      if (!pick || !pick.included) continue;
      const key = `${pick.hit.type}:${pick.hit.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ tmdb_id: pick.hit.id, type: pick.hit.type });
    }
    if (items.length === 0) return;
    // Loud diagnostic for the DevTools console — the user reported repeated
    // "imports vanish" and asked for more visibility into what we actually
    // send vs receive.
    console.info("[import] commit start", {
      sending: items.length,
      sample: items.slice(0, 3),
    });
    setCommitting(true);
    setError(null);
    setFailedOutcomes([]);
    setProgress({ done: 0, total: items.length });

    // Commit in 25-item chunks — each chunk fans out TMDB+OMDB at
    // concurrency 8 on the server and batches D1 writes + a single index
    // update via waitUntil, so 25 items per chunk stays well under the
    // Worker subrequest cap even when every title needs a fresh fetch.
    type Outcome = {
      tmdb_id: number;
      type: TitleType;
      ok: boolean;
      inserted?: boolean;
      error?: string;
    };
    let inserted = 0;
    let alreadyExisted = 0;
    let progressedTotal = 0;
    const failed: { tmdb_id: number; type: TitleType; reason: string }[] = [];
    for (const batch of chunk(items, 25)) {
      const res = (await api<{ outcomes: Outcome[] }>("/api/import/commit", {
        method: "POST",
        body: JSON.stringify({ items: batch }),
      })) as ApiResponse<{ outcomes: Outcome[] }>;
      if (!res.ok) {
        console.error("[import] commit chunk failed", res.error);
        setCommitting(false);
        setProgress(null);
        setError(res.error.message);
        // Keep state in localStorage so the user can retry without
        // re-resolving everything.
        return;
      }
      for (const o of res.data.outcomes) {
        if (!o.ok) {
          failed.push({
            tmdb_id: o.tmdb_id,
            type: o.type,
            reason: o.error ?? "unknown",
          });
          continue;
        }
        if (o.inserted) inserted++;
        else alreadyExisted++;
      }
      progressedTotal += res.data.outcomes.length;
      setProgress({ done: progressedTotal, total: items.length });
    }
    console.info("[import] commit done", {
      sent: items.length,
      inserted,
      alreadyExisted,
      failed: failed.length,
      failureSample: failed.slice(0, 5),
    });
    setCommitting(false);
    setProgress(null);
    setFailedOutcomes(failed);
    // Refresh the watchlist-ids cache so a subsequent re-import sees the
    // freshly-added rows. We don't strictly need this for the navigate
    // below, but the existingIds set is also used while reviewing.
    await reloadWatchlistIds();

    // Only clear persisted state on a fully clean run. If any rows failed,
    // keep the review state so the user can retry just the failures
    // without redoing the whole flow.
    if (failed.length === 0) {
      savePersisted(null);
      const params = new URLSearchParams();
      params.set("imported", String(inserted));
      if (alreadyExisted > 0) params.set("skipped", String(alreadyExisted));
      nav(`/?${params.toString()}`);
      return;
    }
    // Partial success: surface what happened, stay on this page.
    setError(
      `${inserted} added · ${alreadyExisted} already in your catalog · ${failed.length} failed. Failed rows are flagged below — fix or uncheck them and retry.`,
    );
  }

  // Honest count: dedupe by (type, tmdb_id) so the "Add N to catalog"
  // button matches the actual number of inserts the commit will make.
  // Otherwise a 200-row import where many raw lines collapse to the same
  // TMDB title shows e.g. "Add 200" but produces 67 inserts.
  const selectedCount = (() => {
    const seen = new Set<string>();
    for (const p of Object.values(picks)) {
      if (!p?.included) continue;
      seen.add(`${p.hit.type}:${p.hit.id}`);
    }
    return seen.size;
  })();

  // Breakdown for the review header — explains where the entries went so
  // a 200→67 import doesn't feel like a silent drop.
  const breakdown = (() => {
    if (!resolved) {
      return { total: 0, ready: 0, inCatalog: 0, unmatched: 0, dupes: 0 };
    }
    let inCatalog = 0;
    let unmatched = 0;
    const includedKeys = new Set<string>();
    let includedRaw = 0;
    for (const r of resolved) {
      if (r.status === "unmatched") {
        unmatched++;
        continue;
      }
      const p = picks[r.raw];
      if (p && existingIds.has(p.hit.id)) {
        inCatalog++;
        continue;
      }
      if (p?.included) {
        includedRaw++;
        includedKeys.add(`${p.hit.type}:${p.hit.id}`);
      }
    }
    return {
      total: resolved.length,
      ready: includedKeys.size,
      inCatalog,
      unmatched,
      // raw included entries collapsed into a smaller set of unique titles.
      dupes: includedRaw - includedKeys.size,
    };
  })();

  // The sticky sidebar preview shows whichever row the user last hovered (or
  // focused via keyboard). Initialised to the first picked row so the sidebar
  // isn't blank on entry. Cleared with a 200ms grace period so brief cursor
  // drift between list and sidebar doesn't flicker the panel out.
  const [previewItem, setPreviewItem] = useState<{
    pick: TmdbHit;
    raw: string;
  } | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClear = useCallback(() => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);
  const scheduleClear = useCallback(() => {
    cancelClear();
    clearTimerRef.current = setTimeout(() => {
      setPreviewItem(null);
      clearTimerRef.current = null;
    }, 200);
  }, [cancelClear]);
  useEffect(() => () => cancelClear(), [cancelClear]);

  useEffect(() => {
    if (previewItem) return;
    if (!resolved) return;
    for (const r of resolved) {
      const p = picks[r.raw];
      if (p) {
        setPreviewItem({ pick: p.hit, raw: r.raw });
        break;
      }
    }
  }, [resolved, picks, previewItem]);

  // Lazy-fetch full Title detail (genres + providers) for the previewed row.
  // Cached by `${type}:${id}` so re-hovering or switching back is instant.
  const [titleCache, setTitleCache] = useState<Map<string, Title>>(new Map());
  useEffect(() => {
    if (!previewItem) return;
    const key = `${previewItem.pick.type}:${previewItem.pick.id}`;
    if (titleCache.has(key)) return;
    let cancelled = false;
    (async () => {
      const res = (await api<Title>(
        `/api/title/${previewItem.pick.type}/${previewItem.pick.id}`,
      )) as ApiResponse<Title>;
      if (cancelled || !res.ok) return;
      setTitleCache((prev) => {
        const next = new Map(prev);
        next.set(key, res.data);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [previewItem, titleCache]);
  const previewDetail = previewItem
    ? titleCache.get(`${previewItem.pick.type}:${previewItem.pick.id}`) ?? null
    : null;

  // Tap-to-preview: the same content as the sidebar, but in a centered
  // Dialog so mobile users (no hover) and desktop users who tap a row get
  // the full preview surface.
  const [dialogItem, setDialogItem] = useState<{
    pick: TmdbHit;
    raw: string;
  } | null>(null);
  const dialogDetail = dialogItem
    ? titleCache.get(`${dialogItem.pick.type}:${dialogItem.pick.id}`) ?? null
    : null;

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
          initial={fadeUpInitial}
          animate={{ opacity: 1, y: 0 }}
          transition={entryTransition}
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

        {restoreOffer && !resolved && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/8 px-4 py-3">
            <div>
              <div className="font-label text-[10px] text-[var(--paper-faint)]">
                Unfinished import
              </div>
              <p className="mt-1 text-[13px] text-[var(--ink)]">
                You have {restoreOffer.resolved.length} reviewed item{restoreOffer.resolved.length === 1 ? "" : "s"} from{" "}
                {new Date(restoreOffer.savedAt).toLocaleString()} still pending.
                Pick up where you left off?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => restorePersisted(restoreOffer)}
                className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 text-[12px] text-[var(--paper)] hover:opacity-90"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={discardPersisted}
                className="rounded-full border border-[var(--rule)] px-3 py-1.5 text-[12px] text-[var(--paper-dim)] hover:text-[var(--ink)]"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {!resolved && (
          <motion.div
            initial={fadeUpInitial}
            animate={{ opacity: 1, y: 0 }}
            transition={delayedEntry}
            className="mt-8 rounded-2xl border border-[var(--rule)] bg-[var(--paper-2)] p-7"
          >
            <div className="mb-5 flex flex-wrap gap-2">
              {(["paste", "csv", "takeout"] as Mode[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setMode(tab); reset(); }}
                  aria-pressed={mode === tab}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] transition",
                    mode === tab
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)]"
                      : "border-[var(--rule)] text-[var(--paper-dim)] hover:text-[var(--ink)]",
                  )}
                >
                  {modeLabel(tab)}
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
            initial={fadeUpInitial}
            animate={{ opacity: 1, y: 0 }}
            transition={delayedEntry}
            className="mt-8 rounded-2xl border border-[var(--rule)] bg-[var(--paper-2)] p-4"
          >
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-2">
              <div className="min-w-0">
                <h2 className="font-label text-[10px] text-[var(--paper-faint)]">
                  Review &amp; pick
                </h2>
                <p className="mt-1 font-mono text-[11px] tracking-wider text-[var(--paper-dim)]">
                  <span className="text-[var(--ink)]">{breakdown.ready}</span> ready to add
                  {breakdown.inCatalog > 0 && (
                    <> · <span className="text-[var(--ink)]">{breakdown.inCatalog}</span> already in your catalog</>
                  )}
                  {breakdown.unmatched > 0 && (
                    <> · <span className="text-[var(--ink)]">{breakdown.unmatched}</span> unmatched</>
                  )}
                  {breakdown.dupes > 0 && (
                    <> · <span className="text-[var(--ink)]">{breakdown.dupes}</span> duplicate pick{breakdown.dupes === 1 ? "" : "s"} collapsed</>
                  )}
                </p>
              </div>
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
              onMouseLeave={scheduleClear}
              onMouseEnter={cancelClear}
            >
              <ul className="divide-y divide-[var(--rule)]">
                {resolved.map((r) => {
                  const p = picks[r.raw] ?? null;
                  // Prefer server tag for the originally-resolved hit; for
                  // anything the user switches to via the dropdown, fall
                  // back to the client-side ids set.
                  const onOriginalHit =
                    p && r.best && p.hit.id === r.best.id;
                  const inCatalog = p
                    ? (onOriginalHit && r.in_catalog) ||
                      existingIds.has(p.hit.id)
                    : false;
                  const failure = p
                    ? failedOutcomes.find(
                        (f) =>
                          f.tmdb_id === p.hit.id && f.type === p.hit.type,
                      )
                    : undefined;
                  return (
                    <ResolvedRow
                      key={r.raw}
                      row={r}
                      pick={p}
                      inCatalog={inCatalog}
                      failureReason={failure?.reason ?? null}
                      onChange={(next) => {
                        setPicks((prev) => ({ ...prev, [r.raw]: next }));
                        if (next?.hit) {
                          setPreviewItem({ pick: next.hit, raw: r.raw });
                        }
                      }}
                      onPreview={(hit) => {
                        cancelClear();
                        if (hit) setPreviewItem({ pick: hit, raw: r.raw });
                      }}
                      onOpenDialog={(hit) => {
                        if (hit) setDialogItem({ pick: hit, raw: r.raw });
                      }}
                    />
                  );
                })}
              </ul>

              {/* Sticky preview sidebar — desktop only. Always rendered while
                  the review step is up; content swaps on each row's hover or
                  keyboard focus. Hidden on mobile where the tap-to-preview
                  dialog is the affordance. */}
              <aside className="hidden md:block">
                <div className="sticky top-4">
                  <AnimatePresence mode="wait">
                    {previewItem ? (
                      <motion.div
                        key={`${previewItem.pick.type}:${previewItem.pick.id}`}
                        initial={m.reduced ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={m.reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                        transition={previewTransition}
                      >
                        <PickPreview
                          pick={previewItem.pick}
                          raw={previewItem.raw}
                          detail={previewDetail}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty"
                        initial={m.reduced ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={previewTransition}
                        className="rounded-2xl border border-dashed border-[var(--rule)] p-6 text-center font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]"
                      >
                        Hover a row to preview
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </aside>
            </div>

            {/* Tap-to-preview dialog — opens on row tap on any device, with
                the same content as the sidebar. */}
            <Dialog
              open={!!dialogItem}
              onOpenChange={(open) => {
                if (!open) setDialogItem(null);
              }}
            >
              <AnimatedDialogContent
                open={!!dialogItem}
                side="center"
                className="!w-[min(640px,calc(100vw-32px))]"
                title={dialogItem ? dialogItem.pick.title : "Preview"}
              >
                {dialogItem ? (
                  <div className="p-2">
                    <PickPreviewExpanded
                      pick={dialogItem.pick}
                      raw={dialogItem.raw}
                      detail={dialogDetail}
                    />
                  </div>
                ) : null}
              </AnimatedDialogContent>
            </Dialog>
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
  inCatalog,
  failureReason,
  onChange,
  onPreview,
  onOpenDialog,
}: {
  row: ResolvedHit;
  pick: { hit: TmdbHit; included: boolean } | null;
  /** True when the currently-displayed candidate's tmdb_id is already in
   *  the user's watchlist. Re-evaluated when the user switches candidates,
   *  so picking a different-year movie with the same title can flip this
   *  back to false. */
  inCatalog: boolean;
  /** Non-null when the previous commit reported a failure for this row's
   *  current pick. Surfaces a "failed" badge so the user can see exactly
   *  which rows didn't make it. */
  failureReason: string | null;
  /** Update both candidate selection and inclusion in one call. Passing
   *  null means "the row has no candidates" (only relevant for unmatched
   *  rows that started life as null and can't be recovered). */
  onChange: (next: { hit: TmdbHit; included: boolean } | null) => void;
  onPreview: (hit: TmdbHit | null) => void;
  onOpenDialog: (hit: TmdbHit | null) => void;
}) {
  const candidates = [row.best, ...row.alternatives].filter(
    (h): h is TmdbHit => Boolean(h),
  );
  // Display state: the candidate the user is looking at (the one in the
  // dropdown / thumbnail) is independent of whether the row is included.
  // Default to the first candidate so the row has something to show even
  // when the checkbox is unchecked.
  const hit = pick?.hit ?? candidates[0] ?? null;
  const included = pick?.included ?? false;

  return (
    <li
      className="flex items-center gap-3 px-2 py-3 transition-colors hover:bg-[var(--paper-3)]/30 focus-within:bg-[var(--paper-3)]/30"
      onMouseEnter={() => onPreview(hit)}
    >
      <input
        type="checkbox"
        checked={included}
        disabled={!hit}
        onChange={(e) =>
          onChange(hit ? { hit, included: e.target.checked } : null)
        }
        className="h-4 w-4 accent-[var(--accent)]"
        aria-label={`Include ${row.raw}`}
      />
      <button
        type="button"
        disabled={!hit}
        onClick={() => onOpenDialog(hit)}
        onFocus={() => onPreview(hit)}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-md py-1 text-left focus-visible:outline-none disabled:cursor-default",
          // Faded look when not included so the eye reads "this won't be
          // added" without the row disappearing.
          !included && hit && "opacity-55",
        )}
        aria-label={hit ? `Preview ${hit.title}` : undefined}
      >
        <span className="grid h-12 w-8 shrink-0 overflow-hidden rounded bg-[var(--paper-3)]">
          {hit && hit.poster_path ? (
            <img
              src={posterUrl(hit.poster_path, "w185") ?? ""}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="grid h-full place-items-center text-[9px] text-[var(--paper-faint)]">
              ·
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-[var(--ink)]">
            {row.raw}
          </span>
          <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider">
            <RowStatusBadge
              failureReason={failureReason}
              inCatalog={inCatalog}
              status={row.status}
              confidence={row.confidence}
            />
          </span>
        </span>
      </button>
      <CandidatePicker
        candidates={candidates}
        hit={hit}
        included={included}
        onChange={onChange}
      />
    </li>
  );
}

/** Right-side candidate area for a review row. Three shapes (none, one,
 *  many) with different affordances — kept as named branches so the
 *  intent of each shape (no UI noise on single-hit rows, dropdown only
 *  when there's a real choice) reads clearly. */
function CandidatePicker({
  candidates,
  hit,
  included,
  onChange,
}: {
  candidates: TmdbHit[];
  hit: TmdbHit | null;
  included: boolean;
  onChange: (next: { hit: TmdbHit; included: boolean } | null) => void;
}) {
  if (candidates.length > 1) {
    // Multiple TMDB hits — the user might want to switch (different
    // year, same title; movie vs series). The dropdown is purely for
    // candidate choice; the checkbox handles include/skip.
    return (
      <select
        value={hit?.id ?? ""}
        onChange={(e) => {
          const id = Number(e.target.value);
          const next = candidates.find((h) => h.id === id);
          if (next) onChange({ hit: next, included });
        }}
        className="max-w-[14rem] rounded-md border border-[var(--rule)] bg-[var(--paper)] px-2 py-1 text-[11.5px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
      >
        {candidates.map((h) => (
          <option key={h.id} value={h.id} className="bg-[var(--paper-2)]">
            {h.title}
            {h.release_date ? ` (${h.release_date.slice(0, 4)})` : ""} · {h.type}
          </option>
        ))}
      </select>
    );
  }
  if (candidates.length === 1 && hit) {
    // Single uncontested candidate — a dropdown with one option is
    // pure UI noise. Show the matched candidate as a static label so
    // the year / type info is still visible.
    return (
      <span className="max-w-[14rem] truncate font-mono text-[10.5px] text-[var(--paper-dim)]">
        {hit.title}
        {hit.release_date ? ` (${hit.release_date.slice(0, 4)})` : ""} · {hit.type}
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
      no candidates
    </span>
  );
}

function PickPreview({
  pick,
  raw,
  detail,
}: {
  pick: TmdbHit;
  raw: string;
  /** Full Title detail from /api/title/:type/:id, when loaded. Provides
   *  `genres` and `providers` that the search-level pick doesn't carry. */
  detail: Title | null;
}) {
  const poster = posterUrl(pick.poster_path, "w342");
  const year = pick.release_date ? pick.release_date.slice(0, 4) : "—";
  const rating =
    typeof pick.vote_average === "number" && pick.vote_average > 0
      ? pick.vote_average.toFixed(1)
      : null;
  const genres = detail?.genres ?? [];
  const providers = selectProviders(detail?.providers ?? null);

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
        <p className="mt-3 line-clamp-5 text-[12.5px] leading-snug text-[var(--paper-dim)]">
          {pick.overview || (
            <span className="italic text-[var(--paper-faint)]">
              No synopsis on file.
            </span>
          )}
        </p>

        {genres.length > 0 && (
          <div className="mt-3">
            <div className="font-label text-[9px] text-[var(--paper-faint)]">
              Genre
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-[var(--rule)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--paper-dim)]"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {providers.length > 0 && (
          <div className="mt-3">
            <div className="font-label text-[9px] text-[var(--paper-faint)]">
              Stream on
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {providers.map((p) => (
                <span
                  key={p.name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-1.5 py-0.5 text-[10.5px] text-[var(--paper-dim)]"
                  title={p.name}
                >
                  {p.logo ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w45${p.logo}`}
                      alt=""
                      className="h-4 w-4 rounded-[3px] object-cover"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  ) : (
                    <span className="grid h-4 w-4 place-items-center rounded-[3px] bg-[var(--paper-3)] font-mono text-[8px] text-[var(--paper-faint)]">
                      {p.name.slice(0, 1)}
                    </span>
                  )}
                  <span className="truncate">{p.name}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 border-t border-[var(--rule)] pt-3 font-mono text-[9px] uppercase tracking-wider text-[var(--paper-faint)]">
          picked for &ldquo;{raw}&rdquo;
        </div>
      </div>
    </div>
  );
}

function formatRuntime(mins: number | null): string | null {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Expanded variant of PickPreview shown in the tap-to-open dialog. The
 *  dialog has more surface than the sidebar, so it carries cast, runtime,
 *  and IMDb rating in a two-column poster + content layout. */
function PickPreviewExpanded({
  pick,
  raw,
  detail,
}: {
  pick: TmdbHit;
  raw: string;
  detail: Title | null;
}) {
  const poster = posterUrl(pick.poster_path, "w342");
  const year = pick.release_date ? pick.release_date.slice(0, 4) : "—";
  const tmdbRating =
    typeof pick.vote_average === "number" && pick.vote_average > 0
      ? pick.vote_average.toFixed(1)
      : null;
  const runtime = formatRuntime(detail?.runtime ?? null);
  const imdb = detail?.imdb_rating ? detail.imdb_rating.toFixed(1) : null;
  const originalTitle =
    detail?.original_title && detail.original_title !== pick.title
      ? detail.original_title
      : null;
  const genres = detail?.genres ?? [];
  const providers = selectProviders(detail?.providers ?? null);
  const cast = (detail?.cast ?? []).slice(0, 8);

  return (
    <div className="rounded-2xl border border-[var(--rule)] bg-[var(--paper)] p-5 shadow-[var(--shadow-card)]">
      <div className="grid gap-5 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div
          className="overflow-hidden rounded-md border border-[var(--rule)] bg-[var(--paper-3)]"
          style={{ aspectRatio: "2 / 3" }}
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

        <div className="min-w-0">
          <h3
            className="font-display-sm leading-tight text-[var(--ink)]"
            style={{ fontVariationSettings: '"opsz" 32, "wght" 700, "SOFT" 30' }}
          >
            {pick.title}
          </h3>
          {originalTitle && (
            <div className="mt-1 truncate font-mono text-[10.5px] italic text-[var(--paper-faint)]">
              {originalTitle}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-dim)]">
            <span>{year}</span>
            <span aria-hidden>·</span>
            <span>{pick.type}</span>
            {runtime && (
              <>
                <span aria-hidden>·</span>
                <span>{runtime}</span>
              </>
            )}
            {tmdbRating && (
              <>
                <span aria-hidden>·</span>
                <span>★ {tmdbRating} tmdb</span>
              </>
            )}
            {imdb && (
              <>
                <span aria-hidden>·</span>
                <span>★ {imdb} imdb</span>
              </>
            )}
          </div>

          <p className="mt-3 line-clamp-6 text-[13px] leading-snug text-[var(--paper-dim)]">
            {pick.overview || (
              <span className="italic text-[var(--paper-faint)]">
                No synopsis on file.
              </span>
            )}
          </p>

          {genres.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-[var(--rule)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--paper-dim)]"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {cast.length > 0 && (
        <div className="mt-5 border-t border-[var(--rule)] pt-4">
          <div className="font-label text-[9px] text-[var(--paper-faint)]">
            Cast
          </div>
          <ul className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {cast.map((c) => (
              <li
                key={`${c.name}:${c.character ?? ""}`}
                className="min-w-0 text-[12px] leading-tight"
              >
                <span className="block truncate text-[var(--ink)]">
                  {c.name}
                </span>
                {c.character && (
                  <span className="block truncate font-mono text-[9.5px] uppercase tracking-wider text-[var(--paper-faint)]">
                    as {c.character}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {providers.length > 0 && (
        <div className="mt-4 border-t border-[var(--rule)] pt-4">
          <div className="font-label text-[9px] text-[var(--paper-faint)]">
            Stream on
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {providers.map((p) => (
              <span
                key={p.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-1.5 py-0.5 text-[10.5px] text-[var(--paper-dim)]"
                title={p.name}
              >
                {p.logo ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w45${p.logo}`}
                    alt=""
                    className="h-4 w-4 rounded-[3px] object-cover"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                ) : (
                  <span className="grid h-4 w-4 place-items-center rounded-[3px] bg-[var(--paper-3)] font-mono text-[8px] text-[var(--paper-faint)]">
                    {p.name.slice(0, 1)}
                  </span>
                )}
                <span className="truncate">{p.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-[var(--rule)] pt-3 font-mono text-[9px] uppercase tracking-wider text-[var(--paper-faint)]">
        picked for &ldquo;{raw}&rdquo;
      </div>
    </div>
  );
}

/** Status badge under each review row. Priority ladder, top-to-bottom:
 *  failure (server rejected on last commit) → already-in-catalog → resolver
 *  status (matched / ambiguous / unmatched). Kept as a switch so the order
 *  is explicit instead of buried in a nested ternary. */
function RowStatusBadge({
  failureReason,
  inCatalog,
  status,
  confidence,
}: {
  failureReason: string | null;
  inCatalog: boolean;
  status: ResolvedHit["status"];
  confidence: number;
}) {
  if (failureReason) {
    return (
      <span
        className="text-[var(--accent)]"
        title={`Last commit failed: ${failureReason}`}
      >
        failed · {failureReason}
      </span>
    );
  }
  if (inCatalog) {
    return <span className="text-[var(--paper-dim)]">in your catalog</span>;
  }
  switch (status) {
    case "matched":
      return (
        <span className="text-[var(--accent)]">
          matched · {Math.round(confidence * 100)}%
        </span>
      );
    case "ambiguous":
      return (
        <span className="text-[var(--paper-dim)]">
          ambiguous · {Math.round(confidence * 100)}%
        </span>
      );
    case "unmatched":
      return <span className="text-[var(--paper-faint)]">no match</span>;
  }
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
