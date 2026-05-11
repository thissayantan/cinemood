import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useWatchlistIds(): {
  ids: Set<number>;
  add: (id: number) => void;
  remove: (id: number) => void;
  reload: () => Promise<void>;
} {
  const [ids, setIds] = useState<Set<number>>(new Set());

  const reload = useCallback(async () => {
    const res = await api<number[]>("/api/watchlist/ids");
    if (res.ok) setIds(new Set(res.data));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Optimistic mutation: clone the Set so React sees a new reference and
  // re-renders consumers immediately, without waiting for a server reload.
  const updateIds = useCallback(
    (mutate: (next: Set<number>) => void) => {
      setIds((prev) => {
        const next = new Set(prev);
        mutate(next);
        return next;
      });
    },
    [],
  );

  const add = useCallback(
    (id: number) => updateIds((s) => void s.add(id)),
    [updateIds],
  );
  const remove = useCallback(
    (id: number) => updateIds((s) => void s.delete(id)),
    [updateIds],
  );

  return { ids, add, remove, reload };
}
