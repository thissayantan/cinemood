import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import type { User, WatchStatus, WatchlistItem } from "@cinemood/shared";
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
import { Toast } from "@/components/toast";
import { MoodPicker } from "@/components/decide/mood-picker";
import { CompareTable } from "@/components/decide/compare-table";

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
  const [decideOpen, setDecideOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<WatchlistItem | null>(null);
  // Tracks the most-recently removed item so the toast can offer Undo.
  // Only the latest removal is undoable; sequential removes overwrite.
  const [removedItem, setRemovedItem] = useState<WatchlistItem | null>(null);
  // Post-import message bubbled up from /import via ?imported=N&skipped=M.
  // Cleared on dismiss or once the user has seen it.
  const [importToast, setImportToast] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const imported = Number(searchParams.get("imported") ?? "0") || 0;
    const skipped = Number(searchParams.get("skipped") ?? "0") || 0;
    if (imported === 0 && skipped === 0) return;
    const parts: string[] = [];
    if (imported > 0) parts.push(`Added ${imported} title${imported === 1 ? "" : "s"}`);
    if (skipped > 0) parts.push(`${skipped} already in your catalog`);
    setImportToast(parts.join(" · "));
    // Strip the query params so a refresh doesn't replay the toast.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("imported");
        next.delete("skipped");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

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

  const titleCount = wl.all?.length ?? 0;

  const handleAdded = useCallback(
    (id: number) => {
      addId(id);
      setReloadKey((k) => k + 1);
    },
    [addId],
  );

  const handleSetStatus = useCallback(
    async (item: WatchlistItem, status: WatchStatus) => {
      const res = await api(`/api/watchlist/${item.title.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setReloadKey((k) => k + 1);
        const now = Math.floor(Date.now() / 1000);
        setDetailItem((prev) =>
          prev && prev.title.id === item.title.id
            ? {
                ...prev,
                status,
                started_at: status === "watching" ? (prev.started_at ?? now) : status === "pending" ? null : prev.started_at,
                watched_at: status === "watched" ? now : null,
              }
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
        setRemovedItem(item);
      }
    },
    [removeId],
  );

  const handleUndoRemove = useCallback(async () => {
    if (!removedItem) return;
    const target = removedItem;
    setRemovedItem(null);
    const res = await api("/api/watchlist", {
      method: "POST",
      body: JSON.stringify({
        tmdb_id: target.title.id,
        type: target.title.type,
      }),
    });
    if (res.ok) {
      addId(target.title.id);
      setReloadKey((k) => k + 1);
    }
  }, [removedItem, addId]);

  const items = wl.visible;
  const isEmpty = wl.all !== null && wl.all.length === 0;
  const filtersCount = activeFilterCount(wl.filters);
  // "Continue watching" shelf — items the user is currently watching,
  // from the unfiltered set so it's always visible regardless of filters.
  const watchingItems = wl.all?.filter((i) => i.status === "watching") ?? [];

  const isSelectMode = selectedIds.size > 0;

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 6) next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Build lookup maps for the compare dialog
  const posterPathsMap: Record<number, string | null> = {};
  const titleNamesMap: Record<number, string> = {};
  for (const item of wl.all ?? []) {
    posterPathsMap[item.title.id] = item.title.poster_path;
    titleNamesMap[item.title.id] = item.title.title;
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <RouteTitle />
      <TopBar
        user={user}
        titleCount={titleCount}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filtersBadge={filtersCount}
        onOpenDecide={() => setDecideOpen(true)}
      />

      {isEmpty ? (
        <main className="mx-auto max-w-[1440px] px-5 pt-10 md:px-8">
          <EmptyWatchlist onAddClick={() => setPaletteOpen(true)} />
        </main>
      ) : (
        <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-x-10 px-5 pt-6 md:grid-cols-[260px_minmax(0,1fr)] md:px-8 md:pt-8">
          {/* Hairline separator between rail and grid — visible in both
              themes (rule colour is theme-aware) so the rail reads as a
              distinct surface even on the flat cream of light mode. */}
          <div className="hidden border-r border-[var(--rule)] pr-6 md:block">
            <FilterRail
              items={wl.all}
              filters={wl.filters}
              onPatch={wl.patchFilter}
              onReset={wl.resetFilters}
            />
          </div>

          <section>
            {/* "Continue watching" shelf — only visible when the user has
                items in-progress; hidden when filtered to avoid duplication. */}
            {watchingItems.length > 0 && !wl.filters.status && (
              <div className="mb-6 border-b border-[var(--rule)] pb-6">
                <h2 className="mb-3 font-label text-[10px] uppercase tracking-widest text-[var(--accent)]">
                  Continue watching
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-1">
                  {watchingItems.map((item) => (
                    <div key={item.title.id} className="w-[120px] shrink-0">
                      <PosterCard
                        item={item}
                        index={0}
                        onOpen={() => setDetailItem(item)}
                        onSetStatus={(status) => handleSetStatus(item, status)}
                        onRemove={() => handleRemove(item)}
                        focusable
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                className="mt-6 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
                transition={
                  m.reduced
                    ? { duration: 0 }
                    : { duration: m.durBase, ease: m.easeOutQuint }
                }
              >
                {items.map((item, index) => (
                  <PosterCard
                    key={item.title.id}
                    item={item}
                    index={index}
                    onOpen={() => setDetailItem(item)}
                    onSetStatus={(status) => handleSetStatus(item, status)}
                    onRemove={() => handleRemove(item)}
                    selected={selectedIds.has(item.title.id)}
                    onSelect={() => toggleSelect(item.title.id)}
                  />
                ))}
              </motion.div>
            )}
          </section>
        </main>
      )}

      {/* Selection toolbar — slides up from bottom when ≥1 item is selected */}
      {isSelectMode && (
        <motion.div
          initial={m.reduced ? {} : { y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={m.reduced ? {} : { y: "100%", opacity: 0 }}
          transition={m.reduced ? { duration: 0 } : { duration: m.durBase, ease: m.easeOutQuint }}
          className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--rule)] bg-[var(--paper)]/95 px-5 py-2.5 shadow-xl backdrop-blur-sm"
        >
          <span className="font-label text-[11px] uppercase tracking-widest text-[var(--paper-dim)]">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={clearSelection}
            className="font-label text-[11px] uppercase tracking-widest text-[var(--paper-faint)] hover:text-[var(--ink)]"
          >
            Clear
          </button>
          {selectedIds.size >= 2 && (
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className="rounded-full bg-[var(--accent)] px-4 py-1.5 font-label text-[11px] uppercase tracking-widest text-[var(--paper)] hover:opacity-90"
            >
              Compare {selectedIds.size}
            </button>
          )}
        </motion.div>
      )}

      <CompareTable
        open={compareOpen}
        onOpenChange={(open) => {
          setCompareOpen(open);
          if (!open) clearSelection();
        }}
        titleIds={Array.from(selectedIds)}
        posterPaths={posterPathsMap}
        titleNames={titleNamesMap}
      />

      <TitleDetailDialog
        item={detailItem}
        open={!!detailItem}
        onOpenChange={(open) => {
          if (!open) setDetailItem(null);
        }}
        onSetStatus={handleSetStatus}
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

      <MoodPicker
        open={decideOpen}
        onOpenChange={setDecideOpen}
        onOpenItem={(it) => setDetailItem(it)}
      />

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

      <Toast
        open={!!removedItem}
        message={removedItem ? `Removed "${removedItem.title.title}"` : ""}
        action={{ label: "Undo", onClick: handleUndoRemove }}
        onDismiss={() => setRemovedItem(null)}
      />

      <Toast
        open={!!importToast}
        message={importToast ?? ""}
        onDismiss={() => setImportToast(null)}
        duration={6000}
      />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
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
