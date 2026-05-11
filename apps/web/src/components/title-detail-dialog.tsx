import type { WatchlistItem } from "@cinemood/shared";
import { Dialog, AnimatedDialogContent, DialogTitle } from "./dialog";
import { posterUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";

interface Props {
  item: WatchlistItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleWatched: (item: WatchlistItem) => void;
  onRemove: (item: WatchlistItem) => void;
}

export function TitleDetailDialog({
  item,
  open,
  onOpenChange,
  onToggleWatched,
  onRemove,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatedDialogContent
        open={open && !!item}
        side="center"
        title={item ? item.title.title : "Title detail"}
      >
        {item ? <Body item={item} onToggleWatched={onToggleWatched} onRemove={onRemove} /> : null}
      </AnimatedDialogContent>
    </Dialog>
  );
}

function Body({
  item,
  onToggleWatched,
  onRemove,
}: {
  item: WatchlistItem;
  onToggleWatched: (item: WatchlistItem) => void;
  onRemove: (item: WatchlistItem) => void;
}) {
  const t = item.title;
  const backdrop = t.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${t.backdrop_path}`
    : null;
  const poster = posterUrl(t.poster_path, "w342");
  const year = t.release_date ? t.release_date.slice(0, 4) : "—";
  const isWatched = item.status === "watched";
  const tmdbHref = `https://www.themoviedb.org/${t.type === "series" ? "tv" : "movie"}/${t.id}`;

  const providersUS = pickProvidersUS(t.providers);

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
      <div className="relative -mt-24 flex gap-6 px-7 md:-mt-32 md:px-10">
        <div className="relative shrink-0">
          <div
            className="overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--paper-3)] shadow-[var(--shadow-card)]"
            style={{ width: 132, aspectRatio: "2 / 3" }}
          >
            {poster ? (
              <img src={poster} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <div className="font-label text-[10px] text-[var(--paper-faint)]">
            {t.type === "series" ? "Series" : "Motion picture"} · {year}
            {t.runtime ? ` · ${t.runtime}m` : ""}
          </div>
          <DialogTitle
            className="mt-2 font-display-md text-[40px] leading-[1.05] text-[var(--ink)] md:text-[56px]"
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
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rule)] px-7 py-4 md:px-10">
        <span className="font-label text-[10px] text-[var(--paper-faint)]">
          {isWatched ? "Watched" : "On your shelf"}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onToggleWatched(item)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[12px] transition",
              isWatched
                ? "border-[var(--rule)] bg-[var(--paper-3)] text-[var(--ink)] hover:bg-[var(--paper-3)]/70"
                : "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)] hover:opacity-92",
            )}
          >
            {isWatched ? "Unmark watched" : "Mark watched"}
          </button>
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
      <div className="px-7 pb-6 md:px-10">
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
        <div className="px-7 pb-5 md:px-10">
          <div className="font-label text-[10px] text-[var(--paper-faint)]">
            Genre
          </div>
          <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-[var(--paper-dim)]">
            {t.genres.join("  ·  ")}
          </div>
        </div>
      ) : null}

      {/* Cast */}
      {t.cast.length > 0 ? (
        <div className="px-7 pb-5 md:px-10">
          <div className="font-label text-[10px] text-[var(--paper-faint)]">
            Cast
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3">
            {t.cast.slice(0, 6).map((c) => (
              <li key={c.name} className="flex flex-col">
                <span className="text-[13px] text-[var(--ink)]">{c.name}</span>
                {c.character ? (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
                    as {c.character}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Providers */}
      {providersUS.length > 0 ? (
        <div className="px-7 pb-8 md:px-10">
          <div className="font-label text-[10px] text-[var(--paper-faint)]">
            Streaming · US
          </div>
          <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px] text-[var(--paper-dim)]">
            {providersUS.map((p) => (
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

function pickProvidersUS(providers: Record<string, unknown> | null): string[] {
  if (!providers) return [];
  const us = (providers as Record<string, unknown>)["US"];
  if (!us || typeof us !== "object") return [];
  const out = new Set<string>();
  for (const bucket of Object.values(us as Record<string, unknown>)) {
    if (!Array.isArray(bucket)) continue;
    for (const entry of bucket as unknown[]) {
      if (entry && typeof entry === "object" && "provider_name" in entry) {
        const name = (entry as { provider_name?: string }).provider_name;
        if (typeof name === "string") out.add(name);
      }
    }
  }
  return [...out];
}
