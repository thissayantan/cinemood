import { Dialog, AnimatedDialogContent } from "./dialog";

const ROWS: { keys: string[]; label: string }[] = [
  { keys: ["⌘ K", "Ctrl K"], label: "Open the command palette" },
  { keys: ["Tab"], label: "Switch between Add ↔ Find inside the palette" },
  { keys: ["Esc"], label: "Close the topmost modal" },
  { keys: ["G", "H"], label: "Go to your watchlist" },
  { keys: ["G", "I"], label: "Go to the import page" },
  { keys: ["G", "S"], label: "Go to search settings" },
  { keys: ["?"], label: "Open this shortcut list" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShortcutsSheet({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatedDialogContent
        open={open}
        side="center"
        className="!w-[min(540px,calc(100vw-32px))] !top-1/2"
      >
        <div className="p-7">
          <p className="font-label text-[10px] text-[var(--paper-faint)]">
            Keyboard shortcuts
          </p>
          <h2
            className="mt-2 font-display text-[28px] leading-tight text-[var(--ink)]"
            style={{ fontVariationSettings: '"opsz" 36, "wght" 800, "SOFT" 30' }}
          >
            Run the projector from the keys.
          </h2>
          <ul className="mt-6 divide-y divide-[var(--rule)]">
            {ROWS.map((row, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <span className="text-[13px] text-[var(--paper-dim)]">
                  {row.label}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {row.keys.map((k, j) => (
                    <kbd
                      key={j}
                      className="rounded border border-[var(--rule)] bg-[var(--paper-3)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-dim)]"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </AnimatedDialogContent>
    </Dialog>
  );
}
