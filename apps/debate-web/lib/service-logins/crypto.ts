/**
 * @fileoverview AES-GCM encryption for the service logins kept in D1
 * (passwords and session tokens), so a database dump or export never holds
 * them in the clear.
 *
 * The key is derived with HKDF-SHA-256 from `SERVICE_LOGINS_SECRET`, or
 * `BETTER_AUTH_SECRET` when that is unset. Rotating the secret makes the
 * stored values unreadable: they then read as absent and the admin enters the
 * login again.
 *
 * @module lib/service-logins/crypto
 */

const VERSION = "v1";
const encoder = new TextEncoder();
const keys = new Map<string, Promise<CryptoKey>>();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function deriveKey(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret);
  if (!key) {
    key = (async () => {
      const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "HKDF", false, ["deriveKey"]);
      return crypto.subtle.deriveKey(
        { name: "HKDF", hash: "SHA-256", salt: encoder.encode("debate-ai service logins"), info: encoder.encode(VERSION) },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
    })();
    keys.set(secret, key);
  }
  return key;
}

/** `v1.<iv>.<ciphertext>`, both base64url. */
export async function encryptSecret(plain: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await deriveKey(secret), encoder.encode(plain));
  return `${VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(cipher))}`;
}

/** The plain text, or `null` when the value is malformed or was encrypted with another secret. */
export async function decryptSecret(sealed: string | null | undefined, secret: string): Promise<string | null> {
  if (!sealed) return null;
  const [version, iv, cipher] = sealed.split(".");
  if (version !== VERSION || !iv || !cipher) return null;
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(iv) }, await deriveKey(secret), fromBase64Url(cipher));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
