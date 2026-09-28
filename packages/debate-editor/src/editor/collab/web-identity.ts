/**
 * Web browser machine identity (web-collab Phase 2).
 *
 * A non-extractable WebCrypto ECDSA P-256 keypair generated once per
 * browser profile and kept in IndexedDB. The public key's hash IS the
 * machine's routing code ("wk1." + b64url(sha256(spki))) — the same
 * identity the relay's key-proof-bound connect flow expects, and,
 * later, the identity a web pairing code will bind to (Phase 4).
 *
 * `extractable: false` is the point: page JavaScript — including this
 * module — cannot read the private key out, so copying localStorage /
 * IndexedDB to another machine moves nothing that can sign. A copied
 * bearer entitlement dies at its expiry because renewal requires a
 * signature (see relay_auth.verify_web_key_proof on the server).
 *
 * WebCrypto's ECDSA output is raw r||s (64 bytes) — the server converts
 * to DER; we just b64url what subtle.sign returns.
 */

const DB_NAME = 'cardmirror-web-identity';
const STORE = 'keys';
const KEY_ID = 'machine-v1';
const RC_PREFIX = 'wk1.';

interface StoredIdentity {
  id: string;
  keyPair: CryptoKeyPair;
  /** Cached so the routing code is derivable without an export call. */
  spki: ArrayBuffer;
}

let cached: { keyPair: CryptoKeyPair; spki: ArrayBuffer } | null = null;

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

function idbGet(db: IDBDatabase): Promise<StoredIdentity | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY_ID);
    req.onsuccess = () => resolve(req.result as StoredIdentity | undefined);
    req.onerror = () => reject(req.error ?? new Error('indexedDB get failed'));
  });
}

function idbPut(db: IDBDatabase, value: StoredIdentity): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB put failed'));
  });
}

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function loadOrCreate(): Promise<{ keyPair: CryptoKeyPair; spki: ArrayBuffer }> {
  if (cached) return cached;
  const db = await openDb();
  try {
    const existing = await idbGet(db);
    if (existing?.keyPair?.privateKey && existing.spki) {
      cached = { keyPair: existing.keyPair, spki: existing.spki };
      return cached;
    }
    const keyPair = (await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, // non-extractable: the whole design
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    await idbPut(db, { id: KEY_ID, keyPair, spki });
    cached = { keyPair, spki };
    return cached;
  } finally {
    db.close();
  }
}

/** This browser's routing code — derived from the public key, so it
 *  survives only as long as the key does (cleared site data = a new
 *  machine, which claims a new seat on next connect). */
export async function webRoutingCode(): Promise<string> {
  const { spki } = await loadOrCreate();
  const hash = await crypto.subtle.digest('SHA-256', spki);
  return RC_PREFIX + b64url(hash);
}

export interface WebKeyProof {
  webSpki: string;
  webTs: number;
  webSig: string;
}

/** Sign the server's canonical payload for `purpose` ('connect' |
 *  'renew'). Fresh timestamp each call; the server enforces the skew
 *  window and that the spki hash matches the routing code. */
export async function signWebProof(
  purpose: 'connect' | 'renew' | 'disconnect',
): Promise<WebKeyProof> {
  const { keyPair, spki } = await loadOrCreate();
  const rc = await webRoutingCode();
  const ts = Math.floor(Date.now() / 1000);
  const payload = new TextEncoder().encode(`cmweb1:${purpose}:${rc}:${ts}`);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    keyPair.privateKey,
    payload,
  );
  return { webSpki: b64url(spki), webTs: ts, webSig: b64url(sig) };
}

/** Test hook: drop the module cache (NOT the stored key). */
export function __resetWebIdentityCacheForTests(): void {
  cached = null;
}
