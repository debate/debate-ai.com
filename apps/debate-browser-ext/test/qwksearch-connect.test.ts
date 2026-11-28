import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStorage } from './helpers/memory-browser';
import { fakeTabs } from './helpers/fake-tabs';

const mem = vi.hoisted(() => ({ sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> }));
const runtime = vi.hoisted(() => ({ sendMessage: vi.fn() }));
const tabsApi = vi.hoisted(() => ({}) as Record<string, any>);

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  return { browser: { ...memoryBrowser(mem), runtime, tabs: tabsApi } };
});

import {
  QWKSEARCH_CONNECT_MESSAGE,
  requestQwkSearchConnect,
  runQwkSearchConnectFlow,
} from '@/src/auth/qwksearch-connect';

const fetchMock = vi.fn<typeof fetch>();
let tabs: ReturnType<typeof fakeTabs>;

const SIGNED_IN = {
  token: 'bearer-1',
  user: { id: 'u1', name: 'Ada' },
  apiBase: 'https://debate-ai.com',
};

async function consentTab(): Promise<{ id: number; state: string; url: URL }> {
  await vi.waitFor(() => expect(tabs.api.create).toHaveBeenCalled());
  const { id, url } = await tabs.api.create.mock.results[0].value;
  const parsed = new URL(url);
  return { id, state: parsed.searchParams.get('state')!, url: parsed };
}

const completion = (params: Record<string, string>) =>
  `https://debate-ai.com/auth/qwksearch-extension-complete?${new URLSearchParams(params)}`;

beforeEach(() => {
  resetStorage(mem);
  mem.local.debateAccountSession = { ...SIGNED_IN };
  tabs = fakeTabs();
  for (const key of Object.keys(tabsApi)) delete tabsApi[key];
  Object.assign(tabsApi, tabs.api);
  fetchMock.mockReset();
  runtime.sendMessage.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('requestQwkSearchConnect', () => {
  it('asks the background worker and returns its answer', async () => {
    runtime.sendMessage.mockResolvedValue({ ok: true });
    expect(await requestQwkSearchConnect()).toEqual({ ok: true });
    expect(runtime.sendMessage).toHaveBeenCalledWith({ type: QWKSEARCH_CONNECT_MESSAGE });
  });
});

describe('runQwkSearchConnectFlow', () => {
  it('opens a PKCE consent screen that redirects back to the configured deployment', async () => {
    mem.sync.apiBase = 'https://debate-ai.com/';
    mem.local.debateAccountSession = { ...SIGNED_IN };
    const flow = runQwkSearchConnectFlow();
    const { id, url } = await consentTab();

    expect(url.origin).toBe('https://qwksearch.com');
    expect(url.pathname).toBe('/connect');
    expect(url.searchParams.get('redirect_uri')).toBe('https://debate-ai.com/auth/qwksearch-extension-complete');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/);
    expect(tabs.api.create).toHaveBeenCalledWith(expect.objectContaining({ active: true }));

    tabs.close(id);
    await flow;
  });

  it('redeems the code with the verifier that produced the challenge, then closes the tab', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const flow = runQwkSearchConnectFlow();
    const { id, state, url } = await consentTab();

    tabs.navigate(id, completion({ code: 'abc', state }));
    expect(await flow).toEqual({ ok: true });

    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(endpoint).toBe('https://debate-ai.com/api/qwksearch/token');
    expect(new Headers(init!.headers).get('Authorization')).toBe('Bearer bearer-1');
    const body = JSON.parse(init!.body as string) as { code: string; code_verifier: string };
    expect(body.code).toBe('abc');

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body.code_verifier));
    const expected = Buffer.from(digest).toString('base64url');
    expect(url.searchParams.get('code_challenge')).toBe(expected);
    expect(tabs.api.remove).toHaveBeenCalledWith(id);
    expect(tabs.listenerCount()).toBe(0);
  });

  it('refuses an answer whose state does not match', async () => {
    const flow = runQwkSearchConnectFlow();
    const { id } = await consentTab();

    tabs.navigate(id, completion({ code: 'abc', state: 'forged' }));
    const result = await flow;

    expect(result.ok).toBe(false);
    expect(result.error).toContain('state_mismatch');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats access_denied as the reader cancelling', async () => {
    const flow = runQwkSearchConnectFlow();
    const { id, state } = await consentTab();

    tabs.navigate(id, completion({ error: 'access_denied', state }));

    expect(await flow).toEqual({ ok: false, cancelled: true, error: 'QwkSearch sign-in was cancelled.' });
  });

  it('reports other QwkSearch errors without marking them cancelled', async () => {
    const flow = runQwkSearchConnectFlow();
    const { id, state } = await consentTab();

    tabs.navigate(id, completion({ error: 'server_error', state }));

    const result = await flow;
    expect(result.cancelled).toBeUndefined();
    expect(result.error).toBe('QwkSearch sign-in failed (server_error). Please try again.');
  });

  it('reports a cancellation when the consent tab is closed', async () => {
    const flow = runQwkSearchConnectFlow();
    tabs.close((await consentTab()).id);

    expect(await flow).toEqual({ ok: false, cancelled: true, error: 'QwkSearch sign-in was cancelled.' });
    expect(tabs.listenerCount()).toBe(0);
  });

  it('times out after ten minutes without cancelling', async () => {
    vi.useFakeTimers();
    const flow = runQwkSearchConnectFlow();
    await vi.waitFor(() => expect(tabs.api.create).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

    const result = await flow;
    expect(result.ok).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(result.error).toBe('QwkSearch sign-in timed out. Please try again.');
    expect(tabs.api.remove).toHaveBeenCalled();
  });

  it('tells the reader to sign in again when the server rejects the bearer token', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    const flow = runQwkSearchConnectFlow();
    const { id, state } = await consentTab();
    tabs.navigate(id, completion({ code: 'abc', state }));

    expect((await flow).error).toBe('Your Debate AI sign-in expired. Sign in again and retry.');
  });

  it('includes the status when the token exchange fails otherwise', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 502 }));
    const flow = runQwkSearchConnectFlow();
    const { id, state } = await consentTab();
    tabs.navigate(id, completion({ code: 'abc', state }));

    expect((await flow).error).toBe('QwkSearch sign-in could not be completed (502).');
  });

  it('reports a network failure during the token exchange', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const flow = runQwkSearchConnectFlow();
    const { id, state } = await consentTab();
    tabs.navigate(id, completion({ code: 'abc', state }));

    expect(await flow).toEqual({ ok: false, error: 'offline' });
  });

  it('fails when the consent tab cannot be opened', async () => {
    tabs.api.create.mockRejectedValueOnce(new Error('blocked'));
    expect(await runQwkSearchConnectFlow()).toEqual({ ok: false, error: 'blocked' });

    tabs.api.create.mockResolvedValueOnce({} as never);
    expect(await runQwkSearchConnectFlow()).toEqual({ ok: false, error: 'Could not open QwkSearch.' });
  });

  it('signs in to Debate AI first when there is no session, and stops if that fails', async () => {
    resetStorage(mem);
    const flow = runQwkSearchConnectFlow();
    await vi.waitFor(() => expect(tabs.api.create).toHaveBeenCalled());
    const { id, url } = await tabs.api.create.mock.results[0].value;
    expect(new URL(url).pathname).toBe('/login');

    tabs.close(id);
    expect(await flow).toEqual({ ok: false, error: 'Sign-in was cancelled.' });
    expect(tabs.api.create).toHaveBeenCalledTimes(1);
  });
});
