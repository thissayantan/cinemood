import { Hono, type Context } from "hono";
import { z } from "zod";
import type { LlmConfig, LlmConfigPublic } from "@cinemood/shared";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import { isValidModel, MODEL_CATALOG } from "../llm/catalog";
import { createLlmProvider } from "../llm";
import { resolveLlmConfig } from "../llm/resolve";
import {
  deleteUserLlmConfig,
  readUserLlmConfig,
  writeUserLlmConfig,
} from "../lib/user-llm";

type Ctx = Context<{ Bindings: Env; Variables: AuthVars }>;

function authError(c: Ctx) {
  return c.json(
    { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required" } },
    401,
  );
}

function validationError(c: Ctx, message: string) {
  return c.json(
    { ok: false, error: { code: "VALIDATION", message } },
    400,
  );
}

async function readJsonBody(c: Ctx): Promise<unknown | Response> {
  try {
    return await c.req.json();
  } catch {
    return validationError(c, "Invalid JSON");
  }
}

const PutSchema = z
  .discriminatedUnion("provider", [
    z.object({
      provider: z.literal("cloudflare"),
      model: z.string().min(1),
    }),
    z.object({
      provider: z.literal("anthropic"),
      model: z.string().min(1),
      apiKey: z.string().min(1).optional(),
    }),
    z.object({
      provider: z.literal("openai"),
      model: z.string().min(1),
      apiKey: z.string().min(1).optional(),
      baseUrl: z.string().url().optional(),
    }),
    z.object({
      provider: z.literal("google"),
      model: z.string().min(1),
      apiKey: z.string().min(1).optional(),
    }),
  ])
  .refine((v) => isValidModel(v.provider, v.model), {
    message: "Unknown model for provider",
  });

const TestSchema = PutSchema;

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

function publicView(cfg: LlmConfig): LlmConfigPublic {
  return {
    provider: cfg.provider,
    model: cfg.model,
    hasKey: cfg.provider !== "cloudflare" && Boolean(cfg.apiKey),
  };
}

app.get("/api/settings/llm", async (c) => {
  const user = c.get("user");
  if (!user) return authError(c);
  const userCfg = await readUserLlmConfig(c.env, user.id);
  const effective = userCfg ?? (await resolveLlmConfig(c.env, user.id));
  return c.json({
    ok: true,
    data: {
      effective: publicView(effective),
      isUserOverride: Boolean(userCfg),
      catalog: MODEL_CATALOG,
    },
  });
});

async function buildConfigFromBody(
  parsed: z.infer<typeof PutSchema>,
  env: Env,
  userId: string,
): Promise<LlmConfig> {
  if (parsed.provider === "cloudflare") {
    return { provider: "cloudflare", model: parsed.model };
  }
  let apiKey = parsed.apiKey;
  if (!apiKey) {
    const existing = await readUserLlmConfig(env, userId);
    if (
      existing &&
      existing.provider === parsed.provider &&
      "apiKey" in existing &&
      existing.apiKey
    ) {
      apiKey = existing.apiKey;
    }
  }
  if (!apiKey) {
    throw new Error("missing_api_key");
  }
  if (parsed.provider === "openai") {
    return {
      provider: "openai",
      model: parsed.model,
      apiKey,
      baseUrl: parsed.baseUrl,
    };
  }
  return { provider: parsed.provider, model: parsed.model, apiKey };
}

app.put("/api/settings/llm", async (c) => {
  const user = c.get("user");
  if (!user) return authError(c);
  const body = await readJsonBody(c);
  if (body instanceof Response) return body;
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) return validationError(c, parsed.error.message);
  let cfg: LlmConfig;
  try {
    cfg = await buildConfigFromBody(parsed.data, c.env, user.id);
  } catch (err) {
    return validationError(c, err instanceof Error ? err.message : "Bad config");
  }
  await writeUserLlmConfig(c.env, user.id, cfg);
  return c.json({ ok: true, data: { saved: publicView(cfg) } });
});

app.delete("/api/settings/llm", async (c) => {
  const user = c.get("user");
  if (!user) return authError(c);
  await deleteUserLlmConfig(c.env, user.id);
  const effective = await resolveLlmConfig(c.env, user.id);
  return c.json({
    ok: true,
    data: { effective: publicView(effective), isUserOverride: false },
  });
});

app.post("/api/settings/llm/test", async (c) => {
  const user = c.get("user");
  if (!user) return authError(c);
  const body = await readJsonBody(c);
  if (body instanceof Response) return body;
  const parsed = TestSchema.safeParse(body);
  if (!parsed.success) return validationError(c, parsed.error.message);
  let cfg: LlmConfig;
  try {
    cfg = await buildConfigFromBody(parsed.data, c.env, user.id);
  } catch (err) {
    return validationError(c, err instanceof Error ? err.message : "Bad config");
  }
  const provider = createLlmProvider(cfg, c.env);
  const result = await provider.testConnection();
  return c.json({ ok: true, data: result });
});

export default app;
