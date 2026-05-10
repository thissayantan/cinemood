import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WatchlistItem, WatchStatus } from "@cinemood/shared";
import { api } from "@/lib/api";
import { posterUrl } from "@/lib/tmdb";
import { FilterChips } from "./filter-chips";
import { GlassCard } from "./glass-card";

type StatusFilter = WatchStatus | "all";
type TypeFilter = "movie" | "series" | "all";

const SPRING = { type: "spring" as const, stiffness: 240, damping: 24 };

interface Props {
  reloadKey: number;
  onRemoved: (id: number) => void;
}

export function WatchlistGrid({ reloadKey, onRemoved }: Props) {
  const [items, setItems] = useState<WatchlistItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [genre, setGenre] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (type !== "all") params.set("type", type);
      if (genre) params.set("genre", genre);
      if (year) params.set("year", year);
      const path =
        params.toString().length > 0
          ? `/api/watchlist?${params.toString()}`
          : `/api/watchlist`;
      const res = await api<WatchlistItem[]>(path);
      if (cancelled) return;
      if (res.ok) setItems(res.data);
      else {
        setItems([]);
        setError(res.error.message);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, status, type, genre, year]);

  const total = items?.length ?? 0;
  const { genres, years } = useMemo(() => {
    if (!items) return { genres: [] as string[], years: [] as string[] };
    const g = new Set<string>();
    const y = new Set<string>();
    for (const it of items) {
      for (const gen of it.title.genres ?? []) g.add(gen);
      if (it.title.release_date) y.add(it.title.release_date.slice(0, 4));
    }
    return {
      genres: [...g].sort(),
      years: [...y].sort((a, b) => Number(b) - Number(a)).slice(0, 12),
    };
  }, [items]);

  async function toggleStatus(item: WatchlistItem) {
    if (busy) return;
    const next = item.status === "watched" ? "pending" : "watched";
    setBusy(item.title.id);
    const res = await api<WatchlistItem>(`/api/watchlist/${item.title.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: next }),
    });
    setBusy(null);
    if (res.ok && items) {
      setItems(items.map((it) => (it.title.id === item.title.id ? res.data : it)));
    }
  }

  async function remove(item: WatchlistItem) {
    if (busy) return;
    setBusy(item.title.id);
    const res = await api(`/api/watchlist/${item.title.id}`, {
      method: "DELETE",
    });
    setBusy(null);
    if (res.ok && items) {
      setItems(items.filter((it) => it.title.id !== item.title.id));
      onRemoved(item.title.id);
    }
  }

  return (
    <section>
      <div className="mb-5">
        <FilterChips
          status={status}
          onStatus={setStatus}
          type={type}
          onType={setType}
          genres={genres}
          selectedGenre={genre}
          onGenre={setGenre}
          years={years}
          selectedYear={year}
          onYear={setYear}
          total={total}
        />
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      {loading && !items ? (
        <SkeletonGrid />
      ) : !items || items.length === 0 ? (
        <EmptyState filtered={status !== "all" || type !== "all" || !!genre || !!year} />
      ) : (
        <motion.div
          layout
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          <AnimatePresence mode="popLayout">
            {items.map((it, i) => (
              <motion.div
                key={it.title.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ ...SPRING, delay: Math.min(i * 0.03, 0.4) }}
              >
                <Card
                  item={it}
                  open={openId === it.title.id}
                  onOpen={() => setOpenId(openId === it.title.id ? null : it.title.id)}
                  onToggle={() => toggleStatus(it)}
                  onRemove={() => remove(it)}
                  busy={busy === it.title.id}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </section>
  );
}

function Card({
  item,
  open,
  onOpen,
  onToggle,
  onRemove,
  busy,
}: {
  item: WatchlistItem;
  open: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const t = item.title;
  const src = posterUrl(t.poster_path, "w342");
  const year = t.release_date ? t.release_date.slice(0, 4) : null;

  return (
    <GlassCard className="relative overflow-visible">
      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        onClick={onOpen}
        className="group block w-full overflow-hidden rounded-2xl text-left"
      >
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
          {typeof t.vote_average === "number" && t.vote_average > 0 && (
            <span className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white/90 backdrop-blur">
              ★ {t.vote_average.toFixed(1)}
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
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-0 bottom-0 z-10 translate-y-full pt-2"
          >
            <GlassCard className="p-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onToggle}
                  className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-50"
                >
                  {item.status === "watched" ? "Unmark" : "Watched"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onRemove}
                  className="rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <GlassCard className="p-10 text-center">
      <p className="text-sm text-white/65">
        {filtered
          ? "No matches with these filters."
          : "Your watchlist is empty. Search above to add something."}
      </p>
    </GlassCard>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[2/3] animate-pulse rounded-2xl border border-white/10 bg-white/5"
        />
      ))}
    </div>
  );
}
