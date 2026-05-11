import { useMemo } from "react";
import type {
  WatchlistFilters,
  WatchlistItem,
  WatchlistSort,
} from "@cinemood/shared";
import { Slider } from "./slider";
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
const DECADES: { label: string; from: number; to: number }[] = [
  { label: "'70s", from: 1970, to: 1979 },
  { label: "'80s", from: 1980, to: 1989 },
  { label: "'90s", from: 1990, to: 1999 },
  { label: "'00s", from: 2000, to: 2009 },
  { label: "'10s", from: 2010, to: 2019 },
  { label: "'20s", from: 2020, to: 2029 },
];

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
            { v: "watched", label: "Watched" },
          ]}
          value={filters.status}
          onChange={(v) => onPatch("status", v as WatchlistFilters["status"])}
          allowReset={false}
        />
      </Section>

      <Section label="Sort">
        <select
          value={filters.sort ?? "added_desc"}
          onChange={(e) =>
            onPatch("sort", e.target.value as WatchlistSort)
          }
          className="h-9 w-full rounded-md border border-[var(--rule)] bg-[var(--paper-2)] px-2.5 text-[12px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
        >
          {Object.entries(SORT_LABELS).map(([v, label]) => (
            <option key={v} value={v} className="bg-[var(--paper-2)]">
              {label}
            </option>
          ))}
        </select>
      </Section>

      {facets.genres.length > 0 && (
        <Section label="Genre">
          <div className="space-y-1.5">
            {facets.genres.map((g) => {
              const active = filters.genre === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => onPatch("genre", active ? undefined : g)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] transition",
                    active
                      ? "bg-[var(--paper-3)] text-[var(--ink)]"
                      : "hover:bg-[var(--paper-3)]/60",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-3.5 w-3.5 place-items-center rounded-[3px] border",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)]"
                        : "border-[var(--rule)]",
                    )}
                    aria-hidden
                  >
                    {active ? (
                      <svg width="9" height="9" viewBox="0 0 12 12">
                        <path d="M2 6.2l2.6 2.6L10 3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="truncate">{g}</span>
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
                  className={cn(
                    "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition",
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)]"
                      : "border-[var(--rule)] text-[var(--paper-dim)] hover:text-[var(--ink)]",
                  )}
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
            <span>{filters.runtime_min ?? 0}m</span>
            <span>{filters.runtime_max ?? 240}m</span>
          </div>
          <Slider
            min={0}
            max={240}
            step={15}
            value={[filters.runtime_min ?? 0, filters.runtime_max ?? 240]}
            onValueChange={(v: number[]) => {
              const [lo, hi] = v;
              onPatch("runtime_min", lo === 0 ? undefined : lo);
              onPatch("runtime_max", hi === 240 ? undefined : hi);
            }}
          />
        </div>
      </Section>

      {facets.providers.length > 0 && (
        <Section label="Streaming">
          <div className="space-y-1.5">
            {facets.providers.slice(0, 12).map((p) => {
              const set = new Set(filters.providers ?? []);
              const active = set.has(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    if (active) set.delete(p);
                    else set.add(p);
                    const arr = [...set];
                    onPatch("providers", arr.length > 0 ? arr : undefined);
                  }}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] transition",
                    active
                      ? "bg-[var(--paper-3)] text-[var(--ink)]"
                      : "hover:bg-[var(--paper-3)]/60",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-3.5 w-3.5 place-items-center rounded-[3px] border",
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)]"
                        : "border-[var(--rule)]",
                    )}
                    aria-hidden
                  >
                    {active ? (
                      <svg width="9" height="9" viewBox="0 0 12 12">
                        <path d="M2 6.2l2.6 2.6L10 3.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="truncate">{p}</span>
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
