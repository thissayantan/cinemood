import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMotionConfig } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface Option<V extends string> {
  value: V;
  label: string;
}

interface Props<V extends string> {
  value: V;
  options: ReadonlyArray<Option<V>>;
  onChange: (next: V) => void;
  className?: string;
  /** Accessible name for the trigger button. */
  label: string;
}

/** Restrained editorial-cinematic dropdown. Replaces native <select>
 *  for surfaces where the browser's default control fights the rest
 *  of the design.
 *
 *  - Trigger is a rounded pill with the active label + a small caret.
 *  - Panel pops below the trigger with a quick fade/translate.
 *  - Click-outside, Escape, and Enter on a row all behave.
 *  - Keyboard: ArrowUp / ArrowDown cycle, Enter commits, Esc closes.
 *  Built without a primitives lib because the surface area is tiny
 *  and we already have framer-motion for the entry animation. */
export function Dropdown<V extends string>({
  value,
  options,
  onChange,
  className,
  label,
}: Props<V>) {
  const m = useMotionConfig();
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<number>(
    Math.max(0, options.findIndex((o) => o.value === value)),
  );
  const rootRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocused((i) => (i + 1) % options.length);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocused((i) => (i - 1 + options.length) % options.length);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const opt = options[focused];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, options, focused, onChange]);

  // Reset focused row to the current value each time the panel opens.
  useEffect(() => {
    if (open) {
      setFocused(Math.max(0, options.findIndex((o) => o.value === value)));
    }
  }, [open, value, options]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-3 text-[12.5px] text-[var(--ink)] transition hover:bg-[var(--paper-3)]",
          // Subtle inset on light mode so the control reads as a real
          // surface against the cream page.
          "shadow-[inset_0_-1px_0_rgba(26,24,20,0.04)] dark:shadow-none",
        )}
      >
        <span className="truncate">{current?.label}</span>
        <svg
          aria-hidden
          width="10"
          height="10"
          viewBox="0 0 12 12"
          className={cn(
            "shrink-0 text-[var(--paper-faint)] transition-transform",
            open ? "rotate-180" : "rotate-0",
          )}
        >
          <path
            d="M3 4.5l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label={label}
            initial={m.reduced ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={m.reduced ? { opacity: 0 } : { opacity: 0, y: -2 }}
            transition={
              m.reduced
                ? { duration: 0 }
                : { duration: m.durFast, ease: m.easeOutQuint }
            }
            className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--paper-2)] py-1 shadow-[var(--shadow-card)]"
          >
            {options.map((opt, i) => {
              const isActive = opt.value === value;
              const isFocused = i === focused;
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setFocused(i)}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[12.5px] transition",
                      isFocused
                        ? "bg-[var(--paper-3)] text-[var(--ink)]"
                        : "text-[var(--paper-dim)] hover:text-[var(--ink)]",
                    )}
                  >
                    <span>{opt.label}</span>
                    {isActive && (
                      <svg
                        aria-hidden
                        width="11"
                        height="11"
                        viewBox="0 0 12 12"
                        className="shrink-0 text-[var(--accent)]"
                      >
                        <path
                          d="M2 6.2l2.6 2.6L10 3.4"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
