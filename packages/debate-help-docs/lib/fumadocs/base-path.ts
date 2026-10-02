/**
 * @file base-path.ts
 * @description The URL prefix this docs site is served under.
 *
 * The docs are part of debate-ai.com rather than their own origin: the web
 * app mounts this package's route modules under `apps/debate-ai.com/app/docs`,
 * so every page lives under `/docs` (`/docs`, `/docs/features/…`,
 * `/docs/guides/…`). There is no Next `basePath` doing the prefixing — the
 * docs share the app's router — so every URL this package builds, whether a
 * `<Link>` href, a page-tree URL, a `fetch()` or a `window.location`
 * assignment, carries the prefix itself, built from this constant.
 *
 * Keep it in sync with the route folder in the web app (`app/docs`) and with
 * `DOCS_BASE_PATH` in `@debate/webview/lib/docs-links.ts`.
 *
 * @module lib/fumadocs/base-path
 */

/** URL prefix every route of this site is served under, without a trailing slash. */
export const DOCS_BASE_PATH = '/docs';

/**
 * An origin-absolute URL for a path in this site.
 *
 * @param path - Route path with a leading slash, e.g. `"/api/docs-search"`.
 */
export function withBasePath(path: string): string {
  return `${DOCS_BASE_PATH}${path === '/' ? '' : path}`;
}
