import { Hono } from "hono";
import type { Env } from "../env";
import type { AuthVars } from "../middleware/auth";
import {
  buildAuthUrl,
  exchangeCode,
  fetchProfile,
} from "../lib/oauth";
import {
  buildSessionCookie,
  clearSessionCookie,
  createSession,
  newSessionId,
  readCookie,
} from "../lib/session";
import { revokeAllSessions, upsertUser } from "../db/queries";

const STATE_COOKIE = "cm_oauth_state";
const STATE_TTL_SECONDS = 600;

function webUrl(env: Env, path: string): string {
  const origin = env.WEB_ORIGIN?.replace(/\/$/, "") ?? "";
  return origin + path;
}

function stateCookie(value: string, maxAge: number, isProd: boolean): string {
  const parts = [
    `${STATE_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

const app = new Hono<{ Bindings: Env; Variables: AuthVars }>();

app.get("/auth/google", async (c) => {
  const state = newSessionId();
  const isProd = c.env.ENVIRONMENT === "production";
  c.header("Set-Cookie", stateCookie(state, STATE_TTL_SECONDS, isProd));
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

  // Granular error reporting — the global onError swallows everything as
  // INTERNAL which makes "Sign-in failed" undebuggable. Each side-effect
  // gets its own labelled error so the user (and the logs) see which
  // step actually broke.
  function errorRedirect(code: string, err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.redirect(
      webUrl(
        c.env,
        `/?auth_error=${code}&detail=${encodeURIComponent(msg.slice(0, 120))}`,
      ),
    );
  }

  try {
    await upsertUser(c.env.DB, {
      id: profile.sub,
      email: profile.email,
      name: profile.name ?? null,
      picture: profile.picture ?? null,
    });
  } catch (err) {
    console.error("oauth callback: upsertUser failed", err);
    return errorRedirect("db_write_failed", err);
  }

  let session;
  try {
    session = await createSession(c.env.SESSION_SIGNING_KEY, profile.sub);
  } catch (err) {
    console.error("oauth callback: createSession failed", err);
    return errorRedirect("session_create_failed", err);
  }
  const isProd = c.env.ENVIRONMENT === "production";
  c.header("Set-Cookie", buildSessionCookie(session.value, isProd), {
    append: true,
  });

  // Clear the state cookie.
  c.header("Set-Cookie", stateCookie("", 0, isProd), { append: true });

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
  // Stateless signed-cookie sessions have no server-side record to
  // destroy; clearing the cookie is sufficient.
  const isProd = c.env.ENVIRONMENT === "production";
  c.header("Set-Cookie", clearSessionCookie(isProd));
  return c.json({ ok: true, data: { logged_out: true } });
});

/** Sign the user out on every device.
 *
 *  Stateless sessions don't have a server-side record to delete, so
 *  "global logout" is implemented by bumping the user's
 *  `min_issued_at` watermark to now. Every signed token minted before
 *  this instant (anywhere — other browsers, other devices, stolen
 *  cookies) becomes invalid on its next request.
 *
 *  Requires an authenticated request — the caller proves ownership
 *  of the account by presenting a currently-valid token. After the
 *  watermark update the current cookie is *also* invalidated, so the
 *  response clears it so the browser stops sending it. */
app.post("/auth/logout-everywhere", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json(
      { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in required" } },
      401,
    );
  }
  await revokeAllSessions(c.env.DB, user.id);
  const isProd = c.env.ENVIRONMENT === "production";
  c.header("Set-Cookie", clearSessionCookie(isProd));
  return c.json({ ok: true, data: { logged_out: true } });
});

export default app;
