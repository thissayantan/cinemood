import { Hono } from "hono";
import type { Env } from "./env";
import { authMiddleware, type AuthVars } from "./middleware/auth";
import authRoutes from "./routes/auth";
import meRoutes from "./routes/me";
import searchRoutes from "./routes/search";
import titleRoutes from "./routes/title";
import watchlistRoutes from "./routes/watchlist";
import nlSearchRoutes from "./routes/nl-search";
import settingsRoutes from "./routes/settings";
import importRoutes from "./routes/import";
import setupStatusRoutes from "./routes/setup-status";
import recommendRoutes from "./routes/recommend";

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

app.use("*", authMiddleware);

app.get("/api/health", (c) =>
  c.json({ ok: true, data: { status: "up", ts: Date.now() } }),
);

app.route("/", authRoutes);
app.route("/", meRoutes);
app.route("/", searchRoutes);
app.route("/", titleRoutes);
app.route("/", watchlistRoutes);
app.route("/", nlSearchRoutes);
app.route("/", settingsRoutes);
app.route("/", importRoutes);
app.route("/", setupStatusRoutes);
app.route("/", recommendRoutes);

app.notFound((c) =>
  c.json(
    { ok: false, error: { code: "NOT_FOUND", message: "Route not found" } },
    404,
  ),
);

app.onError((err, c) => {
  console.error("api error", err);
  return c.json(
    { ok: false, error: { code: "INTERNAL", message: "Internal error" } },
    500,
  );
});

export default app;
