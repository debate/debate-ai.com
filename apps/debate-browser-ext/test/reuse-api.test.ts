import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStorage } from './helpers/memory-browser';

const mem = vi.hoisted(() => ({ sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> }));

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  return { browser: memoryBrowser(mem) };
});

import { setStoredSession } from '@/src/auth/session';
import {
  annotateReuseCard,
  checkPageForExistingCards,
  getSkipDomains,
  isUrlDomainSkipped,
  parseSkipDomains,
} from '@/src/reuse/api';

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
});

describe('parseSkipDomains', () => {
  it('trims, lowercases and drops blank lines', () => {
    expect(parseSkipDomains('  Example.COM \n\n  docs.test\r\n   \n')).toEqual(['example.com', 'docs.test']);
    expect(parseSkipDomains('')).toEqual([]);
  });
});

describe('isUrlDomainSkipped', () => {
  const skip = ['example.com'];

  it('matches the domain and its subdomains', () => {
    expect(isUrlDomainSkipped('https://example.com/a', skip)).toBe(true);
    expect(isUrlDomainSkipped('https://docs.example.com/a', skip)).toBe(true);
    expect(isUrlDomainSkipped('https://EXAMPLE.com/a', skip)).toBe(true);
  });

  it('does not match look-alike hosts', () => {
    expect(isUrlDomainSkipped('https://example.com.evil.com/', skip)).toBe(false);
    expect(isUrlDomainSkipped('https://notexample.com/', skip)).toBe(false);
  });

  it('is false for an empty list or a URL that does not parse', () => {
    expect(isUrlDomainSkipped('https://example.com/', [])).toBe(false);
    expect(isUrlDomainSkipped('not a url', skip)).toBe(false);
  });
});

describe('getSkipDomains', () => {
  it('reads the whitelist from settings', async () => {
    expect(await getSkipDomains()).toEqual([]);
    mem.sync.skipDomains = 'One.com\ntwo.com';
    expect(await getSkipDomains()).toEqual(['one.com', 'two.com']);
  });
});

describe('checkPageForExistingCards', () => {
  it('requests the reuse check for the encoded page URL, tagged as the extension', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ alreadyCut: true, matches: [{ id: 'm1', cite: 'Smith 20' }] }));

    const result = await checkPageForExistingCards('https://news.test/a?x=1&y=2', 'https://debate-ai.com/');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://debate-ai.com/api/evidence-reuse-check?url=https%3A%2F%2Fnews.test%2Fa%3Fx%3D1%26y%3D2&source=extension',
    );
    expect(init?.method).toBe('GET');
    expect(result).toEqual({ alreadyCut: true, matches: [{ id: 'm1', cite: 'Smith 20' }] });
  });

  it('normalizes a malformed payload to "not cut"', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ matches: 'nope' }));
    expect(await checkPageForExistingCards('https://a.test', 'https://debate-ai.com')).toEqual({
      alreadyCut: false,
      matches: [],
    });
  });

  it('surfaces the server error message, or the status when there is none', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Rate limited' }, 429));
    await expect(checkPageForExistingCards('https://a.test', 'https://debate-ai.com')).rejects.toThrow(
      'Rate limited',
    );
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 502 }));
    await expect(checkPageForExistingCards('https://a.test', 'https://debate-ai.com')).rejects.toThrow('(502)');
  });
});

describe('annotateReuseCard', () => {
  const annotation = {
    claim: 'c',
    supportScore: 7,
    authorQuality: { rating: 'strong', qualifications: 'q', concerns: '' },
    flaws: [],
  };

  it('posts anonymously when signed out', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ annotation }));

    expect(await annotateReuseCard(42, 'https://debate-ai.com/')).toEqual(annotation);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://debate-ai.com/api/evidence-reuse-check/annotate');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ cardId: 42 });
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
  });

  it('sends the bearer token when signed in', async () => {
    await setStoredSession({ token: 'tok', user: { id: 'u1' }, apiBase: 'https://debate-ai.com' });
    fetchMock.mockResolvedValue(jsonResponse({ annotation }));

    await annotateReuseCard(42, 'https://debate-ai.com');

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
  });

  it('throws the server message, or the status when the body is unusable', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Sign in to annotate.' }, 401));
    await expect(annotateReuseCard(1, 'https://debate-ai.com')).rejects.toThrow('Sign in to annotate.');

    fetchMock.mockResolvedValueOnce(new Response('oops', { status: 500 }));
    await expect(annotateReuseCard(1, 'https://debate-ai.com')).rejects.toThrow('(500)');

    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await expect(annotateReuseCard(1, 'https://debate-ai.com')).rejects.toThrow('(200)');
  });
});
