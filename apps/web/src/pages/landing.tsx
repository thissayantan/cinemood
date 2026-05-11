import { motion } from "framer-motion";
import { useMotionConfig } from "@/lib/motion";
import { RouteTitle } from "@/components/route-title";

export default function LandingPage({ authError }: { authError: string | null }) {
  const m = useMotionConfig();
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
      <RouteTitle />
      <Backdrop />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={m.reduced ? false : { opacity: 0, y: m.fadeY }}
          animate={{ opacity: 1, y: 0 }}
          transition={m.reduced ? { duration: 0 } : m.springEntry}
        >
          <h1
            className="font-display text-[64px] leading-[0.95] tracking-tight md:text-[120px]"
            style={{
              // Editorial-cinematic warmth: ink at the top fades into an
              // ink + accent mix at the bottom — like light passing
              // through a single frame of film. Subtle, not gimmicky;
              // works in both light and dark modes because the colour-mix
              // is computed off the theme variables.
              fontVariationSettings: '"opsz" 144, "wght" 800, "SOFT" 20',
              backgroundImage:
                "linear-gradient(180deg, var(--ink) 0%, var(--ink) 45%, color-mix(in srgb, var(--ink) 62%, var(--accent) 38%) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Cinemood
          </h1>
          <p className="mt-5 mx-auto max-w-[28ch] text-balance text-[16px] leading-snug text-[var(--paper-dim)] md:text-[18px]">
            Save what you mean to watch.
            <br />
            Find it back by mood, not by title.
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
            className="mt-10 inline-flex items-center gap-3 rounded-full border border-[var(--ink)] bg-[var(--ink)] px-5 py-2.5 text-[13.5px] font-medium text-[var(--paper)] transition hover:opacity-90"
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

        {/* Brand foot mark, lifted clear of the bottom filmstrip rail
            (which sits at bottom-8). Flanked by two thin hairlines so it
            reads as a deliberate plate cartouche rather than a stray
            label. Restrained — no fake heritage, no marketing fluff. */}
        <div className="absolute bottom-24 inset-x-0 flex items-center justify-center gap-4">
          <span
            aria-hidden
            className="h-px w-12 bg-[var(--paper-faint)] opacity-50"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--paper-faint)]">
            mood · catalog · cinema
          </span>
          <span
            aria-hidden
            className="h-px w-12 bg-[var(--paper-faint)] opacity-50"
          />
        </div>
      </main>
    </div>
  );
}

/** Background scenery for the landing page.
 *
 *  Two layers, both static (the page should feel still — motion belongs
 *  inside the app, not on the door):
 *  1. A soft radial glow centred behind the wordmark, tinted with the
 *     accent so the page has a warm focal point instead of flat dark.
 *  2. A pair of faint filmstrip rails (a row of small rectangles along
 *     the top and bottom edges) — a deliberate on-brand motif that
 *     replaces the old C-NNNN catalog-number wall (those numbers are
 *     meaningless to users, and we already stripped them from every
 *     other surface). */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, var(--accent-glow) 0%, transparent 70%)",
        }}
      />
      <FilmstripRail position="top" />
      <FilmstripRail position="bottom" />
    </div>
  );
}

function FilmstripRail({ position }: { position: "top" | "bottom" }) {
  // 28 perforation holes spaced evenly. We render them as a flex row of
  // small dimensional rectangles inset from the screen edge — a quiet
  // film-archive cue without screaming "filmstrip!" at the user.
  const holes = Array.from({ length: 28 });
  return (
    <div
      className={`absolute inset-x-0 flex justify-between px-8 ${
        position === "top" ? "top-8" : "bottom-8"
      }`}
    >
      {holes.map((_, i) => (
        <span
          key={i}
          className="h-2.5 w-3 rounded-[2px] bg-[var(--ink)] opacity-[0.07]"
        />
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
