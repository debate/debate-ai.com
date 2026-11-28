import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStorage } from './helpers/memory-browser';
import { fakeTabs } from './helpers/fake-tabs';

const mem = vi.hoisted(() => ({ sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> }));
const tabsApi = vi.hoisted(() => ({}) as Record<string, any>);

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  return { browser: { ...memoryBrowser(mem), tabs: tabsApi } };
});

import { runSignInFlow } from '@/src/auth/sign-in-flow';
import { getStoredSession } from '@/src/auth/session';

const fetchMock = vi.fn<typeof fetch>();
let tabs: ReturnType<typeof fakeTabs>;

const tokenUrl = (token: string) => `https://debate-ai.com/auth/extension-complete#debate_ai_ext_token=${token}`;

function sessionResponse(status = 200, body: unknown = null): Response {
  const payload = body ?? {
    session: { token: 'session-token', expiresAt: '2030-01-01T00:00:00Z' },
    user: { id: 'u1', name: 'Ada', email: 'ada@example.com' },
  };
  return new Response(JSON.stringify(payload), { status });
}

async function tabOpened(): Promise<number> {
  await vi.waitFor(() => expect(tabs.api.create).toHaveBeenCalled());
  return (await tabs.api.create.mock.results[0].value).id;
}

beforeEach(() => {
  resetStorage(mem);
  tabs = fakeTabs();
  for (const key of Object.keys(tabsApi)) delete tabsApi[key];
  Object.assign(tabsApi, tabs.api);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('runSignInFlow', () => {
  it('opens the login page for the configured deployment, aimed at the completion page', async () => {
    mem.sync.apiBase = 'https://staging.example.com/';
    const flow = runSignInFlow();
    const id = await tabOpened();

    expect(tabs.api.create).toHaveBeenCalledWith({
      url: 'https://staging.example.com/login?callbackURL=%2Fauth%2Fextension-complete',
      active: true,
    });
    tabs.close(id);
    await flow;
  });

  it('spends the one-time token, stores the session and closes the tab', async () => {
    fetchMock.mockResolvedValue(sessionResponse());
    const flow = runSignInFlow();
    const id = await tabOpened();

    tabs.navigate(id, 'https://debate-ai.com/login');
    tabs.navigate(id, tokenUrl('one-time'));
    const result = await flow;

    expect(result).toEqual({ ok: true, user: { id: 'u1', name: 'Ada', email: 'ada@example.com', image: undefined } });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://debate-ai.com/api/auth/one-time-token/verify',
      expect.objectContaining({ body: JSON.stringify({ token: 'one-time' }) }),
    );
    expect((await getStoredSession())?.token).toBe('session-token');
    expect(tabs.api.remove).toHaveBeenCalledWith(id);
    expect(tabs.listenerCount()).toBe(0);
  });

  it('ignores updates to other tabs', async () => {
    fetchMock.mockResolvedValue(sessionResponse());
    const flow = runSignInFlow();
    const id = await tabOpened();

    tabs.navigate(id + 1, tokenUrl('someone-elses'));
    expect(tabs.listenerCount()).toBe(2);
    tabs.navigate(id, tokenUrl('mine'));
    await flow;

    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ token: 'mine' });
  });

  it('picks the token up from a tab that already landed before the listener attached', async () => {
    fetchMock.mockResolvedValue(sessionResponse());
    tabs.api.create.mockImplementationOnce(async ({ url }) => {
      tabs.api.get.mockResolvedValueOnce({ id: 7, url: tokenUrl('early') });
      return { id: 7, url };
    });

    const result = await runSignInFlow();

    expect(result.ok).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({ token: 'early' });
  });

  it('reports a cancelled sign-in when the reader closes the tab', async () => {
    const flow = runSignInFlow();
    const id = await tabOpened();
    tabs.close(id);

    expect(await flow).toEqual({ ok: false, error: 'Sign-in was cancelled.' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getStoredSession()).toBeNull();
    expect(tabs.listenerCount()).toBe(0);
  });

  it('gives up after the timeout and closes the tab', async () => {
    vi.useFakeTimers();
    const flow = runSignInFlow();
    await vi.advanceTimersByTimeAsync(0);
    const id = (await tabs.api.create.mock.results[0].value).id;

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(await flow).toEqual({ ok: false, error: 'Sign-in timed out. Please try again.' });
    expect(tabs.api.remove).toHaveBeenCalledWith(id);
    expect(tabs.listenerCount()).toBe(0);
  });

  it('survives the tab already being gone when it tries to close it', async () => {
    fetchMock.mockResolvedValue(sessionResponse());
    tabs.api.remove.mockRejectedValueOnce(new Error('No tab with id'));
    const flow = runSignInFlow();
    tabs.navigate(await tabOpened(), tokenUrl('t'));

    expect((await flow).ok).toBe(true);
  });

  it('reports why the server refused the token', async () => {
    fetchMock.mockResolvedValue(sessionResponse(403, {}));
    const flow = runSignInFlow();
    tabs.navigate(await tabOpened(), tokenUrl('t'));

    const result = await flow;
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/BETTER_AUTH_TRUSTED_ORIGINS/);
    expect(await getStoredSession()).toBeNull();
  });

  it('fails cleanly when the tab cannot be opened', async () => {
    tabs.api.create.mockRejectedValueOnce(new Error('Tabs are locked'));
    expect(await runSignInFlow()).toEqual({ ok: false, error: 'Tabs are locked' });
  });

  it('fails when the browser opens a tab with no id', async () => {
    tabs.api.create.mockResolvedValueOnce({ url: 'x' } as never);
    expect(await runSignInFlow()).toEqual({ ok: false, error: 'Could not open a sign-in tab.' });
  });
});
