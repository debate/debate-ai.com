/**
 * Points the web app's `/api` requests at the configured deployment.
 *
 * The app's UI (`debate-ai-webui`) is written for debate-ai.com, where
 * `fetch('/api/videos')` and better-auth's client (whose base URL is
 * `location.origin`) both reach the Worker on the same origin. On the Options
 * page that origin is `chrome-extension://<id>`, which has no API behind it.
 * This wraps `window.fetch` so every request for `/api/*` on the extension's
 * own origin goes to the deployment in Settings instead, carrying the
 * extension's session.
 *
 * Why a bearer token and not the site's cookie: see src/auth/session.ts —
 * the extension's requests to debate-ai.com are cross-site, so the
 * `SameSite=Lax` session cookie is never attached. `host_permissions` is what
 * lets these requests skip CORS.
 *
 * Only `/api/*` is rewritten; everything else under the extension's origin is
 * a file the extension actually ships.
 */
import {
  clearStoredSession,
  getActiveSession,
  setStoredSession,
} from '@/src/auth/session';

let apiBase = 'https://debate-ai.com';

/** Repoints the proxy, e.g. after the deployment setting is saved. */
export function setProxiedApiBase(base: string): void {
  apiBase = base.replace(/\/$/, '');
}

/** The deployment URL this request should go to, or `null` to leave it alone. */
export function proxiedUrl(requestUrl: string, pageOrigin: string, base: string): string | null {
  const url = new URL(requestUrl, pageOrigin);
  if (url.origin !== pageOrigin || !url.pathname.startsWith('/api/')) return null;
  return `${base.replace(/\/$/, '')}${url.pathname}${url.search}`;
}

export function installApiProxy(initialBase: string): void {
  setProxiedApiBase(initialBase);
  const nativeFetch = window.fetch.bind(window);
  const pageOrigin = window.location.origin;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const target = proxiedUrl(request.url, pageOrigin, apiBase);
    if (!target) return nativeFetch(request);

    const session = await getActiveSession();
    const headers = new Headers(request.headers);
    if (session && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${session.token}`);
    }
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const response = await nativeFetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      signal: request.signal,
      credentials: 'omit',
      redirect: request.redirect,
      cache: request.cache,
    });

    const rotated = response.headers.get('set-auth-token');
    if (session && rotated && rotated !== session.token) {
      await setStoredSession({ ...session, token: rotated });
    }
    // Signing out from the app's own menu has to end the extension's session
    // too, or every later request would keep sending the dead token.
    if (new URL(target).pathname === '/api/auth/sign-out') {
      await clearStoredSession();
    }
    return response;
  };
}
