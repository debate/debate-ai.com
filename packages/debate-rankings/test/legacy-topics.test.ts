/**
 * @fileoverview Pins the pre-2000 seasons the Topics & Statistics page appends
 * to `debate-topics.json`'s rows (the Topic Starters dropdown stops at 2015).
 */

import { describe, it, expect } from "vitest";
import {
  LEGACY_TOPIC_YEARS,
  buildLegacyTopicYears,
  withLegacyTopicYears,
} from "../src/topics/legacy-topics";

describe("legacy topic years", () => {
  it("covers policy from 1927-28 and LD from 1979-80, newest first", () => {
    expect(LEGACY_TOPIC_YEARS[0]?.year).toBe(1999);
    expect(LEGACY_TOPIC_YEARS.at(-1)).toMatchObject({ year: 1928, policy_topic_name: "Department of Education" });
    expect(LEGACY_TOPIC_YEARS.find((row) => row.year === 1999)?.ld_topics?.[0]?.topic_name).toBe("Sanctity of Life");
  });

  it("merges policy and LD rows of the same season", () => {
    const rows = buildLegacyTopicYears(
      [{ year: 1990, policy_topic: "P" }],
      [{ year: 1990, ld_topics: [{ topic: "L" }] }, { year: 1985, ld_topics: [{ topic: "M" }] }],
    );
    expect(rows).toEqual([
      { year: 1990, policy_topic: "P", policy_topic_name: undefined, policy_topic_emoji: undefined, ld_topics: [{ topic: "L" }] },
      { year: 1985, ld_topics: [{ topic: "M" }] },
    ]);
  });

  it("appends only seasons the list doesn't already have", () => {
    const merged = withLegacyTopicYears([{ year: 2020, policy_topic: "X" }, { year: 1999, policy_topic: "Mine" }]);
    expect(merged[0]?.year).toBe(2020);
    expect(merged.filter((row) => String(row.year) === "1999")).toHaveLength(1);
    expect(merged.at(-1)?.year).toBe(1928);
  });
});
