import { Hono } from "hono";
import type { Env } from "../env";
import {
  buildAuthUrl,
  exchangeCode,
  fetchProfile,
} from "../lib/oauth";
import {
  buildSessionCookie,
  clearSessionCookie,
  createSession,
  destroySession,
  newSessionId,
  readCookie,
  SESSION_COOKIE,
} from "../lib/session";
import { upsertUser } from "../db/queries";

const STATE_COOKIE = "cm_oauth_state";
const STATE_TTL_SECONDS = 600;

function webUrl(env: Env, path: string): string {
  const origin = env.WEB_ORIGIN?.replace(/\/$/, "") ?? "";
  return origin + path;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/auth/google", async (c) => {
  const state = newSessionId();
  const isProd = c.env.ENVIRONMENT === "production";
  const stateCookieParts = [
    `${STATE_COOKIE}=${state}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${STATE_TTL_SECONDS}`,
  ];
  if (isProd) stateCookieParts.push("Secure");
  c.header("Set-Cookie", stateCookieParts.join("; "));
  return c.redirect(buildAuthUrl(c.env, state));
});

app.get("/auth/google/callback", async (c) => {
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return c.redirect(webUrl(c.env, `/?auth_error=${encodeURIComponent(error)}`));
  }
  if (!code || !state) {
    return c.redirect(webUrl(c.env, "/?auth_error=missing_params"));
  }

  const cookieState = readCookie(c.req.header("cookie") ?? null, STATE_COOKIE);
  if (!cookieState || cookieState !== state) {
    return c.redirect(webUrl(c.env, "/?auth_error=state_mismatch"));
  }

  let profile;
  try {
    const tokens = await exchangeCode(c.env, code);
    profile = await fetchProfile(tokens.access_token);
  } catch (err) {
    console.error("oauth callback failed", err);
    return c.redirect(webUrl(c.env, "/?auth_error=oauth_failed"));
  }

  if (!profile.email_verified) {
    return c.redirect(webUrl(c.env, "/?auth_error=email_unverified"));
  }

  await upsertUser(c.env.DB, {
    id: profile.sub,
    email: profile.email,
    name: profile.name ?? null,
    picture: profile.picture ?? null,
  });

  const session = await createSession(c.env.SESSIONS, profile.sub);
  const isProd = c.env.ENVIRONMENT === "production";
  c.header("Set-Cookie", buildSessionCookie(session.id, isProd), {
    append: true,
  });

  // Clear the state cookie.
  const stateClearParts = [
    `${STATE_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isProd) stateClearParts.push("Secure");
  c.header("Set-Cookie", stateClearParts.join("; "), { append: true });

  return c.redirect(webUrl(c.env, "/"));
});

// Dev-only: adopt an existing KV-resident session id as the browser cookie,
// so manual screenshots and Playwright runs can skip the Google round-trip.
// Hard-gated on ENVIRONMENT === "development".
app.get("/auth/dev-adopt-session", async (c) => {
  if (c.env.ENVIRONMENT !== "development") {
    return c.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Route not found" } },
      404,
    );
  }
  const sid = c.req.query("sid");
  if (!sid) {
    return c.json(
      { ok: false, error: { code: "VALIDATION", message: "Missing sid" } },
      400,
    );
  }
  c.header("Set-Cookie", buildSessionCookie(sid, false));
  return c.redirect(webUrl(c.env, "/"));
});

app.post("/auth/logout", async (c) => {
  const sid = readCookie(c.req.header("cookie") ?? null, SESSION_COOKIE);
  if (sid) await destroySession(c.env.SESSIONS, sid);
  const isProd = c.env.ENVIRONMENT === "production";
  c.header("Set-Cookie", clearSessionCookie(isProd));
  return c.json({ ok: true, data: { logged_out: true } });
});

export default app;
