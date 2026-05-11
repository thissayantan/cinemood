import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import filmReel from "@/lottie/film-reel.json";
import { LottieLoop } from "./lottie-loop";
import { useMotionConfig } from "@/lib/motion";

const FLAG = "cm_welcome_seen";

// Source: in-repo placeholder lottie (apps/web/src/lottie/film-reel.json).
// Swap with a "curtain opening" or "marquee lights" Lottie from
// https://lottiefiles.com/ (Free + Commercial use, ≤80KB compressed)
// when one is chosen; document the URL here.

interface Props {
  /** User's display name (or null) — used in the greeting. */
  name: string | null;
}

/** Plays once per user. Persistence flag stored in localStorage. */
export function WelcomeOverlay({ name }: Props) {
  const m = useMotionConfig();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(FLAG);
      if (!seen) setOpen(true);
    } catch {
      /* private mode etc — silently skip */
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(FLAG, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  // Auto-dismiss after 6s so it never blocks the user.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(dismiss, 6000);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={
            m.reduced
              ? { duration: 0 }
              : { duration: m.durSlow, ease: m.easeOutQuint }
          }
          className="fixed inset-0 z-[60] grid place-items-center bg-[var(--paper)]/96"
          onClick={dismiss}
          aria-modal="true"
          role="dialog"
        >
          <motion.div
            initial={m.reduced ? false : { opacity: 0, y: m.fadeY }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -m.fadeY }}
            transition={m.reduced ? { duration: 0 } : m.springEntry}
            className="flex flex-col items-center px-8 text-center"
          >
            <LottieLoop source={filmReel} loop={false} size={180} speed={0.7} />
            <p className="mt-4 font-label text-[10px] text-[var(--paper-faint)]">
              Welcome to the projection room
            </p>
            <h1
              className="mt-3 font-display text-[44px] leading-[1.02] text-[var(--ink)] md:text-[64px]"
              style={{ fontVariationSettings: '"opsz" 84, "wght" 800, "SOFT" 20' }}
            >
              {name ? `Hello, ${name.split(" ")[0]}.` : "The reels are warm."}
            </h1>
            <p className="mt-3 max-w-md text-[15px] text-[var(--paper-dim)]">
              Press{" "}
              <kbd className="rounded border border-[var(--rule)] bg-[var(--paper-2)] px-1.5 py-0.5 font-mono text-[11px]">
                ⌘K
              </kbd>{" "}
              any time to add a film, or ask your collection a question.
            </p>
            <button
              type="button"
              onClick={dismiss}
              className="mt-7 rounded-full border border-[var(--ink)] bg-[var(--ink)] px-5 py-2 text-[12.5px] text-[var(--paper)] transition hover:opacity-90"
            >
              Start your catalog
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
