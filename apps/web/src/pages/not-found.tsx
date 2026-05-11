import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import filmReel from "@/lottie/film-reel.json";
import { LottieLoop } from "@/components/lottie-loop";
import { useMotionConfig } from "@/lib/motion";
import { RouteTitle } from "@/components/route-title";

export default function NotFoundPage() {
  const m = useMotionConfig();
  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <RouteTitle title="404" />
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={m.reduced ? false : { opacity: 0, y: m.fadeY }}
          animate={{ opacity: 1, y: 0 }}
          transition={m.reduced ? { duration: 0 } : m.springEntry}
          className="flex flex-col items-center"
        >
          <LottieLoop source={filmReel} size={160} speed={0.4} />
          <p className="mt-4 font-label text-[10px] text-[var(--paper-faint)]">
            404 · Off-reel
          </p>
          <h1
            className="mt-2 font-display text-[44px] leading-[1.02] text-[var(--ink)] md:text-[64px]"
            style={{ fontVariationSettings: '"opsz" 84, "wght" 800, "SOFT" 20' }}
          >
            Lost in the credits.
          </h1>
          <p className="mt-3 max-w-sm text-[15px] text-[var(--paper-dim)]">
            That page isn't on your watchlist — or anywhere else.
          </p>
          <Link
            to="/"
            className="mt-7 inline-block rounded-full border border-[var(--ink)] bg-[var(--ink)] px-4 py-2 text-[13px] text-[var(--paper)] transition hover:opacity-90"
          >
            Back to your collection
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
