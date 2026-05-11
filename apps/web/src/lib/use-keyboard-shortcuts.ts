import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface Handlers {
  onOpenPalette?: () => void;
  onOpenShortcuts?: () => void;
  onFocusFilterSearch?: () => void;
}

function isTypingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
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
      if (now - lastG.current < 1500) {
        if (e.key.toLowerCase() === "h") {
          e.preventDefault();
          lastG.current = 0;
          nav("/");
          return;
        }
        if (e.key.toLowerCase() === "i") {
          e.preventDefault();
          lastG.current = 0;
          nav("/import");
          return;
        }
        if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          lastG.current = 0;
          nav("/settings/search");
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
