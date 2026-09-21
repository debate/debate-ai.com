/**
 * @fileoverview Watch-page slugs: `/videos/watch/<slug>`.
 *
 * The slug is purely the slugified title — no video id is appended.
 * The round trip is the part worth pinning: slugify, then match on
 * the slug, gives back a consistent key for the same title.
 */

import { describe, expect, it } from "vitest";
import {
  parseVideoWatchSlug,
  slugifyVideoTitle,
  videoWatchHref,
  videoWatchSlug,
} from "../src/lib/video-slug";

describe("slugifyVideoTitle", () => {
  it("lowercases, folds accents and collapses punctuation to single dashes", () => {
    expect(slugifyVideoTitle("2022 NDT Finals — Dartmouth vs. Michigan!")).toBe(
      "2022-ndt-finals-dartmouth-vs-michigan",
    );
    expect(slugifyVideoTitle("Négation & Réfutation")).toBe("negation-refutation");
  });

  it("truncates long titles at a word boundary", () => {
    const slug = slugifyVideoTitle(
      "Resolved: The United States federal government should substantially increase its investment in hyperscale data centers",
    );
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug.startsWith("resolved-the-united-states-federal-government")).toBe(true);
  });

  it("is empty for a title with nothing slug-able in it", () => {
    expect(slugifyVideoTitle("!!! ???")).toBe("");
    expect(slugifyVideoTitle("")).toBe("");
  });
});

describe("videoWatchSlug / videoWatchHref", () => {
  it("returns the slugified title without a video id", () => {
    expect(videoWatchSlug("NDT Finals")).toBe("ndt-finals");
    expect(videoWatchHref("NDT Finals")).toBe("/videos/watch/ndt-finals");
  });

  it("is empty for a title that slugifies to nothing", () => {
    expect(videoWatchSlug("???")).toBe("");
  });
});

describe("parseVideoWatchSlug", () => {
  it("returns the slug as-is", () => {
    expect(parseVideoWatchSlug("ndt-finals")).toBe("ndt-finals");
    expect(parseVideoWatchSlug("2022-ndt-finals-dartmouth-vs-michigan")).toBe(
      "2022-ndt-finals-dartmouth-vs-michigan",
    );
  });

  it("handles percent-encoded slugs", () => {
    expect(parseVideoWatchSlug("ndt%20finals")).toBe("ndt finals");
  });

  it("returns null for empty input", () => {
    expect(parseVideoWatchSlug("")).toBeNull();
    expect(parseVideoWatchSlug(null)).toBeNull();
    expect(parseVideoWatchSlug(undefined)).toBeNull();
  });
});
