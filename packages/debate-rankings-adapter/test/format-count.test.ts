/**
 * @fileoverview `formatCount` — the single place a video total becomes a
 * display string, now that the sidebar tree, the quick-link tiles and the
 * search chips all share it.
 *
 * Now always shows in k format: 300 -> 0.3k, 1300 -> 1.3k, 12000 -> 12k.
 */

import { describe, it, expect } from "vitest";

import { formatCount } from "../src/format-count";

describe("formatCount", () => {
  it("shows all counts in k format with one decimal under 10k", () => {
    expect(formatCount(300)).toBe("0.3k");
    expect(formatCount(999)).toBe("1.0k");
    expect(formatCount(1346)).toBe("1.3k");
    expect(formatCount(1400)).toBe("1.4k");
    expect(formatCount(9999)).toBe("10.0k");
  });

  it("shows no decimals for 10k and above", () => {
    expect(formatCount(10000)).toBe("10k");
    expect(formatCount(12345)).toBe("12k");
    expect(formatCount(100000)).toBe("100k");
  });
});
