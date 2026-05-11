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
}

export function TopBar({
  user,
  titleCount,
  onOpenPalette,
  onOpenFilters,
  filtersBadge = 0,
}: Props) {
  const shortcut = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)
    ? "⌘K"
    : "Ctrl K";

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--paper)]/85 backdrop-blur supports-[backdrop-filter]:bg-[var(--paper)]/65">
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

        <div className="ml-2 flex-1 flex justify-center">
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
            className="relative grid h-9 w-9 place-items-center rounded-full border border-[var(--rule)] bg-[var(--paper-2)] text-[var(--paper-dim)] transition hover:text-[var(--ink)] md:hidden"
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

        <ThemeToggle />
        <AvatarMenu user={user} />
      </div>
    </header>
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
