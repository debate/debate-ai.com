/**
 * @fileoverview What goes in `/sitemap.xml`, and what must not.
 *
 * The sitemap is a claim to a search engine about which URLs are indexable, so
 * the tests are about the claims rather than the XML: that every entry is an
 * absolute URL on the canonical host, that no redirect and no per-user page is
 * listed, and that the static half of the file cannot drift away from the
 * sidebar the rest of the site is built out of.
 */

import { describe, expect, it } from "vitest";
import { SIDEBAR_VIDEO_LINKS } from "@debate/videos";

import {
  buildSitemap,
  docsSitemapEntries,
  lectureCategorySitemapEntries,
  staticSitemapEntries,
  videoSitemapEntries,
} from "../sitemap";
import { absoluteUrl, DEFAULT_SITE_ORIGIN } from "../site-url";

/** No database here, so the video half is exercised through the pure builder. */
const VIDEO_INPUT = { videos: [], lectureCategories: [], docsPages: [] };

describe("absoluteUrl", () => {
  it("prefixes a site-relative path with the canonical origin", () => {
    expect(absoluteUrl("/videos")).toBe(`${DEFAULT_SITE_ORIGIN}/videos`);
    expect(absoluteUrl("videos")).toBe(`${DEFAULT_SITE_ORIGIN}/videos`);
  });

  it("leaves an already-absolute URL alone", () => {
    expect(absoluteUrl("https://i.ytimg.com/vi/abc/hqdefault.jpg")).toBe(
      "https://i.ytimg.com/vi/abc/hqdefault.jpg",
    );
  });
});

describe("staticSitemapEntries", () => {
  const entries = staticSitemapEntries();
  const paths = entries.map((entry) => new URL(entry.url).pathname);

  it("emits only absolute URLs on the canonical host", () => {
    for (const entry of entries) {
      expect(entry.url.startsWith(`${DEFAULT_SITE_ORIGIN}/`)).toBe(true);
    }
  });

  it("lists the video library as the homepage", () => {
    // `/` is a redirect to `/videos` (app/page.tsx), so the library is the
    // site's front door and is what the sitemap names.
    expect(paths).toContain("/videos");
    expect(paths).not.toContain("/");
  });

  it("lists no URL twice", () => {
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("carries every public video-library category the sidebar links to", () => {
    for (const link of SIDEBAR_VIDEO_LINKS) {
      if (link.href === "/videos/favorites" || link.href === "/videos/history") continue;
      expect(paths, `expected ${link.href} in the sitemap`).toContain(link.href);
    }
  });

  it("omits the per-user library views", () => {
    // These render from the signed-in visitor's own favourites and watch
    // history, so they are one empty page to anyone else.
    expect(paths).not.toContain("/videos/favorites");
    expect(paths).not.toContain("/videos/history");
  });

  it("lists no redirect", () => {
    // The paths that moved under their sidebar category are 308s (see
    // lib/redirects/category-paths.ts); a sitemap carrying one spends crawl
    // budget on a URL that can only forward.
    for (const moved of ["/cards", "/topics", "/rules", "/versus-ai", "/coach"]) {
      expect(paths).not.toContain(moved);
    }
  });
});

describe("lectureCategorySitemapEntries", () => {
  it("builds a page per category and encodes the key", () => {
    const entries = lectureCategorySitemapEntries(["topic_lectures", "drills & reps"]);
    expect(entries.map((entry) => new URL(entry.url).pathname)).toEqual([
      "/lectures/topic_lectures",
      "/lectures/drills%20%26%20reps",
    ]);
  });

  it("drops an empty key rather than emitting /lectures/ twice", () => {
    expect(lectureCategorySitemapEntries(["", "topic_lectures"])).toHaveLength(1);
  });
});

describe("docsSitemapEntries", () => {
  it("absolutises the URLs the Fumadocs source reports", () => {
    const [entry] = docsSitemapEntries(["/docs/guides/practice-tools"]);
    expect(entry.url).toBe(`${DEFAULT_SITE_ORIGIN}/docs/guides/practice-tools`);
  });

  it("ignores anything that is not a site-relative path", () => {
    expect(docsSitemapEntries(["https://example.com/x", ""])).toEqual([]);
  });
});

describe("videoSitemapEntries", () => {
  it("carries the canonical path and the row's last-modified date", () => {
    const lastModified = new Date("2026-03-01T00:00:00Z");
    const [entry] = videoSitemapEntries([
      { path: "/videos/2022/ndt/finals/dartmouth-sv-michigan-pr", lastModified },
    ]);
    expect(entry.url).toBe(`${DEFAULT_SITE_ORIGIN}/videos/2022/ndt/finals/dartmouth-sv-michigan-pr`);
    expect(entry.lastModified).toBe(lastModified);
  });

  it("omits lastmod when the row cannot supply one", () => {
    // The JSON fallback carries no per-row timestamp, and a wrong <lastmod> is
    // worse than none.
    const [entry] = videoSitemapEntries([{ path: "/videos/archive/library/some-lecture", lastModified: null }]);
    expect("lastModified" in entry).toBe(false);
  });

  it("lists a shared path once, keeping the later change", () => {
    // Two rows can build the same path when a title slug collides; a sitemap
    // that names a URL twice is a malformed file.
    const entries = videoSitemapEntries([
      { path: "/videos/2019/lectures/duel", lastModified: new Date("2026-01-01T00:00:00Z") },
      { path: "/videos/2019/lectures/duel", lastModified: new Date("2026-05-01T00:00:00Z") },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].lastModified).toEqual(new Date("2026-05-01T00:00:00Z"));
  });

  it("skips a row with no path", () => {
    expect(videoSitemapEntries([{ path: "", lastModified: null }])).toEqual([]);
  });
});

describe("buildSitemap", () => {
  const entries = buildSitemap({
    videos: [{ path: "/videos/2022/ndt/finals/dartmouth-sv-michigan-pr", lastModified: null }],
    lectureCategories: ["topic_lectures"],
    docsPages: ["/docs", "/docs/guides/practice-tools"],
  });

  it("assembles every source into one file of absolute URLs", () => {
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain("/videos");
    expect(paths).toContain("/lectures/topic_lectures");
    expect(paths).toContain("/docs/guides/practice-tools");
    expect(paths).toContain("/videos/2022/ndt/finals/dartmouth-sv-michigan-pr");
  });

  it("names no URL twice across the whole file", () => {
    const urls = entries.map((entry) => entry.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("is a valid sitemap with no dynamic parts to fill in", () => {
    expect(buildSitemap(VIDEO_INPUT).length).toBeGreaterThan(0);
  });
});
