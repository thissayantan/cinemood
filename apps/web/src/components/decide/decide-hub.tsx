/**
 * decide-hub.tsx — bottom sheet surfacing the three "decide what to watch" modes.
 *
 * Opened by the sparkle (sun) button in the top bar. Three entries:
 *   1. Mood picker     — type a mood, get ranked suggestions from your watchlist.
 *   2. Swipe Q&A       — answer 5 preference questions, get a single winner.
 *   3. Compare         — select 2–6 titles in the grid, then tap "Compare N".
 *
 * The first two open their respective dialogs; the third closes the hub and
 * enters selection mode (the parent handles showing the visual instruction).
 */
import { motion } from "framer-motion";
import { useMotionConfig } from "@/lib/motion";
import { Dialog, AnimatedDialogContent, DialogTitle } from "@/components/dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenMood: () => void;
  onOpenSwipe: () => void;
  onStartCompare: () => void;
}

export function DecideHub({
  open,
  onOpenChange,
  onOpenMood,
  onOpenSwipe,
  onStartCompare,
}: Props) {
  const m = useMotionConfig();

  const modes = [
    {
      id: "mood",
      label: "Mood picker",
      subtitle: "Describe how you're feeling — get ranked suggestions.",
      icon: <SparkleIcon />,
      onClick: () => {
        onOpenChange(false);
        onOpenMood();
      },
    },
    {
      id: "swipe",
      label: "Q&A decider",
      subtitle: "Answer 5 quick questions. Get one perfect pick.",
      icon: <SwipeIcon />,
      onClick: () => {
        onOpenChange(false);
        onOpenSwipe();
      },
    },
    {
      id: "compare",
      label: "Compare titles",
      subtitle: "Select 2–6 titles in the grid, then tap Compare.",
      icon: <TableIcon />,
      onClick: () => {
        onOpenChange(false);
        onStartCompare();
      },
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatedDialogContent open={open} side="center" title="Decide">
        <div className="px-6 pb-8 pt-5">
          <DialogTitle
            className="mb-1 font-display-md text-[22px] leading-tight text-[var(--ink)]"
            style={{ fontVariationSettings: '"opsz" 24, "wght" 800, "SOFT" 20' }}
          >
            Decide
          </DialogTitle>
          <p className="mb-5 text-[12px] text-[var(--paper-faint)]">
            Three ways to find your next watch.
          </p>

          <div className="flex flex-col gap-3">
            {modes.map((mode, i) => (
              <motion.button
                key={mode.id}
                type="button"
                onClick={mode.onClick}
                initial={m.reduced ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  m.reduced
                    ? { duration: 0 }
                    : { duration: m.durBase, delay: i * 0.05, ease: m.easeOutQuint }
                }
                className={cn(
                  "flex items-start gap-4 rounded-xl border border-[var(--rule)] bg-[var(--paper-2)] px-4 py-3.5 text-left transition",
                  "hover:border-[var(--accent)]/50 hover:bg-[var(--paper-3)] active:scale-[0.98]",
                )}
              >
                <span className="mt-0.5 shrink-0 text-[var(--accent)]">{mode.icon}</span>
                <div>
                  <span
                    className="block font-display-sm text-[15px] leading-snug text-[var(--ink)]"
                    style={{ fontVariationSettings: '"opsz" 15, "wght" 650, "SOFT" 30' }}
                  >
                    {mode.label}
                  </span>
                  <span className="block text-[12px] leading-snug text-[var(--paper-faint)]">
                    {mode.subtitle}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </AnimatedDialogContent>
    </Dialog>
  );
}

function SparkleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2v2M8 12v2M2 8h2M12 8h2M4.2 4.2l1.4 1.4M10.4 10.4l1.4 1.4M4.2 11.8l1.4-1.4M10.4 5.6l1.4-1.4"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function SwipeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2.5" y="3" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 13h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 13v0.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5.5 7h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 6h12" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 6v8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
