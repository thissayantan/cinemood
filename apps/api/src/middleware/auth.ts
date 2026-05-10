import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "../env";
import type { User } from "@cinemood/shared";
import { readCookie, readSession, SESSION_COOKIE } from "../lib/session";
import { getUser } from "../db/queries";

export type AuthVars = {
  user: User | null;
};

export const authMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: AuthVars;
}> = async (c, next) => {
  const sid = readCookie(c.req.header("cookie") ?? null, SESSION_COOKIE);
  if (!sid) {
    c.set("user", null);
    await next();
    return;
  }
  const session = await readSession(c.env.SESSIONS, sid);
  if (!session) {
    c.set("user", null);
    await next();
    return;
  }
  const user = await getUser(c.env.DB, session.userId);
  c.set("user", user);
  await next();
};

export function requireUser(
  c: Context<{ Bindings: Env; Variables: AuthVars }>,
): User | Response {
  const user = c.get("user");
  if (!user) {
    return c.json(
      {
        ok: false,
        error: { code: "AUTH_REQUIRED", message: "Sign in required" },
      },
      401,
    );
  }
  return user;
}
