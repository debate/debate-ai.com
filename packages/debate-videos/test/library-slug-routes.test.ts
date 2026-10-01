/**
 * @fileoverview Pins the paths that render the video library's branch views.
 *
 * The statistics view is the one that moved: the Topics Explorer's
 * research-area explorer is now its first section, so `/research/topics`
 * renders the same page. Under Next that address redirects
 * (`app/research/topics/page.tsx`); hosts that route without Next have no
 * redirect, so `PATH_SLUGS` is what keeps the old URL showing the merged
 * page instead of falling back to the lectures listing.
 */

import { describe, expect, it } from "vitest";
import { PATH_SLUGS, SLUG_MAP, librarySlug } from "../src/panels/lectureRouteConfig";

describe("librarySlug", () => {
  it("reads the category param when the route has one", () => {
    expect(librarySlug("Policy", "/videos/policy")).toBe("policy");
    expect(librarySlug(["Topic_Lectures"], "/lectures/topic_lectures")).toBe("topic_lectures");
  });

  it("falls back to the path for the routes that carry no category param", () => {
    expect(librarySlug(undefined, "/practice/statistics")).toBe("statistics");
    expect(librarySlug(undefined, "/practice/glossary/")).toBe("dictionary");
    expect(librarySlug(undefined, "/lectures")).toBe("lectures");
  });

  it("sends the old Topics Explorer address to the statistics view", () => {
    // Its research-area explorer is that page's first section now. Without
    // this the old URL would resolve to no slug and render the lectures grid.
    expect(librarySlug(undefined, "/research/topics")).toBe("statistics");
  });

  it("is undefined for the bare library route", () => {
    expect(librarySlug(undefined, "/videos")).toBeUndefined();
  });

  it("keeps every path slug resolvable to a real view", () => {
    for (const [path, slug] of Object.entries(PATH_SLUGS)) {
      expect(SLUG_MAP[slug]?.view, `${path} maps to slug "${slug}"`).toBeDefined();
    }
  });
});
