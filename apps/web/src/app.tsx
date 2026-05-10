import { Routes, Route, useSearchParams, Navigate } from "react-router-dom";
import HomePage from "./pages/home";
import LandingPage from "./pages/landing";
import SettingsSearchPage from "./pages/settings-search";
import { useUser } from "./lib/use-user";
import { PageShell } from "./components/page-shell";

function Root() {
  const state = useUser();
  const [params] = useSearchParams();
  const authError = params.get("auth_error");

  if (state.status === "loading") {
    return (
      <PageShell>
        <div className="grid min-h-screen place-items-center text-sm text-white/40">
          Loading…
        </div>
      </PageShell>
    );
  }
  if (state.status === "ok") return <HomePage user={state.user} />;
  return <LandingPage authError={authError} />;
}

function SettingsRoute() {
  const state = useUser();
  if (state.status === "loading") {
    return (
      <PageShell>
        <div className="grid min-h-screen place-items-center text-sm text-white/40">
          Loading…
        </div>
      </PageShell>
    );
  }
  if (state.status !== "ok") return <Navigate to="/" replace />;
  return <SettingsSearchPage user={state.user} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/settings/search" element={<SettingsRoute />} />
      <Route path="/" element={<Root />} />
      <Route path="*" element={<Root />} />
    </Routes>
  );
}
