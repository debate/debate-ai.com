/**
 * @fileoverview The site's canonical origin, and the one place a URL is
 * spelled as an absolute address.
 *
 * Search engines are given absolute URLs, not paths: a sitemap's `<loc>`, a
 * `robots.txt` `Sitemap:` line and a page's `alternates.canonical` all need
 * the origin in front of them. Getting it wrong is silent and expensive — a
 * relative canonical resolves against `http://localhost:3000` when the app does
 * not set `metadataBase`, which tells Google the canonical of every video is a
 * development URL.
 *
 * ## Where the origin comes from
 *
 * {@link siteOrigin} reads an environment variable and falls back to
 * {@link CANONICAL_HOST}, so the same deployment can be pointed at a different
 * domain without a code change — a preview URL, a staging host, or a rename.
 * The variables are consulted in the same order as the auth layer's origin
 * resolution (`lib/auth/index.ts`), so a deployment that already sets
 * `BETTER_AUTH_URL` for auth gets the matching SEO metadata for free instead of
 * two sets of configuration that can disagree.
 *
 * ## Why this module does not import `getEnv`
 *
 * `lib/env.ts` reaches the Cloudflare bindings through the request-scoped
 * `AsyncLocalStorage` in `lib/database/context.ts`, which drags the Drizzle
 * schema in with it. That is fine for a route handler, but
 * `lib/redirects/canonical-host.ts` is imported at the very top of the Worker —
 * before `runWithContext` has published anything — and a constant used there
 * should not cost the redirect a database import. So the Worker resolves the
 * origin itself and passes it in; only this module knows the lookup order.
 * @module lib/seo/site-url
 */

import { CANONICAL_HOST } from "@/lib/redirects/canonical-host";

/**
 * The origin used when no environment variable supplies one.
 *
 * `d.ebate.app` and not `debate-ai.com`: the app answers on both, but
 * `debate-ai.com` is the registration domain while `d.` is the host the
 * canonical-host redirect standardises on, so metadata here names the same host
 * inbound links are consolidated to.
 */
export const DEFAULT_SITE_ORIGIN = `https://${CANONICAL_HOST}`;

/**
 * Environment variables that can name the canonical origin, most specific
 * first.
 *
 * `BETTER_AUTH_URL` leads because that is what this codebase already treats as
 * the deployment's own address (auth validates callback URLs against it), and a
 * deployment that has set it has already answered "what is this instance's
 * URL". `NEXT_PUBLIC_*` follow as they do in `lib/auth/index.ts`.
 *
 * A value may be a full origin (`https://d.ebate.app`) or a bare host
 * (`d.ebate.app`); both are accepted, since a `Host`-shaped value is a
 * reasonable thing to paste into a Cloudflare variable.
 */
export const SITE_ORIGIN_VARS = [
  "CANONICAL_SITE_URL",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_BASE_URL",
] as const;

/**
 * Normalises a configured value into an origin: no trailing slash, a scheme
 * added when one is missing.
 *
 * Returns `null` for anything that is not usable as an origin, so a
 * half-configured variable falls through to the default rather than producing
 * `<loc>undefined/videos</loc>`.
 *
 * @param value - The raw environment value.
 * @returns e.g. `https://d.ebate.app`, or `null` when `value` is not an origin.
 */
export function normalizeOrigin(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  // A bare host or host:port, which `new URL` rejects without a scheme.
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (!url.hostname) return null;

  // Drop path, query, hash and trailing slash: an origin is scheme + host + port.
  return url.origin;
}

/**
 * The canonical origin for this request, or `null` when no variable is set.
 *
 * Kept separate from {@link siteOrigin} so a caller holding the bindings — the
 * Worker entry, which runs outside the request context — can resolve it
 * without importing `lib/env.ts`.
 *
 * @param read - Reads a variable by name; the Worker's `env` in production,
 *   `process.env` locally.
 */
export function resolveSiteOrigin(
  read: (name: string) => string | undefined,
): string | null {
  for (const name of SITE_ORIGIN_VARS) {
    const origin = normalizeOrigin(read(name));
    if (origin) return origin;
  }
  return null;
}

/**
 * The canonical origin, for use inside a request.
 *
 * Falls back to {@link DEFAULT_SITE_ORIGIN} when nothing is configured, which
 * is the production default and every local dev run.
 */
export function siteOrigin(): string {
  return resolveSiteOrigin(readConfiguredOrigin) ?? DEFAULT_SITE_ORIGIN;
}

/**
 * Reads a variable from the request-scoped Cloudflare bindings, then from
 * `process.env` for local dev and build-time inlining.
 *
 * The indirection keeps `getEnv`'s import out of this module (see the
 * file-level note) while still reading the same sources it does. It is
 * resolved lazily on first use so importing this module never reaches for the
 * database context.
 */
let readConfiguredOrigin: (name: string) => string | undefined = (name) =>
  typeof process !== "undefined" ? process.env?.[name] : undefined;

/**
 * Points the lookup at the Cloudflare bindings for the current request.
 *
 * Called once by the Worker entry, which holds `env` before any request
 * context exists. Passing a plain reader here is also what lets tests pin the
 * origin without touching global state.
 */
export function setSiteOriginReader(
  read: ((name: string) => string | undefined) | null,
): void {
  if (read) {
    readConfiguredOrigin = read;
    return;
  }
  readConfiguredOrigin = (name) =>
    typeof process !== "undefined" ? process.env?.[name] : undefined;
}

/**
 * Turns a site-relative path into an absolute URL for a sitemap `<loc>`, a
 * `robots.txt` `Sitemap:` line or an Open Graph image.
 *
 * A path that is already absolute is returned unchanged, so a caller that has a
 * full URL in hand does not have to know which form it arrived in.
 *
 * @param path - A path beginning with `/`, or an absolute URL.
 * @returns e.g. `https://d.ebate.app/videos`.
 */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
