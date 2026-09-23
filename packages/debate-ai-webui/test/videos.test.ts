import { describe, expect, it } from "vitest";

import {
  decodeVideoRow,
  decodeVideoRows,
  formatViewCount,
  styleLabel,
  videoWatchUrl,
} from "../src/videos";

/** A full row in the order `GET /videos` documents. */
const ROW = [
  "abc123",
  "Round 3 — Aff vs Neg",
  "2026-01-04T00:00:00Z",
  "Some Debate Channel",
  12345,
  "description",
  2,
  "Glenbrooks",
  "octas",
  "Aff Team",
  "Neg Team",
  true,
  "judge decision",
  "1AC",
  "2NR",
  true,
  "https://example.com/docs",
];

describe("decodeVideoRow", () => {
  it("reads each documented tuple position", () => {
    expect(decodeVideoRow(ROW)).toEqual({
      videoId: "abc123",
      title: "Round 3 — Aff vs Neg",
      date: "2026-01-04T00:00:00Z",
      channel: "Some Debate Channel",
      viewCount: 12345,
      style: 2,
      tournament: "Glenbrooks",
      isTopPick: true,
    });
  });

  it("yields empty fields for a short row rather than leaking undefined", () => {
    // An older deployment, or a lecture with no round metadata.
    expect(decodeVideoRow(["id", "Title"])).toEqual({
      videoId: "id",
      title: "Title",
      date: "",
      channel: "",
      viewCount: 0,
      style: null,
      tournament: "",
      isTopPick: false,
    });
  });

  it("coerces a non-numeric view count to zero", () => {
    expect(decodeVideoRow(["id", "t", "", "", "not a number"]).viewCount).toBe(0);
  });
});

describe("decodeVideoRows", () => {
  it("decodes a page and skips anything that isn't a row", () => {
    expect(decodeVideoRows([ROW, "nonsense", null]).map((v) => v.videoId)).toEqual(["abc123"]);
  });

  it("returns an empty page when the field is missing", () => {
    expect(decodeVideoRows(undefined)).toEqual([]);
  });
});

describe("videoWatchUrl", () => {
  it("encodes the stored YouTube id", () => {
    expect(videoWatchUrl({ ...decodeVideoRow(ROW), videoId: "a b&c" })).toBe(
      "https://www.youtube.com/watch?v=a%20b%26c",
    );
  });
});

describe("formatViewCount", () => {
  it("abbreviates thousands and millions", () => {
    expect(formatViewCount(999)).toBe("999");
    expect(formatViewCount(1_200)).toBe("1.2K");
    expect(formatViewCount(12_000)).toBe("12K");
    expect(formatViewCount(1_250_000)).toBe("1.3M");
    expect(formatViewCount(2_000_000)).toBe("2M");
  });

  it("renders a dash for a missing or nonsensical count", () => {
    expect(formatViewCount(0)).toBe("—");
    expect(formatViewCount(Number.NaN)).toBe("—");
    expect(formatViewCount(-5)).toBe("—");
  });
});

describe("styleLabel", () => {
  it("names the four debate formats", () => {
    expect(styleLabel(1)).toBe("Policy");
    expect(styleLabel(2)).toBe("Public Forum");
    expect(styleLabel(3)).toBe("Lincoln-Douglas");
    expect(styleLabel(4)).toBe("College");
  });

  it("calls a row with no style a lecture", () => {
    expect(styleLabel(null)).toBe("Lecture");
    expect(styleLabel("")).toBe("Lecture");
  });

  it("humanizes a lecture category slug", () => {
    expect(styleLabel("demo_debates")).toBe("demo debates");
  });
});
