import { describe, expect, it } from "vitest";

import { pickLoadingStartTime, seekLanded, LOADING_VIDEO_SRC } from "../loading-video";

describe("pickLoadingStartTime", () => {
  it("starts inside the clip and off the very end", () => {
    // 10s clip, 2s tail reserved -> the whole random range is [0, 8).
    expect(pickLoadingStartTime(10, () => 0)).toBe(0);
    expect(pickLoadingStartTime(10, () => 0.5)).toBe(4);
    expect(pickLoadingStartTime(10, () => 0.999)).toBeCloseTo(7.992, 5);
  });

  it("never returns the same point twice in a row by construction", () => {
    const values = [0.1, 0.62, 0.35].map((r) => pickLoadingStartTime(10, () => r));
    expect(new Set(values).size).toBe(3);
  });

  it("reserves at most half of a short clip, so the range stays random", () => {
    // 1s clip: reserving the full 2s tail would pin every load to 0.
    expect(pickLoadingStartTime(1, () => 0.999)).toBeCloseTo(0.4995, 5);
  });

  it("returns 0 for a duration the browser has not resolved", () => {
    // Safari reports Infinity for a stream it has not measured; a failed
    // load leaves NaN; a 0-length clip has nowhere to seek to.
    expect(pickLoadingStartTime(Number.POSITIVE_INFINITY)).toBe(0);
    expect(pickLoadingStartTime(Number.NaN)).toBe(0);
    expect(pickLoadingStartTime(0)).toBe(0);
    expect(pickLoadingStartTime(-5)).toBe(0);
  });

  it("clamps a random source that breaks the [0, 1) contract", () => {
    expect(pickLoadingStartTime(10, () => 5)).toBe(9.99);
    expect(pickLoadingStartTime(10, () => -1)).toBe(0);
  });

  it("stays within the clip for every point of a real random source", () => {
    for (let i = 0; i < 200; i += 1) {
      const start = pickLoadingStartTime(10);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(start).toBeLessThan(10);
    }
  });
});

describe("LOADING_VIDEO_SRC", () => {
  it("is a root-relative path, so it resolves the same from every route", () => {
    expect(LOADING_VIDEO_SRC.startsWith("/")).toBe(true);
    expect(LOADING_VIDEO_SRC.startsWith("//")).toBe(false);
  });
});

describe("seekLanded", () => {
  it("accepts the keyframe the seek actually snapped to", () => {
    expect(seekLanded(4, 4)).toBe(true);
    expect(seekLanded(4.2, 4)).toBe(true);
    expect(seekLanded(3.8, 4)).toBe(true);
  });

  it("rejects the clamp to 0 that an unseekable element reports", () => {
    // The failure this exists to catch: `currentTime = 4` on a source with no
    // seekable range leaves the element at 0 and throws nothing.
    expect(seekLanded(0, 4)).toBe(false);
  });

  it("rejects a landing outside the keyframe tolerance", () => {
    expect(seekLanded(4.6, 4)).toBe(false);
    expect(seekLanded(3.4, 4)).toBe(false);
  });

  it("rejects an unreadable position rather than calling it a match", () => {
    expect(seekLanded(Number.NaN, 4)).toBe(false);
    expect(seekLanded(4, Number.NaN)).toBe(false);
    expect(seekLanded(Number.POSITIVE_INFINITY, 4)).toBe(false);
  });
});
