/**
 * @fileoverview The opaque reference an anonymous practice match travels as.
 *
 * `POST /api/practice-partners/match` must let the viewer send a request to
 * the debater it found without telling them who that is — so the browser gets
 * neither a name nor an account id, only this token: the matched debater's id,
 * the viewer's id and an expiry, sealed with AES-GCM under a key derived from
 * the auth secret. Only the server can open it, a token minted for one viewer
 * does not open for another, and it lapses after {@link MATCH_TOKEN_TTL_SECONDS}.
 * Every token is freshly randomised, so two tokens for the same debater do not
 * look alike either.
 *
 * Web Crypto only, so it runs unchanged in the Worker and under Vitest.
 *
 * @module lib/practice-partners/match-token
 */

/** How long a found match can still be requested. */
export const MATCH_TOKEN_TTL_SECONDS = 2 * 60 * 60;

const IV_BYTES = 12;
const keys = new Map<string, Promise<CryptoKey>>();

function aesKey(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret);
  if (!key) {
    key = crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(`practice-partner-match:${secret}`))
      .then((raw) => crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]));
    keys.set(secret, key);
  }
  return key;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Seals `opponentId` for `viewerId`, valid until `nowSeconds` + the TTL. */
export async function sealMatchToken(
  secret: string,
  { viewerId, opponentId }: { viewerId: string; opponentId: string },
  nowSeconds: number,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plain = new TextEncoder().encode(
    JSON.stringify({ v: viewerId, o: opponentId, e: nowSeconds + MATCH_TOKEN_TTL_SECONDS }),
  );
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(secret), plain));
  const out = new Uint8Array(IV_BYTES + sealed.length);
  out.set(iv);
  out.set(sealed, IV_BYTES);
  return toBase64Url(out);
}

/**
 * The matched debater's id, or `null` when the token is malformed, tampered
 * with, minted for someone else, or expired.
 */
export async function openMatchToken(
  secret: string,
  token: unknown,
  viewerId: string,
  nowSeconds: number,
): Promise<string | null> {
  if (typeof token !== "string" || token.length > 1024) return null;
  const bytes = fromBase64Url(token);
  if (!bytes || bytes.length <= IV_BYTES) return null;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, IV_BYTES) },
      await aesKey(secret),
      bytes.slice(IV_BYTES),
    );
    const { v, o, e } = JSON.parse(new TextDecoder().decode(plain)) as { v?: unknown; o?: unknown; e?: unknown };
    if (v !== viewerId || typeof o !== "string" || typeof e !== "number" || e < nowSeconds) return null;
    return o;
  } catch {
    return null;
  }
}

/** The key material: the auth secret, with the same dev fallback `lib/auth` uses. */
export function matchTokenSecret(getEnv: (name: string) => string | undefined): string {
  return getEnv("BETTER_AUTH_SECRET") || "dev-secret-change-in-production";
}
