/**
 * @fileoverview Watch-page slugs: `/videos/watch/<title-slug>-<videoId>`.
 *
 * The round trip is the part worth pinning. The title half of a slug is
 * decoration — a video that gets retitled, or shared with an older title,
 * must still resolve — so the id is read back positionally from the end.
 * YouTube ids contain `-` and `_` often enough that the obvious
 * `split("-").pop()` truncates a real share of the library.
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
  it("appends the video id to the title slug", () => {
    expect(videoWatchSlug("NDT Finals", "OXdffJy8HIs")).toBe("ndt-finals-OXdffJy8HIs");
    expect(videoWatchHref("NDT Finals", "OXdffJy8HIs")).toBe(
      "/videos/watch/ndt-finals-OXdffJy8HIs",
    );
  });

  it("falls back to the bare id when the title slugifies to nothing", () => {
    expect(videoWatchSlug("???", "OXdffJy8HIs")).toBe("OXdffJy8HIs");
  });
});

describe("parseVideoWatchSlug", () => {
  it("round-trips every id, dashes and underscores included", () => {
    for (const id of ["OXdffJy8HIs", "-abc123XYZ_", "a_b-c_d-e_f", "dQw4w9WgXcQ"]) {
      expect(parseVideoWatchSlug(videoWatchSlug("2022 NDT Finals", id))).toBe(id);
    }
  });

  it("ignores the title, so a retitled video keeps its old links", () => {
    expect(parseVideoWatchSlug("some-completely-different-title-OXdffJy8HIs")).toBe("OXdffJy8HIs");
  });

  it("accepts a bare id and a percent-encoded slug", () => {
    expect(parseVideoWatchSlug("OXdffJy8HIs")).toBe("OXdffJy8HIs");
    expect(parseVideoWatchSlug("ndt%20finals-OXdffJy8HIs")).toBe("OXdffJy8HIs");
  });

  it("rejects a slug that carries no id", () => {
    expect(parseVideoWatchSlug("")).toBeNull();
    expect(parseVideoWatchSlug(null)).toBeNull();
    expect(parseVideoWatchSlug("ndt-finals")).toBeNull();
    // Eleven trailing characters, but not separated from the title by a dash.
    expect(parseVideoWatchSlug("ndtfinalsOXdffJy8HIs")).toBeNull();
    // Eleven characters, one of them outside the id alphabet.
    expect(parseVideoWatchSlug("ndt-finals-OXdffJy8HI!")).toBeNull();
  });
});
