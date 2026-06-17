import type React from "react";
import { Routes, Route, useSearchParams, Navigate } from "react-router-dom";
import type { User } from "@cinemood/shared";
import HomePage from "./pages/home";
import LandingPage from "./pages/landing";
import SettingsSearchPage from "./pages/settings-search";
import SettingsAccountPage from "./pages/settings-account";
import SettingsTokensPage from "./pages/settings-tokens";
import ImportPage from "./pages/import";
import NotFoundPage from "./pages/not-found";
import { useUser } from "./lib/use-user";

function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--paper)] font-mono text-[11px] uppercase tracking-wider text-[var(--paper-faint)]">
      Loading…
    </div>
  );
}

function Root() {
  const state = useUser();
  const [params] = useSearchParams();
  const authError = params.get("auth_error");
  const authDetail = params.get("detail");
  const setupError = params.get("setup_error");
  const fullError = authError
    ? authDetail
      ? `${authError} — ${authDetail}`
      : authError
    : null;

  if (state.status === "loading") return <Loading />;
  if (state.status === "ok") return <HomePage user={state.user} />;
  return <LandingPage authError={fullError} setupError={setupError} />;
}

function AuthedShell({
  render,
}: {
  render: (user: User) => React.ReactElement;
}) {
  const state = useUser();
  if (state.status === "loading") return <Loading />;
  if (state.status !== "ok") return <Navigate to="/" replace />;
  return render(state.user);
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/settings/account"
        element={<AuthedShell render={(u) => <SettingsAccountPage user={u} />} />}
      />
      <Route
        path="/settings/search"
        element={<AuthedShell render={(u) => <SettingsSearchPage user={u} />} />}
      />
      <Route
        path="/settings/tokens"
        element={<AuthedShell render={(u) => <SettingsTokensPage user={u} />} />}
      />
      <Route
        path="/import"
        element={<AuthedShell render={(u) => <ImportPage user={u} />} />}
      />
      <Route path="/" element={<Root />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
