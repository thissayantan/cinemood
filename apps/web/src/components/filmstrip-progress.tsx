import { motion } from "framer-motion";
import { useMotionConfig } from "@/lib/motion";

interface Props {
  /** Items processed so far. */
  done: number;
  /** Total items the operation will process. */
  total: number;
  /** Short uppercase label on the left ("resolving", "adding to catalog"). */
  label: string;
  /** Optional accessory string on the right (e.g. "C-0042 just added"). */
  accessory?: string;
}

/** Determinate progress bar with a faint sprocket strip above — fits the
 *  editorial-cinematic catalog aesthetic. Reduced-motion safe: the bar still
 *  animates width but the shimmer overlay drops out. */
export function FilmstripProgress({ done, total, label, accessory }: Props) {
  const m = useMotionConfig();
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  // 16 perforation ticks across the strip width.
  const PERFS = 16;

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between">
        <span className="font-label text-[10px] text-[var(--paper-faint)]">
          {label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--paper-dim)]">
          <span className="text-[var(--accent)]">{done}</span>
          <span className="text-[var(--paper-faint)]"> / {total}</span>
          {accessory ? (
            <span className="ml-3 text-[var(--paper-faint)]">{accessory}</span>
          ) : null}
        </span>
      </div>

      {/* Sprocket-hole strip — a faint row of equally spaced rectangles that
          reads as film perforations. Purely decorative; aria-hidden. */}
      <div
        aria-hidden
        className="mt-2 flex h-1.5 items-center justify-between gap-0.5"
      >
        {Array.from({ length: PERFS }).map((_, i) => (
          <span
            key={i}
            className="block h-full w-[2px] rounded-[1px] bg-[var(--paper-faint)] opacity-40"
          />
        ))}
      </div>

      {/* The track itself. */}
      <div
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label}
        className="relative mt-1 h-[3px] w-full overflow-hidden rounded-full bg-[var(--paper-3)]"
      >
        <motion.div
          className="absolute inset-y-0 left-0 bg-[var(--accent)]"
          initial={false}
          animate={{ width: `${pct * 100}%` }}
          transition={
            m.reduced
              ? { duration: 0 }
              : { duration: m.durSlow, ease: m.easeOutQuint }
          }
        />
        {/* Shimmer overlay on the leading edge while in-flight, dropped in
            reduced-motion mode. */}
        {!m.reduced && pct < 1 ? (
          <motion.div
            aria-hidden
            className="absolute inset-y-0 w-[18%] rounded-full opacity-65"
            initial={{ left: "-18%" }}
            animate={{ left: "100%" }}
            transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, var(--accent-glow) 50%, transparent 100%)",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
