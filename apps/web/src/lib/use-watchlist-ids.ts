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

  const add = useCallback((id: number) => {
    setIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return { ids, add, remove, reload };
}
