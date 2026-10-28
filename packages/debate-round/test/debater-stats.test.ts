import { describe, expect, it } from "vitest";
import type { OpponentRoundRecord } from "@debate-ai/rankings-adapter/src/sync/opponent-team-profile";
import { buildDebaterStats, RECENT_FORM_WINDOW } from "../src/round/debater-stats";

function round(overrides: Partial<OpponentRoundRecord> = {}): OpponentRoundRecord {
  return {
    teamId: "us",
    tournamentName: "Open",
    date: "2026-01-01",
    division: "Varsity",
    side: "aff",
    won: true,
    ...overrides,
  };
}

describe("buildDebaterStats", () => {
  it("reports no win rate rather than NaN for an empty history", () => {
    const stats = buildDebaterStats([]);
    expect(stats.overall).toEqual({ rounds: 0, wins: 0, losses: 0, winRate: null });
    expect(stats.byDivision).toEqual([]);
    expect(stats.trend).toBe("insufficient-data");
  });

  it("tallies overall and per-side records", () => {
    const stats = buildDebaterStats([
      round({ side: "aff", won: true }),
      round({ side: "aff", won: false }),
      round({ side: "neg", won: true }),
    ]);
    expect(stats.overall).toMatchObject({ rounds: 3, wins: 2, losses: 1, winRate: 0.67 });
    expect(stats.aff).toMatchObject({ rounds: 2, winRate: 0.5 });
    expect(stats.neg).toMatchObject({ rounds: 1, winRate: 1 });
  });

  it("groups by division, most rounds first then alphabetical", () => {
    const stats = buildDebaterStats([
      round({ division: "Novice" }),
      round({ division: "Varsity" }),
      round({ division: "Varsity", won: false }),
      round({ division: "JV" }),
    ]);
    expect(stats.byDivision.map((d) => [d.label, d.rounds])).toEqual([
      ["Varsity", 2],
      ["JV", 1],
      ["Novice", 1],
    ]);
  });

  it("counts a round once per argument tag, ignoring blanks and duplicates", () => {
    const stats = buildDebaterStats([
      round({ argumentTags: ["topicality", "topicality", "  "], won: true }),
      round({ argumentTags: ["topicality", "critique"], won: false }),
      round({}),
    ]);
    expect(stats.byArgumentTag).toEqual([
      { label: "topicality", rounds: 2, wins: 1, losses: 1, winRate: 0.5 },
      { label: "critique", rounds: 1, wins: 0, losses: 1, winRate: 0 },
    ]);
  });

  it("builds recent form from the newest rounds regardless of input order", () => {
    const old = Array.from({ length: RECENT_FORM_WINDOW }, (_, i) =>
      round({ date: `2025-01-0${i + 1}`, won: false }),
    );
    const fresh = Array.from({ length: RECENT_FORM_WINDOW }, (_, i) =>
      round({ date: `2026-03-0${i + 1}`, won: true }),
    );
    const stats = buildDebaterStats([...fresh, ...old]);
    expect(stats.recent).toMatchObject({ rounds: RECENT_FORM_WINDOW, winRate: 1 });
    expect(stats.trend).toBe("improving");
  });

  it("flags a decline and a steady record", () => {
    const wins = Array.from({ length: 5 }, (_, i) => round({ date: `2025-01-0${i + 1}`, won: true }));
    const losses = Array.from({ length: 5 }, (_, i) => round({ date: `2026-03-0${i + 1}`, won: false }));
    expect(buildDebaterStats([...wins, ...losses]).trend).toBe("declining");

    const mixed = Array.from({ length: 10 }, (_, i) => round({ date: `2026-03-${10 + i}`, won: i % 2 === 0 }));
    expect(buildDebaterStats(mixed).trend).toBe("steady");
  });

  it("withholds a trend below ten rounds", () => {
    expect(buildDebaterStats(Array.from({ length: 9 }, () => round())).trend).toBe("insufficient-data");
  });

  it("treats an unparseable date as oldest instead of throwing", () => {
    const records = [
      round({ date: "not a date", won: false }),
      ...Array.from({ length: RECENT_FORM_WINDOW }, (_, i) => round({ date: `2026-03-0${i + 1}` })),
    ];
    expect(buildDebaterStats(records).recent.winRate).toBe(1);
  });

  describe("speech length", () => {
    it("reports nulls when no round logged a word count", () => {
      expect(buildDebaterStats([round(), round({ won: false })]).speechLength).toEqual({
        rounds: 0,
        averageWords: null,
        averageWordsInWins: null,
        averageWordsInLosses: null,
      });
    });

    it("averages word counts overall and across wins and losses", () => {
      const { speechLength } = buildDebaterStats([
        round({ speechWordCount: 4000, won: true }),
        round({ speechWordCount: 5000, won: true }),
        round({ speechWordCount: 3000, won: false }),
        round({ won: false }),
      ]);
      expect(speechLength).toEqual({
        rounds: 3,
        averageWords: 4000,
        averageWordsInWins: 4500,
        averageWordsInLosses: 3000,
      });
    });

    it("ignores zero, negative and non-finite counts", () => {
      const { speechLength } = buildDebaterStats([
        round({ speechWordCount: 0 }),
        round({ speechWordCount: -5 }),
        round({ speechWordCount: Number.NaN }),
        round({ speechWordCount: 1000 }),
      ]);
      expect(speechLength).toMatchObject({ rounds: 1, averageWords: 1000 });
    });

    it("leaves a side null when only the other side has counts", () => {
      const { speechLength } = buildDebaterStats([round({ speechWordCount: 2500, won: true })]);
      expect(speechLength.averageWordsInLosses).toBeNull();
    });
  });
});
