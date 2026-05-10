import { Routes, Route, useSearchParams } from "react-router-dom";
import HomePage from "./pages/home";
import LandingPage from "./pages/landing";
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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route path="*" element={<Root />} />
    </Routes>
  );
}
