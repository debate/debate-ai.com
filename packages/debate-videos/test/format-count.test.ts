/**
 * @fileoverview `formatCount` — the single place a video total becomes a
 * display string, now that the sidebar tree, the quick-link tiles and the
 * search chips all share it.
 *
 * The `exact` escape hatch exists for the College Debates total: every other
 * count is shortened to `1.4k` so it cannot crowd out its title, but that
 * collection's number is the round archive's headline figure and reads
 * wrong — and low — rounded to one decimal place.
 */

import { describe, it, expect } from "vitest";

import { formatCount } from "../src/components/category-gallery/format-count";

describe("formatCount", () => {
  it("shortens thousands so a count cannot crowd out its title", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1346)).toBe("1.3k");
    expect(formatCount(1400)).toBe("1.4k");
    expect(formatCount(12345)).toBe("12k");
  });

  it("prints the total in full when asked to", () => {
    expect(formatCount(1400, { exact: true })).toBe("1400");
    expect(formatCount(999, { exact: true })).toBe("999");
  });
});
