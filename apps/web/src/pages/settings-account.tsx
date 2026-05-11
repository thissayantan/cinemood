import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { User } from "@cinemood/shared";
import { useMotionConfig } from "@/lib/motion";
import { AvatarMenu } from "@/components/avatar-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { RouteTitle } from "@/components/route-title";
import { logoutEverywhere } from "@/lib/use-user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar";

function initials(user: User): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function SettingsAccountPage({ user }: { user: User }) {
  const m = useMotionConfig();
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);

  async function handleSignOutEverywhere() {
    setRunning(true);
    await logoutEverywhere();
    // logoutEverywhere navigates away on success, but keep the flag set
    // so the button stays disabled in the brief window before the
    // location.href takes effect.
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <RouteTitle title="Account" />
      <header className="border-b border-[var(--rule)]">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-5 md:px-8">
          <Link
            to="/"
            className="font-display-md text-[24px] leading-none text-[var(--ink)]"
            style={{ fontVariationSettings: '"opsz" 36, "wght" 800, "SOFT" 20' }}
          >
            Cinemood
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AvatarMenu user={user} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-5 pb-24 pt-10 md:px-8">
        <motion.div
          initial={m.reduced ? false : { opacity: 0, y: m.fadeY }}
          animate={{ opacity: 1, y: 0 }}
          transition={m.reduced ? { duration: 0 } : m.springEntry}
        >
          <Link
            to="/"
            className="font-label text-[10px] text-[var(--paper-faint)] hover:text-[var(--ink)]"
          >
            ← Back to your collection
          </Link>
          <h1
            className="mt-3 font-display text-[44px] leading-[1.02] text-[var(--ink)]"
            style={{ fontVariationSettings: '"opsz" 72, "wght" 800, "SOFT" 20' }}
          >
            Account
          </h1>
          <p className="mt-3 max-w-[60ch] text-[15px] text-[var(--paper-dim)]">
            Your sign-in identity, session controls, and other settings tied to
            your account.
          </p>
        </motion.div>

        {/* Identity */}
        <motion.section
          initial={m.reduced ? false : { opacity: 0, y: m.fadeY }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            m.reduced ? { duration: 0 } : { ...m.springEntry, delay: 0.05 }
          }
          className="mt-8 rounded-2xl border border-[var(--rule)] bg-[var(--paper-2)] p-6"
        >
          <h2 className="font-label text-[10px] text-[var(--paper-faint)]">
            Signed in as
          </h2>
          <div className="mt-3 flex items-center gap-4">
            <Avatar className="h-14 w-14">
              {user.picture ? (
                <AvatarImage src={user.picture} alt={user.name ?? user.email} />
              ) : null}
              <AvatarFallback>{initials(user)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div
                className="truncate font-display-sm text-[22px] leading-tight text-[var(--ink)]"
                style={{
                  fontVariationSettings: '"opsz" 22, "wght" 700, "SOFT" 30',
                }}
              >
                {user.name ?? user.email}
              </div>
              <div className="mt-0.5 truncate text-[13px] text-[var(--paper-dim)]">
                {user.email}
              </div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
                via google · oauth
              </div>
            </div>
          </div>
        </motion.section>

        {/* Other settings shortcut */}
        <motion.section
          initial={m.reduced ? false : { opacity: 0, y: m.fadeY }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            m.reduced ? { duration: 0 } : { ...m.springEntry, delay: 0.08 }
          }
          className="mt-5 rounded-2xl border border-[var(--rule)] bg-[var(--paper-2)] p-6"
        >
          <h2 className="font-label text-[10px] text-[var(--paper-faint)]">
            Other settings
          </h2>
          <ul className="mt-3 divide-y divide-[var(--rule)]">
            <li>
              <Link
                to="/settings/search"
                className="flex items-center justify-between gap-4 py-3 text-[14px] text-[var(--ink)] hover:text-[var(--accent)]"
              >
                <span>
                  <span className="block">Search settings</span>
                  <span className="block text-[12px] text-[var(--paper-dim)]">
                    Choose which LLM provider parses your natural-language
                    queries.
                  </span>
                </span>
                <span aria-hidden className="text-[var(--paper-faint)]">
                  →
                </span>
              </Link>
            </li>
          </ul>
        </motion.section>

        {/* Security / danger zone */}
        <motion.section
          initial={m.reduced ? false : { opacity: 0, y: m.fadeY }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            m.reduced ? { duration: 0 } : { ...m.springEntry, delay: 0.11 }
          }
          className="mt-5 rounded-2xl border border-[var(--rule)] bg-[var(--paper-2)] p-6"
        >
          <h2 className="font-label text-[10px] text-[var(--paper-faint)]">
            Security
          </h2>
          <div className="mt-3">
            <div className="text-[14px] text-[var(--ink)]">
              Sign out of every device
            </div>
            <p className="mt-1 max-w-[58ch] text-[13px] leading-snug text-[var(--paper-dim)]">
              Invalidates every session token issued for this account — this
              browser, any other browser, any phone or tablet you signed in
              from, and any stolen cookie. You'll need to sign in again on each
              device.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!confirming ? (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="rounded-full border border-[var(--accent)] px-4 py-2 text-[12.5px] font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
                >
                  Sign out everywhere
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleSignOutEverywhere}
                    disabled={running}
                    className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-[12.5px] font-medium text-[var(--paper)] transition hover:opacity-90 disabled:opacity-50"
                  >
                    {running ? "Signing out…" : "Yes — sign out every device"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={running}
                    className="rounded-full border border-[var(--rule)] px-4 py-2 text-[12.5px] text-[var(--paper-dim)] transition hover:text-[var(--ink)] disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
                    no undo
                  </span>
                </>
              )}
            </div>
          </div>
        </motion.section>
      </main>
    </div>
  );
}
