import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import filmReel from "@/lottie/film-reel.json";
import { LottieLoop } from "./lottie-loop";
import { useMotionConfig } from "@/lib/motion";

// Lottie source: in-repo placeholder at apps/web/src/lottie/film-reel.json
// (<5KB). Swap with a richer animation from
// https://lottiefiles.com/search?keywords=film+reel (Free + Commercial-use,
// ≤80KB compressed) when one is picked — document the URL here.

interface Props {
  onAddClick: () => void;
}

export function EmptyWatchlist({ onAddClick }: Props) {
  const m = useMotionConfig();
  const initial = m.reduced ? false : { opacity: 0, y: m.fadeY };
  const transition = m.reduced ? { duration: 0 } : m.springEntry;
  return (
    <motion.div
      initial={initial}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className="mx-auto flex max-w-md flex-col items-center px-6 py-14 text-center"
    >
      <LottieLoop source={filmReel} size={220} speed={0.45} loop />
      <h1
        className="mt-4 font-display text-[40px] leading-[1.05] text-[var(--ink)]"
        style={{ fontVariationSettings: '"opsz" 56, "wght" 800, "SOFT" 20' }}
      >
        An empty reel.
      </h1>
      <p className="mt-3 max-w-sm text-[15px] text-[var(--paper-dim)]">
        Your collection starts here. Press{" "}
        <kbd className="rounded border border-[var(--rule)] bg-[var(--paper-2)] px-1.5 py-0.5 font-mono text-[11px]">
          ⌘K
        </kbd>{" "}
        to add your first film.
      </p>
      <div className="mt-7 flex items-center gap-3">
        <button
          type="button"
          onClick={onAddClick}
          className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-5 py-2 text-[13px] font-medium text-[var(--paper)] transition hover:opacity-90"
        >
          Add your first film
        </button>
        <span className="font-label text-[10px] text-[var(--paper-faint)]">
          or
        </span>
        <Link
          to="/import"
          className="text-[13px] text-[var(--paper-dim)] underline-offset-4 transition hover:text-[var(--ink)] hover:underline"
        >
          Import an existing list
        </Link>
      </div>
    </motion.div>
  );
}
