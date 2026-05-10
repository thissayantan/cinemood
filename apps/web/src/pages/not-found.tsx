import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PageShell } from "@/components/page-shell";

const SPRING = { type: "spring" as const, stiffness: 240, damping: 24 };

export default function NotFoundPage() {
  return (
    <PageShell>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
        >
          <p className="text-xs uppercase tracking-[0.2em] text-current opacity-50">
            404
          </p>
          <h1 className="mt-3 bg-gradient-to-br from-fuchsia-400 via-violet-400 to-cyan-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent dark:from-fuchsia-200 dark:via-violet-200 dark:to-cyan-200 md:text-6xl">
            Lost in the credits.
          </h1>
          <p className="mt-4 text-sm opacity-65">
            That page isn't on your watchlist (or anywhere else).
          </p>
          <Link
            to="/"
            className="mt-8 inline-block rounded-full border border-black/15 bg-black/5 px-5 py-2.5 text-sm font-medium transition hover:bg-black/10 dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/15"
          >
            Back to watchlist
          </Link>
        </motion.div>
      </main>
    </PageShell>
  );
}
