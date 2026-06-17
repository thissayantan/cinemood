/**
 * settings-tokens.tsx — personal access token management.
 *
 * Lists the user's tokens (prefix, name, last used), lets them create new
 * ones, and revoke existing ones. The raw token is shown ONCE on creation
 * in a monospace "vault" — after the user copies it, it's gone forever.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { AccessTokenPublic, User } from "@cinemood/shared";
import { api } from "@/lib/api";
import { useMotionConfig } from "@/lib/motion";
import { AvatarMenu } from "@/components/avatar-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { RouteTitle } from "@/components/route-title";
import { cn } from "@/lib/utils";

interface CreateResult extends AccessTokenPublic {
  raw: string;
}

export default function SettingsTokensPage({ user }: { user: User }) {
  const m = useMotionConfig();
  const fadeUpInitial = m.reduced ? false : { opacity: 0, y: m.fadeY };
  const entryT = m.reduced ? { duration: 0 } : m.springEntry;
  const fadeT = m.reduced ? { duration: 0 } : { duration: m.durBase, ease: m.easeOutQuint };

  const [tokens, setTokens] = useState<AccessTokenPublic[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [expiryDays, setExpiryDays] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<CreateResult | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void fetchTokens();
  }, []);

  async function fetchTokens() {
    setLoading(true);
    const res = await api<AccessTokenPublic[]>("/api/settings/tokens");
    setLoading(false);
    if (res.ok) setTokens(res.data);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    setError(null);
    const res = await api<CreateResult>("/api/settings/tokens", {
      method: "POST",
      body: JSON.stringify({
        name: newName.trim(),
        ...(expiryDays ? { expires_in_days: Number(expiryDays) } : {}),
      }),
    });
    setCreating(false);
    if (res.ok) {
      setJustCreated(res.data);
      setNewName("");
      setExpiryDays("");
      setCopied(false);
      void fetchTokens();
    } else {
      setError(res.error.message);
    }
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    const res = await api(`/api/settings/tokens/${id}`, { method: "DELETE" });
    setRevoking(null);
    if (res.ok) {
      setTokens((prev) => prev?.filter((t) => t.id !== id) ?? null);
    }
  }

  async function copyToken() {
    if (!justCreated) return;
    await navigator.clipboard.writeText(justCreated.raw);
    setCopied(true);
  }

  function formatDate(ts: number | null): string {
    if (!ts) return "Never";
    return new Date(ts * 1000).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <RouteTitle title="API tokens" />

      {/* Header */}
      <header className="border-b border-[var(--rule)]">
        <div className="mx-auto flex h-16 max-w-[900px] items-center justify-between px-5 md:px-8">
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

      {/* Page content */}
      <main className="mx-auto max-w-[900px] px-5 py-10 md:px-8">
        {/* Back nav */}
        <motion.div
          initial={fadeUpInitial}
          animate={{ opacity: 1, y: 0 }}
          transition={entryT}
          className="mb-8"
        >
          <div className="flex flex-wrap gap-3 text-[12px]">
            <Link to="/settings/account" className="text-[var(--paper-faint)] hover:text-[var(--ink)]">Account</Link>
            <span className="text-[var(--paper-faint)]">·</span>
            <Link to="/settings/search" className="text-[var(--paper-faint)] hover:text-[var(--ink)]">Search</Link>
            <span className="text-[var(--paper-faint)]">·</span>
            <span className="text-[var(--ink)]">API tokens</span>
          </div>
          <h1
            className="mt-4 font-display-md text-[32px] leading-tight text-[var(--ink)] md:text-[40px]"
            style={{ fontVariationSettings: '"opsz" 48, "wght" 800, "SOFT" 20' }}
          >
            API tokens
          </h1>
          <p className="mt-2 max-w-lg text-[14px] text-[var(--paper-dim)]">
            Use personal access tokens to connect Cinemood from Claude Desktop, the Android app, or any MCP client.
            Tokens authenticate as you and carry the same permissions as your session.
          </p>
        </motion.div>

        <div className="grid gap-10 lg:grid-cols-[1fr_320px] lg:items-start">
          {/* Token list */}
          <motion.section
            initial={fadeUpInitial}
            animate={{ opacity: 1, y: 0 }}
            transition={m.reduced ? { duration: 0 } : { ...m.springEntry, delay: 0.05 }}
          >
            <h2 className="mb-4 font-label text-[11px] uppercase tracking-widest text-[var(--paper-faint)]">
              Your tokens
            </h2>

            {/* One-time token reveal */}
            <AnimatePresence>
              {justCreated && (
                <motion.div
                  initial={m.reduced ? {} : { opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={m.reduced ? {} : { opacity: 0, height: 0 }}
                  transition={fadeT}
                  className="mb-6 overflow-hidden rounded-xl border border-amber-500/40 bg-amber-50/60 dark:bg-amber-900/20"
                >
                  <div className="px-4 py-3 text-[13px]">
                    <p className="mb-1 font-label text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-400">
                      Copy this now — it won't be shown again
                    </p>
                    <p className="text-[12px] text-amber-800/80 dark:text-amber-300/80">
                      "{justCreated.name}" — store it somewhere safe, like a password manager.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 border-t border-amber-500/20 bg-amber-50 px-4 py-3 dark:bg-amber-900/30">
                    <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px] text-[var(--ink)]">
                      {justCreated.raw}
                    </code>
                    <button
                      type="button"
                      onClick={copyToken}
                      className={cn(
                        "shrink-0 rounded-lg border px-3 py-1.5 font-label text-[10px] uppercase tracking-widest transition",
                        copied
                          ? "border-green-500/60 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "border-[var(--rule)] bg-[var(--paper)] text-[var(--paper-dim)] hover:text-[var(--ink)]",
                      )}
                    >
                      {copied ? "Copied ✓" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setJustCreated(null)}
                      aria-label="Dismiss"
                      className="shrink-0 text-[var(--paper-faint)] hover:text-[var(--ink)]"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {loading ? (
              <div className="py-8 text-center font-label text-[10px] uppercase tracking-widest text-[var(--paper-faint)]">
                Loading…
              </div>
            ) : !tokens || tokens.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--rule)] px-6 py-10 text-center">
                <p className="text-[14px] text-[var(--paper-faint)]">No tokens yet.</p>
                <p className="mt-1 text-[12px] text-[var(--paper-faint)]">
                  Create one to connect Claude Desktop or the Android app.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[var(--rule)]">
                {tokens.map((token, i) => (
                  <div
                    key={token.id}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3",
                      i > 0 && "border-t border-[var(--rule)]",
                    )}
                  >
                    {/* Token prefix */}
                    <code className="shrink-0 font-mono text-[12px] text-[var(--paper-dim)]">
                      {token.prefix}…
                    </code>
                    {/* Name + dates */}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-[var(--ink)]">{token.name}</span>
                      <span className="block font-mono text-[10px] text-[var(--paper-faint)]">
                        Created {formatDate(token.created_at)}
                        {" · "}
                        Last used {formatDate(token.last_used_at)}
                        {token.expires_at && (
                          <> · Expires {formatDate(token.expires_at)}</>
                        )}
                      </span>
                    </div>
                    {/* Revoke */}
                    <button
                      type="button"
                      onClick={() => handleRevoke(token.id)}
                      disabled={revoking === token.id}
                      className={cn(
                        "shrink-0 rounded-lg border px-3 py-1.5 font-label text-[10px] uppercase tracking-widest transition",
                        "border-[var(--rule)] text-[var(--paper-faint)] hover:border-[var(--accent)]/60 hover:text-[var(--accent)]",
                        revoking === token.id && "opacity-50",
                      )}
                    >
                      {revoking === token.id ? "Revoking…" : "Revoke"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.section>

          {/* Create token form */}
          <motion.section
            initial={fadeUpInitial}
            animate={{ opacity: 1, y: 0 }}
            transition={m.reduced ? { duration: 0 } : { ...m.springEntry, delay: 0.1 }}
            className="rounded-xl border border-[var(--rule)] bg-[var(--paper-2)] p-5"
          >
            <h2 className="mb-4 font-label text-[11px] uppercase tracking-widest text-[var(--paper-faint)]">
              New token
            </h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block font-label text-[10px] uppercase tracking-widest text-[var(--paper-faint)]">
                  Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Claude Desktop, Android app…"
                  maxLength={100}
                  className="w-full rounded-xl border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-[14px] text-[var(--ink)] placeholder:text-[var(--paper-faint)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-label text-[10px] uppercase tracking-widest text-[var(--paper-faint)]">
                  Expires after (optional)
                </label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  className="w-full rounded-xl border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none"
                >
                  <option value="">Never</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                </select>
              </div>
              {error && (
                <p className="text-[12px] text-red-500">{error}</p>
              )}
              <button
                type="submit"
                disabled={!newName.trim() || creating}
                className={cn(
                  "mt-1 rounded-xl px-4 py-2.5 font-label text-[11px] uppercase tracking-widest transition",
                  newName.trim() && !creating
                    ? "bg-[var(--accent)] text-[var(--paper)] hover:opacity-90"
                    : "cursor-not-allowed bg-[var(--paper-3)] text-[var(--paper-faint)]",
                )}
              >
                {creating ? "Creating…" : "Generate token"}
              </button>
            </form>

            <div className="mt-5 border-t border-[var(--rule)] pt-4">
              <p className="text-[11px] text-[var(--paper-faint)]">
                The token is shown once. After you close the reveal panel it's gone —
                if you lose it, revoke and create a new one.
              </p>
              <p className="mt-2 text-[11px] text-[var(--paper-faint)]">
                For Claude Desktop, add to your <code className="font-mono text-[10px]">claude_desktop_config.json</code>:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-[var(--rule)] bg-[var(--paper)] p-2 font-mono text-[10px] text-[var(--paper-dim)]">{`{
  "mcpServers": {
    "cinemood": {
      "command": "npx",
      "args": ["-y", "@cinemood/mcp"],
      "env": { "CINEMOOD_TOKEN": "cmt_…" }
    }
  }
}`}</pre>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
