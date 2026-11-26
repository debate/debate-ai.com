import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStorage } from './helpers/memory-browser';

const mem = vi.hoisted(() => ({ sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> }));

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  return { browser: memoryBrowser(mem) };
});

import { getStoredSession, setStoredSession } from '@/src/auth/session';
import { installApiProxy, proxiedUrl, setProxiedApiBase } from '@/src/app-host/api-proxy';

const ORIGIN = window.location.origin;
const BASE = 'https://debate-ai.com';

describe('proxiedUrl', () => {
  it('rewrites same-origin /api requests onto the deployment, keeping path and query', () => {
    expect(proxiedUrl(`${ORIGIN}/api/videos?x=1&y=2`, ORIGIN, BASE)).toBe(`${BASE}/api/videos?x=1&y=2`);
    expect(proxiedUrl('/api/auth/get-session', ORIGIN, `${BASE}/`)).toBe(`${BASE}/api/auth/get-session`);
  });

  it('leaves everything else alone', () => {
    expect(proxiedUrl(`${ORIGIN}/options.html`, ORIGIN, BASE)).toBeNull();
    expect(proxiedUrl(`${ORIGIN}/apiary`, ORIGIN, BASE)).toBeNull();
    expect(proxiedUrl(`https://other.test/api/videos`, ORIGIN, BASE)).toBeNull();
  });
});

describe('installApiProxy', () => {
  const nativeFetch = vi.fn<typeof fetch>();
  const originalFetch = window.fetch;

  beforeEach(() => {
    resetStorage(mem);
    nativeFetch.mockReset();
    nativeFetch.mockResolvedValue(new Response('{}', { status: 200 }));
    window.fetch = nativeFetch as unknown as typeof window.fetch;
    installApiProxy(BASE);
  });

  afterEach(() => {
    window.fetch = originalFetch;
    setProxiedApiBase(BASE);
  });

  const lastCall = () => {
    const [target, init] = nativeFetch.mock.calls.at(-1)!;
    return { target, init: init as RequestInit, headers: new Headers((init as RequestInit)?.headers) };
  };

  it('passes non-API requests straight to the native fetch', async () => {
    await window.fetch(`${ORIGIN}/timer.html`);
    const [first] = nativeFetch.mock.calls[0];
    expect((first as Request).url).toBe(`${ORIGIN}/timer.html`);
  });

  it('sends API requests to the deployment without cookies, adding the session token', async () => {
    await setStoredSession({ token: 'tok', user: { id: 'u1' }, apiBase: BASE });

    await window.fetch(`${ORIGIN}/api/videos?limit=2`);

    const { target, init, headers } = lastCall();
    expect(target).toBe(`${BASE}/api/videos?limit=2`);
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('omit');
    expect(init.body).toBeUndefined();
    expect(headers.get('Authorization')).toBe('Bearer tok');
  });

  it('keeps an Authorization header the app set itself, and forwards bodies', async () => {
    await setStoredSession({ token: 'tok', user: { id: 'u1' }, apiBase: BASE });

    await window.fetch(`${ORIGIN}/api/things`, {
      method: 'POST',
      headers: { Authorization: 'Bearer app-own', 'Content-Type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });

    const { init, headers } = lastCall();
    expect(headers.get('Authorization')).toBe('Bearer app-own');
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"a":1}');
  });

  it('adds no token when signed out', async () => {
    await window.fetch(`${ORIGIN}/api/videos`);
    expect(lastCall().headers.has('Authorization')).toBe(false);
  });

  it('follows setProxiedApiBase', async () => {
    setProxiedApiBase('https://self-hosted.test/');
    await window.fetch(`${ORIGIN}/api/videos`);
    expect(lastCall().target).toBe('https://self-hosted.test/api/videos');
  });

  it('stores a rotated token', async () => {
    await setStoredSession({ token: 'tok', user: { id: 'u1' }, apiBase: BASE });
    nativeFetch.mockResolvedValue(new Response('{}', { headers: { 'set-auth-token': 'tok-2' } }));
    await window.fetch(`${ORIGIN}/api/videos`);
    expect((await getStoredSession())?.token).toBe('tok-2');
  });

  it('ends the extension session when the app signs out', async () => {
    await setStoredSession({ token: 'tok', user: { id: 'u1' }, apiBase: BASE });
    await window.fetch(`${ORIGIN}/api/auth/sign-out`, { method: 'POST' });
    expect(await getStoredSession()).toBeNull();
  });
});
