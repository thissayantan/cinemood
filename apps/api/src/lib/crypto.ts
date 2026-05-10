// AES-GCM encrypt/decrypt for per-user LLM config blobs.
// Key is a base64-encoded 32-byte secret (LLM_CONFIG_KEY).

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function importKey(rawKey: string): Promise<CryptoKey> {
  const bytes = base64ToBytes(rawKey);
  if (bytes.byteLength !== 32) {
    throw new Error(`llm_config_key_bad_length: ${bytes.byteLength} bytes`);
  }
  return crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson(
  rawKey: string,
  payload: unknown,
): Promise<string> {
  const key = await importKey(rawKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  const cipherBytes = new Uint8Array(cipher);
  const out = new Uint8Array(iv.byteLength + cipherBytes.byteLength);
  out.set(iv, 0);
  out.set(cipherBytes, iv.byteLength);
  return bytesToBase64(out);
}

export async function decryptJson<T>(
  rawKey: string,
  blob: string,
): Promise<T> {
  const key = await importKey(rawKey);
  const all = base64ToBytes(blob);
  const iv = all.slice(0, 12);
  const cipher = all.slice(12);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipher,
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
