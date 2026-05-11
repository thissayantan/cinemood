import { useEffect } from "react";

const BASE = "Cinemood — your watchlist, by mood";

interface Props {
  /** Page-specific prefix. If omitted, the base title is used as-is. */
  title?: string;
}

export function RouteTitle({ title }: Props) {
  useEffect(() => {
    document.title = title ? `${title} · Cinemood` : BASE;
    return () => {
      document.title = BASE;
    };
  }, [title]);
  return null;
}
