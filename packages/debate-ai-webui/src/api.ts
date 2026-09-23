/**
 * @fileoverview The one place this package talks to a server.
 *
 * Every screen reaches the Debate AI API through `debate-api-client` rather
 * than `fetch`: the SDK routes each call through grab-url, so the caching,
 * retries, rate limiting and request dedupe configured there apply to a UI
 * embedded in an extension exactly as they do in the web app. Nothing in
 * `screens/` imports `fetch`, and nothing hard-codes a URL.
 *
 * The SDK never rejects on an HTTP error — every operation resolves to
 * `{ data?, error? }` — so {@link unwrap} is what turns that into the throw
 * the screens' `useAsync` hook already knows how to render.
 *
 * @module api
 */

import { createClient, type Client, type RequestResult } from "debate-api-client";

/**
 * Default deployment the UI runs against, as an *origin* rather than an API
 * base: hosts embedding this UI (the browser extension's Options page, say)
 * configure the site they point at, and {@link apiBaseUrl} derives the API
 * prefix from it. Matches `debate-api-client`'s own default once `/api` is
 * appended.
 */
export const DEFAULT_ORIGIN = "https://debate-ai.com";

/**
 * The API prefix for a deployment origin: `https://debate-ai.com` →
 * `https://debate-ai.com/api`.
 *
 * An origin that already ends in `/api` is left alone, so a host that
 * configured the API base directly (the extension's `apiBase` setting predates
 * this package and is documented as either) does not end up calling
 * `/api/api/...`. A blank or unparseable value falls back to
 * {@link DEFAULT_ORIGIN} instead of producing a relative URL that would resolve
 * against the extension's own `chrome-extension://` origin.
 */
export function apiBaseUrl(origin: string | undefined): string {
  const trimmed = (origin ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return `${DEFAULT_ORIGIN}/api`;
  try {
    // Rejects "debate-ai.com" (no scheme) and anything else grab-url could not
    // resolve on its own.
    new URL(trimmed);
  } catch {
    return `${DEFAULT_ORIGIN}/api`;
  }
  return /\/api$/.test(trimmed) ? trimmed : `${trimmed}/api`;
}

/**
 * The site origin behind an API base, for the "open this in the web app" links
 * the screens render: `https://debate-ai.com/api` → `https://debate-ai.com`.
 */
export function siteUrl(origin: string | undefined, route = "/"): string {
  const base = apiBaseUrl(origin).replace(/\/api$/, "");
  return `${base}${route.startsWith("/") ? route : `/${route}`}`;
}

/**
 * A `debate-api-client` client pointed at `origin`'s deployment.
 *
 * `devtools` is left on: grab's Ctrl+Alt+I request inspector is as useful in
 * an extension page as it is in the app, and it is the only way to see what a
 * screen asked for when a host has no network panel of its own.
 */
export function createWebUiClient(origin: string | undefined): Client {
  return createClient({ baseUrl: apiBaseUrl(origin) });
}

/**
 * Resolves an SDK call to its payload, throwing its `error` instead.
 *
 * The SDK's contract is "never throws, check `error` first" — which every
 * screen would otherwise have to restate. Doing it once here is what lets a
 * screen `await` a call and let {@link useAsync} catch the failure.
 *
 * @throws Error carrying the API's own message, or a generic one when the call
 *   failed without saying why.
 */
export async function unwrap<T>(call: Promise<RequestResult<T>>): Promise<T> {
  const { data, error } = await call;
  if (error) throw new Error(error);
  if (data === undefined) throw new Error("The API returned an empty response.");
  return data;
}
