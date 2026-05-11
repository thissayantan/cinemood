import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type {
  ApiResponse,
  LlmConfigPublic,
  LlmProviderId,
  ParsedQuery,
  User,
} from "@cinemood/shared";
import { api } from "@/lib/api";
import { useMotionConfig } from "@/lib/motion";
import { AvatarMenu } from "@/components/avatar-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { RouteTitle } from "@/components/route-title";
import { cn } from "@/lib/utils";

type Catalog = Record<LlmProviderId, ReadonlyArray<{ id: string; label: string }>>;

interface SettingsResponse {
  effective: LlmConfigPublic;
  isUserOverride: boolean;
  catalog: Catalog;
}

const PROVIDER_LABEL: Record<LlmProviderId, string> = {
  cloudflare: "Cloudflare",
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

export default function SettingsSearchPage({ user }: { user: User }) {
  const m = useMotionConfig();
  const fadeUpInitial = m.reduced ? false : { opacity: 0, y: m.fadeY };
  const entryTransition = m.reduced ? { duration: 0 } : m.springEntry;
  const delayedEntry = m.reduced
    ? { duration: 0 }
    : { ...m.springEntry, delay: 0.05 };
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [provider, setProvider] = useState<LlmProviderId>("cloudflare");
  const [model, setModel] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    kind: "ok" | "err";
    text: string;
    sample?: ParsedQuery;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = (await api<SettingsResponse>("/api/settings/llm")) as
        | ApiResponse<SettingsResponse>;
      if (cancelled) return;
      if (res.ok) {
        setData(res.data);
        setProvider(res.data.effective.provider);
        setModel(res.data.effective.model);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const models = useMemo(() => data?.catalog[provider] ?? [], [data, provider]);

  useEffect(() => {
    if (models.length > 0 && !models.some((option) => option.id === model)) {
      setModel(models[0]!.id);
    }
  }, [models, model]);

  function bodyForRequest(): unknown {
    if (provider === "cloudflare") return { provider, model };
    const body: Record<string, unknown> = { provider, model };
    if (apiKey.trim()) body.apiKey = apiKey.trim();
    return body;
  }

  async function save() {
    setBusy("save");
    setStatus(null);
    const res = await api("/api/settings/llm", {
      method: "PUT",
      body: JSON.stringify(bodyForRequest()),
    });
    setBusy(null);
    if (res.ok) {
      setStatus({ kind: "ok", text: "Saved." });
      setApiKey("");
      const next = (await api<SettingsResponse>("/api/settings/llm")) as ApiResponse<SettingsResponse>;
      if (next.ok) setData(next.data);
    } else setStatus({ kind: "err", text: res.error.message });
  }

  async function reset() {
    setBusy("reset");
    setStatus(null);
    const res = await api("/api/settings/llm", { method: "DELETE" });
    setBusy(null);
    if (res.ok) {
      setStatus({ kind: "ok", text: "Reset to default." });
      setApiKey("");
      const next = (await api<SettingsResponse>("/api/settings/llm")) as ApiResponse<SettingsResponse>;
      if (next.ok) {
        setData(next.data);
        setProvider(next.data.effective.provider);
        setModel(next.data.effective.model);
      }
    } else setStatus({ kind: "err", text: res.error.message });
  }

  async function test() {
    setBusy("test");
    setStatus(null);
    const res = (await api<{
      ok: boolean;
      error?: string;
      sampleOutput?: ParsedQuery;
    }>("/api/settings/llm/test", {
      method: "POST",
      body: JSON.stringify(bodyForRequest()),
    })) as ApiResponse<{
      ok: boolean;
      error?: string;
      sampleOutput?: ParsedQuery;
    }>;
    setBusy(null);
    if (!res.ok) {
      setStatus({ kind: "err", text: res.error.message });
      return;
    }
    if (res.data.ok && res.data.sampleOutput) {
      setStatus({ kind: "ok", text: "Connected.", sample: res.data.sampleOutput });
    } else {
      setStatus({ kind: "err", text: res.data.error ?? "Test failed" });
    }
  }

  const needsKey = provider !== "cloudflare";
  const keyAlreadySet =
    needsKey && data?.effective.provider === provider && data.effective.hasKey;

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <RouteTitle title="Search settings" />
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
          initial={fadeUpInitial}
          animate={{ opacity: 1, y: 0 }}
          transition={entryTransition}
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
            Search settings
          </h1>
          <p className="mt-3 max-w-[55ch] text-[15px] text-[var(--paper-dim)]">
            Choose which model parses your natural-language queries. Cloudflare is the default and free; bring your own key for Anthropic, OpenAI, or Google.
          </p>
        </motion.div>

        <motion.div
          initial={fadeUpInitial}
          animate={{ opacity: 1, y: 0 }}
          transition={delayedEntry}
          className="mt-8 rounded-2xl border border-[var(--rule)] bg-[var(--paper-2)] p-7"
        >
          {loading ? (
            <div className="font-mono text-[11px] uppercase tracking-wider text-[var(--paper-faint)]">
              Loading…
            </div>
          ) : (
            <div className="space-y-7">
              <div>
                <Label>Provider</Label>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(Object.keys(PROVIDER_LABEL) as LlmProviderId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => { setProvider(id); setStatus(null); }}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-[13px] transition",
                        provider === id
                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--paper)]"
                          : "border-[var(--rule)] bg-[var(--paper)] text-[var(--paper-dim)] hover:text-[var(--ink)]",
                      )}
                    >
                      {PROVIDER_LABEL[id]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Model</Label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-[var(--rule)] bg-[var(--paper)] px-3 py-2.5 text-[13px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
                >
                  {models.map((option) => (
                    <option key={option.id} value={option.id} className="bg-[var(--paper-2)]">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {needsKey && (
                <div>
                  <Label>
                    API key{" "}
                    {keyAlreadySet && (
                      <span className="ml-1 rounded-full bg-[var(--accent)]/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--accent)]">
                        Saved
                      </span>
                    )}
                  </Label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={keyAlreadySet ? "Leave blank to keep saved key" : "Paste your API key"}
                    className="mt-3 w-full rounded-xl border border-[var(--rule)] bg-[var(--paper)] px-3 py-2.5 font-mono text-[12px] text-[var(--ink)] placeholder:text-[var(--paper-faint)] outline-none transition focus:border-[var(--accent)]"
                  />
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-[var(--paper-faint)]">
                    Stored encrypted with AES-GCM. Never logged.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={test}
                  className="rounded-full border border-[var(--rule)] bg-[var(--paper)] px-4 py-2 text-[12.5px] text-[var(--paper-dim)] transition hover:text-[var(--ink)] disabled:opacity-50"
                >
                  {busy === "test" ? "Testing…" : "Test connection"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={save}
                  className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-[12.5px] text-[var(--paper)] transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy === "save" ? "Saving…" : "Save"}
                </button>
                <span className="flex-1" />
                {data?.isUserOverride && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={reset}
                    className="rounded-full border border-[var(--rule)] bg-transparent px-4 py-2 text-[12.5px] text-[var(--paper-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                  >
                    {busy === "reset" ? "Resetting…" : "Reset to default"}
                  </button>
                )}
              </div>

              {status && (
                <div
                  className={cn(
                    "rounded-md border px-3 py-2 text-[11px]",
                    status.kind === "ok"
                      ? "border-[var(--accent)]/30 bg-[var(--accent)]/8 text-[var(--accent)]"
                      : "border-[var(--accent)] bg-[var(--accent)]/12 text-[var(--accent)]",
                  )}
                >
                  <div>{status.text}</div>
                  {status.sample && (
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-[var(--paper-dim)]">
                      {JSON.stringify(status.sample, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {data && (
                <div className="border-t border-[var(--rule)] pt-4 font-mono text-[11px] uppercase tracking-wider text-[var(--paper-faint)]">
                  Currently in use:{" "}
                  <span className="text-[var(--ink)]">
                    {PROVIDER_LABEL[data.effective.provider]} · {data.effective.model}
                  </span>
                  {data.isUserOverride && (
                    <span className="ml-2 rounded-full border border-[var(--accent)]/40 px-1.5 py-0.5 text-[9px] text-[var(--accent)]">
                      custom
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-label text-[10px] text-[var(--paper-faint)]">
      {children}
    </span>
  );
}
