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

  // Resolve the highlighted hit + (when available) its full Title detail
  // so the preview pane can show genres / providers / cast in both modes.
  // Find-mode results already carry a full Title from /api/search; only
  // Add-mode (TMDB search) hits need the lazy /api/title fetch.
  const findHighlightItem =
    mode === "find" && findResp
      ? findResp.results.find((it) => String(it.title.id) === highlightValue) ??
        null
      : null;
  const previewHit: TmdbHit | null =
    mode === "add"
      ? tmdbHits.find((h) => String(h.id) === highlightValue) ?? null
      : findHighlightItem
        ? asHit(findHighlightItem)
        : null;
  const previewKey = previewHit
    ? `${previewHit.type}:${previewHit.id}`
    : null;
  const previewDetail =
    findHighlightItem?.title ??
    (previewKey && titleCache.has(previewKey)
      ? titleCache.get(previewKey)!
      : null);

  // Lazy-fetch full Title detail for the Add-mode preview only. Find-mode
  // results carry a full Title already, so we skip the round-trip there.
  useEffect(() => {
    if (mode !== "add") return;
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
  }, [mode, previewHit, previewKey, titleCache]);

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
        // Anchored in the upper third instead of dead-centre so the
        // input lands near eye-level and the results occupy the visual
        // centre band (Linear / Raycast / Spotlight pattern).
        // top-[12vh] + max-h 76vh keeps a comfortable ≈12vh tail of
        // breathing room at the bottom even on a long result list.
        className="!top-[12vh] !translate-y-0 max-h-[min(76vh,720px)] overflow-hidden !w-[min(880px,calc(100vw-32px))]"
        title="Command palette"
      >
        <Command
          shouldFilter={false}
          className="flex flex-col"
          loop
          value={highlightValue}
          onValueChange={setHighlightValue}
        >
          <div className="flex items-center gap-3 border-b border-[var(--rule)] px-5 py-3.5">
            <span
              aria-hidden
              className="font-mono text-[13px] text-[var(--paper-faint)]"
            >
              ⌘
            </span>
            <Command.Input
              value={q}
              onValueChange={setQ}
              placeholder={placeholder}
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-[15.5px] text-[var(--ink)] placeholder:text-[var(--paper-faint)] focus:outline-none"
            />
            <ModeChip mode={mode} onChange={setMode} />
          </div>

          <div className="flex flex-1 overflow-hidden">
          <Command.List className="max-h-[62vh] min-w-0 flex-1 overflow-y-auto px-2 py-2">
            {loading && (
              <div className="flex items-center gap-3 px-4 py-5 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
                <span className="relative inline-block h-[2px] w-12 overflow-hidden rounded bg-[var(--paper-3)]">
                  <span className="absolute inset-y-0 left-0 w-1/3 animate-pulse bg-[var(--accent)]" />
                </span>
                <span>
                  {mode === "add" ? "Searching TMDB…" : "Parsing your query…"}
                </span>
              </div>
            )}

            {!loading && q.trim() && mode === "add" && tmdbHits.length === 0 && (
              <Command.Empty className="px-3 py-8">
                {looksLikeFindQuery(q) ? (
                  <div className="text-center">
                    <div className="font-label text-[10px] text-[var(--paper-faint)]">
                      Nothing on TMDB matched that
                    </div>
                    <p className="mt-2 text-[13px] leading-snug text-[var(--paper-dim)]">
                      That looks like a description, not a title.
                      <br />
                      Switch to <span className="text-[var(--ink)]">Find</span>{" "}
                      to search your watchlist by mood.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMode("find")}
                      className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--paper)] transition hover:opacity-90"
                    >
                      Try in Find <span aria-hidden>→</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-[13px] text-[var(--paper-faint)]">
                    Nothing matched. Try a different spelling, or a year.
                  </div>
                )}
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
                            {it.title.type} ·{" "}
                            {it.title.release_date?.slice(0, 4) ?? "—"}
                            {typeof it.title.vote_average === "number" &&
                            it.title.vote_average > 0
                              ? ` · ★ ${it.title.vote_average.toFixed(1)}`
                              : ""}
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
              <div className="grid place-items-center px-6 py-10">
                <div className="w-full max-w-[360px] text-center">
                  <div className="font-label text-[10px] text-[var(--paper-faint)]">
                    {mode === "add" ? "Add a title" : "Find in your watchlist"}
                  </div>
                  <h3
                    className="mt-1.5 font-display-sm text-[20px] leading-tight text-[var(--ink)]"
                    style={{ fontVariationSettings: '"opsz" 24, "wght" 700, "SOFT" 30' }}
                  >
                    {mode === "add"
                      ? "Search TMDB by title."
                      : "Ask in plain English."}
                  </h3>
                  <p className="mt-2 text-[12.5px] leading-snug text-[var(--paper-dim)]">
                    {mode === "add"
                      ? "Type a film or series name. Press ↵ to add the highlighted result."
                      : "Try things like “dark thrillers with Jeremy Strong” or “lighter than 90 minutes”."}
                  </p>
                  <ul className="mt-5 inline-flex flex-col items-start gap-2 text-[12px] text-[var(--paper-dim)]">
                    <li className="flex items-center gap-2">
                      <Kbd>Tab</Kbd>
                      <span>switch between Add ↔ Find</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Kbd>↵</Kbd>
                      <span>confirm the highlighted row</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Kbd>Esc</Kbd>
                      <span>close the palette</span>
                    </li>
                  </ul>
                </div>
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

          <div className="flex items-center justify-between border-t border-[var(--rule)] px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
            <span>{mode === "add" ? "Add a title" : "Find in your watchlist"}</span>
            <span className="flex items-center gap-1.5">
              <Kbd>Esc</Kbd>
              <span>to close</span>
            </span>
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
  // Segmented two-tab toggle. Single visual structure: text + accent
  // underline for the active mode, muted text for the inactive one. Was
  // previously two competing pill styles (solid block vs text-on-fill)
  // that read as separate buttons rather than a unified toggle.
  return (
    <div
      role="tablist"
      aria-label="Palette mode"
      className="flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wider"
    >
      {(["add", "find"] as Mode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            className={cn(
              "relative px-1.5 py-1 transition",
              active
                ? "text-[var(--ink)]"
                : "text-[var(--paper-faint)] hover:text-[var(--paper-dim)]",
            )}
          >
            {m === "add" ? "Add" : "Find"}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-1 -bottom-0.5 h-[1.5px] bg-[var(--accent)]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-[var(--rule)] bg-[var(--paper-3)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-dim)]">
      {children}
    </kbd>
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

/** Heuristic: does this query look like a natural-language Find query
 *  rather than a TMDB title lookup?
 *
 *  TMDB title searches are typically: a literal title, sometimes
 *  followed by a year. "The Bear", "Blade Runner 2049", "Severance".
 *  Find-mode queries are descriptive: "dark thrillers with Jeremy
 *  Strong", "feel-good comedies from the 90s", "sci-fi movie with a
 *  high rating".
 *
 *  Signals we treat as "looks like Find":
 *    - 5+ tokens (most titles are 1–4 words)
 *    - contains a stop-word that's almost never in a title ("with",
 *      "from", "by", "about", "starring", "rated", "rating", "than")
 *    - contains a descriptor word that's a category not a title
 *      ("dark", "feel-good", "high", "low", "best", "worst",
 *      "underrated", "recent")
 *    - contains a comparative ("more than", "less than", "≥", "≤", "+")
 *    - starts with a verb-y prompt ("show me", "suggest", "find",
 *      "recommend") */
function looksLikeFindQuery(q: string): boolean {
  const text = q.trim().toLowerCase();
  if (!text) return false;
  const tokens = text.split(/\s+/);
  if (tokens.length >= 6) return true;
  const findIndicators = [
    "with",
    "from",
    "about",
    "starring",
    "rated",
    "rating",
    "than",
    "by",
    "show me",
    "suggest",
    "find me",
    "recommend",
    "dark",
    "feel-good",
    "feel good",
    "underrated",
    "high",
    "low",
    "best",
    "worst",
    "recent",
    "older",
    "newer",
    "more than",
    "less than",
    "minutes",
    "hour",
    "hours",
    "minute",
    "season",
    "seasons",
  ];
  for (const ind of findIndicators) {
    if (text.includes(ind)) return true;
  }
  // Comparative shorthands: "8+", "≥ 8", "rating > 7"
  if (/\b\d+\s*\+/.test(text)) return true;
  if (/[≥≤<>]/.test(text)) return true;
  return false;
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
