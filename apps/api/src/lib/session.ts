interface SessionData {
  userId: string;
  expiresAt: number;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SESSION_KEY_PREFIX = "session:";

export const SESSION_COOKIE = "cm_session";

export function newSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function base64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function createSession(
  kv: KVNamespace,
  userId: string,
): Promise<{ id: string; expiresAt: number }> {
  const id = newSessionId();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const data: SessionData = { userId, expiresAt };
  await kv.put(SESSION_KEY_PREFIX + id, JSON.stringify(data), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return { id, expiresAt };
}

export async function readSession(
  kv: KVNamespace,
  id: string,
): Promise<SessionData | null> {
  const raw = await kv.get(SESSION_KEY_PREFIX + id);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (parsed.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function destroySession(
  kv: KVNamespace,
  id: string,
): Promise<void> {
  await kv.delete(SESSION_KEY_PREFIX + id);
}

export function buildSessionCookie(id: string, isProduction: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${id}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(isProduction: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function readCookie(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}
