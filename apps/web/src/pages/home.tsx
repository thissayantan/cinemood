import { motion } from "framer-motion";
import type { User } from "@cinemood/shared";
import { PageShell } from "@/components/page-shell";
import { AvatarMenu } from "@/components/avatar-menu";
import { SearchBar } from "@/components/search-bar";
import { useWatchlistIds } from "@/lib/use-watchlist-ids";

const SPRING = { type: "spring" as const, stiffness: 240, damping: 24 };

export default function HomePage({ user }: { user: User }) {
  const { ids, add } = useWatchlistIds();

  return (
    <PageShell>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="bg-gradient-to-br from-fuchsia-200 via-violet-200 to-cyan-200 bg-clip-text text-xl font-bold tracking-tight text-transparent">
          Cinemood
        </span>
        <AvatarMenu user={user} />
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="mt-6 mb-8 max-w-3xl"
        >
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Find something to watch.
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Search TMDB and tap a poster to save it to your watchlist.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.06 }}
        >
          <SearchBar savedIds={ids} onAdded={add} />
        </motion.div>
      </main>
    </PageShell>
  );
}
