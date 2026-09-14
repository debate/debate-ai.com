import { describe, expect, it } from "vitest";
import {
  STYLE_COLORS,
  TOURNAMENT_COLORS,
  formatVideoDate,
  getRoundBadgeColor,
  getYearTopic,
} from "../src/components/video-card/videoCardUtils";
import type { TopicType } from "../src/types/videos";

const topics = [
  {
    year: 2024,
    policy_topic: "Fiscal redistribution",
    pf_topic: "AI regulation",
    ld_topic: "Wealth tax",
    ndt_topic: "Arctic policy",
  },
] satisfies TopicType[];

describe("getRoundBadgeColor", () => {
  it("gives finals the strongest amber treatment", () => {
    expect(getRoundBadgeColor("Finals")).toContain("bg-amber-400");
    expect(getRoundBadgeColor("champ")).toContain("bg-amber-400");
  });

  it("is case and whitespace insensitive", () => {
    expect(getRoundBadgeColor("  FINALS ")).toBe(getRoundBadgeColor("finals"));
  });

  it("fades progressively through the elimination bracket", () => {
    expect(getRoundBadgeColor("Semifinals")).toContain("bg-yellow-400");
    expect(getRoundBadgeColor("Quarterfinals")).toContain("bg-yellow-300");
    expect(getRoundBadgeColor("Octafinals")).toContain("bg-yellow-200");
    expect(getRoundBadgeColor("Doubles")).toContain("bg-yellow-50");
  });

  it("falls back to the muted style for prelims", () => {
    expect(getRoundBadgeColor("R4")).toContain("bg-amber-50/50");
  });
});

describe("getYearTopic", () => {
  it("picks the topic field matching the debate style", () => {
    expect(getYearTopic(2024, 1, topics)).toBe("Fiscal redistribution");
    expect(getYearTopic(2024, 2, topics)).toBe("AI regulation");
    expect(getYearTopic(2024, 3, topics)).toBe("Wealth tax");
    expect(getYearTopic(2024, 4, topics)).toBe("Arctic policy");
  });

  it("returns undefined for unknown years, styles or missing data", () => {
    expect(getYearTopic(1999, 1, topics)).toBeUndefined();
    expect(getYearTopic(2024, 99, topics)).toBeUndefined();
    expect(getYearTopic(2024, 1, undefined)).toBeUndefined();
    expect(getYearTopic(0, 1, topics)).toBeUndefined();
  });
});

describe("badge color maps", () => {
  it("covers all four debate styles", () => {
    for (const style of [1, 2, 3, 4]) {
      expect(STYLE_COLORS[style], `style ${style}`).toBeTruthy();
      expect(TOURNAMENT_COLORS[style], `style ${style}`).toBeTruthy();
    }
  });
});

describe("formatVideoDate", () => {
  it("formats a full date and a bare month", () => {
    // Parsed as UTC midnight, so assert on the parts rather than a locale
    // string that shifts with the runner's timezone.
    expect(formatVideoDate("2026-03-14T12:00:00Z")).toContain("2026");
    expect(formatVideoDate("2026-03-14T12:00:00Z")).toContain("Mar");
    expect(formatVideoDate("2026-03-14T12:00:00Z")).toContain("14");
    expect(formatVideoDate("2026-03-14T12:00:00Z", "month")).toBe("Mar");
  });

  it("returns the fallback for a date that does not parse", () => {
    // The grid renders one of these per row; an unparseable date has to read
    // as missing rather than as the literal "Invalid Date".
    expect(formatVideoDate("not a date")).toBe("");
    expect(formatVideoDate("", "full", "—")).toBe("—");
  });
});
