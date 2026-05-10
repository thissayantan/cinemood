import { motion } from "framer-motion";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,rgba(167,139,250,0.35),transparent_55%),radial-gradient(circle_at_85%_70%,rgba(34,211,238,0.28),transparent_60%)]"
        aria-hidden
      />
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 24 }}
          className="bg-gradient-to-br from-fuchsia-200 via-violet-200 to-cyan-200 bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-7xl"
        >
          Cinemood
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 24, delay: 0.08 }}
          className="mt-4 max-w-xl text-balance text-base text-white/70 md:text-lg"
        >
          Movies and series, found by mood.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 24, delay: 0.16 }}
          className="mt-10 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 backdrop-blur-xl"
        >
          <p className="text-sm text-white/60">Auth lands in the next phase.</p>
        </motion.div>
      </div>
    </main>
  );
}
