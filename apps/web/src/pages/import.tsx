import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { ApiResponse, User } from "@cinemood/shared";
import { api } from "@/lib/api";
import { posterUrl } from "@/lib/tmdb";
import {
  parseCsvImport,
  parseTakeoutJson,
  parseTextarea,
  type ImportCandidate,
  type TitleType,
} from "@/lib/import-parsers";
import { PageShell } from "@/components/page-shell";
import { GlassCard } from "@/components/glass-card";
import { AvatarMenu } from "@/components/avatar-menu";

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

const SPRING = { type: "spring" as const, stiffness: 240, damping: 24 };

export default function ImportPage({ user }: { user: User }) {
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

  function reset() {
    setText("");
    setCandidates([]);
    setResolved(null);
    setPicks({});
    setError(null);
    setParseInfo(null);
  }

  function handlePasteParse() {
    const items = parseTextarea(text);
    setCandidates(items);
    setParseInfo(`${items.length} line(s) detected`);
  }

  async function handleFile(file: File, kind: "csv" | "takeout") {
    const body = await file.text();
    if (kind === "csv") {
      const { candidates: items, detected } = parseCsvImport(body);
      setCandidates(items);
      setParseInfo(
        `${items.length} row(s), detected format: ${detected}`,
      );
    } else {
      const items = parseTakeoutJson(body);
      setCandidates(items);
      setParseInfo(`${items.length} item(s) found in JSON`);
    }
  }

  async function runResolve() {
    if (candidates.length === 0) return;
    setLoading(true);
    setError(null);
    const res = (await api<{ resolved: ResolvedHit[] }>("/api/import/resolve", {
      method: "POST",
      body: JSON.stringify({ items: candidates }),
    })) as ApiResponse<{ resolved: ResolvedHit[] }>;
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setResolved(res.data.resolved);
    const initialPicks: Record<string, TmdbHit | null> = {};
    for (const r of res.data.resolved) {
      initialPicks[r.raw] = r.status === "unmatched" ? null : r.best ?? null;
    }
    setPicks(initialPicks);
  }

  async function commit() {
    if (!resolved) return;
    const items: { tmdb_id: number; type: TitleType }[] = [];
    for (const r of resolved) {
      const pick = picks[r.raw];
      if (pick) items.push({ tmdb_id: pick.id, type: pick.type });
    }
    if (items.length === 0) return;
    setCommitting(true);
    const res = (await api<{
      outcomes: { tmdb_id: number; ok: boolean }[];
    }>("/api/import/commit", {
      method: "POST",
      body: JSON.stringify({ items }),
    })) as ApiResponse<{ outcomes: { tmdb_id: number; ok: boolean }[] }>;
    setCommitting(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    nav("/?imported=" + res.data.outcomes.filter((o) => o.ok).length);
  }

  const selectedCount = Object.values(picks).filter(Boolean).length;

  return (
    <PageShell>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          to="/"
          className="bg-gradient-to-br from-fuchsia-200 via-violet-200 to-cyan-200 bg-clip-text text-xl font-bold tracking-tight text-transparent"
        >
          Cinemood
        </Link>
        <AvatarMenu user={user} />
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="space-y-2"
        >
          <Link
            to="/"
            className="text-xs text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
          >
            ← Back to watchlist
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Import</h1>
          <p className="text-sm text-white/65">
            Paste a list, upload a Letterboxd/Trakt/IMDb CSV, or drop in a
            Google Takeout JSON. Each item is resolved against TMDB and shown
            for review before anything is added.
          </p>
        </motion.div>

        {!resolved && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.04 }}
          >
            <GlassCard className="mt-8 p-6">
              <div className="mb-5 flex flex-wrap gap-2">
                {(["paste", "csv", "takeout"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      reset();
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${
                      mode === m
                        ? "border-white/40 bg-white/15 text-white"
                        : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
                    }`}
                  >
                    {m === "paste"
                      ? "Paste list"
                      : m === "csv"
                        ? "Upload CSV"
                        : "Google Takeout"}
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
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/30"
                  />
                  <button
                    type="button"
                    onClick={handlePasteParse}
                    disabled={!text.trim()}
                    className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/85 transition hover:bg-white/10 disabled:opacity-50"
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
                <p className="mt-4 text-xs text-white/55">{parseInfo}</p>
              )}

              {candidates.length > 0 && (
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
                  <span className="text-sm text-white/65">
                    Ready to resolve {candidates.length} title
                    {candidates.length === 1 ? "" : "s"} against TMDB.
                  </span>
                  <button
                    type="button"
                    onClick={runResolve}
                    disabled={loading}
                    className="rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
                  >
                    {loading ? "Resolving…" : "Resolve"}
                  </button>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}

        {resolved && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.04 }}
          >
            <GlassCard className="mt-8 p-4">
              <div className="mb-3 flex items-center justify-between px-2">
                <h2 className="text-sm font-medium text-white/85">
                  Review &amp; pick — {selectedCount} of {resolved.length}{" "}
                  selected
                </h2>
                <button
                  type="button"
                  onClick={reset}
                  className="text-xs text-white/55 hover:text-white"
                >
                  Start over
                </button>
              </div>
              <ul className="divide-y divide-white/10">
                {resolved.map((r) => (
                  <ResolvedRow
                    key={r.raw}
                    row={r}
                    pick={picks[r.raw] ?? null}
                    onPick={(hit) =>
                      setPicks((prev) => ({ ...prev, [r.raw]: hit }))
                    }
                  />
                ))}
              </ul>
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-5">
                <span className="text-xs text-white/55">
                  Skipped items can be re-tried by editing the input.
                </span>
                <button
                  type="button"
                  onClick={commit}
                  disabled={committing || selectedCount === 0}
                  className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-4 py-2 text-sm font-medium text-emerald-50 transition hover:bg-emerald-400/25 disabled:opacity-50"
                >
                  {committing
                    ? "Adding…"
                    : `Add ${selectedCount} to watchlist`}
                </button>
              </div>
              {error && (
                <div className="mt-4 rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </div>
              )}
            </GlassCard>
          </motion.div>
        )}
      </main>
    </PageShell>
  );
}

function ResolvedRow({
  row,
  pick,
  onPick,
}: {
  row: ResolvedHit;
  pick: TmdbHit | null;
  onPick: (hit: TmdbHit | null) => void;
}) {
  const candidates = [row.best, ...row.alternatives].filter(
    (h): h is TmdbHit => Boolean(h),
  );

  return (
    <li className="flex items-center gap-3 px-2 py-3">
      <input
        type="checkbox"
        checked={Boolean(pick)}
        onChange={(e) =>
          onPick(e.target.checked ? candidates[0] ?? null : null)
        }
        className="h-4 w-4 accent-violet-400"
      />
      <div className="grid h-12 w-8 shrink-0 overflow-hidden rounded bg-white/5">
        {pick && pick.poster_path ? (
          <img
            src={posterUrl(pick.poster_path, "w185") ?? ""}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-[9px] text-white/40">
            ·
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-white/90">{row.raw}</div>
        <div className="mt-0.5 text-xs text-white/45">
          {row.status === "matched" && (
            <span className="text-emerald-200/85">
              matched ({Math.round(row.confidence * 100)}%)
            </span>
          )}
          {row.status === "ambiguous" && (
            <span className="text-amber-200/85">
              ambiguous ({Math.round(row.confidence * 100)}%)
            </span>
          )}
          {row.status === "unmatched" && (
            <span className="text-red-200/85">no match</span>
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
          className="max-w-[16rem] rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-white/30"
        >
          <option value="" className="bg-[#15151c]">
            — skip —
          </option>
          {candidates.map((h) => (
            <option key={h.id} value={h.id} className="bg-[#15151c]">
              {h.title}
              {h.release_date ? ` (${h.release_date.slice(0, 4)})` : ""} ·{" "}
              {h.type}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-xs text-white/40">no candidates</span>
      )}
    </li>
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
      <span className="text-xs uppercase tracking-wider text-white/55">
        {label}
      </span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
        className="block rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 file:mr-3 file:rounded-md file:border-0 file:bg-white/15 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-white/20"
      />
    </label>
  );
}
