import { useEffect, useState } from "react";

/** Returns true on devices with a real hover pointer (mouse / trackpad),
 *  false on touch-only devices.
 *
 *  Used to suppress hover-only overlays (e.g. poster card synopsis) on
 *  touch — otherwise a tap that opens the detail dialog would *also*
 *  briefly flash the hover state because tap → focus → onFocus fires.
 *
 *  Hover state is queried via `@media (hover: hover)` which is the
 *  reliable CSS-level signal for "pointer can hover without clicking". */
export function useHasHover(): boolean {
  const [hasHover, setHasHover] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(hover: hover)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: hover)");
    function handle(event: MediaQueryListEvent) {
      setHasHover(event.matches);
    }
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);
  return hasHover;
}
