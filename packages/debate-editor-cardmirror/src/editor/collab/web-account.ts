/**
 * Web account linking (web-collab Phase 2): the browser edition's
 * equivalent of the desktop main-process entitlement store.
 *
 * connect(code) proves possession of this browser's non-extractable
 * key ([[web-identity]]) alongside the one-time connect code, stores
 * the minted entitlement, and schedules quiet renewal. The entitlement
 * is a bearer (localStorage), but a copied one dies at expiry: renewal
 * requires the key's signature, which cannot leave this origin.
 *
 * Light module — consulted from relayClient() resolution; no wasm, no
 * heavy imports. State is localStorage so the sync callers (token
 * suppliers) never await.
 */

import { signWebProof, webRoutingCode } from './web-identity.js';

const LS_TOKEN = 'pmd-web-entitlement';
const LS_EXP = 'pmd-web-entitlement-exp'; // epoch ms
const LS_EMAIL = 'pmd-web-entitlement-email';
const LS_RC = 'pmd-web-routing-code';

/** Renew when less than this remains. Entitlement TTLs are hours-to-
 *  days; half a day of margin absorbs sleep/offline gaps. */
const RENEW_MARGIN_MS = 12 * 60 * 60 * 1000;
const RENEW_CHECK_MS = 30 * 60 * 1000;

let renewTimer: ReturnType<typeof setInterval> | null = null;

/** Fired on every credential transition (connect, disconnect, renewal
 *  outcome) so long-lived consumers — the mailbox push stream — can
 *  re-check instead of riding a connection authorized by a credential
 *  the user has since discarded. */
const changeListeners = new Set<() => void>();

export function onWebAccountChanged(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

function fireChanged(): void {
  for (const fn of changeListeners) fn();
}

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface WebAccountStatus {
  connected: boolean;
  email: string;
  routingCode: string;
  expiresAt: number | null;
}

export function webAccountStatus(): WebAccountStatus {
  const s = ls();
  const token = s?.getItem(LS_TOKEN) ?? '';
  const exp = Number(s?.getItem(LS_EXP) ?? 0);
  const live = !!token && exp > Date.now();
  return {
    connected: live,
    email: s?.getItem(LS_EMAIL) ?? '',
    routingCode: s?.getItem(LS_RC) ?? '',
    expiresAt: live ? exp : null,
  };
}

/** Sync suppliers for the relay client resolution. Empty when not
 *  connected (or expired) so callers can fall through. */
export function webEntitlementToken(): string {
  const s = ls();
  const token = s?.getItem(LS_TOKEN) ?? '';
  const exp = Number(s?.getItem(LS_EXP) ?? 0);
  return token && exp > Date.now() ? token : '';
}

export function webRoutingCodeSync(): string {
  return ls()?.getItem(LS_RC) ?? '';
}

interface ConnectResponse {
  entitlement: string;
  expiresAt: number;
  email?: string;
  grace?: boolean;
}

async function postConnect(
  relayBase: string,
  body: Record<string, unknown>,
): Promise<ConnectResponse> {
  const res = await fetch(`${relayBase.replace(/\/+$/, '')}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const parsed = (await res.json()) as { detail?: unknown };
      detail =
        typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail ?? '');
    } catch {
      /* non-JSON error body */
    }
    const err = new Error(detail || `connect failed (${res.status})`) as Error & {
      status?: number;
      detail?: string;
      detailObj?: Record<string, unknown>;
    };
    err.status = res.status;
    err.detail = detail;
    // Structured 409 bodies (seatLimit / youWereEvicted) ride through
    // for the settings UI's confirm-evict flow.
    try {
      const parsed = JSON.parse(detail) as unknown;
      if (parsed && typeof parsed === 'object') {
        err.detailObj = parsed as Record<string, unknown>;
      }
    } catch {
      /* plain-string detail */
    }
    throw err;
  }
  return (await res.json()) as ConnectResponse;
}

function store(rc: string, got: ConnectResponse): void {
  const s = ls();
  if (!s) return;
  s.setItem(LS_TOKEN, got.entitlement);
  s.setItem(LS_EXP, String(got.expiresAt));
  if (got.email) s.setItem(LS_EMAIL, got.email);
  s.setItem(LS_RC, rc);
  fireChanged();
}

/** Link this browser to a membership with a one-time connect code from
 *  the blog page. `confirmEvict` retries a 409 seatLimit answer. */
export async function webAccountConnect(
  relayBase: string,
  connectCode: string,
  opts?: { confirmEvict?: boolean },
): Promise<WebAccountStatus> {
  const rc = await webRoutingCode();
  const proof = await signWebProof('connect');
  const got = await postConnect(relayBase, {
    connectCode: connectCode.trim(),
    routingCode: rc,
    confirmEvict: opts?.confirmEvict === true,
    ...proof,
  });
  store(rc, got);
  scheduleWebRenewal(relayBase);
  return webAccountStatus();
}

/** Code-less renewal: key proof only. Quietly a no-op when there is
 *  nothing to renew or plenty of time left. */
export async function webAccountRenew(relayBase: string, force = false): Promise<void> {
  const s = ls();
  if (!s) return;
  const rc = s.getItem(LS_RC) ?? '';
  const token = s.getItem(LS_TOKEN) ?? '';
  if (!rc || !token) return;
  const exp = Number(s.getItem(LS_EXP) ?? 0);
  if (!force && exp - Date.now() > RENEW_MARGIN_MS) return;
  const proof = await signWebProof('renew');
  try {
    const got = await postConnect(relayBase, {
      connectCode: '',
      routingCode: rc,
      ...proof,
    });
    store(rc, got);
  } catch (err) {
    const status = (err as { status?: number }).status;
    // Eviction / lapse-past-grace: the binding is gone, stop
    // presenting a dead credential. Transient failures keep it — the
    // next check retries.
    if (status === 401 || status === 403 || status === 409) webAccountDisconnect();
  }
}

export function webAccountDisconnect(): void {
  const s = ls();
  if (!s) return;
  s.removeItem(LS_TOKEN);
  s.removeItem(LS_EXP);
  s.removeItem(LS_EMAIL);
  // The routing code stays: it's the KEY's identity, not the link's.
  fireChanged();
}

export function scheduleWebRenewal(relayBase: string): void {
  if (renewTimer !== null) return;
  renewTimer = setInterval(() => void webAccountRenew(relayBase), RENEW_CHECK_MS);
  void webAccountRenew(relayBase);
}

/** Test hook. */
export function __resetWebAccountForTests(): void {
  if (renewTimer !== null) clearInterval(renewTimer);
  renewTimer = null;
  webAccountDisconnect();
  ls()?.removeItem(LS_RC);
}
