import { useState } from "react";
import { motion } from "framer-motion";
import type { WatchlistItem } from "@cinemood/shared";
import { cn } from "@/lib/utils";
import { useMotionConfig, staggerDelay } from "@/lib/motion";
import { posterUrl } from "@/lib/tmdb";
import { selectProviders } from "@/lib/providers";

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
  onToggleWatched: () => void;
  onRemove: () => void;
  focusable?: boolean;
}

export function PosterCard({
  item,
  index,
  onOpen,
  onToggleWatched,
  onRemove,
  focusable = true,
}: Props) {
  const t = item.title;
  const m = useMotionConfig();
  const [hovered, setHovered] = useState(false);

  const src = posterUrl(t.poster_path, "w342");
  const year = t.release_date ? t.release_date.slice(0, 4) : "—";
  const rating = typeof t.vote_average === "number" ? t.vote_average : null;
  const isWatched = item.status === "watched";
  const providers = selectProviders(t.providers, 3);

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

  return (
    <motion.article
      initial={articleInitial}
      animate={{ opacity: 1, y: 0 }}
      transition={articleTransition}
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
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
        {/* Poster image */}
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
            label={isWatched ? "Unmark watched" : "Mark watched"}
            onClick={onToggleWatched}
          >
            {isWatched ? <UndoIcon /> : <CheckIcon />}
          </QuickAction>
          <QuickAction label="Remove from watchlist" onClick={onRemove} danger>
            <TrashIcon />
          </QuickAction>
        </motion.div>
      )}

      {/* Metadata strip below poster */}
      <div className="mt-2 flex items-baseline justify-between gap-2 px-0.5">
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
