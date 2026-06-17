/**
 * access-token.ts — generation and hashing for personal access tokens.
 *
 * Raw token format: `cmt_` + base64url(32 random bytes)
 * Stored format:    SHA-256 hex of the raw token  (never the plaintext)
 * Display format:   first 12 characters + "…"    (enough to identify, not enough to steal)
 *
 * Raw token is returned ONCE from the API; never logged, cached, or re-revealed.
 */

/**
 * Generate a fresh raw token. Format: `cmt_<base64url(32 bytes)>`.
 * NEVER store or log this value.
 */
export function generateRawToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `cmt_${b64}`;
}

/**
 * SHA-256 hex of `raw`. This is what lives in the database.
 */
export async function hashToken(raw: string): Promise<string> {
  const enc = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * First 12 characters of the raw token (shown in the UI as a display prefix).
 * `cmt_` is 4 chars; the display shows `cmt_XXXXXXXX…`.
 */
export function tokenPrefix(raw: string): string {
  return raw.slice(0, 12);
}
