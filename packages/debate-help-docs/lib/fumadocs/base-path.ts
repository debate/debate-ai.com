/**
 * @file base-path.ts
 * @description The URL prefix this docs site is served under.
 *
 * The docs ship as part of debate-ai.com rather than as their own origin:
 * `next build` static-exports this app and the export is copied into
 * `apps/debate-ai.com/public/docs`, so every page lives under `/docs`
 * (`/docs`, `/docs/features/…`, `/docs/guides/…`). Next's `basePath` handles
 * that for routing, `<Link>` hrefs, and `_next/` assets, so app routes here
 * are written *without* the prefix — `app/(docs)/[[...slug]]` is `/docs`, not
 * `/docs/docs`.
 *
 * What `basePath` does not cover is anything that bypasses the router:
 * `fetch()` URLs and `window.location` assignments are raw paths the browser
 * resolves against the origin. Those have to carry the prefix themselves, so
 * they build it from this constant.
 *
 * Keep it in sync with `basePath` in `next.config.ts` (which imports it) and
 * with the copy target in `apps/debate-ai.com/scripts/build-docs.mjs`.
 *
 * @module lib/fumadocs/base-path
 */

/** URL prefix every route of this site is served under, without a trailing slash. */
export const DOCS_BASE_PATH = '/docs';

/**
 * An origin-absolute URL for a path in this site, for uses that `basePath`
 * does not rewrite (`fetch`, `window.location`, `new URL(…, origin)`).
 *
 * @param path - Route path with a leading slash, e.g. `"/api/docs-search"`.
 */
export function withBasePath(path: string): string {
  return `${DOCS_BASE_PATH}${path === '/' ? '' : path}`;
}
