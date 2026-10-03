import { describe, expect, it } from "vitest";
import {
  FIELD_OUTCOME,
  MAJOR_TOURNAMENTS,
  PRESET_TOURNAMENT_FIELD,
  formatDates,
  parsePresetId,
  planPresetMarkets,
  presetMajorMarketId,
  presetRatingMarketId,
  ratingPeriod,
  tournamentClose,
  type PresetTeam,
} from "../src/presets";

const team = (rank: number): PresetTeam => ({
  hash: `HASH${rank}`.padEnd(64, "0"),
  name: `Team ${rank}`,
  school: `School ${rank}`,
  rating: 2000 - rank,
  rank,
});

const OCT_2_2026 = Date.UTC(2026, 9, 2, 3) / 1000;

describe("MAJOR_TOURNAMENTS", () => {
  it("lists fifteen tournaments in date order with unique slugs", () => {
    expect(MAJOR_TOURNAMENTS).toHaveLength(15);
    expect(new Set(MAJOR_TOURNAMENTS.map((t) => t.slug)).size).toBe(15);
    const starts = MAJOR_TOURNAMENTS.map((t) => t.start);
    expect([...starts].sort()).toEqual(starts);
    for (const t of MAJOR_TOURNAMENTS) expect(t.end >= t.start).toBe(true);
  });
});

describe("ratingPeriod", () => {
  it("closes at the start of the next month, rolling over the year", () => {
    expect(ratingPeriod(OCT_2_2026)).toEqual({ key: "2026-10", closesAt: Date.UTC(2026, 10, 1) / 1000 });
    expect(ratingPeriod(Date.UTC(2026, 11, 31, 23) / 1000)).toEqual({ key: "2026-12", closesAt: Date.UTC(2027, 0, 1) / 1000 });
  });
});

describe("preset ids", () => {
  it("round-trip to their section", () => {
    expect(parsePresetId(presetRatingMarketId("hsld", "ABCDEF0123456789ffff", "2026-10"))).toEqual({
      group: "top-teams",
      dataset: "hsld",
      tournament: null,
    });
    expect(parsePresetId(presetMajorMarketId("toc", "hscx"))).toEqual({ group: "majors", dataset: "hscx", tournament: "toc" });
    expect(parsePresetId("2b1d2c4e-uuid")).toBeNull();
  });
});

describe("planPresetMarkets", () => {
  const rankings = [
    { dataset: "hspf", teams: [7, 3, 1, 2, 5, 4, 6, 8, 9, 10].map(team) },
    { dataset: "cpd", teams: [1, 2].map(team) },
  ];

  it("opens a rating market on each division's top five, by rank, closing at month end", () => {
    const ratings = planPresetMarkets(OCT_2_2026, rankings).filter((m) => m.kind === "rating");
    expect(ratings.map((m) => (m.source.type === "rating" ? `${m.source.dataset}:${m.source.name}` : ""))).toEqual([
      "hspf:Team 1",
      "hspf:Team 2",
      "hspf:Team 3",
      "hspf:Team 4",
      "hspf:Team 5",
      "cpd:Team 1",
      "cpd:Team 2",
    ]);
    expect(ratings[0]).toMatchObject({
      closesAt: Date.UTC(2026, 10, 1) / 1000,
      source: { baseline: 1999, hash: "hash1".padEnd(64, "0") },
    });
  });

  it("opens a winner market per upcoming major and division with rankings, top teams plus the field", () => {
    const majors = planPresetMarkets(OCT_2_2026, rankings).filter((m) => m.kind === "tournament");
    const ids = majors.map((m) => m.id);
    expect(ids).toContain(presetMajorMarketId("glenbrooks", "hspf"));
    expect(ids).toContain(presetMajorMarketId("ndt", "cpd"));
    // No LD or Policy rankings were given, and Heart of Texas has no PF.
    expect(ids.some((id) => id.includes("heart-of-texas"))).toBe(false);
    expect(ids.some((id) => id.endsWith(":hsld"))).toBe(false);

    const glenbrooks = majors.find((m) => m.id === presetMajorMarketId("glenbrooks", "hspf"))!;
    expect(glenbrooks.outcomes).toHaveLength(PRESET_TOURNAMENT_FIELD + 1);
    expect(glenbrooks.outcomes[0].label).toBe("Team 1 (School 1)");
    expect(glenbrooks.outcomes.at(-1)).toEqual(FIELD_OUTCOME);
    expect(new Set(glenbrooks.outcomes.map((o) => o.id)).size).toBe(glenbrooks.outcomes.length);
    expect(glenbrooks.source).toEqual({ type: "manual" });
    expect(glenbrooks.closesAt).toBe(tournamentClose(MAJOR_TOURNAMENTS.find((t) => t.slug === "glenbrooks")!));
  });

  it("drops tournaments that have started", () => {
    const afterHarvard = Date.UTC(2027, 1, 20) / 1000;
    const slugs = planPresetMarkets(afterHarvard, rankings)
      .filter((m) => m.kind === "tournament")
      .map((m) => parsePresetId(m.id)?.tournament);
    expect(new Set(slugs)).toEqual(new Set(["ndt", "ndca", "toc", "nsda"]));
  });

  it("plans nothing without rankings", () => {
    expect(planPresetMarkets(OCT_2_2026, [])).toEqual([]);
  });
});

describe("formatDates", () => {
  it("collapses a shared month and year", () => {
    expect(formatDates({ start: "2026-11-21", end: "2026-11-23" })).toBe("Nov 21–23, 2026");
    expect(formatDates({ start: "2027-01-30", end: "2027-02-01" })).toBe("Jan 30 – Feb 1, 2027");
  });
});
