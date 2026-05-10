import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ApiResponse } from "@cinemood/shared";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounce";
import { PosterCard } from "./poster-card";

interface TmdbHit {
  id: number;
  type: "movie" | "series";
  title: string;
  release_date: string | null;
  poster_path: string | null;
  overview: string | null;
  vote_average: number | null;
}

interface Props {
  savedIds: Set<number>;
  onAdded: (id: number) => void;
}

export function SearchBar({ savedIds, onAdded }: Props) {
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350);
  const [results, setResults] = useState<TmdbHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!debounced.trim()) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      const res = (await api<TmdbHit[]>(
        `/api/search/tmdb?q=${encodeURIComponent(debounced)}`,
      )) as ApiResponse<TmdbHit[]>;
      if (cancelled) return;
      if (res.ok) {
        setResults(res.data);
      } else {
        setError(res.error.message);
        setResults([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  async function add(hit: TmdbHit) {
    if (adding) return;
    setAdding(hit.id);
    const res = await api(`/api/watchlist`, {
      method: "POST",
      body: JSON.stringify({ tmdb_id: hit.id, type: hit.type }),
    });
    setAdding(null);
    if (res.ok) onAdded(hit.id);
  }

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search movies and series…"
          className="w-full rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-base text-white placeholder:text-white/35 outline-none backdrop-blur-xl transition focus:border-white/30 focus:bg-white/10"
        />
        {loading && (
          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs text-white/40">
            Searching…
          </span>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          >
            {results.map((r, i) => (
              <motion.div
                key={`${r.type}-${r.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 240,
                  damping: 24,
                  delay: i * 0.04,
                }}
              >
                <PosterCard
                  title={r.title}
                  year={r.release_date ? r.release_date.slice(0, 4) : null}
                  posterPath={r.poster_path}
                  badge={r.type === "series" ? "Series" : "Movie"}
                  rating={r.vote_average}
                  added={savedIds.has(r.id)}
                  disabled={savedIds.has(r.id) || adding === r.id}
                  onClick={() => add(r)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
