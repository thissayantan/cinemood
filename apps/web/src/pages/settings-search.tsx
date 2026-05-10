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
import { PageShell } from "@/components/page-shell";
import { GlassCard } from "@/components/glass-card";
import { AvatarMenu } from "@/components/avatar-menu";

type Catalog = Record<LlmProviderId, ReadonlyArray<{ id: string; label: string }>>;

interface SettingsResponse {
  effective: LlmConfigPublic;
  isUserOverride: boolean;
  catalog: Catalog;
}

const SPRING = { type: "spring" as const, stiffness: 240, damping: 24 };

const PROVIDER_LABEL: Record<LlmProviderId, string> = {
  cloudflare: "Cloudflare",
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
};

export default function SettingsSearchPage({ user }: { user: User }) {
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
        | ApiResponse<SettingsResponse>
        | { ok: false; error: { code: string; message: string } };
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
    // When provider changes, ensure model is valid for it.
    if (models.length > 0 && !models.some((m) => m.id === model)) {
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
      // Refresh effective config.
      const next = (await api<SettingsResponse>("/api/settings/llm")) as
        | ApiResponse<SettingsResponse>;
      if (next.ok) setData(next.data);
    } else {
      setStatus({ kind: "err", text: res.error.message });
    }
  }

  async function reset() {
    setBusy("reset");
    setStatus(null);
    const res = await api("/api/settings/llm", { method: "DELETE" });
    setBusy(null);
    if (res.ok) {
      setStatus({ kind: "ok", text: "Reset to default." });
      setApiKey("");
      const next = (await api<SettingsResponse>("/api/settings/llm")) as
        | ApiResponse<SettingsResponse>;
      if (next.ok) {
        setData(next.data);
        setProvider(next.data.effective.provider);
        setModel(next.data.effective.model);
      }
    } else {
      setStatus({ kind: "err", text: res.error.message });
    }
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
      setStatus({
        kind: "ok",
        text: "Connected.",
        sample: res.data.sampleOutput,
      });
    } else {
      setStatus({
        kind: "err",
        text: res.data.error ?? "Test failed",
      });
    }
  }

  const needsKey = provider !== "cloudflare";
  const keyAlreadySet =
    needsKey && data?.effective.provider === provider && data.effective.hasKey;

  return (
    <PageShell>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link
          to="/"
          className="bg-gradient-to-br from-fuchsia-200 via-violet-200 to-cyan-200 bg-clip-text text-xl font-bold tracking-tight text-transparent"
        >
          Cinemood
        </Link>
        <AvatarMenu user={user} />
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className="space-y-2"
        >
          <Link
            to="/"
            className="text-xs text-white/50 underline-offset-4 hover:text-white/80 hover:underline"
          >
            ← Back to watchlist
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Search settings</h1>
          <p className="text-sm text-white/65">
            Choose which model parses your natural-language queries. Cloudflare
            is the default and free; bring your own key for Anthropic, OpenAI,
            or Google.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING, delay: 0.06 }}
        >
          <GlassCard className="mt-8 p-6">
            {loading ? (
              <div className="text-sm text-white/50">Loading…</div>
            ) : (
              <div className="space-y-6">
                <div>
                  <Label>Provider</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(Object.keys(PROVIDER_LABEL) as LlmProviderId[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          setProvider(p);
                          setStatus(null);
                        }}
                        className={`rounded-xl border px-3 py-2 text-sm transition ${
                          provider === p
                            ? "border-white/40 bg-white/15 text-white"
                            : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10"
                        }`}
                      >
                        {PROVIDER_LABEL[p]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Model</Label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-white/30"
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#15151c]">
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {needsKey && (
                  <div>
                    <Label>
                      API key{" "}
                      {keyAlreadySet && (
                        <span className="ml-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                          Saved
                        </span>
                      )}
                    </Label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        keyAlreadySet
                          ? "Leave blank to keep saved key"
                          : "Paste your API key"
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/30"
                    />
                    <p className="mt-2 text-xs text-white/45">
                      Stored encrypted with AES-GCM (per-user). Never logged.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={test}
                    className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/85 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {busy === "test" ? "Testing…" : "Test connection"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={save}
                    className="rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
                  >
                    {busy === "save" ? "Saving…" : "Save"}
                  </button>
                  <span className="flex-1" />
                  {data?.isUserOverride && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={reset}
                      className="rounded-full border border-red-300/20 bg-red-500/10 px-4 py-2 text-sm text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                    >
                      {busy === "reset" ? "Resetting…" : "Reset to default"}
                    </button>
                  )}
                </div>

                {status && (
                  <div
                    className={`rounded-md border px-3 py-2 text-xs ${
                      status.kind === "ok"
                        ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                        : "border-red-300/30 bg-red-400/10 text-red-200"
                    }`}
                  >
                    <div>{status.text}</div>
                    {status.sample && (
                      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] text-emerald-100/80">
                        {JSON.stringify(status.sample, null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {data && (
                  <div className="border-t border-white/10 pt-4 text-xs text-white/55">
                    Currently in use:{" "}
                    <span className="text-white/90">
                      {PROVIDER_LABEL[data.effective.provider]} ·{" "}
                      {data.effective.model}
                    </span>
                    {data.isUserOverride && (
                      <span className="ml-2 rounded-full bg-violet-400/15 px-2 py-0.5 text-[10px] text-violet-100">
                        custom
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </motion.div>
      </main>
    </PageShell>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-wider text-white/55">
      {children}
    </span>
  );
}
