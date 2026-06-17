import { useState } from "react";
import { motion } from "framer-motion";
import type { WatchStatus, WatchlistItem } from "@cinemood/shared";
import { cn } from "@/lib/utils";
import { useMotionConfig, staggerDelay } from "@/lib/motion";
import { posterUrl } from "@/lib/tmdb";
import { selectProviders } from "@/lib/providers";
import { useHasHover } from "@/lib/use-has-hover";

// Subtle ring + drop-shadow rather than a flat border so the OTT badge has
// edge separation on both pale and dark posters (a white border vanishes on
// cream in light mode, a black border vanishes on dark posters). The three
// stacked layers — dark hairline, white halo, soft drop — are load-bearing.
const PROVIDER_BADGE_SHADOW =
  "0 0 0 1px rgba(0,0,0,0.35), 0 0 0 2px rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.35)";

interface Props {
  item: WatchlistItem;
  index: number;
  onOpen: () => void;
  /** Called with the desired next status. Card shows contextual actions per current status. */
  onSetStatus: (status: WatchStatus) => void;
  onRemove: () => void;
  focusable?: boolean;
  /** Multi-select mode: whether this card is currently selected. */
  selected?: boolean;
  /** Multi-select mode: called when the user clicks the selection toggle. */
  onSelect?: () => void;
}

export function PosterCard({
  item,
  index,
  onOpen,
  onSetStatus,
  onRemove,
  focusable = true,
  selected = false,
  onSelect,
}: Props) {
  const t = item.title;
  const m = useMotionConfig();
  // Suppress the synopsis-overlay hover affordance on touch devices.
  // Without this gate, tapping a card flashes the overlay (tap → focus
  // → onFocus → hovered=true) just before the detail dialog opens. The
  // detail dialog is the touch user's path to synopsis/cast/actions
  // anyway — mark-watched and remove live there too.
  const hasHover = useHasHover();
  const [hovered, setHovered] = useState(false);

  const src = posterUrl(t.poster_path, "w342");
  const year = t.release_date ? t.release_date.slice(0, 4) : "—";
  const rating = typeof t.vote_average === "number" ? t.vote_average : null;
  const isWatched = item.status === "watched";
  const isWatching = item.status === "watching";
  const providers = selectProviders(t.providers, 3);

  // Contextual primary action per status:
  //   pending  → "Start watching"  (→ watching)
  //   watching → "Mark watched"    (→ watched)
  //   watched  → "Unmark watched"  (→ pending)
  const quickActionConfig = {
    pending:  { label: "Start watching",  icon: <PlayIcon />,  next: "watching" as WatchStatus },
    watching: { label: "Mark watched",    icon: <CheckIcon />, next: "watched"  as WatchStatus },
    watched:  { label: "Unmark watched",  icon: <UndoIcon />,  next: "pending"  as WatchStatus },
  }[item.status];

  // Motion: when reduced, every entrance collapses to instant; otherwise
  // use the shared spring + a small fade-up offset.
  const articleInitial = m.reduced ? false : { opacity: 0, y: m.fadeY };
  const articleTransition = m.reduced
    ? { duration: 0 }
    : { ...m.springEntry, delay: staggerDelay(index, m) };
  const fadeTransition = m.reduced
    ? { duration: 0 }
    : { duration: m.durBase, ease: m.easeOutQuint };
  const drawTransition = m.reduced
    ? { duration: 0 }
    : { duration: m.durSlow, ease: m.easeOutQuint };

  // Pointer/focus -> hovered binding, gated on `hasHover` so touch devices
  // don't flash the overlay during the tap → open-dialog handoff.
  const hoverHandlers = hasHover
    ? {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
        onFocus: () => setHovered(true),
        onBlur: () => setHovered(false),
      }
    : {};

  return (
    <motion.article
      initial={articleInitial}
      animate={{ opacity: 1, y: 0 }}
      transition={articleTransition}
      className="group relative"
      {...hoverHandlers}
    >
      <motion.button
        type="button"
        tabIndex={focusable ? 0 : -1}
        aria-label={`Open ${t.title}`}
        onClick={onOpen}
        whileHover={m.reduced ? undefined : { scale: m.scaleHover }}
        whileTap={m.reduced ? undefined : { scale: 0.985 }}
        transition={{ duration: m.durFast, ease: m.easeOutQuint }}
        className="relative block w-full overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--paper-2)] text-left"
        style={{ aspectRatio: "2 / 3" }}
      >
        {/* Poster image — desaturated when watched; normal when watching or pending */}
        {src ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            className={cn(
              "h-full w-full object-cover transition-all",
              isWatched && "saturate-[0.55] brightness-[0.78]",
            )}
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[var(--paper-3)] text-[var(--paper-faint)]">
            <span className="font-label text-[11px]">No poster</span>
          </div>
        )}

        {/* Watching ring — accent-coloured border overlay; communicates
            "in progress" without touching the poster image itself. */}
        {isWatching && (
          <span
            className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-[var(--accent)]"
            aria-label="Currently watching"
          />
        )}

        {/* Multi-select: selection ring + checkmark overlay.
            The checkbox is shown on hover (via group-hover) or when already
            selected, so the user can click it to enter/exit select mode.
            The main card click (onOpen) is unchanged — selection is only
            triggered by clicking this checkbox. */}
        {onSelect && (
          <>
            {selected && (
              <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-inset ring-sky-500/80" />
            )}
            <button
              type="button"
              aria-label={selected ? "Deselect" : "Select for compare"}
              aria-pressed={selected}
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className={cn(
                "absolute left-2 top-2 z-10 grid h-5 w-5 place-items-center rounded-full border-2 transition",
                selected
                  ? "border-sky-500 bg-sky-500 text-white"
                  : "border-white/60 bg-black/40 text-transparent opacity-0 group-hover:opacity-100",
              )}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5.3l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}

        {/* Top-left: OTT providers — informational, always visible (no
            hover needed). Caps at 3 logos to keep the corner uncluttered;
            the detail dialog shows the full list. */}
        {providers.length > 0 && (
          <div
            className={cn(
              "absolute left-2 top-2 flex items-center gap-1",
              isWatched && "opacity-55",
            )}
            aria-label={`Available on ${providers.map((p) => p.name).join(", ")}`}
          >
            {providers.map((p) =>
              p.logo ? (
                <img
                  key={p.name}
                  src={`https://image.tmdb.org/t/p/w45${p.logo}`}
                  alt={p.name}
                  title={p.name}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  style={{ boxShadow: PROVIDER_BADGE_SHADOW }}
                  className="h-[18px] w-[18px] rounded-[4px] object-cover"
                />
              ) : (
                <span
                  key={p.name}
                  title={p.name}
                  style={{ boxShadow: PROVIDER_BADGE_SHADOW }}
                  className="grid h-[18px] w-[18px] place-items-center rounded-[4px] bg-black/65 font-mono text-[9px] text-white"
                >
                  {p.name.slice(0, 1)}
                </span>
              ),
            )}
          </div>
        )}

        {/* Watched checkmark draw-in */}
        {isWatched && (
          <motion.span
            initial={m.reduced ? { opacity: 1 } : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={drawTransition}
            className="absolute bottom-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-[var(--paper)]"
            aria-label="Watched"
          >
            <svg width="13" height="13" viewBox="0 0 16 16">
              <motion.path
                d="M3.5 8.5l3 3 6-6.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={m.reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={drawTransition}
              />
            </svg>
          </motion.span>
        )}

        {/* Watching play-dot badge — solid accent circle with a play
            triangle; no draw-in animation (it's a steady state). */}
        {isWatching && (
          <span
            className="absolute bottom-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-[var(--accent)] text-[var(--paper)]"
            aria-label="Currently watching"
          >
            <svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor">
              <path d="M2 2.5l6 2.8-6 2.8z" />
            </svg>
          </span>
        )}

        {/* Hover/focus synopsis overlay. Text is locked to white because
            the overlay sits on the poster image — a theme-following colour
            collapses to dark-on-dark in dark mode. */}
        {hovered && !m.reduced && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fadeTransition}
            className="absolute inset-0 flex flex-col justify-end p-4 text-white"
            style={{
              background:
                "linear-gradient(180deg, transparent 0%, rgba(10,9,8,0.0) 18%, rgba(10,9,8,0.78) 50%, rgba(10,9,8,0.94) 78%, rgba(10,9,8,0.98) 100%)",
            }}
          >
            <p
              className="line-clamp-3 text-[12px] leading-snug"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
            >
              {t.overview || (
                <span className="text-white/70 italic">
                  No synopsis on file.
                </span>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-white/85">
              {t.runtime ? <span>{t.runtime}m</span> : null}
              {t.genres.slice(0, 2).map((g) => (
                <span key={g} className="rounded-md border border-white/30 px-1.5 py-0.5">
                  {g}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </motion.button>

      {/* Hover quick-actions; positioned outside the button for accessible activation */}
      {hovered && !m.reduced && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={fadeTransition}
          className="absolute right-2 top-2 z-10 flex gap-1.5"
        >
          <QuickAction
            label={quickActionConfig.label}
            onClick={() => onSetStatus(quickActionConfig.next)}
          >
            {quickActionConfig.icon}
          </QuickAction>
          <QuickAction label="Remove from watchlist" onClick={onRemove} danger>
            <TrashIcon />
          </QuickAction>
        </motion.div>
      )}

      {/* Metadata strip below poster */}
      <div className="mt-2 flex items-baseline justify-between gap-2 px-0.5">
        <div className="min-w-0">
          <h3
            className={cn(
              "truncate font-display-sm text-[14px] leading-tight text-[var(--ink)]",
              isWatched && "text-[var(--paper-dim)]",
            )}
            style={{ fontVariationSettings: '"opsz" 14, "wght" 600, "SOFT" 40' }}
            title={t.title}
          >
            {t.title}
          </h3>
          {/* "Watching" label — shown below title so it doesn't push year/rating */}
          {isWatching && (
            <span className="block font-label text-[9px] uppercase tracking-widest text-[var(--accent)]">
              Watching
            </span>
          )}
        </div>
        <div className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
          {year}
          {rating !== null && rating > 0 ? (
            <span className="ml-1">· ★{rating.toFixed(1)}</span>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

function QuickAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      // These overlays sit on a poster image (any colour, often dark), not
      // on the page surface, so a theme-following palette would tank
      // contrast in dark mode. Lock to white-on-near-black with a subtle
      // white edge — high contrast on every poster regardless of theme.
      className={cn(
        "grid h-7 w-7 place-items-center rounded-full border border-white/25 bg-black/65 text-white shadow-sm shadow-black/30 backdrop-blur-sm transition hover:bg-black/85",
        danger && "hover:border-[var(--accent)] hover:text-[var(--accent)]",
      )}
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor">
      <path d="M2 1.5l8 4.7-8 4.7z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function UndoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M3 8a5 5 0 1 1 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 5v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M3.5 4.5h9M6 4V2.8c0-.5.4-.8.8-.8h2.4c.4 0 .8.3.8.8V4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4.5 4.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
