import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApiResponse,
  WatchlistFilters,
  WatchlistItem,
  WatchlistSort,
} from "@cinemood/shared";
import { api } from "./api";

function buildQuery(filters: WatchlistFilters): string {
  const p = new URLSearchParams();
  if (filters.status) p.set("status", filters.status);
  if (filters.type) p.set("type", filters.type);
  if (filters.genre) p.set("genre", filters.genre);
  if (typeof filters.year_min === "number")
    p.set("year_min", String(filters.year_min));
  if (typeof filters.year_max === "number")
    p.set("year_max", String(filters.year_max));
  if (typeof filters.min_rating === "number")
    p.set("min_rating", String(filters.min_rating));
  if (typeof filters.runtime_min === "number")
    p.set("runtime_min", String(filters.runtime_min));
  if (typeof filters.runtime_max === "number")
    p.set("runtime_max", String(filters.runtime_max));
  if (filters.providers && filters.providers.length > 0) {
    for (const pr of filters.providers) p.append("provider", pr);
  }
  if (filters.sort) p.set("sort", filters.sort);
  return p.toString();
}

export const SORT_LABELS: Record<WatchlistSort, string> = {
  added_desc: "Recently added",
  added_asc: "Earliest added",
  title_asc: "Title A–Z",
  year_desc: "Year (newest)",
  year_asc: "Year (oldest)",
  rating_desc: "Rating (highest)",
  catalog_desc: "Spine number",
};

export interface WatchlistView {
  /** All items currently loaded for the user (used to derive facets). */
  all: WatchlistItem[] | null;
  /** Items after server-side filtering. Same as `all` when no filters set. */
  visible: WatchlistItem[] | null;
  filters: WatchlistFilters;
  setFilters: (next: WatchlistFilters) => void;
  patchFilter: <K extends keyof WatchlistFilters>(
    key: K,
    value: WatchlistFilters[K],
  ) => void;
  resetFilters: () => void;
  reload: () => Promise<void>;
  loading: boolean;
  error: string | null;
}

const DEFAULT_FILTERS: WatchlistFilters = { sort: "added_desc" };

export function useWatchlist(reloadKey = 0): WatchlistView {
  const [all, setAll] = useState<WatchlistItem[] | null>(null);
  const [visible, setVisible] = useState<WatchlistItem[] | null>(null);
  const [filters, setFiltersState] = useState<WatchlistFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load the unfiltered set once per `reloadKey` change (for facets).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const res = (await api<WatchlistItem[]>("/api/watchlist")) as
        | ApiResponse<WatchlistItem[]>;
      if (cancelled) return;
      if (res.ok) {
        setAll(res.data);
      } else {
        setAll([]);
        setError(res.error.message);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Reload `visible` whenever filters change (server-side).
  const fetchVisible = useCallback(async (f: WatchlistFilters) => {
    setLoading(true);
    setError(null);
    const q = buildQuery(f);
    const path = q ? `/api/watchlist?${q}` : `/api/watchlist`;
    const res = (await api<WatchlistItem[]>(path)) as ApiResponse<WatchlistItem[]>;
    if (res.ok) setVisible(res.data);
    else {
      setVisible([]);
      setError(res.error.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const isDefault =
      Object.keys(filters).length === 1 && filters.sort === "added_desc";
    if (isDefault && all) {
      setVisible(all);
      setLoading(false);
      return;
    }
    void fetchVisible(filters);
  }, [filters, all, fetchVisible]);

  const setFilters = useCallback((next: WatchlistFilters) => {
    setFiltersState(next);
  }, []);

  const patchFilter = useCallback(
    <K extends keyof WatchlistFilters>(key: K, value: WatchlistFilters[K]) => {
      setFiltersState((prev) => {
        const next = { ...prev };
        if (value === undefined || value === null) delete next[key];
        else next[key] = value;
        return next;
      });
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const reload = useCallback(async () => {
    await fetchVisible(filters);
  }, [fetchVisible, filters]);

  return useMemo(
    () => ({ all, visible, filters, setFilters, patchFilter, resetFilters, reload, loading, error }),
    [all, visible, filters, setFilters, patchFilter, resetFilters, reload, loading, error],
  );
}

/** Derive available facets (genres, years, providers) from the unfiltered set. */
export function deriveFacets(items: WatchlistItem[] | null) {
  if (!items) return { genres: [] as string[], years: [] as number[], providers: [] as string[] };
  const g = new Set<string>();
  const y = new Set<number>();
  const p = new Set<string>();
  for (const it of items) {
    for (const gen of it.title.genres) g.add(gen);
    if (it.title.release_date) {
      const yr = Number(it.title.release_date.slice(0, 4));
      if (Number.isFinite(yr) && yr > 1880) y.add(yr);
    }
    const providers = it.title.providers as Record<string, unknown> | null;
    if (providers) {
      for (const region of Object.values(providers)) {
        if (!region || typeof region !== "object") continue;
        for (const bucket of Object.values(region as Record<string, unknown>)) {
          if (!Array.isArray(bucket)) continue;
          for (const entry of bucket) {
            if (entry && typeof entry === "object" && "provider_name" in entry) {
              const name = (entry as { provider_name?: string }).provider_name;
              if (typeof name === "string" && name) p.add(name);
            }
          }
        }
      }
    }
  }
  return {
    genres: [...g].sort(),
    years: [...y].sort((a, b) => b - a),
    providers: [...p].sort(),
  };
}
