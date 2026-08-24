/**
 * Web port of the card-sharing sealed box (web-collab Phase 4).
 *
 * WIRE-IDENTICAL to the desktop implementation in
 * apps/desktop/src/pairing-crypto.ts — same `cmk1.` public codes, same
 * routing-id derivation, same SealedBundle {epk, iv, ct, tag} — so web
 * and desktop machines share cards with each other transparently
 * (pinned by an interop test that round-trips against the Node
 * implementation). Scheme:
 *
 *   X25519 ECDH (ephemeral sender key → recipient public key)
 *     → HKDF-SHA256(shared, salt = ephPub‖recipPub, info 'cardmirror-pairing-v1')
 *     → AES-256-GCM (WebCrypto emits ct‖tag — split to match the wire)
 *
 * The keypair lives in IndexedDB with a NON-EXTRACTABLE private key
 * (deriveBits allowed, export forbidden) — stronger than desktop's
 * key file: page JS cannot read the key out, so copied site storage
 * cannot decrypt this machine's cards elsewhere.
 */

const CODE_PREFIX = 'cmk1.';
const HKDF_INFO = new TextEncoder().encode('cardmirror-pairing-v1');
const DB_NAME = 'cardmirror-web-pairing';
const STORE = 'keys';
const KEY_ID = 'x25519-v1';

export interface SealedBundle {
  epk: string;
  iv: string;
  ct: string;
  tag: string;
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(pad), (c) => c.charCodeAt(0));
}

function rawFromPublicCode(code: string): Uint8Array {
  const trimmed = code.trim();
  const b64 = trimmed.startsWith(CODE_PREFIX) ? trimmed.slice(CODE_PREFIX.length) : trimmed;
  return fromB64url(b64);
}

async function importPeerPublic(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'OKP', crv: 'X25519', x: b64url(raw) },
    { name: 'X25519' },
    false,
    [],
  );
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
}

/** Host-visible routing code for a public code — sha256(rawKey)[0..16),
 *  b64url. Identical to the desktop derivation. */
export async function webRoutingId(publicCode: string): Promise<string> {
  const digest = await sha256(rawFromPublicCode(publicCode));
  return b64url(digest.subarray(0, 16));
}

async function deriveAesKey(
  privateKey: CryptoKey,
  peerPublic: CryptoKey,
  ephPubRaw: Uint8Array,
  recipPubRaw: Uint8Array,
): Promise<CryptoKey> {
  const shared = await crypto.subtle.deriveBits({ name: 'X25519', public: peerPublic }, privateKey, 256);
  const salt = new Uint8Array(ephPubRaw.length + recipPubRaw.length);
  salt.set(ephPubRaw, 0);
  salt.set(recipPubRaw, ephPubRaw.length);
  const hkdfKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: HKDF_INFO as BufferSource },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// ── Keystore (IndexedDB) ─────────────────────────────────────────────

interface StoredKeys {
  id: string;
  keyPair: CryptoKeyPair;
  pubRaw: ArrayBuffer;
}

let cached: { keyPair: CryptoKeyPair; pubRaw: Uint8Array } | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
  });
}

function idbGet(db: IDBDatabase): Promise<StoredKeys | undefined> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY_ID);
    req.onsuccess = () => resolve(req.result as StoredKeys | undefined);
    req.onerror = () => reject(req.error ?? new Error('indexedDB get failed'));
  });
}

function idbPut(db: IDBDatabase, value: StoredKeys): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB put failed'));
  });
}

async function generate(db: IDBDatabase): Promise<{ keyPair: CryptoKeyPair; pubRaw: Uint8Array }> {
  const keyPair = (await crypto.subtle.generateKey({ name: 'X25519' }, false, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as { x?: string };
  const pubRaw = fromB64url(jwk.x ?? '');
  await idbPut(db, { id: KEY_ID, keyPair, pubRaw: pubRaw.buffer as ArrayBuffer });
  return { keyPair, pubRaw };
}

async function loadOrCreate(): Promise<{ keyPair: CryptoKeyPair; pubRaw: Uint8Array }> {
  if (cached) return cached;
  const db = await openDb();
  try {
    const existing = await idbGet(db);
    if (existing?.keyPair?.privateKey && existing.pubRaw) {
      cached = { keyPair: existing.keyPair, pubRaw: new Uint8Array(existing.pubRaw) };
      return cached;
    }
    cached = await generate(db);
    return cached;
  } finally {
    db.close();
  }
}

/** This browser's shareable pairing code (`cmk1.…` = its public key). */
export async function webOwnPublicCode(): Promise<string> {
  const { pubRaw } = await loadOrCreate();
  return CODE_PREFIX + b64url(pubRaw);
}

/** The opaque routing code the relay sees for this browser's mailbox. */
export async function webOwnRoutingId(): Promise<string> {
  return webRoutingId(await webOwnPublicCode());
}

/** Throw away the keypair, mint a fresh one (invalidates old shares). */
export async function webRegenerateKey(): Promise<string> {
  const db = await openDb();
  try {
    cached = await generate(db);
    return CODE_PREFIX + b64url(cached.pubRaw);
  } finally {
    db.close();
  }
}

/** Seal an object to a recipient's public code (anonymous sealed box). */
export async function webSeal(obj: unknown, recipientPublicCode: string): Promise<SealedBundle> {
  const recipRaw = rawFromPublicCode(recipientPublicCode);
  const recipPub = await importPeerPublic(recipRaw);
  const eph = (await crypto.subtle.generateKey({ name: 'X25519' }, false, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const ephJwk = (await crypto.subtle.exportKey('jwk', eph.publicKey)) as { x?: string };
  const ephRaw = fromB64url(ephJwk.x ?? '');
  const aes = await deriveAesKey(eph.privateKey, recipPub, ephRaw, recipRaw);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(obj));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, aes, plain as BufferSource),
  );
  // WebCrypto appends the 16-byte GCM tag; the wire carries it apart.
  const ct = sealed.subarray(0, sealed.length - 16);
  const tag = sealed.subarray(sealed.length - 16);
  return { epk: b64url(ephRaw), iv: b64url(iv), ct: b64url(ct), tag: b64url(tag) };
}

/** Open a bundle addressed to this browser. Throws on tamper/wrong key. */
export async function webOpen(bundle: SealedBundle): Promise<unknown> {
  const { keyPair, pubRaw } = await loadOrCreate();
  const ephRaw = fromB64url(bundle.epk);
  const ephPub = await importPeerPublic(ephRaw);
  const aes = await deriveAesKey(keyPair.privateKey, ephPub, ephRaw, pubRaw);
  const ct = fromB64url(bundle.ct);
  const tag = fromB64url(bundle.tag);
  const joined = new Uint8Array(ct.length + tag.length);
  joined.set(ct, 0);
  joined.set(tag, ct.length);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64url(bundle.iv) as BufferSource },
    aes,
    joined as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

/** Test hook: drop the module cache (not the stored key). */
export function __resetWebPairingCryptoForTests(): void {
  cached = null;
}
