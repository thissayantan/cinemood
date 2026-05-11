import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMotionConfig } from "@/lib/motion";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Props {
  open: boolean;
  message: string;
  action?: ToastAction;
  onDismiss: () => void;
  /** ms before auto-dismiss. Default 5000. */
  duration?: number;
}

/** Bottom-center transient notification with an optional undo action.
 *  Auto-dismisses after `duration` ms while open; clears the timer on
 *  re-open (so consecutive triggers reset the countdown). */
export function Toast({ open, message, action, onDismiss, duration = 5000 }: Props) {
  const m = useMotionConfig();

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(id);
  }, [open, duration, onDismiss, message]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={m.reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={m.reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={
            m.reduced
              ? { duration: 0 }
              : { duration: m.durToastIn, ease: m.easeOutQuint }
          }
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-4 py-2 shadow-[var(--shadow-card)]"
        >
          <span className="text-[13px] text-[var(--ink)]">{message}</span>
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--accent)] hover:opacity-80"
            >
              {action.label}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="grid h-5 w-5 place-items-center rounded-full text-[var(--paper-faint)] hover:text-[var(--ink)]"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M2 2l8 8M10 2l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
