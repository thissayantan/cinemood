import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { User, WatchlistItem } from "@cinemood/shared";
import { api } from "@/lib/api";
import { useMotionConfig } from "@/lib/motion";
import { useWatchlist } from "@/lib/use-watchlist";
import { useWatchlistIds } from "@/lib/use-watchlist-ids";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { TopBar } from "@/components/top-bar";
import { FilterRail } from "@/components/filter-rail";
import { ActiveChips } from "@/components/active-chips";
import { PosterCard } from "@/components/poster-card";
import { TitleDetailDialog } from "@/components/title-detail-dialog";
import { CommandPalette } from "@/components/command-palette";
import { Sheet } from "@/components/sheet";
import { EmptyWatchlist } from "@/components/empty-watchlist";
import { RouteTitle } from "@/components/route-title";
import { ShortcutsSheet } from "@/components/shortcuts-sheet";
import { WelcomeOverlay } from "@/components/welcome-overlay";

function activeFilterCount(filters: ReturnType<typeof useWatchlist>["filters"]): number {
  let n = 0;
  if (filters.type) n++;
  if (filters.status) n++;
  if (filters.genre) n++;
  if (filters.year_min !== undefined || filters.year_max !== undefined) n++;
  if (typeof filters.min_rating === "number") n++;
  if (filters.runtime_min !== undefined || filters.runtime_max !== undefined) n++;
  if (filters.providers && filters.providers.length > 0) n++;
  return n;
}

export default function HomePage({ user }: { user: User }) {
  const m = useMotionConfig();
  const [reloadKey, setReloadKey] = useState(0);
  const wl = useWatchlist(reloadKey);
  const { ids, add: addId, remove: removeId } = useWatchlistIds();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<WatchlistItem | null>(null);

  useKeyboardShortcuts({
    onOpenPalette: () => setPaletteOpen((o) => !o),
    onOpenShortcuts: () => setShortcutsOpen(true),
  });

  // Keep an explicit Esc listener for the welcome flow — keyboard shortcuts
  // hook ignores Esc since Radix handles it inside dialogs.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShortcutsOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const latestCatalogNo = useMemo(() => {
    if (!wl.all) return 0;
    return wl.all.reduce((acc, it) => Math.max(acc, it.catalog_no), 0);
  }, [wl.all]);

  const handleAdded = useCallback(
    (id: number) => {
      addId(id);
      setReloadKey((k) => k + 1);
    },
    [addId],
  );

  const handleToggleWatched = useCallback(
    async (item: WatchlistItem) => {
      const next = item.status === "watched" ? "pending" : "watched";
      const res = await api(`/api/watchlist/${item.title.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        setReloadKey((k) => k + 1);
        setDetailItem((prev) =>
          prev && prev.title.id === item.title.id
            ? { ...prev, status: next, watched_at: next === "watched" ? Math.floor(Date.now() / 1000) : null }
            : prev,
        );
      }
    },
    [],
  );

  const handleRemove = useCallback(
    async (item: WatchlistItem) => {
      const res = await api(`/api/watchlist/${item.title.id}`, { method: "DELETE" });
      if (res.ok) {
        removeId(item.title.id);
        setReloadKey((k) => k + 1);
        setDetailItem((prev) =>
          prev && prev.title.id === item.title.id ? null : prev,
        );
      }
    },
    [removeId],
  );

  const items = wl.visible;
  const isEmpty = wl.all !== null && wl.all.length === 0;
  const filtersCount = activeFilterCount(wl.filters);

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <RouteTitle />
      <TopBar
        user={user}
        latestCatalogNo={latestCatalogNo}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filtersBadge={filtersCount}
      />

      {isEmpty ? (
        <main className="mx-auto max-w-[1440px] px-5 pt-10 md:px-8">
          <EmptyWatchlist onAddClick={() => setPaletteOpen(true)} />
        </main>
      ) : (
        <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-x-10 px-5 pt-6 md:grid-cols-[260px_minmax(0,1fr)] md:px-8 md:pt-8">
          <div className="hidden md:block">
            <FilterRail
              items={wl.all}
              filters={wl.filters}
              onPatch={wl.patchFilter}
              onReset={wl.resetFilters}
            />
          </div>

          <section>
            <ActiveChips
              filters={wl.filters}
              total={items?.length ?? 0}
              onPatch={wl.patchFilter}
              onReset={wl.resetFilters}
            />

            {wl.loading && !items ? (
              <SkeletonGrid />
            ) : !items || items.length === 0 ? (
              <NoMatches />
            ) : (
              <motion.div
                layout
                className="mt-6 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                transition={
                  m.reduced ? { duration: 0 } : { duration: m.durBase, ease: m.easeOutQuint }
                }
              >
                {items.map((it, i) => (
                  <PosterCard
                    key={it.title.id}
                    item={it}
                    index={i}
                    onOpen={() => setDetailItem(it)}
                    onToggleWatched={() => handleToggleWatched(it)}
                    onRemove={() => handleRemove(it)}
                  />
                ))}
              </motion.div>
            )}
          </section>
        </main>
      )}

      <TitleDetailDialog
        item={detailItem}
        open={!!detailItem}
        onOpenChange={(open) => {
          if (!open) setDetailItem(null);
        }}
        onToggleWatched={handleToggleWatched}
        onRemove={handleRemove}
      />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onAdded={handleAdded}
        onOpenItem={(it) => setDetailItem(it)}
        savedIds={ids}
      />

      <ShortcutsSheet open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      <WelcomeOverlay name={user.name} />

      <Sheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        className="px-5 py-6"
        title="Filter your watchlist"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-label text-[10px] text-[var(--paper-faint)]">
            Filter your watchlist
          </span>
          <button
            type="button"
            onClick={() => setFilterSheetOpen(false)}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-full border border-[var(--rule)] text-[var(--paper-dim)] hover:text-[var(--ink)]"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <FilterRail
          items={wl.all}
          filters={wl.filters}
          onPatch={wl.patchFilter}
          onReset={wl.resetFilters}
        />
      </Sheet>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[2/3] animate-pulse rounded-xl border border-[var(--rule)] bg-[var(--paper-2)]"
        />
      ))}
    </div>
  );
}

function NoMatches() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <p className="font-display-sm text-[22px] text-[var(--ink)]">
        Nothing in your collection matches that.
      </p>
      <p className="mt-2 text-[14px] text-[var(--paper-dim)]">
        Try relaxing a filter — or press <kbd className="rounded border border-[var(--rule)] bg-[var(--paper-2)] px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd> to add something new.
      </p>
    </div>
  );
}
