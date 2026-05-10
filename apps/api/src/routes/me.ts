import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

app.get("/api/me", (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json(
      { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required" } },
      401,
    );
  }
  return c.json({ ok: true, data: user });
});

export default app;
