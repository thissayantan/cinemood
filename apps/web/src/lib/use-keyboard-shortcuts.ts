import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface Handlers {
  onOpenPalette?: () => void;
  onOpenShortcuts?: () => void;
  onFocusFilterSearch?: () => void;
}

/** Window (ms) within which a "g" press is considered the start of a
 *  two-key navigation sequence. */
const G_SEQUENCE_WINDOW_MS = 1500;

/** Routes reachable via the "g x" two-key sequence. */
const G_ROUTES: Record<string, string> = {
  h: "/",
  i: "/import",
  s: "/settings/search",
};

function isTypingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/** Global app-level shortcuts. Card-scoped shortcuts (W, Del, arrows) live
 *  on the card components themselves. */
export function useKeyboardShortcuts({
  onOpenPalette,
  onOpenShortcuts,
  onFocusFilterSearch,
}: Handlers) {
  const nav = useNavigate();
  const lastG = useRef<number>(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      // Mod+K opens the palette regardless of focus.
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenPalette?.();
        return;
      }
      if (isTypingContext(e.target)) return;

      // Two-key "G x" sequences for nav.
      const now = Date.now();
      if (e.key === "g" || e.key === "G") {
        lastG.current = now;
        return;
      }
      if (now - lastG.current < G_SEQUENCE_WINDOW_MS) {
        const route = G_ROUTES[e.key.toLowerCase()];
        if (route) {
          e.preventDefault();
          lastG.current = 0;
          nav(route);
          return;
        }
      }

      if (e.key === "?") {
        e.preventDefault();
        onOpenShortcuts?.();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        onFocusFilterSearch?.();
        return;
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [nav, onOpenPalette, onOpenShortcuts, onFocusFilterSearch]);
}
