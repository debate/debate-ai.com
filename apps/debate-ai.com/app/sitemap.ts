/**
 * @fileoverview `/sitemap.xml` — the list of URLs on this site worth indexing.
 *
 * Uses Next's `sitemap` metadata-file convention rather than a route handler,
 * which is what makes the XML correct by construction: vinext's `sitemapToXml`
 * escapes every field, so a video whose title contains `&` or a tag that
 * contains `<` cannot produce a malformed document, and the response carries the
 * right content type and cache header without either being spelled out here.
 *
 * ## Where the URLs come from
 *
 * Three dynamic sources, handed to the pure builder in `lib/seo/sitemap.ts`:
 *
 * - **Videos** (`getVideoSitemapEntries`) — every video at its *canonical*
 *   path. The old `/videos/watch/<slug>` URLs this file used to list
 *   alongside them are permanent redirects and are deliberately gone.
 * - **Lecture categories** (`getVideoMeta`) — one page per category, so a
 *   category that empties out drops off the sitemap instead of lingering.
 * - **Docs pages** (`docsPageUrls`) — read from the same Fumadocs source the
 *   `/docs` routes render, so a page cannot be in the docs and missing here.
 *
 * ## Why this is dynamic
 *
 * The library is a live table: a video is added, re-tagged or taken down
 * between crawls, and a sitemap frozen at build time would describe a site that
 * no longer exists. So the default export reads on every request, and vinext
 * serves the result as `public, max-age=0, must-revalidate` — an edge node
 * revalidates rather than serving a stale library for an hour.
 */

import type { MetadataRoute } from "next"
import { buildSitemap } from "@/lib/seo/sitemap"
import { getVideoMeta, getVideoSitemapEntries } from "@/lib/videos/video-repository"
import { docsPageUrls } from "debate-help-docs/lib/fumadocs/sitemap-helper"

/** Read the library on each request rather than freezing it at build time. */
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [videos, meta] = await Promise.all([
    getVideoSitemapEntries(),
    getVideoMeta(),
  ])

  // The docs source is compiled into the bundle, so this reads an in-memory
  // index — but it is kept out of the `Promise.all` above so a failure here
  // costs the docs pages rather than the whole sitemap.
  let docsPages: string[] = []
  try {
    docsPages = docsPageUrls()
  } catch (error) {
    console.error("sitemap: docs page list failed", error)
  }

  return buildSitemap({
    videos,
    lectureCategories: meta.lectureCategories.map((category) => category.key),
    docsPages,
  })
}
