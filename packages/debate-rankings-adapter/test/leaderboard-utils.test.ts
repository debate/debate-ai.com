/**
 * @fileoverview Unit tests for the rankings leaderboard helpers in
 * `src/leaderboard/leaderboardUtils.ts`: season maths, topic resolution,
 * sorting/filtering of team rows, surname shortening and the Schools
 * roll-up.
 */

import { describe, expect, it } from "vitest";
import type { RankingDataset, RankingEntry } from "@debate-ai/rankings-adapter";
import {
  DIVISION_CONFIG,
  LEADERBOARD_TABS,
  SCHOOL_DATASETS,
  aggregateSchools,
  currentSeasonYear,
  displayEntryName,
  divisionDatasets,
  filterEntries,
  filterSchools,
  getNumericValue,
  hasLiveLeaderboard,
  hasValue,
  lastName,
  resolveDivisionTopic,
  schoolRankingsFor,
  seasonLabel,
  seasonYears,
  sortEntries,
  sortSchools,
  type Division,
  type SchoolRanking,
} from "../src/leaderboard/leaderboardUtils";

function entry(overrides: Partial<RankingEntry>): RankingEntry {
  return {
    rank: 1,
    school: "Lincoln High",
    name: "Smith & Jones",
    adjustedRating: 1500,
    deviation: 50,
    matches: 10,
    rating: 1600,
    hash: "h",
    affWinRate: 50,
    negWinRate: 50,
    affElimWinRate: null,
    negElimWinRate: null,
    ...overrides,
  };
}

function dataset(entries: RankingEntry[]): RankingDataset {
  return { id: "hspf", label: "x", tournaments: [], majors: [], entries, field: null };
}

describe("division config", () => {
  it("lists four divisions plus a Schools tab", () => {
    expect(LEADERBOARD_TABS.map((t) => t.value)).toEqual(["VPF", "VLD", "VCX", "NDT", "SCHOOLS"]);
    expect(LEADERBOARD_TABS.at(-1)?.label).toBe("Schools");
  });

  it("rolls schools up from each division's first (full-season) dataset", () => {
    expect(SCHOOL_DATASETS).toEqual([
      { division: "VPF", datasetId: "hspf" },
      { division: "VLD", datasetId: "hsld" },
      { division: "VCX", datasetId: "hscx" },
      { division: "NDT", datasetId: "cpd" },
    ]);
  });

  it("returns datasets for a division and nothing for an unknown one", () => {
    expect(divisionDatasets("VLD")).toEqual(["hsld", "hsld_sepoct"]);
    expect(divisionDatasets("XX" as Division)).toEqual([]);
  });

  it("only PF and LD have live leaderboards", () => {
    expect(hasLiveLeaderboard("VPF")).toBe(true);
    expect(hasLiveLeaderboard("VLD")).toBe(true);
    expect(hasLiveLeaderboard("VCX")).toBe(false);
    expect(hasLiveLeaderboard("NDT")).toBe(false);
  });

  it("gives every division a logo", () => {
    for (const d of DIVISION_CONFIG) expect(d.logoSrc).toMatch(/^https:/);
  });
});

describe("season helpers", () => {
  it("rolls the season over on July 1", () => {
    expect(currentSeasonYear(new Date(2026, 5, 30))).toBe(2026);
    expect(currentSeasonYear(new Date(2026, 6, 1))).toBe(2027);
    expect(currentSeasonYear(new Date(2026, 8, 15))).toBe(2027);
  });

  it("lists years newest first back to 2002", () => {
    const years = seasonYears(new Date(2026, 8, 1));
    expect(years[0]).toBe("2027");
    expect(years.at(-1)).toBe("2002");
    expect(years).toHaveLength(26);
  });

  it("labels a season with its start and end years", () => {
    expect(seasonLabel("2027")).toBe("2026-27");
    expect(seasonLabel(2010)).toBe("2009-10");
    expect(seasonLabel(2001)).toBe("2000-01");
  });
});

describe("resolveDivisionTopic", () => {
  const topics = [{ topic: "Resolved: X", months: "Sep-Oct" }] as any;

  it("is undefined with no year data or unknown division", () => {
    expect(resolveDivisionTopic(undefined, "VPF")).toBeUndefined();
    expect(resolveDivisionTopic({}, "XX" as Division)).toBeUndefined();
  });

  it("prefers the current topic list", () => {
    expect(resolveDivisionTopic({ pf_topics: topics, pf_topic: "legacy" }, "VPF")).toBe(topics);
  });

  it("returns a string topic for policy", () => {
    expect(resolveDivisionTopic({ policy_topic: "Ocean" }, "VCX")).toBe("Ocean");
  });

  it("falls back to legacy PF/LD strings when the list is empty", () => {
    expect(resolveDivisionTopic({ pf_topics: [], pf_topic: "<b>PF</b>" }, "VPF")).toBe("<b>PF</b>");
    expect(resolveDivisionTopic({ ld_topic: "<b>LD</b>" }, "VLD")).toBe("<b>LD</b>");
  });

  it("is undefined when nothing is set", () => {
    expect(resolveDivisionTopic({ policy_topic: "" }, "VCX")).toBeUndefined();
    expect(resolveDivisionTopic({}, "NDT")).toBeUndefined();
  });
});

describe("value helpers", () => {
  it("treats null, undefined, -- and empty string as absent", () => {
    expect(hasValue(null)).toBe(false);
    expect(hasValue(undefined)).toBe(false);
    expect(hasValue("--")).toBe(false);
    expect(hasValue("")).toBe(false);
    expect(hasValue(0)).toBe(true);
    expect(hasValue("x")).toBe(true);
  });

  it("coerces numbers and numeric strings, else 0", () => {
    expect(getNumericValue(4)).toBe(4);
    expect(getNumericValue("2.5")).toBe(2.5);
    expect(getNumericValue("abc")).toBe(0);
    expect(getNumericValue(null)).toBe(0);
    expect(getNumericValue({})).toBe(0);
  });
});

describe("sortEntries", () => {
  const a = entry({ name: "Alpha", adjustedRating: 10, affWinRate: null });
  const b = entry({ name: "Bravo", adjustedRating: 30, affWinRate: 70 });
  const c = entry({ name: "Charlie", adjustedRating: 20, affWinRate: 40 });

  it("returns the input unchanged with no sort", () => {
    const list = [a, b, c];
    expect(sortEntries(list, null)).toBe(list);
  });

  it("sorts numbers both directions", () => {
    expect(sortEntries([a, b, c], { key: "adjustedRating", dir: "asc" }).map((e) => e.name)).toEqual([
      "Alpha",
      "Charlie",
      "Bravo",
    ]);
    expect(sortEntries([a, b, c], { key: "adjustedRating", dir: "desc" }).map((e) => e.name)).toEqual([
      "Bravo",
      "Charlie",
      "Alpha",
    ]);
  });

  it("sorts strings alphabetically", () => {
    expect(sortEntries([c, a, b], { key: "name", dir: "asc" }).map((e) => e.name)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
  });

  it("keeps null win rates last regardless of direction", () => {
    const d = entry({ name: "Delta", affWinRate: null });
    expect(sortEntries([a, b, d, c], { key: "affWinRate", dir: "asc" }).map((e) => e.name)).toEqual([
      "Charlie",
      "Bravo",
      "Alpha",
      "Delta",
    ]);
    expect(sortEntries([a, c, b], { key: "affWinRate", dir: "desc" }).map((e) => e.name)).toEqual([
      "Bravo",
      "Charlie",
      "Alpha",
    ]);
  });

  it("sorts by TOC bids through the bid lookup, missing bids counting 0", () => {
    const bids = new Map([["Alpha", 1], ["Charlie", 3]]);
    const count = (e: { name: string }) => bids.get(e.name) ?? 0;
    expect(sortEntries([a, b, c], { key: "bids", dir: "desc" }, count).map((e) => e.name)).toEqual([
      "Charlie",
      "Alpha",
      "Bravo",
    ]);
  });

  it("does not mutate the input", () => {
    const list = [b, a];
    sortEntries(list, { key: "adjustedRating", dir: "asc" });
    expect(list).toEqual([b, a]);
  });
});

describe("filterEntries", () => {
  const rows = [entry({ name: "Kim & Lee", school: "Harker" }), entry({ name: "Doe", school: "Lexington" })];

  it("returns everything for a blank query", () => {
    expect(filterEntries(rows, "   ")).toBe(rows);
  });

  it("matches name or school case-insensitively", () => {
    expect(filterEntries(rows, "HARK").map((e) => e.name)).toEqual(["Kim & Lee"]);
    expect(filterEntries(rows, "doe").map((e) => e.school)).toEqual(["Lexington"]);
    expect(filterEntries(rows, "zzz")).toEqual([]);
  });
});

describe("lastName / displayEntryName", () => {
  it("reduces names to surnames", () => {
    expect(lastName("Jane Smith")).toBe("Smith");
    expect(lastName("Madonna")).toBe("Madonna");
    expect(lastName("John Smith Jr.")).toBe("Smith Jr.");
    expect(lastName("A Bee III")).toBe("Bee III");
  });

  it("keeps a two-word name ending in a suffix as the suffix only", () => {
    expect(lastName("Smith Jr")).toBe("Jr");
  });

  it("shortens each half of a team name", () => {
    expect(lastName("Ann Kim & Bo Lee")).toBe("Kim & Lee");
  });

  it("only shortens LD names", () => {
    expect(displayEntryName("Jane Smith", "VLD")).toBe("Smith");
    expect(displayEntryName("Jane Smith", "VPF")).toBe("Jane Smith");
  });
});

describe("aggregateSchools", () => {
  it("merges spellings, ranks by best rating then average", () => {
    const rows = aggregateSchools([
      {
        event: "PF",
        entries: [
          entry({ school: "Harker", name: "A", adjustedRating: 1800 }),
          entry({ school: "Harker", name: "B", adjustedRating: 1600 }),
          entry({ school: "Lexington", name: "C", adjustedRating: 1700 }),
          entry({ school: "   ", name: "skip", adjustedRating: 9999 }),
        ],
      },
      {
        event: "LD",
        entries: [
          entry({ school: "Harker ", name: "D", adjustedRating: 1900 }),
          entry({ school: "Lexington", name: "E", adjustedRating: 1700 }),
        ],
      },
    ]);

    expect(rows.map((r) => r.school)).toEqual(["Harker", "Lexington"]);
    const [harker, lex] = rows;
    expect(harker).toMatchObject({
      rank: 1,
      bestRating: 1900,
      bestEntry: "D",
      bestEvent: "LD",
      teams: 3,
      events: ["PF", "LD"],
    });
    expect(harker.avgRating).toBeCloseTo((1800 + 1600 + 1900) / 3);
    expect(lex).toMatchObject({ rank: 2, bestRating: 1700, bestEntry: "C", bestEvent: "PF", teams: 2 });
  });

  it("ranks on the balanced score (depth counts), breaking exact ties by name", () => {
    const rows = aggregateSchools([
      {
        event: "PF",
        entries: [
          entry({ school: "Zeta", adjustedRating: 100 }),
          entry({ school: "Alpha", adjustedRating: 100 }),
          entry({ school: "Mid", adjustedRating: 100 }),
          entry({ school: "Mid", adjustedRating: 90 }),
        ],
      },
    ]);
    // Mid's second team lifts its balanced score above the one-team schools,
    // even though all three share a best rating of 100.
    expect(rows.map((r) => r.school)).toEqual(["Mid", "Alpha", "Zeta"]);
    const [mid, alpha, zeta] = rows;
    expect(mid.balancedScore).toBeGreaterThan(alpha.balancedScore);
    expect(alpha.balancedScore).toBe(zeta.balancedScore);
    expect(alpha.avgRating).toBe(zeta.avgRating);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("shows the spelling most entries use", () => {
    const rows = aggregateSchools([
      {
        event: "PF",
        entries: [
          entry({ school: "harker" }),
          entry({ school: "Harker" }),
          entry({ school: "Harker" }),
        ],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].school).toBe("Harker");
  });
});

describe("schoolRankingsFor", () => {
  const datasets = {
    VPF: dataset([entry({ school: "Harker", adjustedRating: 1800 })]),
    VCX: dataset([entry({ school: "Lexington", adjustedRating: 1900 })]),
  };

  it("rolls up every loaded division for 'all'", () => {
    const rows = schoolRankingsFor(datasets, "all");
    expect(rows.map((r) => [r.school, r.bestEvent])).toEqual([
      ["Lexington", "Policy"],
      ["Harker", "PF"],
    ]);
  });

  it("limits to one division and skips missing datasets", () => {
    expect(schoolRankingsFor(datasets, "VPF").map((r) => r.school)).toEqual(["Harker"]);
    expect(schoolRankingsFor(datasets, "NDT")).toEqual([]);
  });
});

describe("sortSchools / filterSchools", () => {
  const rows: SchoolRanking[] = [
    { rank: 1, school: "Bravo", bestRating: 10, bestEntry: "Kim", bestEvent: "PF", avgRating: 5, balancedScore: 40, teams: 2, events: [] },
    { rank: 2, school: "Alpha", bestRating: 30, bestEntry: "Lee", bestEvent: "LD", avgRating: 7, balancedScore: 60, teams: 1, events: [] },
  ];

  it("sorts by text and number columns", () => {
    expect(sortSchools(rows, { key: "school", dir: "asc" }).map((r) => r.school)).toEqual(["Alpha", "Bravo"]);
    expect(sortSchools(rows, { key: "school", dir: "desc" }).map((r) => r.school)).toEqual(["Bravo", "Alpha"]);
    expect(sortSchools(rows, { key: "teams", dir: "asc" }).map((r) => r.teams)).toEqual([1, 2]);
    expect(sortSchools(rows, { key: "bestRating", dir: "desc" }).map((r) => r.bestRating)).toEqual([30, 10]);
    expect(sortSchools(rows, { key: "balancedScore", dir: "asc" }).map((r) => r.school)).toEqual(["Bravo", "Alpha"]);
  });

  it("filters on school or best entry", () => {
    expect(filterSchools(rows, "")).toBe(rows);
    expect(filterSchools(rows, "alp").map((r) => r.school)).toEqual(["Alpha"]);
    expect(filterSchools(rows, "KIM").map((r) => r.school)).toEqual(["Bravo"]);
  });
});
