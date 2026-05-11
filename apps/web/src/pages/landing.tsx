import { motion } from "framer-motion";
import { useMotionConfig } from "@/lib/motion";
import { RouteTitle } from "@/components/route-title";

export default function LandingPage({ authError }: { authError: string | null }) {
  const m = useMotionConfig();
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
      <RouteTitle />
      <BackdropMarquee />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={m.reduced ? false : { opacity: 0, y: m.fadeY }}
          animate={{ opacity: 1, y: 0 }}
          transition={m.reduced ? { duration: 0 } : m.springEntry}
        >
          <div className="font-label text-[10px] text-[var(--paper-faint)]">
            Est. 2026 · A Personal Catalog
          </div>
          <h1
            className="mt-4 font-display text-[64px] leading-[0.95] tracking-tight text-[var(--ink)] md:text-[112px]"
            style={{ fontVariationSettings: '"opsz" 144, "wght" 800, "SOFT" 20' }}
          >
            Cinemood
          </h1>
          <p className="mt-4 max-w-md mx-auto text-balance text-[15px] leading-snug text-[var(--paper-dim)] md:text-[17px]">
            A catalog of films and series, found by mood. Save things, find them
            back in plain English, watch them at your own pace.
          </p>
          <motion.a
            initial={m.reduced ? false : { opacity: 0, y: m.fadeY }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              m.reduced
                ? { duration: 0 }
                : { ...m.springEntry, delay: 0.08 }
            }
            href="/auth/google"
            className="mt-9 inline-flex items-center gap-3 rounded-full border border-[var(--ink)] bg-[var(--ink)] px-5 py-2.5 text-[13.5px] font-medium text-[var(--paper)] transition hover:opacity-90"
          >
            <GoogleGlyph />
            Sign in with Google
          </motion.a>
          {authError && (
            <p
              className="mt-6 inline-block rounded-md border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-2 text-[11.5px] text-[var(--accent)]"
              role="alert"
            >
              Sign-in failed: {authError}
            </p>
          )}
        </motion.div>
      </main>
    </div>
  );
}

/** Static marquee — three rows of muted "title cards" with mono catalog
 *  numbers, mimicking a film-archive's index card wall. No motion. */
function BackdropMarquee() {
  const lines = [
    ["C-0042 · BLADE RUNNER 2049", "C-0041 · MAD MEN", "C-0040 · SEVERANCE", "C-0039 · PAST LIVES"],
    ["C-0038 · INCEPTION", "C-0037 · BREAKING BAD", "C-0036 · THE BEAR", "C-0035 · LA LA LAND"],
    ["C-0034 · ARRIVAL", "C-0033 · FARGO", "C-0032 · ANNIHILATION", "C-0031 · DUNE"],
  ];
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center gap-8 opacity-[0.14]"
    >
      {lines.map((row, i) => (
        <div
          key={i}
          className="flex w-[200%] gap-8 whitespace-nowrap font-mono text-[12px] uppercase tracking-wider"
          style={{ transform: `translateX(${(i - 1) * -40}px)` }}
        >
          {row.concat(row).map((s, j) => (
            <span key={j}>{s}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.908c1.702-1.567 2.685-3.875 2.685-6.614z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.345 0-4.328-1.583-5.036-3.71H.96v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.96A8.996 8.996 0 0 0 0 9c0 1.452.347 2.827.96 4.042l3.004-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9 0A8.997 8.997 0 0 0 .96 4.958L3.964 7.29C4.672 5.163 6.655 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}
