import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStorage } from './helpers/memory-browser';

const mem = vi.hoisted(() => ({ sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> }));
const runtime = vi.hoisted(() => ({ sendMessage: vi.fn() }));

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  return { browser: { ...memoryBrowser(mem), runtime } };
});

import {
  NotSignedInError,
  SIGN_IN_MESSAGE,
  SIGN_OUT_MESSAGE,
  authorizedFetch,
  clearStoredSession,
  exchangeOneTimeToken,
  getActiveSession,
  getStoredSession,
  isSignedIn,
  refreshSession,
  requestSignIn,
  requestSignOut,
  setStoredSession,
  signOut,
  type StoredSession,
} from '@/src/auth/session';

const fetchMock = vi.fn<typeof fetch>();
const SESSION_KEY = 'debateAccountSession';

const session = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  token: 'tok-1',
  user: { id: 'u1', name: 'Ada', email: 'ada@example.com' },
  apiBase: 'https://debate-ai.com',
  ...overrides,
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) },
    ...init,
  });
}

beforeEach(() => {
  resetStorage(mem);
  fetchMock.mockReset();
  runtime.sendMessage.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('stored session', () => {
  it('round-trips through storage and clears', async () => {
    expect(await getStoredSession()).toBeNull();
    await setStoredSession(session());
    expect(await getStoredSession()).toEqual(session());
    await clearStoredSession();
    expect(await getStoredSession()).toBeNull();
  });

  it('ignores a stored value that has no token or no user id', async () => {
    mem.local[SESSION_KEY] = { token: '', user: { id: 'u1' }, apiBase: 'https://debate-ai.com' };
    expect(await getStoredSession()).toBeNull();
    mem.local[SESSION_KEY] = { token: 'x', user: {}, apiBase: 'https://debate-ai.com' };
    expect(await getStoredSession()).toBeNull();
  });
});

describe('getActiveSession', () => {
  it('returns the session for the configured deployment, ignoring a trailing slash', async () => {
    await setStoredSession(session({ apiBase: 'https://debate-ai.com/' }));
    expect((await getActiveSession())?.token).toBe('tok-1');
    expect(await isSignedIn()).toBe(true);
  });

  it('refuses a session that belongs to another deployment', async () => {
    await setStoredSession(session({ apiBase: 'https://other.example' }));
    expect(await getActiveSession()).toBeNull();
    expect(await isSignedIn()).toBe(false);
  });

  it('refuses an expired session but keeps one with no expiry', async () => {
    await setStoredSession(session({ expiresAt: Date.now() - 1000 }));
    expect(await getActiveSession()).toBeNull();
    await setStoredSession(session({ expiresAt: Date.now() + 60_000 }));
    expect(await getActiveSession()).not.toBeNull();
  });
});

describe('authorizedFetch', () => {
  it('throws NotSignedInError without a session, before making a request', async () => {
    await expect(authorizedFetch('/api/x')).rejects.toBeInstanceOf(NotSignedInError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the bearer token to the configured deployment and keeps caller headers', async () => {
    await setStoredSession(session());
    mem.sync.apiBase = 'https://debate-ai.com/';
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await authorizedFetch('/api/x', { method: 'POST', headers: { 'X-Test': '1' } });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://debate-ai.com/api/x');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok-1');
    expect(headers.get('X-Test')).toBe('1');
  });

  it('persists a rotated token', async () => {
    await setStoredSession(session());
    fetchMock.mockResolvedValue(jsonResponse({}, { headers: { 'set-auth-token': 'tok-2' } }));
    await authorizedFetch('/api/x');
    expect((await getStoredSession())?.token).toBe('tok-2');
  });

  it('drops the session on a 401', async () => {
    await setStoredSession(session());
    fetchMock.mockResolvedValue(new Response('no', { status: 401 }));
    const response = await authorizedFetch('/api/x');
    expect(response.status).toBe(401);
    expect(await getStoredSession()).toBeNull();
  });
});

describe('refreshSession', () => {
  it('returns null without a session', async () => {
    expect(await refreshSession()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('updates the user and expiry while keeping the held token', async () => {
    await setStoredSession(session());
    fetchMock.mockResolvedValue(
      jsonResponse({
        session: { expiresAt: '2030-01-01T00:00:00.000Z' },
        user: { id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com', image: null },
      }),
    );
    const next = await refreshSession();
    expect(next?.token).toBe('tok-1');
    expect(next?.user.name).toBe('Ada Lovelace');
    expect(next?.expiresAt).toBe(Date.parse('2030-01-01T00:00:00.000Z'));
    expect(await getStoredSession()).toEqual(next);
  });

  it('clears the session when the server answers 401 or returns no user', async () => {
    await setStoredSession(session());
    fetchMock.mockResolvedValueOnce(new Response('no', { status: 401 }));
    expect(await refreshSession()).toBeNull();
    expect(await getStoredSession()).toBeNull();

    await setStoredSession(session());
    fetchMock.mockResolvedValueOnce(jsonResponse(null));
    expect(await refreshSession()).toBeNull();
    expect(await getStoredSession()).toBeNull();
  });

  it('keeps the session on other failures and when the network is down', async () => {
    await setStoredSession(session());
    fetchMock.mockResolvedValueOnce(new Response('down', { status: 503 }));
    expect(await refreshSession()).toBeNull();
    expect(await getStoredSession()).not.toBeNull();

    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect((await refreshSession())?.token).toBe('tok-1');
    expect(await getStoredSession()).not.toBeNull();
  });
});

describe('exchangeOneTimeToken', () => {
  it('posts the token and builds a session from the answer', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        session: { token: 'new-token', expiresAt: '2030-01-01T00:00:00.000Z' },
        user: { id: 'u9', name: 'Grace', email: 'g@example.com' },
      }),
    );
    const result = await exchangeOneTimeToken('one-time', 'https://debate-ai.com/');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://debate-ai.com/api/auth/one-time-token/verify');
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'one-time' });
    expect(result).toMatchObject({
      token: 'new-token',
      apiBase: 'https://debate-ai.com',
      expiresAt: Date.parse('2030-01-01T00:00:00.000Z'),
      user: { id: 'u9', name: 'Grace' },
    });
  });

  it('explains an untrusted extension on 403 and reports other statuses', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 403 }));
    await expect(exchangeOneTimeToken('t', 'https://x.test')).rejects.toThrow(/BETTER_AUTH_TRUSTED_ORIGINS/);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(exchangeOneTimeToken('t', 'https://x.test')).rejects.toThrow('(500)');
  });

  it('rejects an answer with no token or user, and leaves a bad expiry unset', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ session: {}, user: { id: 'u1' } }));
    await expect(exchangeOneTimeToken('t', 'https://x.test')).rejects.toThrow(/usable session/);

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ session: { token: 'a', expiresAt: 'not a date' }, user: { id: 'u1' } }),
    );
    expect((await exchangeOneTimeToken('t', 'https://x.test')).expiresAt).toBeUndefined();
  });
});

describe('requests to the background worker and sign-out', () => {
  it('asks the worker to sign in and out', async () => {
    runtime.sendMessage.mockResolvedValue({ ok: true });
    expect(await requestSignIn()).toEqual({ ok: true });
    expect(runtime.sendMessage).toHaveBeenCalledWith({ type: SIGN_IN_MESSAGE });
    await requestSignOut();
    expect(runtime.sendMessage).toHaveBeenLastCalledWith({ type: SIGN_OUT_MESSAGE });
  });

  it('signs out on the server and always clears the local session', async () => {
    await setStoredSession(session());
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await signOut();
    expect(fetchMock.mock.calls[0][0]).toBe('https://debate-ai.com/api/auth/sign-out');
    expect(await getStoredSession()).toBeNull();

    await setStoredSession(session());
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await signOut();
    expect(await getStoredSession()).toBeNull();
  });
});
