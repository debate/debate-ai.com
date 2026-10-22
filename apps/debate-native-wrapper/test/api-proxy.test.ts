import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalFetch = window.fetch;
// Under jsdom, `Request` is Node's, which (unlike a browser's) won't resolve a
// relative URL against the page, so these tests spell out the page's origin.
const page = (path: string) => `${window.location.origin}${path}`;
let nativeFetch: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  nativeFetch = vi.fn(async () => new Response('ok'));
  window.fetch = nativeFetch as unknown as typeof fetch;
  // Installs itself on import, the way offline/main.tsx loads it.
  await import('../offline/api-proxy');
});

afterEach(() => {
  window.fetch = originalFetch;
});

/** The Request the proxy handed to the original fetch, and its init. */
function forwarded(): [Request, RequestInit | undefined] {
  expect(nativeFetch).toHaveBeenCalledTimes(1);
  return nativeFetch.mock.calls[0] as [Request, RequestInit | undefined];
}

describe('offline api proxy', () => {
  it('exports the build-time site', async () => {
    const { SITE } = await import('../offline/api-proxy');
    expect(SITE).toBe('https://site.test');
  });

  it('sends same-origin /api requests to the site, keeping the query', async () => {
    await window.fetch(page('/api/videos?page=2'));
    const [request, init] = forwarded();
    expect(request.url).toBe('https://site.test/api/videos?page=2');
    expect(init).toEqual({ credentials: 'omit' });
  });

  it('leaves same-origin pages outside /api alone', async () => {
    await window.fetch(page('/assets/app.js'));
    const [request, init] = forwarded();
    expect(request.url).toBe(page('/assets/app.js'));
    expect(init).toBeUndefined();
  });

  it('leaves other origins alone, even under /api', async () => {
    await window.fetch(new URL('https://other.test/api/x'));
    const [request, init] = forwarded();
    expect(request.url).toBe('https://other.test/api/x');
    expect(init).toBeUndefined();
  });
});
