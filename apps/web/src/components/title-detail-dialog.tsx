import { useEffect, useState } from "react";
import type { SeasonDetail, WatchStatus, WatchlistItem } from "@cinemood/shared";
import { Dialog, AnimatedDialogContent, DialogTitle } from "./dialog";
import { PersonDialog } from "./person-dialog";
import { posterUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { fetchSeason } from "@/lib/api";
import { useRegion, pickProviders } from "@/lib/region";

interface Props {
  item: WatchlistItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetStatus: (item: WatchlistItem, status: WatchStatus) => void;
  onRemove: (item: WatchlistItem) => void;
}

export function TitleDetailDialog({
  item,
  open,
  onOpenChange,
  onSetStatus,
  onRemove,
}: Props) {
  const [personId, setPersonId] = useState<number | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <AnimatedDialogContent
          open={open && !!item}
          side="center"
          title={item ? item.title.title : "Title detail"}
        >
          {item ? (
            <Body
              item={item}
              onSetStatus={onSetStatus}
              onRemove={onRemove}
              onPersonClick={setPersonId}
            />
          ) : null}
        </AnimatedDialogContent>
      </Dialog>

      <PersonDialog
        personId={personId}
        onOpenChange={(open) => { if (!open) setPersonId(null); }}
      />
    </>
  );
}

function Body({
  item,
  onSetStatus,
  onRemove,
  onPersonClick,
}: {
  item: WatchlistItem;
  onSetStatus: (item: WatchlistItem, status: WatchStatus) => void;
  onRemove: (item: WatchlistItem) => void;
  onPersonClick: (id: number) => void;
}) {
  const t = item.title;
  const { region } = useRegion();

  const backdrop = t.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${t.backdrop_path}`
    : null;
  const poster = posterUrl(t.poster_path, "w342");
  const year = t.release_date ? t.release_date.slice(0, 4) : "—";
  const isWatched = item.status === "watched";
  const isWatching = item.status === "watching";
  const tmdbHref = `https://www.themoviedb.org/${t.type === "series" ? "tv" : "movie"}/${t.id}`;
  const isSeries = t.type === "series";

  let statusLabel = "On your shelf";
  if (isWatched) statusLabel = "Watched";
  else if (isWatching) statusLabel = "Watching now";

  const providers = pickProviders(t.providers, region);

  // Season/episode state (series only)
  const seasons =
    t.seasons?.filter((s) => s.season_number > 0).slice(0, 10) ?? [];
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [seasonDetail, setSeasonDetail] = useState<SeasonDetail | null>(null);
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [expandedEp, setExpandedEp] = useState<number | null>(null);

  // Auto-select first season when series opens
  useEffect(() => {
    if (isSeries && seasons.length > 0 && selectedSeason === null) {
      setSelectedSeason(seasons[0]!.season_number);
    }
  }, [isSeries, seasons.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedSeason === null) return;
    let cancelled = false;
    setSeasonLoading(true);
    setSeasonDetail(null);
    setExpandedEp(null);
    fetchSeason(t.id, selectedSeason).then((data) => {
      if (!cancelled) {
        setSeasonDetail(data);
        setSeasonLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [t.id, selectedSeason]);

  return (
    <div className="relative">
      {/* Backdrop hero */}
      <div className="relative h-[280px] overflow-hidden md:h-[360px]">
        {backdrop ? (
          <img
            src={backdrop}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-full w-full bg-[var(--paper-3)]" />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--paper-2) 0%, transparent) 0%, color-mix(in oklab, var(--paper-2) 30%, transparent) 50%, color-mix(in oklab, var(--paper-2) 92%, transparent) 88%, var(--paper-2) 100%)",
          }}
        />
      </div>

      {/* Header row */}
      <div className="relative -mt-16 flex gap-4 px-5 sm:-mt-24 sm:gap-6 sm:px-7 md:-mt-32 md:px-10">
        <div className="relative shrink-0">
          <div
            className="overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--paper-3)] shadow-[var(--shadow-card)] w-[96px] sm:w-[132px]"
            style={{ aspectRatio: "2 / 3" }}
          >
            {poster ? (
              <img src={poster} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <div className="font-label text-[10px] text-[var(--paper-faint)]">
            {isSeries
              ? `Series${t.number_of_seasons ? ` · ${t.number_of_seasons} season${t.number_of_seasons === 1 ? "" : "s"}` : ""}`
              : "Motion picture"}{" "}
            · {year}
            {t.runtime ? ` · ${t.runtime}m` : ""}
          </div>
          <DialogTitle
            className="mt-2 font-display-md text-[28px] leading-[1.05] text-[var(--ink)] sm:text-[40px] md:text-[56px]"
            style={{ fontVariationSettings: '"opsz" 72, "wght" 800, "SOFT" 20' }}
          >
            {t.title}
          </DialogTitle>
          {t.original_title && t.original_title !== t.title ? (
            <div className="mt-1 font-italic text-[14px] text-[var(--paper-dim)]">
              {t.original_title}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-dim)]">
            {typeof t.vote_average === "number" && t.vote_average > 0 ? (
              <Badge>TMDB ★ {t.vote_average.toFixed(1)}</Badge>
            ) : null}
            {typeof t.imdb_rating === "number" && t.imdb_rating > 0 ? (
              <Badge>IMDB ★ {t.imdb_rating.toFixed(1)}</Badge>
            ) : null}
            {typeof t.vote_count === "number" && t.vote_count > 0 ? (
              <Badge muted>{t.vote_count.toLocaleString()} votes</Badge>
            ) : null}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule)] px-5 py-4 sm:px-7 md:px-10">
        <span className="font-label text-[10px] text-[var(--paper-faint)]">
          {statusLabel}
        </span>
        <div className="flex flex-wrap gap-2">
          {!isWatching && !isWatched && (
            <button
              type="button"
              onClick={() => onSetStatus(item, "watching")}
              className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-3.5 py-1.5 text-[12px] text-[var(--paper)] transition hover:opacity-90"
            >
              Start watching
            </button>
          )}
          {isWatching && (
            <button
              type="button"
              onClick={() => onSetStatus(item, "watched")}
              className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-3.5 py-1.5 text-[12px] text-[var(--paper)] transition hover:opacity-90"
            >
              Mark watched
            </button>
          )}
          {(isWatching || isWatched) && (
            <button
              type="button"
              onClick={() => onSetStatus(item, "pending")}
              className="rounded-full border border-[var(--rule)] bg-[var(--paper-3)] px-3.5 py-1.5 text-[12px] text-[var(--ink)] transition hover:bg-[var(--paper-3)]/70"
            >
              {isWatched ? "Unmark watched" : "Stop watching"}
            </button>
          )}
          {!isWatching && !isWatched && (
            <button
              type="button"
              onClick={() => onSetStatus(item, "watched")}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[12px] transition",
                "border-[var(--rule)] bg-transparent text-[var(--paper-dim)] hover:text-[var(--ink)]",
              )}
            >
              Mark watched
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(item)}
            className="rounded-full border border-[var(--rule)] bg-transparent px-3.5 py-1.5 text-[12px] text-[var(--paper-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Remove
          </button>
          <a
            href={tmdbHref}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-full border border-[var(--rule)] px-3.5 py-1.5 text-[12px] text-[var(--paper-dim)] transition hover:text-[var(--ink)]"
          >
            View on TMDB ↗
          </a>
        </div>
      </div>

      {/* Synopsis */}
      <div className="px-5 pb-6 sm:px-7 md:px-10">
        <p className="max-w-[68ch] text-[16px] leading-[1.55] text-[var(--ink)]">
          {t.overview || (
            <span className="italic text-[var(--paper-dim)]">
              No synopsis on file.
            </span>
          )}
        </p>
      </div>

      {/* Genres */}
      {t.genres.length > 0 ? (
        <div className="px-5 pb-5 sm:px-7 md:px-10">
          <div className="font-label text-[10px] text-[var(--paper-faint)]">Genre</div>
          <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-[var(--paper-dim)]">
            {t.genres.join("  ·  ")}
          </div>
        </div>
      ) : null}

      {/* Cast */}
      {t.cast.length > 0 ? (
        <div className="px-5 pb-5 sm:px-7 md:px-10">
          <div className="font-label text-[10px] text-[var(--paper-faint)]">Cast</div>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
            {t.cast.slice(0, 6).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPersonClick(c.id)}
                  className="group flex w-full flex-col text-left transition"
                >
                  <span className="text-[13px] text-[var(--ink)] group-hover:text-[var(--accent)]">
                    {c.name}
                  </span>
                  {c.character ? (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
                      as {c.character}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Episode guide (series only) */}
      {isSeries && seasons.length > 0 ? (
        <div className="border-t border-[var(--rule)] px-5 py-5 sm:px-7 md:px-10">
          <div className="mb-3 font-label text-[10px] text-[var(--paper-faint)]">
            Episodes
          </div>

          {/* Season chips */}
          <div className="mb-4 flex flex-wrap gap-2">
            {seasons.map((s) => (
              <button
                key={s.season_number}
                type="button"
                onClick={() => setSelectedSeason(s.season_number)}
                className={cn(
                  "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition",
                  selectedSeason === s.season_number
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)]"
                    : "border-[var(--rule)] text-[var(--paper-dim)] hover:border-[var(--ink)] hover:text-[var(--ink)]",
                )}
              >
                {s.name === `Season ${s.season_number}` ? `S${s.season_number}` : s.name}
              </button>
            ))}
          </div>

          {/* Episode list */}
          {seasonLoading ? (
            <div className="flex h-24 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--rule)] border-t-[var(--accent)]" />
            </div>
          ) : seasonDetail ? (
            <ul className="divide-y divide-[var(--rule)]">
              {seasonDetail.episodes.map((ep) => {
                const isOpen = expandedEp === ep.episode_number;
                return (
                  <li key={ep.episode_number}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedEp(isOpen ? null : ep.episode_number)
                      }
                      className="flex w-full items-start gap-3 py-3 text-left"
                    >
                      <span className="mt-0.5 w-8 shrink-0 font-mono text-[10px] text-[var(--paper-faint)]">
                        E{ep.episode_number}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] text-[var(--ink)]">
                          {ep.name ?? `Episode ${ep.episode_number}`}
                        </span>
                        <span className="ml-2 font-mono text-[10px] text-[var(--paper-faint)]">
                          {ep.air_date ? ep.air_date.slice(0, 4) : ""}
                          {ep.runtime ? ` · ${ep.runtime}m` : ""}
                        </span>
                        {isOpen && ep.overview ? (
                          <p className="mt-1.5 text-[12px] leading-[1.55] text-[var(--paper-dim)]">
                            {ep.overview}
                          </p>
                        ) : null}
                      </div>
                      <span className="mt-0.5 shrink-0 text-[10px] text-[var(--paper-faint)]">
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Providers */}
      {providers.length > 0 ? (
        <div className="px-5 pb-8 sm:px-7 md:px-10">
          <div className="font-label text-[10px] text-[var(--paper-faint)]">
            Streaming · {region}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px] text-[var(--paper-dim)]">
            {providers.map((p) => (
              <span
                key={p}
                className="rounded-full border border-[var(--rule)] px-2.5 py-1"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Badge({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full border border-[var(--rule)] px-2 py-0.5",
        muted && "opacity-70",
      )}
    >
      {children}
    </span>
  );
}
