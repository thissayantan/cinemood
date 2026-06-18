import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import { authGuard, type Ctx } from "./_shared";
import { getPersonDetail } from "../lib/tmdb";

const ParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

app.get("/api/person/:id", async (c) => {
  const parsed = ParamsSchema.safeParse({ id: c.req.param("id") });
  if (!parsed.success) {
    return c.json(
      { ok: false, error: { code: "VALIDATION", message: parsed.error.message } },
      400,
    );
  }
  const { id } = parsed.data;

  const user = authGuard(c as Ctx);
  if (user instanceof Response) return user;

  if (!c.env.TMDB_API_KEY || !c.env.TMDB_API_KEY.trim()) {
    return c.json(
      {
        ok: false,
        error: {
          code: "UPSTREAM_NOT_CONFIGURED",
          message:
            "TMDB API key is not configured on this deployment. Set TMDB_API_KEY via wrangler secret put.",
        },
      },
      503,
    );
  }

  try {
    const data = await getPersonDetail(c.env.TMDB_API_KEY, c.env.CACHE, id);
    return c.json({ ok: true, data });
  } catch (err) {
    console.error("person detail failed", err);
    return c.json(
      { ok: false, error: { code: "UPSTREAM_ERROR", message: "Person fetch failed" } },
      502,
    );
  }
});

export default app;
