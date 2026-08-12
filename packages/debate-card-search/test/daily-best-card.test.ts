import { describe, expect, it } from "vitest";
import {
  buildDailyBestCardHighlight,
  buildDailyBestCards,
  getBestCardForDay,
  getUtcDayKey,
  groupCardsByDay,
  pickBestCardOfDay,
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
