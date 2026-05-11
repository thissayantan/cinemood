/** Stateless, signed-cookie session implementation.
 *
 *  Previously sessions were persisted as a row in the SESSIONS KV
 *  namespace: createSession did a `kv.put`, readSession a `kv.get`.
 *  Cloudflare's free-tier KV caps writes at 1,000/day. Every sign-in
 *  spent one of those writes; once exhausted, *no one* could sign in
 *  until the daily counter reset at UTC midnight.
 *
 *  The session payload here is tiny — `{userId, expiresAt}` — and the
 *  Worker already has a strong server-side secret (`SESSION_SIGNING_KEY`)
 *  available for HMAC. So we sign the payload, put it in the cookie, and
 *  carry it round on every request. No I/O on the auth hot path; no
 *  daily cap exposure; no infra dependency on KV for login.
 *
 *  Trade-off: there's no server-side revocation list, so a stolen cookie
 *  remains valid until it expires. Acceptable for a personal-catalog
 *  app; a future "sign me out everywhere" feature can add a small
 *  revocation set in KV that's checked alongside signature verification. */

export interface SessionData {
  userId: string;
  /** Unix seconds when this token was minted. Compared against the
   *  user row's `min_issued_at` watermark on every request, so a
   *  "sign me out everywhere" action can invalidate every prior token
   *  without server-side per-session bookkeeping. */
  issuedAt: number;
  /** Unix seconds at which this token's signature stops being honoured. */
  expiresAt: number;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replaceAll("-", "+").replaceAll("_", "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

let cachedKey: { material: string; key: CryptoKey } | null = null;
async function importSigningKey(material: string): Promise<CryptoKey> {
  if (cachedKey && cachedKey.material === material) return cachedKey.key;
  const key = await crypto.subtle.importKey(
    "raw",
    utf8(material),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  cachedKey = { material, key };
  return key;
}

async function sign(payload: string, signingKey: string): Promise<string> {
  const key = await importSigningKey(signingKey);
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, utf8(payload)),
  );
  return base64Url(sig);
}

async function verifySig(
  payload: string,
  signature: string,
  signingKey: string,
): Promise<boolean> {
  const key = await importSigningKey(signingKey);
  try {
    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(signature),
      utf8(payload),
    );
  } catch {
    return false;
  }
}

/** Create a fresh signed session cookie value. The returned string is
 *  put straight into Set-Cookie; no KV write happens. */
export async function createSession(
  signingKey: string,
  userId: string,
): Promise<{ value: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_TTL_SECONDS;
  const data: SessionData = { userId, issuedAt: now, expiresAt };
  const payload = base64Url(utf8(JSON.stringify(data)));
  const signature = await sign(payload, signingKey);
  return { value: `${payload}.${signature}`, expiresAt };
}

/** Verify the signed cookie. Returns the embedded session data if the
 *  signature is valid and the session hasn't expired; null otherwise. */
export async function readSession(
  signingKey: string,
  cookieValue: string,
): Promise<SessionData | null> {
  if (!cookieValue || !cookieValue.includes(".")) return null;
  const [payload, signature, ...rest] = cookieValue.split(".");
  if (!payload || !signature || rest.length > 0) return null;
  if (!(await verifySig(payload, signature, signingKey))) return null;
  let data: SessionData;
  try {
    data = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as SessionData;
  } catch {
    return null;
  }
  if (
    typeof data.userId !== "string" ||
    typeof data.expiresAt !== "number" ||
    data.expiresAt < Math.floor(Date.now() / 1000)
  ) {
    return null;
  }
  // Tokens minted before this column existed (or before any "sign me
  // out everywhere" event) carry no issuedAt — treat as 0 so the
  // middleware's `>= minIssuedAt` check still works.
  if (typeof data.issuedAt !== "number") data.issuedAt = 0;
  return data;
}

/** Destroy a session client-side. Stateless sessions have no
 *  server-side record to delete, so this is a no-op — the caller
 *  clears the cookie via `clearSessionCookie`. Kept for callsite
 *  compatibility. */
export async function destroySession(): Promise<void> {
  /* no-op */
}

export function buildSessionCookie(value: string, isProduction: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${value}`,
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
