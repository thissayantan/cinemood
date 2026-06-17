import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ApiResponse,
  WatchlistFilters,
  WatchlistItem,
  WatchlistSort,
} from "@cinemood/shared";
import { api } from "./api";

function buildQuery(filters: WatchlistFilters): string {
  const params = new URLSearchParams();
  const setStr = (key: string, value: string | undefined) => {
    if (value) params.set(key, value);
  };
  const setNum = (key: string, value: number | undefined) => {
    if (typeof value === "number") params.set(key, String(value));
  };

  setStr("status", filters.status);
  setStr("type", filters.type);
  setStr("genre", filters.genre);
  setNum("year_min", filters.year_min);
  setNum("year_max", filters.year_max);
  setNum("min_rating", filters.min_rating);
  setNum("runtime_min", filters.runtime_min);
  setNum("runtime_max", filters.runtime_max);
  if (filters.providers && filters.providers.length > 0) {
    for (const provider of filters.providers) params.append("provider", provider);
  }
  setStr("sort", filters.sort);
  return params.toString();
}

export const SORT_LABELS: Record<WatchlistSort, string> = {
  added_desc: "Recently added",
  added_asc: "Earliest added",
  title_asc: "Title A–Z",
  year_desc: "Year (newest)",
  year_asc: "Year (oldest)",
  rating_desc: "Rating (highest)",
  catalog_desc: "Spine number",
  started_desc: "Started watching",
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
  if (!items) {
    return { genres: [] as string[], years: [] as number[], providers: [] as string[] };
  }
  const genres = new Set<string>();
  const years = new Set<number>();
  const providers = new Set<string>();
  for (const item of items) {
    for (const genre of item.title.genres) genres.add(genre);
    if (item.title.release_date) {
      const yr = Number(item.title.release_date.slice(0, 4));
      if (Number.isFinite(yr) && yr > 1880) years.add(yr);
    }
    collectProviderNames(item.title.providers as Record<string, unknown> | null, providers);
  }
  return {
    genres: [...genres].sort(),
    years: [...years].sort((a, b) => b - a),
    providers: [...providers].sort(),
  };
}

/** Walk the TMDB providers shape (region → bucket → entries) and collect
 *  every `provider_name` into `out`. Used for the providers facet. */
function collectProviderNames(
  providers: Record<string, unknown> | null,
  out: Set<string>,
): void {
  if (!providers) return;
  for (const region of Object.values(providers)) {
    if (!region || typeof region !== "object") continue;
    for (const bucket of Object.values(region as Record<string, unknown>)) {
      if (!Array.isArray(bucket)) continue;
      for (const entry of bucket) {
        if (!entry || typeof entry !== "object" || !("provider_name" in entry)) continue;
        const name = (entry as { provider_name?: string }).provider_name;
        if (typeof name === "string" && name) out.add(name);
      }
    }
  }
}
