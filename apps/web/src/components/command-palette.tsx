import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import type {
  ApiResponse,
  ParsedQuery,
  Title,
  TitleType,
  WatchlistItem,
} from "@cinemood/shared";
import { Dialog, AnimatedDialogContent } from "./dialog";
import { api } from "@/lib/api";
import { posterUrl } from "@/lib/tmdb";
import { cn } from "@/lib/utils";
import { selectProviders } from "@/lib/providers";

interface TmdbHit {
  id: number;
  type: TitleType;
  title: string;
  release_date: string | null;
  poster_path: string | null;
  overview: string | null;
  vote_average: number | null;
}

interface NlSearchResponse {
  parsed: ParsedQuery;
  results: WatchlistItem[];
}

type Mode = "add" | "find";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (id: number) => void;
  onOpenItem: (item: WatchlistItem) => void;
  savedIds: Set<number>;
}

function fmtCatalog(n: number): string {
  return `C-${String(n).padStart(4, "0")}`;
}

export function CommandPalette({
  open,
  onOpenChange,
  onAdded,
  onOpenItem,
  savedIds,
}: Props) {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "add";
    return (localStorage.getItem("cm_palette_mode") as Mode) || "add";
  });
  const [q, setQ] = useState("");
  const [tmdbHits, setTmdbHits] = useState<TmdbHit[]>([]);
  const [findResp, setFindResp] = useState<NlSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // cmdk-controlled highlighted value. Drives the preview pane so the
  // user can see full details before pressing Enter to add.
  const [highlightValue, setHighlightValue] = useState<string>("");
  // Lazy cache of /api/title/:type/:id results (genres + providers +
  // runtime + imdb rating) keyed by "type:id" — re-hovering an item is
  // instant after the first fetch.
  const [titleCache, setTitleCache] = useState<Map<string, Title>>(
    new Map(),
  );

  useEffect(() => {
    localStorage.setItem("cm_palette_mode", mode);
  }, [mode]);

  // Reset query when palette closes.
  useEffect(() => {
    if (!open) {
      setQ("");
      setTmdbHits([]);
      setFindResp(null);
      setLoading(false);
    }
  }, [open]);

  // Debounced effect for the input.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setTmdbHits([]);
      setFindResp(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const delay = mode === "add" ? 250 : 350;
    debounceRef.current = setTimeout(() => {
      if (mode === "add") {
        void runTmdb(q);
      } else {
        void runFind(q);
      }
    }, delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, mode]);

  async function runTmdb(query: string) {
    const res = (await api<TmdbHit[]>(
      `/api/search/tmdb?q=${encodeURIComponent(query)}`,
    )) as ApiResponse<TmdbHit[]>;
    setLoading(false);
    if (res.ok) setTmdbHits(res.data);
    else setTmdbHits([]);
  }

  async function runFind(query: string) {
    const res = (await api<NlSearchResponse>("/api/search", {
      method: "POST",
      body: JSON.stringify({ query }),
    })) as ApiResponse<NlSearchResponse>;
    setLoading(false);
    if (res.ok) setFindResp(res.data);
    else setFindResp(null);
  }

  // Resolve the highlighted hit (or null when nothing applicable).
  const previewHit: TmdbHit | null =
    mode === "add"
      ? tmdbHits.find((h) => String(h.id) === highlightValue) ?? null
      : null;
  const previewKey = previewHit
    ? `${previewHit.type}:${previewHit.id}`
    : null;
  const previewDetail =
    previewKey && titleCache.has(previewKey)
      ? titleCache.get(previewKey)!
      : null;

  // Lazy-fetch full Title detail for the previewed row. Cached so
  // navigating the list with arrow keys doesn't re-fetch already-seen
  // items.
  useEffect(() => {
    if (!previewHit || !previewKey) return;
    if (titleCache.has(previewKey)) return;
    let cancelled = false;
    (async () => {
      const res = (await api<Title>(
        `/api/title/${previewHit.type}/${previewHit.id}`,
      )) as ApiResponse<Title>;
      if (cancelled || !res.ok) return;
      setTitleCache((prev) => {
        const next = new Map(prev);
        next.set(previewKey, res.data);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [previewHit, previewKey, titleCache]);

  async function add(hit: TmdbHit) {
    if (adding) return;
    setAdding(hit.id);
    const res = await api("/api/watchlist", {
      method: "POST",
      body: JSON.stringify({ tmdb_id: hit.id, type: hit.type }),
    });
    setAdding(null);
    if (res.ok) {
      onAdded(hit.id);
      onOpenChange(false);
    }
  }

  // Tab toggles mode; only fires when palette is open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Tab") {
        e.preventDefault();
        setMode((m) => (m === "add" ? "find" : "add"));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const placeholder =
    mode === "add"
      ? "Search TMDB to add a film or series…"
      : 'Ask in plain English — "dark thrillers with Jeremy Strong"…';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatedDialogContent
        open={open}
        side="center"
        className="!top-[26%] !translate-y-0 max-h-[min(78vh,720px)] overflow-hidden !w-[min(880px,calc(100vw-32px))]"
        title="Command palette"
      >
        <Command
          shouldFilter={false}
          className="flex flex-col"
          loop
          value={highlightValue}
          onValueChange={setHighlightValue}
        >
          <div className="flex items-center gap-3 border-b border-[var(--rule)] px-5 py-4">
            <span className="font-mono text-[14px] text-[var(--accent)]">⌘</span>
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder={placeholder}
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-[16px] text-[var(--ink)] placeholder:text-[var(--paper-faint)] focus:outline-none"
            />
            <ModeChip mode={mode} onChange={setMode} />
          </div>

          <div className="flex min-h-[260px] flex-1 overflow-hidden">
          <Command.List className="max-h-[62vh] min-w-0 flex-1 overflow-y-auto px-2 py-2">
            {loading && (
              <div className="px-3 py-6 text-center font-mono text-[11px] uppercase tracking-wider text-[var(--paper-faint)]">
                {mode === "add" ? "Searching TMDB…" : "Parsing your query…"}
              </div>
            )}

            {!loading && q.trim() && mode === "add" && tmdbHits.length === 0 && (
              <Command.Empty className="px-3 py-6 text-center text-[13px] text-[var(--paper-faint)]">
                Nothing matched. Try a different spelling, or a year.
              </Command.Empty>
            )}

            {!loading && mode === "add" && tmdbHits.length > 0 && (
              <Command.Group
                heading="Add to your watchlist"
                className="[&>[cmdk-group-heading]]:font-label [&>[cmdk-group-heading]]:px-3 [&>[cmdk-group-heading]]:py-2 [&>[cmdk-group-heading]]:text-[10px] [&>[cmdk-group-heading]]:text-[var(--paper-faint)]"
              >
                {tmdbHits.slice(0, 10).map((hit) => {
                  const saved = savedIds.has(hit.id);
                  return (
                    <Command.Item
                      key={`${hit.type}-${hit.id}`}
                      value={String(hit.id)}
                      onSelect={() => {
                        if (saved) return;
                        void add(hit);
                      }}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] aria-selected:bg-[var(--paper-3)]",
                        saved && "opacity-55",
                      )}
                    >
                      <TmdbThumb hit={hit} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[var(--ink)]">{hit.title}</div>
                        <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
                          {hit.release_date?.slice(0, 4) ?? "—"} ·{" "}
                          {hit.type === "series" ? "series" : "movie"}
                          {typeof hit.vote_average === "number" && hit.vote_average > 0
                            ? ` · ★ ${hit.vote_average.toFixed(1)}`
                            : ""}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
                        {saved ? "saved" : adding === hit.id ? "adding…" : "↵ add"}
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {!loading && mode === "find" && findResp && (
              <>
                <ParsedChipsLine parsed={findResp.parsed} />
                {findResp.results.length === 0 ? (
                  <div className="px-3 py-5 text-center text-[13px] text-[var(--paper-faint)]">
                    No matches in your watchlist for that query.
                  </div>
                ) : (
                  <Command.Group
                    heading="Found in your watchlist"
                    className="[&>[cmdk-group-heading]]:font-label [&>[cmdk-group-heading]]:px-3 [&>[cmdk-group-heading]]:py-2 [&>[cmdk-group-heading]]:text-[10px] [&>[cmdk-group-heading]]:text-[var(--paper-faint)]"
                  >
                    {findResp.results.slice(0, 10).map((it) => (
                      <Command.Item
                        key={it.title.id}
                        value={String(it.title.id)}
                        onSelect={() => {
                          onOpenItem(it);
                          onOpenChange(false);
                        }}
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] aria-selected:bg-[var(--paper-3)]"
                      >
                        <TmdbThumb hit={asHit(it)} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[var(--ink)]">
                            {it.title.title}
                          </div>
                          <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
                            {fmtCatalog(it.catalog_no)} · {it.title.type} ·{" "}
                            {it.title.release_date?.slice(0, 4) ?? "—"}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
                          ↵ open
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </>
            )}

            {!q.trim() && (
              <div className="px-3 py-6 text-[13px] text-[var(--paper-faint)]">
                <div className="font-label mb-2 text-[10px]">Tips</div>
                <ul className="space-y-1.5">
                  <li>
                    <kbd className="font-mono text-[10px] text-[var(--ink)]">Tab</kbd>{" "}
                    — switch between Add ↔ Find
                  </li>
                  <li>
                    <kbd className="font-mono text-[10px] text-[var(--ink)]">↵</kbd>{" "}
                    — confirm the highlighted item
                  </li>
                  <li>
                    <kbd className="font-mono text-[10px] text-[var(--ink)]">Esc</kbd>{" "}
                    — close
                  </li>
                </ul>
              </div>
            )}
          </Command.List>

          {/* Side preview pane — only shown in Add mode when a row is
              highlighted. Hidden on narrow viewports where the palette
              already wraps tightly. */}
          {previewHit && (
            <aside className="hidden w-[300px] shrink-0 overflow-y-auto border-l border-[var(--rule)] bg-[var(--paper-3)]/30 p-4 md:block">
              <PalettePreview hit={previewHit} detail={previewDetail} />
            </aside>
          )}
          </div>

          <div className="border-t border-[var(--rule)] px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
            <span>{mode === "add" ? "Add" : "Find"}</span>
            <span className="mx-2">·</span>
            <span>Tab to switch · Esc to close</span>
          </div>
        </Command>
      </AnimatedDialogContent>
    </Dialog>
  );
}

function ModeChip({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--rule)] bg-[var(--paper-3)] p-0.5">
      {(["add", "find"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          aria-pressed={mode === m}
          className={cn(
            "rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition",
            mode === m
              ? "bg-[var(--ink)] text-[var(--paper)]"
              : "text-[var(--paper-dim)] hover:text-[var(--ink)]",
          )}
        >
          {m === "add" ? "Add" : "Find"}
        </button>
      ))}
    </div>
  );
}

function ParsedChipsLine({ parsed }: { parsed: ParsedQuery }) {
  const f = parsed.filters;
  const chips: string[] = [];
  if (f.type) chips.push(...f.type);
  if (f.genres) chips.push(...f.genres);
  if (f.exclude_genres) chips.push(...f.exclude_genres.map((g) => `not ${g}`));
  if (typeof f.min_rating === "number") chips.push(`≥ ${f.min_rating}★`);
  if (f.release_after) chips.push(`after ${f.release_after.slice(0, 4)}`);
  if (f.release_before) chips.push(`before ${f.release_before.slice(0, 4)}`);
  if (f.cast) chips.push(...f.cast);
  if (f.providers) chips.push(...f.providers);

  if (chips.length === 0 && !parsed.semantic_query) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--rule)] px-3 py-2.5">
      <span className="font-label text-[10px] text-[var(--paper-faint)]">Parsed</span>
      {chips.map((c, i) => (
        <span
          key={i}
          className="rounded-full border border-[var(--rule)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-dim)]"
        >
          {c}
        </span>
      ))}
      {parsed.semantic_query && (
        <span className="rounded-full border border-[var(--accent)] bg-[var(--accent)]/8 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--accent)]">
          mood: {parsed.semantic_query}
        </span>
      )}
    </div>
  );
}

function PalettePreview({
  hit,
  detail,
}: {
  hit: TmdbHit;
  /** Full Title from /api/title/:type/:id once loaded — provides
   *  genres, providers, runtime, imdb rating. Null while loading. */
  detail: Title | null;
}) {
  const poster = posterUrl(hit.poster_path, "w342");
  const year = hit.release_date?.slice(0, 4) ?? "—";
  const tmdbRating =
    typeof hit.vote_average === "number" && hit.vote_average > 0
      ? hit.vote_average.toFixed(1)
      : null;
  const imdb = detail?.imdb_rating ? detail.imdb_rating.toFixed(1) : null;
  const runtime = detail?.runtime
    ? detail.runtime >= 60
      ? `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}m`
      : `${detail.runtime}m`
    : null;
  const genres = detail?.genres ?? [];
  const providers = selectProviders(detail?.providers ?? null, 5);

  return (
    <div>
      <div
        className="overflow-hidden rounded-md border border-[var(--rule)] bg-[var(--paper-3)]"
        style={{ aspectRatio: "2 / 3" }}
      >
        {poster ? (
          <img
            src={poster}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="grid h-full place-items-center font-label text-[10px] text-[var(--paper-faint)]">
            no poster
          </div>
        )}
      </div>
      <h3
        className="mt-3 font-display-sm leading-tight text-[var(--ink)]"
        style={{ fontVariationSettings: '"opsz" 22, "wght" 700, "SOFT" 30' }}
      >
        {hit.title}
      </h3>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-dim)]">
        <span>{year}</span>
        <span aria-hidden>·</span>
        <span>{hit.type}</span>
        {runtime && (
          <>
            <span aria-hidden>·</span>
            <span>{runtime}</span>
          </>
        )}
        {tmdbRating && (
          <>
            <span aria-hidden>·</span>
            <span>★ {tmdbRating}</span>
          </>
        )}
        {imdb && (
          <>
            <span aria-hidden>·</span>
            <span>★ {imdb} imdb</span>
          </>
        )}
      </div>
      <p className="mt-2 line-clamp-6 text-[12px] leading-snug text-[var(--paper-dim)]">
        {hit.overview || (
          <span className="italic text-[var(--paper-faint)]">
            No synopsis on file.
          </span>
        )}
      </p>

      {genres.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {genres.map((g) => (
            <span
              key={g}
              className="rounded-full border border-[var(--rule)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--paper-dim)]"
            >
              {g}
            </span>
          ))}
        </div>
      )}

      {providers.length > 0 && (
        <div className="mt-3">
          <div className="font-label text-[9px] text-[var(--paper-faint)]">
            Stream on
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {providers.map((p) =>
              p.logo ? (
                <img
                  key={p.name}
                  src={`https://image.tmdb.org/t/p/w45${p.logo}`}
                  alt={p.name}
                  title={p.name}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-5 w-5 rounded-[4px] border border-[var(--rule)] object-cover"
                />
              ) : (
                <span
                  key={p.name}
                  title={p.name}
                  className="grid h-5 w-5 place-items-center rounded-[4px] border border-[var(--rule)] bg-[var(--paper-3)] font-mono text-[9px] text-[var(--paper-dim)]"
                >
                  {p.name.slice(0, 1)}
                </span>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TmdbThumb({ hit }: { hit: { poster_path: string | null } }) {
  const src = posterUrl(hit.poster_path, "w185");
  if (!src) {
    return <div className="h-12 w-8 shrink-0 rounded bg-[var(--paper-3)]" />;
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="h-12 w-8 shrink-0 rounded object-cover"
    />
  );
}

function asHit(it: WatchlistItem) {
  return {
    id: it.title.id,
    type: it.title.type,
    title: it.title.title,
    release_date: it.title.release_date,
    poster_path: it.title.poster_path,
    overview: it.title.overview,
    vote_average: it.title.vote_average,
  };
}
