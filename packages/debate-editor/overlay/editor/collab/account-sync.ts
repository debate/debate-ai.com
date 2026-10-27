/**
 * Account sync for collaboration — the signed-in debate-ai.com account as
 * the credential for card sharing and co-editing.
 *
 * Upstream links a browser to a paid Debate Decoded membership (a connect
 * code from debate-decoded.ghost.io, an entitlement renewed every few days,
 * two machines per membership) and talks to the Debate Decoded relay. On
 * debate-ai.com none of that exists: the relay is the app's own
 * (`/api/collab-relay`, apps/debate-web/lib/collab-relay), and it authorizes
 * with the session cookie the rest of the site already uses. This module is
 * what the editor's credential seams read instead (`web-account.ts`'s
 * `webEntitlementToken` / `webAccountStatus` / `onWebAccountChanged` are
 * patched to defer here):
 *
 *   - `accountSyncToken()` — '' when signed out; otherwise a fixed marker
 *     bearer. The cookie does the authorizing; the marker only tells the
 *     editor's clients that a credential exists, so they don't refuse
 *     locally (`room-client.ts` fails a bare `Bearer ` without a request).
 *   - `accountSyncStatus()` — who is signed in, for the settings row.
 *   - `refreshAccountSync()` — asks the relay (`GET /account`). Runs once on
 *     first use, again when the tab becomes visible, and from the settings
 *     row; the last answer is cached in localStorage so the synchronous
 *     suppliers have a value from the first frame of the next visit.
 *
 * Light module: no wasm, no heavy imports — it sits on the relay
 * resolution path like web-account.ts did.
 */

import { WEB_DEFAULT_RELAY_URL } from './relay-endpoint.js';

/** Must match `ACCOUNT_BEARER` in apps/debate-web/lib/collab-relay/handler.ts. */
export const ACCOUNT_SYNC_TOKEN = 'account-session';

const LS_KEY = 'debate-editor-account-sync';

export interface AccountSyncStatus {
  signedIn: boolean;
  email: string;
  name: string;
  /** True once the relay has answered in this page (false = cached / unknown). */
  checked: boolean;
}

const SIGNED_OUT: AccountSyncStatus = { signedIn: false, email: '', name: '', checked: false };

let state: AccountSyncStatus | null = null;
let inFlight: Promise<AccountSyncStatus> | null = null;
let started = false;
const listeners = new Set<() => void>();

function ls(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function load(): AccountSyncStatus {
  if (state) return state;
  try {
    const raw = ls()?.getItem(LS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<AccountSyncStatus>) : null;
    state = parsed
      ? {
          signedIn: parsed.signedIn === true,
          email: typeof parsed.email === 'string' ? parsed.email : '',
          name: typeof parsed.name === 'string' ? parsed.name : '',
          checked: false,
        }
      : { ...SIGNED_OUT };
  } catch {
    state = { ...SIGNED_OUT };
  }
  return state;
}

function store(next: AccountSyncStatus): void {
  const prev = load();
  state = next;
  try {
    ls()?.setItem(LS_KEY, JSON.stringify({ signedIn: next.signedIn, email: next.email, name: next.name }));
  } catch {
    /* storage unavailable — the in-memory state still serves this page */
  }
  if (prev.signedIn !== next.signedIn || prev.email !== next.email || prev.name !== next.name) {
    for (const fn of listeners) fn();
  }
}

/** The relay base the account check goes to (same one the rooms and mailbox use). */
function accountUrl(): string {
  return `${WEB_DEFAULT_RELAY_URL.replace(/\/+$/, '')}/account`;
}

/** Ask the relay who is signed in. Single-flight; a network failure keeps the last answer. */
export function refreshAccountSync(): Promise<AccountSyncStatus> {
  if (inFlight) return inFlight;
  const p = (async (): Promise<AccountSyncStatus> => {
    try {
      if (typeof fetch !== 'function' || typeof window === 'undefined' || !WEB_DEFAULT_RELAY_URL) return load();
      const res = await fetch(accountUrl(), { credentials: 'same-origin', cache: 'no-store' });
      if (res.status === 401) {
        store({ ...SIGNED_OUT, checked: true });
      } else if (res.ok) {
        const body = (await res.json()) as { signedIn?: boolean; email?: string; name?: string };
        store({
          signedIn: body.signedIn === true,
          email: typeof body.email === 'string' ? body.email : '',
          name: typeof body.name === 'string' ? body.name : '',
          checked: true,
        });
      }
    } catch {
      /* offline / not on the app — keep what we had */
    }
    return load();
  })().finally(() => {
    if (inFlight === p) inFlight = null;
  });
  inFlight = p;
  return p;
}

/** First use kicks off the check and keeps it fresh when the tab comes back. */
function ensureStarted(): void {
  if (started) return;
  started = true;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  void refreshAccountSync();
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void refreshAccountSync();
    });
  } catch {
    /* non-DOM host */
  }
}

export function accountSyncStatus(): AccountSyncStatus {
  ensureStarted();
  return load();
}

/** The bearer for relay requests: the marker when signed in, '' when not. */
export function accountSyncToken(): string {
  return accountSyncStatus().signedIn ? ACCOUNT_SYNC_TOKEN : '';
}

/** Fires when the signed-in account changes (sign in, sign out, another user). */
export function onAccountSyncChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Lets a host that already knows the session (the React shell) skip the round trip. */
export function setAccountSyncSession(session: { email?: string; name?: string } | null): void {
  store(
    session
      ? { signedIn: true, email: session.email ?? '', name: session.name ?? '', checked: true }
      : { ...SIGNED_OUT, checked: true },
  );
}

/** Test hook. */
export function __resetAccountSyncForTests(): void {
  state = null;
  inFlight = null;
  started = false;
  listeners.clear();
  try {
    ls()?.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}
