import { Hono } from "hono";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) =>
  c.json({ ok: true, data: { status: "up", ts: Date.now() } }),
);

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
