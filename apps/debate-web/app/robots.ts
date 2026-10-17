/**
 * @fileoverview `/robots.txt` — crawl rules, and the pointer to the sitemap.
 *
 * Next's `robots` metadata-file convention, which vinext serialises to the
 * `text/plain` the crawlers expect. It did not exist before this file, so
 * nothing was directing crawlers at `/sitemap.xml` at all: a sitemap nobody is
 * told about is one Google has to guess the URL of.
 *
 * The rules themselves live in `lib/seo/crawl-rules.ts`, so they can be tested
 * without rendering a route.
 *
 * ## What this file is and is not
 *
 * `robots.txt` is a crawl-budget measure. It stops a crawler *fetching* a page;
 * it does not remove a page already in the index, and a disallowed URL that
 * other sites link to can still appear in results as a bare link. So the right
 * description of the disallow list is "not worth crawling", not "must never be
 * indexed" — nothing here is secret, and nothing here renders without an
 * account, which is what makes disallowing the correct tool. A page that truly
 * must not appear in a result needs a `noindex` a crawler can read, and a
 * crawler told not to fetch will never see one.
 *
 * The disallowed set and the sitemap's contents are drawn from the same place
 * (`lib/seo/crawl-rules.ts` and the sidebar link data), so the two files cannot
 * quietly disagree about what the public site is.
 */

import type { MetadataRoute } from "next"
import { ALLOWED_PATHS, DISALLOWED_PATHS } from "@/lib/seo/crawl-rules"
import { absoluteUrl } from "@/lib/seo/site-url"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [...ALLOWED_PATHS],
        disallow: [...DISALLOWED_PATHS],
      },
    ],
    // The pointer that makes /sitemap.xml discoverable at all.
    sitemap: absoluteUrl("/sitemap.xml"),
    // Tells Yandex which host to treat as canonical when it sees the app served
    // from more than one — the app answers on `debate-ai.com` as well as on the
    // canonical host.
    host: absoluteUrl("/"),
  }
}
