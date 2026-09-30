/**
 * @fileoverview The URL inventory a sitemap is built from.
 *
 * Split out from `app/sitemap.ts` so the shape of the file can be tested
 * without a database, a Worker or a request. `app/sitemap.ts` does the reading
 * (videos from `videos`, lecture categories from the video meta, docs pages
 * from the Fumadocs source) and hands the results here; everything in this
 * module is a pure function of those inputs.
 *
 * ## What is and is not in a sitemap
 *
 * A sitemap lists the URLs a search engine should index, so it is a statement
 * about *indexability*, not a directory. Two consequences shape the lists below:
 *
 * - **Redirects are excluded.** `/videos/watch/<slug>` is a permanent redirect
 *   to the video's canonical path (`app/videos/watch/[slug]/page.tsx`), and the
 *   category paths that moved under `/research`, `/practice` and `/coaching` are
 *   308s (see `lib/redirects/category-paths.ts`). A sitemap must carry the
 *   destination, never the hop — listing a redirect spends crawl budget on a
 *   URL that can only ever forward.
 * - **The authenticated tool surface is excluded.** Everything under
 *   `/research/cards/*`, `/practice/*`, `/settings`, `/admin` and the per-user
 *   routes needs a signed-in session to render anything. `app/robots.ts`
 *   disallows the same paths; a sitemap that listed them would contradict it.
 * @module lib/seo/sitemap
 */

import { SIDEBAR_VIDEO_LINKS } from "debate-videos";
import { absoluteUrl } from "./site-url";
import type { VideoSitemapEntry } from "@/lib/videos/video-repository";

/** A sitemap URL and the crawl hints that go with it. */
export interface SitemapEntry {
  /** Absolute URL — what goes in `<loc>`. */
  url: string;
  /** When the page last changed; omitted when it cannot be known. */
  lastModified?: Date;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  /**
   * Relative importance, 0.0–1.0. Google has said for years that it ignores
   * this field; it is still emitted because other consumers read it, and it
   * costs one line.
   */
  priority?: number;
}

/**
 * The hand-maintained pages: the site's own front door and the handful of
 * routes that are content rather than a tool.
 *
 * The homepage is `/videos`, not `/` — `app/page.tsx` redirects `/` there, so
 * the root is a redirect and is listed nowhere, for the same reason
 * `/videos/watch/<slug>` is not.
 */
const STATIC_PAGES: ReadonlyArray<{ path: string; priority: number; changeFrequency: SitemapEntry["changeFrequency"] }> = [
  { path: "/videos", priority: 1.0, changeFrequency: "daily" },
  { path: "/lectures", priority: 0.9, changeFrequency: "weekly" },
  { path: "/tools", priority: 0.8, changeFrequency: "monthly" },
  { path: "/docs", priority: 0.8, changeFrequency: "weekly" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
];

/**
 * The video library's category pages, read off the sidebar's own link data
 * (`SIDEBAR_VIDEO_LINKS`) rather than restated here.
 *
 * The two destinations deliberately left out are the ones whose content is the
 * visitor's, not the site's: `/videos/favorites` and `/videos/history` render
 * from the signed-in user's own library. Everything else the sidebar links to
 * is a fixed page.
 */
const EXCLUDED_VIDEO_LINKS = new Set(["/videos/favorites", "/videos/history"]);

/** Paths the sitemap builds, with a stable priority tier per group. */
const PRIORITY = {
  videoCategory: 0.8,
  lectureCategory: 0.7,
  video: 0.6,
  docs: 0.7,
} as const;

/**
 * The sitemap's fixed pages: the homepage, the content routes, and the video
 * library's category pages.
 *
 * Deduplicated by URL: `/videos` and `/lectures` are named both in
 * {@link STATIC_PAGES} and by the sidebar's own link data, and a sitemap that
 * names a URL twice is a malformed file rather than a redundant one.
 */
export function staticSitemapEntries(): SitemapEntry[] {
  const byUrl = new Map<string, SitemapEntry>();

  // The hand-maintained pages are written first so a URL they share with the
  // sidebar keeps the priority and frequency stated here.
  for (const { path, priority, changeFrequency } of STATIC_PAGES) {
    byUrl.set(absoluteUrl(path), { url: absoluteUrl(path), changeFrequency, priority });
  }

  // `SIDEBAR_VIDEO_LINKS` is a superset that also holds the favourites and
  // watch-history destinations, so it is walked rather than the individual
  // collections; adding a category to the sidebar adds it here.
  for (const link of SIDEBAR_VIDEO_LINKS) {
    if (EXCLUDED_VIDEO_LINKS.has(link.href)) continue;
    const url = absoluteUrl(link.href);
    if (byUrl.has(url)) continue;
    byUrl.set(url, { url, changeFrequency: "weekly", priority: PRIORITY.videoCategory });
  }

  return [...byUrl.values()];
}

/**
 * One entry per lecture category, `/lectures/<key>`.
 *
 * The keys come from `getVideoMeta().lectureCategories`, so a category that
 * loses its last video leaves the sitemap on the next build rather than
 * pointing at an empty page forever.
 *
 * @param keys - Lecture category keys, e.g. `topic_lectures`.
 */
export function lectureCategorySitemapEntries(keys: readonly string[]): SitemapEntry[] {
  return keys
    .filter(Boolean)
    .map((key) => ({
      url: absoluteUrl(`/lectures/${encodeURIComponent(key)}`),
      changeFrequency: "weekly" as const,
      priority: PRIORITY.lectureCategory,
    }));
}

/**
 * One entry per help-docs page.
 *
 * Fumadocs already knows each page's URL — it is the same `source` the docs
 * routes render from, and the `url` it carries already includes the `/docs`
 * prefix — so this only has to absolutise it.
 *
 * @param urls - Page URLs as the Fumadocs source reports them, e.g. `/docs/guides`.
 */
export function docsSitemapEntries(urls: readonly string[]): SitemapEntry[] {
  return urls
    .filter((url) => typeof url === "string" && url.startsWith("/"))
    .map((url) => ({
      url: absoluteUrl(url),
      changeFrequency: "weekly" as const,
      priority: PRIORITY.docs,
    }));
}

/**
 * One entry per video, at its canonical path.
 *
 * Deduplicated by path, because a round whose videos share a title slug can
 * build the same path twice and a sitemap that lists a URL twice is a
 * malformed file, not a redundant one.
 *
 * @param entries - Rows from `getVideoSitemapEntries()`.
 */
export function videoSitemapEntries(entries: readonly VideoSitemapEntry[]): SitemapEntry[] {
  const byPath = new Map<string, SitemapEntry>();
  for (const entry of entries) {
    if (!entry?.path) continue;
    const existing = byPath.get(entry.path);
    // Two rows on one path: keep whichever claims the later change, since
    // `<lastmod>` is the one hint on the entry that is worth being right about.
    if (existing?.lastModified && entry.lastModified && entry.lastModified > existing.lastModified) {
      existing.lastModified = entry.lastModified;
      continue;
    }
    if (!existing) {
      byPath.set(entry.path, {
        url: absoluteUrl(entry.path),
        ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
        changeFrequency: "monthly",
        priority: PRIORITY.video,
      });
    }
  }
  return [...byPath.values()];
}

/**
 * Assembles the whole sitemap.
 *
 * Ordering is a convenience for whoever opens the file, not a signal: the
 * sitemap protocol has no opinion on element order and search engines read the
 * set. Static pages lead because they are the ones a human is looking for.
 *
 * Deduplicated across the sources, not only within one. The lists are built
 * separately and genuinely overlap — `/docs` is named here and also comes back
 * from the Fumadocs source as its own root page — and a sitemap that names a
 * URL twice is a malformed file, not a redundant one. Earlier sources win, so
 * a URL's priority and frequency come from the page that declared it first.
 *
 * @param input - The dynamic parts, each already read by the caller.
 * @returns Every indexable URL on the site.
 */
export function buildSitemap(input: {
  videos: readonly VideoSitemapEntry[];
  lectureCategories: readonly string[];
  docsPages: readonly string[];
}): SitemapEntry[] {
  const entries = [
    ...staticSitemapEntries(),
    ...lectureCategorySitemapEntries(input.lectureCategories),
    ...docsSitemapEntries(input.docsPages),
    ...videoSitemapEntries(input.videos),
  ];

  const byUrl = new Map<string, SitemapEntry>();
  for (const entry of entries) {
    if (!byUrl.has(entry.url)) byUrl.set(entry.url, entry);
  }
  return [...byUrl.values()];
}
