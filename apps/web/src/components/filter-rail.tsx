import { useMemo } from "react";
import type {
  WatchlistFilters,
  WatchlistItem,
  WatchlistSort,
} from "@cinemood/shared";
import { Slider } from "./slider";
import { Dropdown } from "./dropdown";
import { SORT_LABELS, deriveFacets } from "@/lib/use-watchlist";
import { cn } from "@/lib/utils";

interface Props {
  items: WatchlistItem[] | null;
  filters: WatchlistFilters;
  onPatch: <K extends keyof WatchlistFilters>(
    key: K,
    value: WatchlistFilters[K],
  ) => void;
  onReset: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1920;
const RUNTIME_MIN = 0;
const RUNTIME_MAX = 240;
const DECADES: { label: string; from: number; to: number }[] = [
  { label: "'70s", from: 1970, to: 1979 },
  { label: "'80s", from: 1980, to: 1989 },
  { label: "'90s", from: 1990, to: 1999 },
  { label: "'00s", from: 2000, to: 2009 },
  { label: "'10s", from: 2010, to: 2019 },
  { label: "'20s", from: 2020, to: 2029 },
];

/** Active / inactive class for any pill in the rail (decade pills, genre
 *  chips, streaming chips, and the type/status PillGroup all share this). */
function pillClass(active: boolean, mono = false): string {
  const base = mono
    ? "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition"
    : "rounded-full border px-2.5 py-0.5 text-[11.5px] transition";
  if (active) {
    return cn(base, "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)]");
  }
  return cn(base, "border-[var(--rule)] text-[var(--paper-dim)] hover:text-[var(--ink)]");
}

export function FilterRail({ items, filters, onPatch, onReset }: Props) {
  const facets = useMemo(() => deriveFacets(items), [items]);

  return (
    <aside className="space-y-7 pr-2 font-body text-[13px] text-[var(--paper-dim)]">
      <Section label="Type">
        <PillGroup
          options={[
            { v: "movie", label: "Movies" },
            { v: "series", label: "Series" },
          ]}
          value={filters.type}
          onChange={(v) => onPatch("type", v as WatchlistFilters["type"])}
        />
      </Section>

      <Section label="Status">
        <PillGroup
          options={[
            { v: undefined, label: "All" },
            { v: "pending", label: "To watch" },
            { v: "watching", label: "Watching" },
            { v: "watched", label: "Watched" },
          ]}
          value={filters.status}
          onChange={(v) => onPatch("status", v as WatchlistFilters["status"])}
          allowReset={false}
        />
      </Section>

      <Section label="Sort">
        <Dropdown
          label="Sort the watchlist"
          value={filters.sort ?? "added_desc"}
          options={Object.entries(SORT_LABELS).map(([value, label]) => ({
            value: value as WatchlistSort,
            label,
          }))}
          onChange={(v) => onPatch("sort", v)}
        />
      </Section>

      {facets.genres.length > 0 && (
        <Section label="Genre">
          {/* Chip cloud instead of a tall checkbox column. Each genre is
              a small rounded pill; active state mirrors the decade and
              type pills so the rail has one visual language for
              binary-toggle facets. Single-select to match the existing
              state shape (`filters.genre` is one string). */}
          <div className="flex flex-wrap gap-1.5">
            {facets.genres.map((g) => {
              const active = filters.genre === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => onPatch("genre", active ? undefined : g)}
                  aria-pressed={active}
                  className={pillClass(active)}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section label="Release year">
        <div className="space-y-3">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
            <span>{filters.year_min ?? MIN_YEAR}</span>
            <span>{filters.year_max ?? CURRENT_YEAR}</span>
          </div>
          <Slider
            min={MIN_YEAR}
            max={CURRENT_YEAR}
            step={1}
            value={[
              filters.year_min ?? MIN_YEAR,
              filters.year_max ?? CURRENT_YEAR,
            ]}
            onValueChange={(v: number[]) => {
              const [lo, hi] = v;
              onPatch("year_min", lo === MIN_YEAR ? undefined : lo);
              onPatch("year_max", hi === CURRENT_YEAR ? undefined : hi);
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            {DECADES.map((d) => {
              const active =
                filters.year_min === d.from && filters.year_max === d.to;
              return (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => {
                    if (active) {
                      onPatch("year_min", undefined);
                      onPatch("year_max", undefined);
                    } else {
                      onPatch("year_min", d.from);
                      onPatch("year_max", d.to);
                    }
                  }}
                  className={pillClass(active, true)}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section label="Rating">
        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
            <span>≥ {(filters.min_rating ?? 0).toFixed(1)}</span>
            <span>10</span>
          </div>
          <Slider
            min={0}
            max={10}
            step={0.5}
            value={[filters.min_rating ?? 0]}
            onValueChange={(v: number[]) => {
              const x = v[0]!;
              onPatch("min_rating", x === 0 ? undefined : x);
            }}
          />
        </div>
      </Section>

      <Section label="Runtime">
        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
            <span>{filters.runtime_min ?? RUNTIME_MIN}m</span>
            <span>{filters.runtime_max ?? RUNTIME_MAX}m</span>
          </div>
          <Slider
            min={RUNTIME_MIN}
            max={RUNTIME_MAX}
            step={15}
            value={[
              filters.runtime_min ?? RUNTIME_MIN,
              filters.runtime_max ?? RUNTIME_MAX,
            ]}
            onValueChange={(v: number[]) => {
              const [lo, hi] = v;
              onPatch("runtime_min", lo === RUNTIME_MIN ? undefined : lo);
              onPatch("runtime_max", hi === RUNTIME_MAX ? undefined : hi);
            }}
          />
        </div>
      </Section>

      {facets.providers.length > 0 && (
        <Section label="Streaming">
          {/* Multi-select chip cloud — same shape as genres but the
              behaviour adds/removes from a set. */}
          <div className="flex flex-wrap gap-1.5">
            {facets.providers.slice(0, 12).map((provider) => {
              const set = new Set(filters.providers ?? []);
              const active = set.has(provider);
              return (
                <button
                  key={provider}
                  type="button"
                  onClick={() => {
                    if (active) set.delete(provider);
                    else set.add(provider);
                    const arr = [...set];
                    onPatch("providers", arr.length > 0 ? arr : undefined);
                  }}
                  aria-pressed={active}
                  className={pillClass(active)}
                >
                  {provider}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <div className="pt-2">
        <button
          type="button"
          onClick={onReset}
          className="font-label text-[10px] text-[var(--paper-faint)] underline-offset-4 hover:text-[var(--accent)] hover:underline"
        >
          Reset all filters
        </button>
      </div>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 font-label text-[10px] text-[var(--paper-faint)]">
        {label}
      </div>
      {children}
    </section>
  );
}

function PillGroup<T extends string | undefined>({
  options,
  value,
  onChange,
  allowReset = true,
}: {
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  allowReset?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(({ v, label }) => {
        const active = value === v;
        return (
          <button
            key={String(v ?? "_none")}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (active && allowReset) onChange(undefined as T);
              else onChange(v);
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11.5px] transition",
              active
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)]"
                : "border-[var(--rule)] text-[var(--paper-dim)] hover:text-[var(--ink)]",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
