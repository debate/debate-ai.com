/**
 * @fileoverview The crawl rules, and their agreement with the sitemap.
 *
 * A `robots.txt` that quietly stops matching the site is not something to
 * discover from a crawler, so the rules are tested as data: that they cover the
 * account-bound surface, that they do not block public content, and — the one
 * that actually breaks — that nothing the sitemap advertises is disallowed.
 */

import { describe, expect, it } from "vitest";

import { ALLOWED_PATHS, DISALLOWED_PATHS } from "../crawl-rules";
import { buildSitemap } from "../sitemap";

/**
 * Whether a crawler would actually be stopped from `path`.
 *
 * Models the real rule rather than a naive prefix scan: when an `Allow` and a
 * `Disallow` both match, the *more specific* one wins. So `/practice` being
 * disallowed does not stop `/practice/glossary` once that exact path is allowed
 * — a test that only checked prefixes would pass a broken rule and fail a
 * correct one.
 */
function isDisallowed(path: string): boolean {
  const matched = (rules: readonly string[]) =>
    rules
      .filter((rule) => path === rule || path.startsWith(`${rule}/`))
      .sort((a, b) => b.length - a.length)[0];
  const allow = matched(ALLOWED_PATHS);
  const deny = matched(DISALLOWED_PATHS);
  if (allow === undefined) return deny !== undefined;
  if (deny === undefined) return false;
  return deny.length > allow.length;
}

describe("DISALLOWED_PATHS", () => {
  it("keeps the account and API surface out of the crawl", () => {
    for (const path of ["/api/videos", "/auth/native-complete", "/login", "/settings", "/admin"]) {
      expect(isDisallowed(path), `expected ${path} to be disallowed`).toBe(true);
    }
  });

  it("keeps the per-user workspaces out of the crawl", () => {
    for (const path of [
      "/research/cards",
      "/research/cards/coverage",
      "/practice/versus-ai",
      "/practice/forums",
      "/coaching/progress",
      "/doc",
      "/debate",
      "/reason-editor",
    ]) {
      expect(isDisallowed(path), `expected ${path} to be disallowed`).toBe(true);
    }
  });

  it("leaves the public content crawlable", () => {
    for (const path of ["/videos", "/lectures", "/docs", "/legal/privacy"]) {
      expect(isDisallowed(path), `expected ${path} to stay crawlable`).toBe(false);
    }
  });

  it("leaves the reference pages that moved under /practice crawlable", () => {
    // These are public content that a blanket `Disallow: /practice/` would
    // have blocked along with the tools above. (Rankings moved to the
    // Coaching tools as `/coaching/rankings`.)
    for (const path of ["/practice/glossary", "/practice/statistics"]) {
      expect(isDisallowed(path), `expected ${path} to stay crawlable`).toBe(false);
    }
  });

  it("carries no URL fragment, which robots.txt does not match on", () => {
    // The tool tree links to `/practice/partners#judge`; the path is the part
    // that goes in the file.
    for (const path of DISALLOWED_PATHS) {
      expect(path).not.toContain("#");
    }
    expect(DISALLOWED_PATHS).toContain("/practice/partners");
  });

  it("is sorted, so the served file is stable between requests", () => {
    expect([...DISALLOWED_PATHS]).toEqual([...DISALLOWED_PATHS].sort());
  });

  it("disallows nothing twice", () => {
    expect(new Set(DISALLOWED_PATHS).size).toBe(DISALLOWED_PATHS.length);
  });
});

describe("the crawl rules and the sitemap agree", () => {
  it("disallows no URL the sitemap advertises", () => {
    // The two files are generated from the same sidebar data, so this can only
    // fail if one of them stops reading it.
    const advertised = buildSitemap({
      videos: [{ path: "/videos/2022/ndt/finals/dartmouth-sv-michigan-pr", lastModified: null }],
      lectureCategories: ["topic_lectures"],
      docsPages: ["/docs", "/docs/guides/practice-tools"],
    }).map((entry) => new URL(entry.url).pathname);

    for (const path of advertised) {
      expect(isDisallowed(path), `${path} is in the sitemap but disallowed`).toBe(false);
    }
  });
});

describe("ALLOWED_PATHS", () => {
  it("states that the site as a whole is crawlable", () => {
    expect(ALLOWED_PATHS).toContain("/");
  });
});
