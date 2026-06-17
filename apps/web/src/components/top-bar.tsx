import type { User } from "@cinemood/shared";
import { Link } from "react-router-dom";
import { AvatarMenu } from "./avatar-menu";
import { ThemeToggle } from "./theme-toggle";

interface Props {
  user: User;
  /** Total titles in the user's watchlist — shown as a quiet subtitle
   *  next to the wordmark. Replaces the old C-NNNN catalog spine number
   *  which conveyed nothing actionable to a user. */
  titleCount: number;
  onOpenPalette: () => void;
  onOpenFilters?: () => void;
  filtersBadge?: number;
  onOpenDecide?: () => void;
}

export function TopBar({
  user,
  titleCount,
  onOpenPalette,
  onOpenFilters,
  filtersBadge = 0,
  onOpenDecide,
}: Props) {
  const shortcut = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)
    ? "⌘K"
    : "Ctrl K";

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--paper)]/88 backdrop-blur-lg supports-[backdrop-filter]:bg-[var(--paper)]/72">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-5 md:px-8">
        <Link
          to="/"
          className="flex items-baseline gap-3 text-[var(--ink)] no-underline"
          aria-label="Cinemood — home"
        >
          <span
            className="font-display-md text-[26px] leading-none"
            style={{ fontVariationSettings: '"opsz" 36, "wght" 800, "SOFT" 20' }}
          >
            Cinemood
          </span>
          {titleCount > 0 && (
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)] sm:inline">
              {titleCount} title{titleCount === 1 ? "" : "s"}
            </span>
          )}
        </Link>

        {/* Mobile (<sm): icon-only search trigger so the four chrome
            elements (wordmark / search / filter / theme / avatar) all
            fit in 375px. Tap target stays ≥44×44. */}
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Search or add a film"
          className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--rule)] bg-[var(--paper-2)] text-[var(--paper-dim)] transition hover:text-[var(--ink)] sm:hidden"
        >
          <SearchIcon />
        </button>

        {/* Tablet and up: the full inline search button with shortcut
            hint. */}
        <div className="ml-2 hidden flex-1 justify-center sm:flex">
          <button
            type="button"
            onClick={onOpenPalette}
            // Subtle inset shadow in light mode so the bar lifts off the
            // cream page (paper-2 alone is too close to paper to read as
            // a distinct surface). The shadow is invisible in dark mode
            // where paper-2 is already well-separated from paper.
            className="group flex h-9 w-full max-w-[480px] items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--paper-2)] px-4 text-left text-[13px] text-[var(--paper-dim)] shadow-[inset_0_-1px_0_rgba(26,24,20,0.04)] transition hover:bg-[var(--paper-3)] hover:text-[var(--ink)] dark:shadow-none"
          >
            <SearchIcon />
            <span className="truncate">Search or add a film…</span>
            <span
              aria-hidden
              className="ml-auto rounded border border-[var(--rule)] bg-[var(--paper)] px-1.5 py-[1px] font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]"
            >
              {shortcut}
            </span>
          </button>
        </div>

        {onOpenFilters && (
          <button
            type="button"
            onClick={onOpenFilters}
            // 44×44 tap target on mobile (Apple HIG); collapses with the
            // rest of the chrome at md where the persistent rail takes over.
            className="relative grid h-11 w-11 place-items-center rounded-full border border-[var(--rule)] bg-[var(--paper-2)] text-[var(--paper-dim)] transition hover:text-[var(--ink)] md:hidden"
            aria-label="Open filters"
          >
            <FilterIcon />
            {filtersBadge > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 font-mono text-[9px] font-semibold text-[var(--paper)]">
                {filtersBadge}
              </span>
            )}
          </button>
        )}

        {onOpenDecide && (
          <button
            type="button"
            onClick={onOpenDecide}
            aria-label="Decide what to watch"
            title="Decide what to watch"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--rule)] bg-[var(--paper-2)] text-[var(--paper-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <DecideIcon />
          </button>
        )}
        <ThemeToggle />
        <AvatarMenu user={user} />
      </div>
    </header>
  );
}

/** Sparkle / wand icon to represent the "Decide" feature. */
function DecideIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 2v2M8 12v2M2 8h2M12 8h2M4.2 4.2l1.4 1.4M10.4 10.4l1.4 1.4M4.2 11.8l1.4-1.4M10.4 5.6l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 3h12M4 8h8M6 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
