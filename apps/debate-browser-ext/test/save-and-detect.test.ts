import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStorage } from './helpers/memory-browser';

const mem = vi.hoisted(() => ({ sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> }));

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  return { browser: memoryBrowser(mem) };
});

import type { Article, ChatMessage } from '@/src/article/types';
import { saveArticleToAccount } from '@/src/article/save';
import { setStoredSession } from '@/src/auth/session';
import { detectPageUrl } from '@/src/url-detection/api';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  resetStorage(mem);
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('saveArticleToAccount', () => {
  const article: Article = {
    title: 'Deterrence works',
    url: 'https://news.test/a',
    html: '<p>Body of the article.</p>',
    author: 'Jane Doe',
  };
  const chat: ChatMessage[] = [{ role: 'user', content: 'Summarize', time: '10:00' }];

  const signIn = (apiBase = 'https://debate-ai.com') =>
    setStoredSession({ token: 'tok', user: { id: 'u1' }, apiBase });

  it('requires a signed-in reader and sends nothing otherwise', async () => {
    await expect(saveArticleToAccount(article, chat)).rejects.toThrow(/Sign in/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the built document with the session token and returns where to find it', async () => {
    await signIn();
    fetchMock.mockResolvedValue(jsonResponse({ id: 77, title: 'Saved title' }));

    const saved = await saveArticleToAccount(article, chat);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://debate-ai.com/api/doc/documents');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok');
    expect(JSON.stringify(JSON.parse(String(init?.body)))).toContain('Deterrence works');
    expect(saved).toEqual({ id: 77, title: 'Saved title', openUrl: 'https://debate-ai.com/reason-editor' });
  });

  it('falls back to the document title and a zero id when the server omits them', async () => {
    await signIn('https://self-hosted.test');
    mem.sync.apiBase = 'https://self-hosted.test/';
    fetchMock.mockResolvedValue(jsonResponse({}));

    const saved = await saveArticleToAccount(article, chat);

    expect(saved.id).toBe(0);
    expect(saved.title).toBeTruthy();
    expect(saved.openUrl).toBe('https://self-hosted.test/reason-editor');
  });

  it('tells the reader to sign in again after a 401, and reports other failures', async () => {
    await signIn();
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(saveArticleToAccount(article, chat)).rejects.toThrow(/session has expired/);

    await signIn();
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(saveArticleToAccount(article, chat)).rejects.toThrow('(500)');
  });
});

describe('detectPageUrl', () => {
  it('posts the page to the configured deployment and returns the visit info', async () => {
    mem.sync.apiBase = 'https://debate-ai.com/';
    fetchMock.mockResolvedValue(jsonResponse({ id: 3, visitCount: 2 }));

    const result = await detectPageUrl('https://a.test/x', 'A title', 'https://a.test/icon.png');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://debate-ai.com/api/url-detection');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      url: 'https://a.test/x',
      title: 'A title',
      favicon: 'https://a.test/icon.png',
    });
    expect(result).toEqual({ id: 3, visitCount: 2 });
  });

  it('returns null, with a warning, on a non-OK answer or a network failure', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    expect(await detectPageUrl('https://a.test/x')).toBeNull();
    expect(warn).toHaveBeenCalledWith('URL detection failed:', 500);

    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    expect(await detectPageUrl('https://a.test/x')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
