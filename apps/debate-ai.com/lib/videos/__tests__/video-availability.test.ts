/**
 * @fileoverview Turning what YouTube says about a video into what the library
 * stores about it.
 *
 * The distinction this pins is the one that decides whether a video is worth
 * keeping: `private` and `not_embeddable` are reversible and the row's
 * metadata still matters, while `removed` means the API no longer returns the
 * video at all. Getting that wrong in either direction is expensive — treat
 * every private video as deleted and the library loses rounds that come back
 * next week; treat a deletion as available and viewers keep clicking a card
 * that plays nothing.
 */

import { describe, expect, it } from "vitest";
import { classifyAvailability } from "../resync-view-counts";
import type { YouTubeVideoStatus } from "debate-data-sync/src/youtube/youtube-api";

/** A status as the API returns one, overridable per case. */
function status(overrides: Partial<YouTubeVideoStatus> = {}): YouTubeVideoStatus {
  return {
    videoId: "dQw4w9WgXcQ",
    viewCount: 1234,
    privacyStatus: "public",
    uploadStatus: "processed",
    embeddable: true,
    ...overrides,
  };
}

describe("classifyAvailability", () => {
  it("calls a normal public video available", () => {
    expect(classifyAvailability(status())).toBe("available");
  });

  it("treats an id the API did not return as removed", () => {
    // A `/videos` lookup by id simply omits a deleted video, so absence is
    // the only signal a takedown ever gives.
    expect(classifyAvailability(undefined)).toBe("removed");
  });

  it("keeps a private video apart from a deleted one", () => {
    expect(classifyAvailability(status({ privacyStatus: "private" }))).toBe("private");
  });

  it("counts a rejected or failed upload as removed", () => {
    expect(classifyAvailability(status({ uploadStatus: "rejected" }))).toBe("removed");
    expect(classifyAvailability(status({ uploadStatus: "failed" }))).toBe("removed");
    expect(classifyAvailability(status({ uploadStatus: "deleted" }))).toBe("removed");
  });

  it("flags a video that exists but can no longer be embedded", () => {
    // It still plays on YouTube; it just cannot play in our page.
    expect(classifyAvailability(status({ embeddable: false }))).toBe("not_embeddable");
  });

  it("does not flag a video whose embeddable flag was simply absent", () => {
    expect(classifyAvailability(status({ embeddable: null }))).toBe("available");
  });

  it("reports an unlisted video as available", () => {
    // Unlisted videos play in an embed; only private ones stop.
    expect(classifyAvailability(status({ privacyStatus: "unlisted" }))).toBe("available");
  });
});
