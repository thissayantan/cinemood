import { motion } from "framer-motion";
import { PageShell } from "@/components/page-shell";

const SPRING = { type: "spring" as const, stiffness: 240, damping: 24 };

export default function LandingPage({ authError }: { authError: string | null }) {
  return (
    <PageShell>
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="bg-gradient-to-br from-fuchsia-200 via-violet-200 to-cyan-200 bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-7xl"
        >
          Cinemood
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.06 }}
          className="mt-4 max-w-xl text-balance text-base text-white/70 md:text-lg"
        >
          Movies and series, found by mood. Save things, find them back in plain
          English.
        </motion.p>
        <motion.a
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.14 }}
          href="/auth/google"
          className="mt-10 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-medium text-white shadow-lg backdrop-blur-xl transition hover:bg-white/15"
        >
          <GoogleGlyph />
          Sign in with Google
        </motion.a>
        {authError && (
          <p
            className="mt-6 rounded-md border border-red-300/30 bg-red-400/10 px-3 py-2 text-xs text-red-200"
            role="alert"
          >
            Sign-in failed: {authError}
          </p>
        )}
      </main>
    </PageShell>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.908c1.702-1.567 2.685-3.875 2.685-6.614z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.345 0-4.328-1.583-5.036-3.71H.96v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.96A8.996 8.996 0 0 0 0 9c0 1.452.347 2.827.96 4.042l3.004-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9 0A8.997 8.997 0 0 0 .96 4.958L3.964 7.29C4.672 5.163 6.655 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
