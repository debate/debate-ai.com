import { describe, expect, it } from "vitest";
import {
  buildDailyBestCardHighlight,
  buildDailyBestCards,
  buildWeeklyBestCardRollupHighlight,
  buildWeeklyBestCardRollups,
  getBestCardForDay,
  getUtcDayKey,
  getUtcWeekKey,
  groupCardsByDay,
  groupDailyBestCardsByWeek,
  pickBestCardOfDay,
  pickBestCardOfWeek,
  type DailyBestCard,
  type TimestampedCardContribution,
} from "../src/lib/daily-best-card";

const DAY_ONE = Date.parse("2026-08-10T12:00:00.000Z");
const DAY_ONE_LATER = Date.parse("2026-08-10T23:00:00.000Z");
const DAY_TWO = Date.parse("2026-08-11T09:00:00.000Z");

const strongCard: TimestampedCardContribution = {
  id: "strong-card",
  kind: "card",
  submittedAt: DAY_ONE,
  likes: 2,
  saves: 1,
  qualitySignals: [0.9, 0.95],
  reviewerEndorsements: [{ reviewerWeight: 1 }, { reviewerWeight: 0.9 }],
};

const viralCard: TimestampedCardContribution = {
  id: "viral-card",
  kind: "card",
  submittedAt: DAY_ONE_LATER,
  likes: 500,
  saves: 500,
  qualitySignals: [0.1],
  reviewerEndorsements: [],
};

const untouchedCard: TimestampedCardContribution = {
  id: "untouched-card",
  kind: "card",
  submittedAt: DAY_TWO,
  likes: 0,
  saves: 0,
  qualitySignals: [],
  reviewerEndorsements: [],
};

describe("getUtcDayKey", () => {
  it("formats a timestamp as its UTC calendar day", () => {
    expect(getUtcDayKey(DAY_ONE)).toBe("2026-08-10");
    expect(getUtcDayKey(DAY_ONE_LATER)).toBe("2026-08-10");
    expect(getUtcDayKey(DAY_TWO)).toBe("2026-08-11");
  });
});

describe("groupCardsByDay", () => {
  it("groups cards by UTC submission day, preserving order within a group", () => {
    const byDay = groupCardsByDay([strongCard, viralCard, untouchedCard]);
    expect(Array.from(byDay.keys())).toEqual(["2026-08-10", "2026-08-11"]);
    expect(byDay.get("2026-08-10")).toEqual([strongCard, viralCard]);
    expect(byDay.get("2026-08-11")).toEqual([untouchedCard]);
  });

  it("returns an empty map for no contributions", () => {
    expect(groupCardsByDay([]).size).toBe(0);
  });
});

describe("pickBestCardOfDay", () => {
  it("picks the highest-helpfulness card among a day's submissions", () => {
    const best = pickBestCardOfDay("2026-08-10", [strongCard, viralCard]);
    expect(best.contribution.id).toBe("strong-card");
    expect(best.dayKey).toBe("2026-08-10");
  });

  it("breaks ties by id for a stable, deterministic winner", () => {
    const tiedA: TimestampedCardContribution = { ...untouchedCard, id: "b" };
    const tiedB: TimestampedCardContribution = { ...untouchedCard, id: "a" };
    expect(pickBestCardOfDay("2026-08-11", [tiedA, tiedB]).contribution.id).toBe("a");
  });

  it("throws for an empty day", () => {
    expect(() => pickBestCardOfDay("2026-08-10", [])).toThrow(/no contributions/);
  });
});

describe("buildDailyBestCards", () => {
  it("picks one winner per represented day, sorted by day ascending", () => {
    const results = buildDailyBestCards([viralCard, untouchedCard, strongCard]);
    expect(results.map((r) => r.dayKey)).toEqual(["2026-08-10", "2026-08-11"]);
    expect(results[0].contribution.id).toBe("strong-card");
    expect(results[1].contribution.id).toBe("untouched-card");
  });

  it("returns an empty list for no contributions", () => {
    expect(buildDailyBestCards([])).toEqual([]);
  });
});

describe("getBestCardForDay", () => {
  it("returns the winner for the UTC day of `now`", () => {
    const result = getBestCardForDay([strongCard, viralCard, untouchedCard], DAY_ONE_LATER);
    expect(result?.dayKey).toBe("2026-08-10");
    expect(result?.contribution.id).toBe("strong-card");
  });

  it("returns null when no cards were submitted that day", () => {
    const noon = Date.parse("2026-08-12T12:00:00.000Z");
    expect(getBestCardForDay([strongCard, viralCard], noon)).toBeNull();
  });
});

describe("buildDailyBestCardHighlight", () => {
  it("renders a short highlight line for the day's winner", () => {
    const best = pickBestCardOfDay("2026-08-10", [strongCard, viralCard]);
    expect(buildDailyBestCardHighlight(best)).toBe(
      `Card of the day (2026-08-10): "strong-card" — helpfulness ${best.breakdown.helpfulnessScore}/100`,
    );
  });
});

describe("getUtcWeekKey", () => {
  it("formats a day within a week as that week's ISO key", () => {
    expect(getUtcWeekKey("2026-08-10")).toBe("2026-W33");
    expect(getUtcWeekKey("2026-08-11")).toBe("2026-W33");
    expect(getUtcWeekKey("2026-08-16")).toBe("2026-W33");
    expect(getUtcWeekKey("2026-08-17")).toBe("2026-W34");
  });

  it("assigns a year-end Monday to the following ISO year's week 1", () => {
    // 2025-12-29 is a Monday, but belongs to the week containing 2026-01-01.
    expect(getUtcWeekKey("2025-12-29")).toBe("2026-W01");
    expect(getUtcWeekKey("2026-01-01")).toBe("2026-W01");
    expect(getUtcWeekKey("2026-01-04")).toBe("2026-W01");
    expect(getUtcWeekKey("2026-01-05")).toBe("2026-W02");
  });

  it("assigns a new-year's-day Friday back to the prior ISO year's week 53", () => {
    // 2026 has 53 ISO weeks (Jan 1, 2026 is a Thursday in a non-leap year).
    expect(getUtcWeekKey("2026-12-31")).toBe("2026-W53");
    expect(getUtcWeekKey("2027-01-01")).toBe("2026-W53");
  });
});

const dailyOne: DailyBestCard = pickBestCardOfDay("2026-08-10", [strongCard, viralCard]);
const dailyTwo: DailyBestCard = pickBestCardOfDay("2026-08-11", [untouchedCard]);
const dailyThreeStrongerLaterWeek: DailyBestCard = pickBestCardOfDay("2026-08-17", [
  { ...viralCard, submittedAt: Date.parse("2026-08-17T12:00:00.000Z") },
]);

describe("groupDailyBestCardsByWeek", () => {
  it("groups daily winners by ISO week, preserving order within a group", () => {
    const byWeek = groupDailyBestCardsByWeek([dailyOne, dailyTwo, dailyThreeStrongerLaterWeek]);
    expect(Array.from(byWeek.keys())).toEqual(["2026-W33", "2026-W34"]);
    expect(byWeek.get("2026-W33")).toEqual([dailyOne, dailyTwo]);
    expect(byWeek.get("2026-W34")).toEqual([dailyThreeStrongerLaterWeek]);
  });

  it("returns an empty map for no daily winners", () => {
    expect(groupDailyBestCardsByWeek([]).size).toBe(0);
  });
});

describe("pickBestCardOfWeek", () => {
  it("picks the highest-helpfulness daily winner among a week's days", () => {
    const champion = pickBestCardOfWeek("2026-W33", [dailyTwo, dailyOne]);
    expect(champion.dayKey).toBe("2026-08-10");
  });

  it("breaks ties by dayKey ascending for a stable, deterministic champion", () => {
    const tiedLater: DailyBestCard = { ...dailyTwo, dayKey: "2026-08-12" };
    const champion = pickBestCardOfWeek("2026-W33", [tiedLater, dailyTwo]);
    expect(champion.dayKey).toBe("2026-08-11");
  });

  it("throws for a week with no daily winners", () => {
    expect(() => pickBestCardOfWeek("2026-W33", [])).toThrow(/no daily winners/);
  });
});

describe("buildWeeklyBestCardRollups", () => {
  it("rolls up one entry per represented week, sorted by week ascending", () => {
    const rollups = buildWeeklyBestCardRollups([dailyThreeStrongerLaterWeek, dailyOne, dailyTwo]);

    expect(rollups.map((r) => r.weekKey)).toEqual(["2026-W33", "2026-W34"]);
    expect(rollups[0].days.map((d) => d.dayKey)).toEqual(["2026-08-10", "2026-08-11"]);
    expect(rollups[0].champion.dayKey).toBe("2026-08-10");
    expect(rollups[1].champion.dayKey).toBe("2026-08-17");
  });

  it("returns an empty list for no daily winners", () => {
    expect(buildWeeklyBestCardRollups([])).toEqual([]);
  });
});

describe("buildWeeklyBestCardRollupHighlight", () => {
  it("renders a short highlight line naming the week's champion and day count", () => {
    const [rollup] = buildWeeklyBestCardRollups([dailyOne, dailyTwo]);
    expect(buildWeeklyBestCardRollupHighlight(rollup)).toBe(
      `Best of the week (2026-W33): "strong-card" — helpfulness ${rollup.champion.breakdown.helpfulnessScore}/100 (2 days)`,
    );
  });

  it("uses singular phrasing for a single-day week", () => {
    const [rollup] = buildWeeklyBestCardRollups([dailyOne]);
    expect(buildWeeklyBestCardRollupHighlight(rollup)).toContain("(1 day)");
  });
});
