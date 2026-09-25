import { describe, expect, it } from "vitest";
import {
  DIVISION_CONFIG,
  VALID_DIVISIONS,
  divisionDatasets,
  filterEntries,
  resolveDivisionTopic,
  sortEntries,
} from "../src/panels/leaderboard/leaderboardUtils";
import { RANKING_DATASETS, type RankingEntry } from "debate-rankings";

const entry = (over: Partial<RankingEntry>): RankingEntry => ({
  rank: 1,
  school: "School",
  name: "Team",
  adjustedRating: 1500,
  deviation: 100,
  matches: 10,
  rating: 1700,
  hash: "",
  affWinRate: 50,
  negWinRate: 50,
  affElimWinRate: null,
  negElimWinRate: null,
  ...over,
});

describe("sortEntries", () => {
  const entries = [
    entry({ name: "B", rank: 2, school: "Michigan", affElimWinRate: 100 }),
    entry({ name: "A", rank: 1, school: "Emory", affElimWinRate: null }),
    entry({ name: "C", rank: 3, school: "Berkeley", affElimWinRate: 50 }),
  ];

  it("returns the input untouched when no sort is active", () => {
    expect(sortEntries(entries, null)).toBe(entries);
  });

  it("does not mutate the input array", () => {
    const copy = [...entries];
    sortEntries(entries, { key: "rank", dir: "desc" });
    expect(entries).toEqual(copy);
  });

  it("sorts numeric columns in both directions", () => {
    expect(sortEntries(entries, { key: "rank", dir: "asc" }).map((e) => e.name)).toEqual(["A", "B", "C"]);
    expect(sortEntries(entries, { key: "rank", dir: "desc" }).map((e) => e.name)).toEqual(["C", "B", "A"]);
  });

  it("keeps null win rates last in either direction", () => {
    expect(sortEntries(entries, { key: "affElimWinRate", dir: "desc" }).map((e) => e.name)).toEqual(["B", "C", "A"]);
    expect(sortEntries(entries, { key: "affElimWinRate", dir: "asc" }).map((e) => e.name)).toEqual(["C", "B", "A"]);
  });

  it("sorts text columns alphabetically", () => {
    expect(sortEntries(entries, { key: "school", dir: "asc" }).map((e) => e.school)).toEqual([
      "Berkeley",
      "Emory",
      "Michigan",
    ]);
  });
});

describe("filterEntries", () => {
  const entries = [entry({ name: "Gallagher & Young", school: "Emory" }), entry({ name: "Ma & Yang", school: "New Trier" })];

  it("matches name or school case-insensitively", () => {
    expect(filterEntries(entries, "emory").map((e) => e.name)).toEqual(["Gallagher & Young"]);
    expect(filterEntries(entries, "YANG").map((e) => e.school)).toEqual(["New Trier"]);
  });

  it("returns everything for a blank query", () => {
    expect(filterEntries(entries, "  ")).toBe(entries);
  });
});

describe("division config", () => {
  it("describes every valid division exactly once", () => {
    expect(DIVISION_CONFIG.map((d) => d.value).sort()).toEqual(
      [...VALID_DIVISIONS].sort(),
    );
  });

  it("gives every division a label and a logo", () => {
    for (const division of DIVISION_CONFIG) {
      expect(division.label.length, division.value).toBeGreaterThan(0);
      expect(division.logoSrc, division.value).toMatch(/^https?:\/\//);
    }
  });

  it("points LD and PF at the monthly topic lists", () => {
    expect(DIVISION_CONFIG.find((d) => d.value === "VPF")?.topicKey).toBe("pf_topics");
    expect(DIVISION_CONFIG.find((d) => d.value === "VLD")?.topicKey).toBe("ld_topics");
    expect(DIVISION_CONFIG.find((d) => d.value === "VCX")?.topicNameKey).toBe(
      "policy_topic_name",
    );
    expect(DIVISION_CONFIG.find((d) => d.value === "NDT")?.topicNameKey).toBe(
      "ndt_topic_name",
    );
  });
});

describe("resolveDivisionTopic", () => {
  it("returns monthly PF/LD lists", () => {
    const pf = [
      { start_month: "September", topic: "Sports betting" },
      { start_month: "November", topic: "Housing" },
    ];
    expect(resolveDivisionTopic({ pf_topics: pf }, "VPF")).toEqual(pf);
  });

  it("falls back to the legacy HTML string", () => {
    expect(resolveDivisionTopic({ ld_topic: "Wealth tax<br>AGI" }, "VLD")).toBe(
      "Wealth tax<br>AGI",
    );
  });

  it("returns the yearly Policy/NDT resolution", () => {
    expect(
      resolveDivisionTopic({ policy_topic: "Arctic development" }, "VCX"),
    ).toBe("Arctic development");
  });
});

describe("divisionDatasets", () => {
  it("maps every division to at least one generated dataset", () => {
    const known = new Set(RANKING_DATASETS.map((d) => d.id));
    for (const { value } of DIVISION_CONFIG) {
      const ids = divisionDatasets(value);
      expect(ids.length, value).toBeGreaterThan(0);
      for (const id of ids) expect(known.has(id), id).toBe(true);
    }
  });

  it("offers LD's Sep–Oct slice after the full season", () => {
    expect(divisionDatasets("VLD")).toEqual(["hsld", "hsld_sepoct"]);
    expect(divisionDatasets("NDT")).toEqual(["cpd"]);
  });

  it("is empty for an unrecognized division", () => {
    expect(divisionDatasets("BOGUS" as never)).toEqual([]);
  });
});
