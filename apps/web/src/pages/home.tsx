import { useState } from "react";
import { motion } from "framer-motion";
import type { User } from "@cinemood/shared";
import { PageShell } from "@/components/page-shell";
import { AvatarMenu } from "@/components/avatar-menu";
import { SearchBar } from "@/components/search-bar";
import { WatchlistGrid } from "@/components/watchlist-grid";
import { useWatchlistIds } from "@/lib/use-watchlist-ids";

const SPRING = { type: "spring" as const, stiffness: 240, damping: 24 };

export default function HomePage({ user }: { user: User }) {
  const { ids, add, remove } = useWatchlistIds();
  const [reloadKey, setReloadKey] = useState(0);

  function handleAdded(id: number) {
    add(id);
    setReloadKey((k) => k + 1);
  }

  function handleRemoved(id: number) {
    remove(id);
  }

  return (
    <PageShell>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="bg-gradient-to-br from-fuchsia-200 via-violet-200 to-cyan-200 bg-clip-text text-xl font-bold tracking-tight text-transparent">
          Cinemood
        </span>
        <AvatarMenu user={user} />
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-6 pb-24">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="space-y-4"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">
            Add to your watchlist
          </h1>
          <SearchBar savedIds={ids} onAdded={handleAdded} />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.06 }}
          className="space-y-5"
        >
          <h2 className="text-2xl font-semibold tracking-tight text-white/90">
            My watchlist
          </h2>
          <WatchlistGrid reloadKey={reloadKey} onRemoved={handleRemoved} />
        </motion.section>
      </main>
    </PageShell>
  );
}
