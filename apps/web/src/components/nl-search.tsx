import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ParsedQuery, WatchlistItem, ApiResponse } from "@cinemood/shared";
import { api } from "@/lib/api";
import { GlassCard } from "./glass-card";
import { posterUrl } from "@/lib/tmdb";

interface NlSearchResponse {
  parsed: ParsedQuery;
  results: WatchlistItem[];
}

const SPRING = { type: "spring" as const, stiffness: 240, damping: 24 };

export function NlSearch() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NlSearchResponse | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    const res = (await api<NlSearchResponse>("/api/search", {
      method: "POST",
      body: JSON.stringify({ query: q }),
    })) as ApiResponse<NlSearchResponse>;
    setLoading(false);
    if (res.ok) setData(res.data);
    else {
      setError(res.error.message);
      setData(null);
    }
  }

  function clear() {
    setQ("");
    setData(null);
    setError(null);
  }

  return (
    <div>
      <form onSubmit={run} className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Ask in plain English — "dark thrillers with Jeremy Strong", "feel-good 90s comedies"…'
          className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 pr-28 text-base text-white placeholder:text-white/35 outline-none backdrop-blur-xl transition focus:border-white/30 focus:bg-white/10"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-2">
          {data && (
            <button
              type="button"
              onClick={clear}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !q.trim()}
            className="rounded-full border border-white/25 bg-white/15 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            {loading ? "Thinking…" : "Search"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-3 rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <AnimatePresence>
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={SPRING}
            className="mt-6 space-y-5"
          >
            <ParsedChips parsed={data.parsed} />
            {data.results.length === 0 ? (
              <GlassCard className="p-6 text-center text-sm text-white/70">
                No matches in your watchlist for that query.
              </GlassCard>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {data.results.map((it, i) => (
                  <motion.div
                    key={it.title.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING, delay: Math.min(i * 0.03, 0.4) }}
                  >
                    <ResultCard item={it} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ParsedChips({ parsed }: { parsed: ParsedQuery }) {
  const f = parsed.filters;
  const chips: { key: string; label: string }[] = [];
  if (f.type) chips.push(...f.type.map((t) => ({ key: `t-${t}`, label: t })));
  if (f.genres) chips.push(...f.genres.map((g) => ({ key: `g-${g}`, label: g })));
  if (f.exclude_genres)
    chips.push(...f.exclude_genres.map((g) => ({ key: `xg-${g}`, label: `not ${g}` })));
  if (typeof f.min_rating === "number")
    chips.push({ key: "min", label: `≥ ${f.min_rating}★` });
  if (typeof f.max_rating === "number")
    chips.push({ key: "max", label: `≤ ${f.max_rating}★` });
  if (f.release_after) chips.push({ key: "ra", label: `after ${f.release_after.slice(0, 4)}` });
  if (f.release_before) chips.push({ key: "rb", label: `before ${f.release_before.slice(0, 4)}` });
  if (f.cast) chips.push(...f.cast.map((c) => ({ key: `c-${c}`, label: c })));
  if (f.providers) chips.push(...f.providers.map((p) => ({ key: `p-${p}`, label: p })));
  if (f.keywords) chips.push(...f.keywords.map((k) => ({ key: `k-${k}`, label: k })));

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-white/45">Parsed:</span>
      {chips.length === 0 && (
        <span className="text-white/45">no filters extracted</span>
      )}
      {chips.map((c) => (
        <span
          key={c.key}
          className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-white/80"
        >
          {c.label}
        </span>
      ))}
      {parsed.semantic_query && (
        <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-2.5 py-1 text-violet-100">
          vibe: {parsed.semantic_query}
        </span>
      )}
    </div>
  );
}

function ResultCard({ item }: { item: WatchlistItem }) {
  const t = item.title;
  const src = posterUrl(t.poster_path, "w342");
  const year = t.release_date ? t.release_date.slice(0, 4) : null;
  return (
    <GlassCard className="overflow-hidden">
      <div className="relative aspect-[2/3] w-full bg-black/30">
        {src ? (
          <img src={src} alt={t.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-white/40">No poster</div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/85 backdrop-blur">
          {t.type === "series" ? "Series" : "Movie"}
        </span>
        {item.status === "watched" && (
          <span className="absolute right-2 top-2 rounded-full bg-emerald-400/85 px-2 py-0.5 text-[10px] font-semibold text-black">
            Watched
          </span>
        )}
      </div>
      <div className="px-3 py-2.5">
        <div className="line-clamp-2 text-sm font-medium text-white/90">{t.title}</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-white/45">
          {year && <span>{year}</span>}
          {t.genres[0] && <span className="truncate">· {t.genres[0]}</span>}
        </div>
      </div>
    </GlassCard>
  );
}
