/**
 * @file sitemap-helper.ts
 * @description The help docs' page URLs, for the web app's sitemap.
 *
 * The app's `/sitemap.xml` wants to list every docs page. It cannot walk the
 * content directory itself: on Workers there is no filesystem, and the MDX is
 * compiled at build time into the {@link source} loader's own index. So the app
 * calls in here, and this module reads the same source the docs routes render
 * from — one source of truth, whether a page is reached through the site or
 * through the sitemap.
 *
 * @module lib/fumadocs/sitemap-helper
 */

import { source } from './source';

/**
 * Every docs page's URL, as the Fumadocs source reports it.
 *
 * `page.url` already carries the `/docs` prefix (the loader is built with
 * `baseUrl: DOCS_BASE_PATH`), so these are site-relative paths the caller
 * absolutises itself — it is the one that owns the canonical origin.
 *
 * Includes the docs root, which is a real page (`content/docs/index.mdx`) and
 * not a redirect.
 */
export function docsPageUrls(): string[] {
  return source.getPages().map((page) => page.url);
}
