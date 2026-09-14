import { describe, expect, it } from "vitest";
import {
  getInitials,
  mergeElo,
  normalizeTeamName,
  swapTrailingInitials,
} from "../src/rankings/merge-elo";
import type { LeaderboardEntry } from "../src/rankings/sync-rankings-debatedrills";

describe("normalizeTeamName", () => {
  it("lowercases, strips punctuation and collapses whitespace", () => {
    expect(normalizeTeamName("  Strake   Jesuit, M.S.  ")).toBe(
      "strake jesuit ms",
    );
  });

  it("keeps digits, which appear in campus names", () => {
    expect(normalizeTeamName("P.S. 130 AB")).toBe("ps 130 ab");
  });
});

describe("getInitials", () => {
  it("takes the first letter of each whitespace-separated word", () => {
    expect(getInitials("Jack Liu")).toBe("JL");
  });

  it("ignores the runs of extra whitespace between names", () => {
    expect(getInitials("  Jack   Liu  ")).toBe("JL");
  });

  it("returns an empty string for an empty name", () => {
    expect(getInitials("   ")).toBe("");
  });
});

describe("swapTrailingInitials", () => {
  it("swaps a two-letter suffix", () => {
    expect(swapTrailingInitials("strake jesuit ms")).toBe("strake jesuit sm");
  });

  it("returns null when there is no two-letter suffix", () => {
    expect(swapTrailingInitials("strake jesuit")).toBeNull();
    expect(swapTrailingInitials("ms")).toBeNull();
  });
});

const toc = (over: Partial<LeaderboardEntry> = {}): LeaderboardEntry => ({
  rank: 1,
  teamName: "Strake Jesuit MS",
  ...over,
});

describe("mergeElo", () => {
  it("attaches Elo and Elo rank on a direct name match", () => {
    const merged = mergeElo(
      [toc()],
      [{ rank: 4, teamName: "Strake Jesuit MS", debateElo: 1712, eloRank: 4 }],
      "VPF",
    );

    expect(merged[0].debateElo).toBe(1712);
    expect(merged[0].eloRank).toBe(4);
    // The bid-list fields survive the merge.
    expect(merged[0].rank).toBe(1);
  });

  it("matches PF teams whose initials are listed in the other order", () => {
    const merged = mergeElo(
      [toc({ teamName: "Strake Jesuit MS" })],
      [{ rank: 7, teamName: "Strake Jesuit SM", debateElo: 1650, eloRank: 7 }],
      "VPF",
    );

    expect(merged[0].debateElo).toBe(1650);
  });

  it("does not try the initial swap outside PF", () => {
    const merged = mergeElo(
      [toc({ teamName: "Strake Jesuit MS" })],
      [{ rank: 7, teamName: "Strake Jesuit SM", debateElo: 1650 }],
      "VCX",
    );

    expect(merged[0].debateElo).toBeUndefined();
  });

  it("appends student initials for LD, where DebateDrills names include them", () => {
    const merged = mergeElo(
      [toc({ teamName: "Harker", students: "Ada Lovelace" })],
      [{ rank: 2, teamName: "Harker AL", debateElo: 1801, eloRank: 2 }],
      "VLD",
    );

    expect(merged[0].debateElo).toBe(1801);
    expect(merged[0].eloRank).toBe(2);
  });

  it("falls back to the plain rank when DebateDrills has no separate eloRank", () => {
    const merged = mergeElo(
      [toc()],
      [{ rank: 9, teamName: "Strake Jesuit MS", debateElo: 1500 }],
      "VPF",
    );

    expect(merged[0].eloRank).toBe(9);
  });

  it("ignores DebateDrills rows that carry no Elo", () => {
    const merged = mergeElo(
      [toc()],
      [{ rank: 3, teamName: "Strake Jesuit MS" }],
      "VPF",
    );

    expect(merged[0].debateElo).toBeUndefined();
  });

  it("returns every bid-list row unchanged when there is no Elo data at all", () => {
    const entries = [toc(), toc({ rank: 2, teamName: "Harker AB" })];
    const merged = mergeElo(entries, [], "VPF");

    expect(merged).toHaveLength(2);
    expect(merged.map((e) => e.teamName)).toEqual([
      "Strake Jesuit MS",
      "Harker AB",
    ]);
    expect(merged.every((e) => e.debateElo === undefined)).toBe(true);
  });

  it("does not mutate the entries it was given", () => {
    const entries = [toc()];
    mergeElo(
      entries,
      [{ rank: 4, teamName: "Strake Jesuit MS", debateElo: 1712 }],
      "VPF",
    );

    expect(entries[0].debateElo).toBeUndefined();
  });
});
