/**
 * Signing in to debate-ai.com from the extension, and staying signed in.
 *
 * ## Why this is not just a cookie
 *
 * The extension and debate-ai.com share the browser's cookie jar, but every
 * request the extension makes to that origin is *cross-site*, and the session
 * cookie better-auth sets is `SameSite=Lax` — so the browser never attaches it
 * to them, however many host permissions the extension holds. The extension
 * therefore carries its own copy of the session as a bearer token, which the
 * `bearer()` plugin on the server accepts in place of the cookie (see
 * apps/debate-ai.com/lib/auth/index.ts).
 *
 * ## The handoff
 *
 * 1. The extension opens `/login?callbackURL=/auth/extension-complete` in a
 *    normal tab. Sign-in happens on the site, in a real tab — which is the
 *    only place it *can* happen, since Google refuses OAuth inside an embedded
 *    view, and it means the reader types their password into debate-ai.com and
 *    never into an extension surface.
 * 2. `/auth/extension-complete` mints a single-use, five-minute token off the
 *    session it now has, and parks it in its own URL fragment.
 * 3. The background worker is watching that tab, reads the token, closes the
 *    tab, and spends it at `POST /api/auth/one-time-token/verify` — which
 *    answers with the session, token included.
 *
 * ## Staying signed in
 *
 * The token is stored in `storage.local` and survives restarts and updates.
 * Every authorized response is checked for a rotated `set-auth-token`, and the
 * background worker pings `/api/auth/get-session` on an alarm, which is what
 * makes better-auth roll the session's expiry forward. So the reader stays
 * signed in for as long as they keep using the browser, and is only asked
 * again if they sign out or leave it untouched past the session's lifetime.
 */
import { browser } from 'wxt/browser';

import { getSettings } from '@/src/settings/settings';

/** The signed-in reader, as much of them as the panel shows. */
export interface AuthUser {
  id: string;
  name?: string;
  email?: string;
  image?: string | null;
}

export interface StoredSession {
  /** better-auth session token, sent as `Authorization: Bearer …`. */
  token: string;
  /** Epoch ms the server said the session expires at, when it said so. */
  expiresAt?: number;
  user: AuthUser;
  /** The deployment this session belongs to — a session is not portable across them. */
  apiBase: string;
}

const SESSION_KEY = 'debateAccountSession';

/** Messages extension pages send the background worker to drive sign-in. */
export const SIGN_IN_MESSAGE = 'debate-account-sign-in';
export const SIGN_OUT_MESSAGE = 'debate-account-sign-out';

/** Whatever the background worker did, so a page can show the outcome. */
export interface SignInResult {
  ok: boolean;
  user?: AuthUser;
  error?: string;
}

function normalizeBase(apiBase: string): string {
  return apiBase.replace(/\/$/, '');
}

/** The session this browser is holding, if any. */
export async function getStoredSession(): Promise<StoredSession | null> {
  const stored = await browser.storage.local.get(SESSION_KEY);
  const session = stored[SESSION_KEY] as StoredSession | undefined;
  if (!session?.token || !session?.user?.id) return null;
  return session;
}

export async function setStoredSession(session: StoredSession): Promise<void> {
  await browser.storage.local.set({ [SESSION_KEY]: session });
}

export async function clearStoredSession(): Promise<void> {
  await browser.storage.local.remove(SESSION_KEY);
}

/**
 * The stored session, but only if it belongs to the deployment currently
 * configured. Pointing the extension at a different deployment invalidates the
 * session rather than sending one server's token to another.
 */
export async function getActiveSession(): Promise<StoredSession | null> {
  const session = await getStoredSession();
  if (!session) return null;
  const { apiBase } = await getSettings();
  if (normalizeBase(session.apiBase) !== normalizeBase(apiBase)) return null;
  if (session.expiresAt && session.expiresAt < Date.now()) return null;
  return session;
}

export async function isSignedIn(): Promise<boolean> {
  return (await getActiveSession()) !== null;
}

/**
 * `fetch` against the configured deployment, carrying the session.
 *
 * A rotated token — better-auth hands one back in `set-auth-token` whenever it
 * refreshes the session — is persisted here, so the caller never has to think
 * about it. A 401 clears the stored session, because the only useful response
 * to "this token is no longer a session" is to stop pretending it is one.
 */
export async function authorizedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const session = await getActiveSession();
  if (!session) throw new NotSignedInError();

  const { apiBase } = await getSettings();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.token}`);

  const response = await fetch(`${normalizeBase(apiBase)}${path}`, { ...init, headers });

  const rotated = response.headers.get('set-auth-token');
  if (rotated && rotated !== session.token) {
    await setStoredSession({ ...session, token: rotated });
  }
  if (response.status === 401) {
    await clearStoredSession();
  }
  return response;
}

export class NotSignedInError extends Error {
  constructor() {
    super('Sign in to your Debate AI account to use this.');
    this.name = 'NotSignedInError';
  }
}

/** better-auth's `{ session, user }`, as much of it as is used here. */
interface SessionPayload {
  session?: { token?: string; expiresAt?: string | number };
  user?: { id?: string; name?: string; email?: string; image?: string | null };
}

function toStoredSession(payload: SessionPayload, apiBase: string): StoredSession | null {
  const token = payload.session?.token;
  const user = payload.user;
  if (!token || !user?.id) return null;
  const rawExpiry = payload.session?.expiresAt;
  const expiresAt = rawExpiry ? new Date(rawExpiry).getTime() : undefined;
  return {
    token,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
    user: { id: user.id, name: user.name, email: user.email, image: user.image },
    apiBase: normalizeBase(apiBase),
  };
}

/**
 * Asks the server who this token belongs to, which also rolls the session's
 * expiry forward. Returns the refreshed session, or `null` once the server no
 * longer recognises the token — in which case the stored one is dropped.
 */
export async function refreshSession(): Promise<StoredSession | null> {
  const existing = await getActiveSession();
  if (!existing) return null;

  try {
    const response = await authorizedFetch('/api/auth/get-session');
    if (!response.ok) {
      if (response.status === 401) await clearStoredSession();
      return null;
    }
    const payload = (await response.json()) as SessionPayload | null;
    if (!payload?.user?.id) {
      await clearStoredSession();
      return null;
    }
    const { apiBase } = await getSettings();
    // `get-session` does not echo the token unless it rotated one, so keep the
    // token already held (or whatever `authorizedFetch` just persisted).
    const stored = (await getStoredSession()) ?? existing;
    const next: StoredSession = {
      ...stored,
      user: {
        id: payload.user.id,
        name: payload.user.name,
        email: payload.user.email,
        image: payload.user.image,
      },
      expiresAt: payload.session?.expiresAt
        ? new Date(payload.session.expiresAt).getTime()
        : stored.expiresAt,
      apiBase: normalizeBase(apiBase),
    };
    await setStoredSession(next);
    return next;
  } catch {
    // Offline, or the deployment is down. The session is not known to be bad,
    // so it is kept — the reader stays signed in and the next ping retries.
    return existing;
  }
}

/** Spends a one-time token for a session of this extension's own. */
export async function exchangeOneTimeToken(
  token: string,
  apiBase: string,
): Promise<StoredSession> {
  const response = await fetch(`${normalizeBase(apiBase)}/api/auth/one-time-token/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? 'This deployment does not trust this extension yet. Check BETTER_AUTH_TRUSTED_ORIGINS on the server.'
        : `Sign-in could not be completed (${response.status}).`,
    );
  }
  const payload = (await response.json()) as SessionPayload;
  const session = toStoredSession(payload, apiBase);
  if (!session) throw new Error('The server did not return a usable session.');
  return session;
}

/** Asks the background worker to run the sign-in flow. */
export async function requestSignIn(): Promise<SignInResult> {
  return (await browser.runtime.sendMessage({ type: SIGN_IN_MESSAGE })) as SignInResult;
}

/** Asks the background worker to sign out, on the server and here. */
export async function requestSignOut(): Promise<void> {
  await browser.runtime.sendMessage({ type: SIGN_OUT_MESSAGE });
}

/**
 * Ends the session on the server as well as in this browser.
 *
 * The local session is dropped whatever the server says: a sign-out that
 * cannot reach the network still has to sign the reader out here.
 */
export async function signOut(): Promise<void> {
  try {
    await authorizedFetch('/api/auth/sign-out', { method: 'POST' });
  } catch {
    // Already signed out, or offline.
  }
  await clearStoredSession();
}
