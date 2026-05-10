import { motion } from "framer-motion";
import type { User } from "@cinemood/shared";
import { PageShell } from "@/components/page-shell";
import { AvatarMenu } from "@/components/avatar-menu";
import { GlassCard } from "@/components/glass-card";

const SPRING = { type: "spring" as const, stiffness: 240, damping: 24 };

export default function HomePage({ user }: { user: User }) {
  return (
    <PageShell>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="bg-gradient-to-br from-fuchsia-200 via-violet-200 to-cyan-200 bg-clip-text text-xl font-bold tracking-tight text-transparent">
          Cinemood
        </span>
        <AvatarMenu user={user} />
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
        >
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}.
          </h1>
          <p className="mt-3 text-white/65">
            Your watchlist will live here. Search and import are wired up in the
            next phases.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.08 }}
        >
          <GlassCard className="mt-10 p-6">
            <p className="text-sm text-white/65">
              You're signed in as <span className="text-white">{user.email}</span>.
            </p>
          </GlassCard>
        </motion.div>
      </main>
    </PageShell>
  );
}
