/**
 * @fileoverview The watch page's simulated matchup: the prediction uses the
 * round's real sides and stage (prelim = one judge, elims = 3, finals = 5),
 * its simulation is stable across renders, and it compares against the
 * recorded decision. A team no ranking names plays as a stand-in, and a
 * past college round uses debatedata's table. Also pins that the Team
 * rankings section shows it whenever either team is ranked.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { RankingDataset, RankingEntry } from "@debate-ai/rankings";
import type { VideoType } from "../src/types/videos";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

const { predictWatchMatchup, predictCollegeHistoryMatchup, standInEntry, isStandInEntry, PREDICTION_SIM_ROUNDS } =
  await import("../src/lib/watch-matchup-prediction");
const { WatchMatchupPrediction } = await import("../src/components/videos/watch/WatchMatchupPrediction");

function entry(rank: number, school: string, name: string, rating: number, aff = 50, neg = 50): RankingEntry {
  return {
    rank,
    school,
    name,
    adjustedRating: rating,
    deviation: 6,
    matches: 40,
    rating,
    hash: `${school}-${name}`,
    affWinRate: aff,
    negWinRate: neg,
    affElimWinRate: null,
    negElimWinRate: null,
  };
}

const strong = entry(1, "Harker", "Lee & Liu", 90);
const weak = entry(40, "Gunn", "Adams & Bell", 60);
const even = entry(20, "Lynbrook", "Cho & Dee", 90);
const dataset: RankingDataset = {
  id: "hspf",
  label: "PF",
  tournaments: [],
  majors: [],
  entries: [strong, weak, even],
  field: null,
};
const datasets = [dataset];

describe("predictWatchMatchup", () => {
  it("favors the higher-rated team and reads the stage from the round label", () => {
    const prelim = predictWatchMatchup(strong, weak, dataset, datasets, "Round 3", null, "v1");
    expect(prelim).toMatchObject({ stage: "prelim", stageKnown: true, panel: 1, favorite: "aff", actual: null, upset: null });
    expect(prelim.roundLabel).toBe("R3");
    expect(prelim.affWin + prelim.negWin).toBeCloseTo(1);

    const quarters = predictWatchMatchup(strong, weak, dataset, datasets, "Quarters", null, "v1");
    expect(quarters).toMatchObject({ stage: "elim", panel: 3, roundLabel: "Quarters" });
    // A panel majority magnifies the favorite's single-ballot edge.
    expect(quarters.affWin).toBeGreaterThan(prelim.affWin);

    const finals = predictWatchMatchup(strong, weak, dataset, datasets, "Finals", null, "v1");
    expect(finals.panel).toBe(5);
    expect(finals.affWin).toBeGreaterThan(quarters.affWin);
  });

  it("uses the real sides: swapping aff and neg flips the favorite", () => {
    const p = predictWatchMatchup(weak, strong, dataset, datasets, "R1", null, "v2");
    expect(p.favorite).toBe("neg");
    expect(p.negWin).toBeGreaterThan(0.5);
  });

  it("shifts toward the team debating its stronger side", () => {
    const affLean = entry(20, "Lynbrook", "Cho & Dee", 90, 80, 30);
    const ds = { ...dataset, entries: [affLean, even] };
    const onAff = predictWatchMatchup(affLean, even, ds, [ds], "R2", null);
    const onNeg = predictWatchMatchup(even, affLean, ds, [ds], "R2", null);
    expect(onAff.affWin).toBeGreaterThan(onNeg.negWin);
  });

  it("treats an unparsed round as a prelim", () => {
    const p = predictWatchMatchup(strong, weak, dataset, datasets, "", null);
    expect(p).toMatchObject({ stage: "prelim", stageKnown: false, roundLabel: null, panel: 1 });
  });

  it("runs a stable simulation and flags an upset against the decision", () => {
    const a = predictWatchMatchup(strong, weak, dataset, datasets, "Semis", false, "v3");
    const b = predictWatchMatchup(strong, weak, dataset, datasets, "Semis", false, "v3");
    expect(a.simulated).toEqual(b.simulated);
    expect(a.simulated.rounds).toBe(PREDICTION_SIM_ROUNDS);
    expect(a.simulated.aWins).toBeGreaterThan(a.simulated.bWins);
    expect(a).toMatchObject({ actual: "neg", upset: true });
    expect(predictWatchMatchup(strong, weak, dataset, datasets, "Semis", true)).toMatchObject({ actual: "aff", upset: false });
  });
});

describe("standInEntry", () => {
  it("plays its school's average (else the field's median), with no rounds or debaters of its own", () => {
    const row = standInEntry(dataset, "Nobody ZZ", "Gunn")!;
    expect(row).toMatchObject({ rating: 60, deviation: 6, matches: 0, name: "", school: "Gunn", affWinRate: null });
    expect(standInEntry(dataset, "Nobody ZZ")!.rating).toBe(90);
    expect(isStandInEntry(row)).toBe(true);
    expect(isStandInEntry(strong)).toBe(false);
    expect(standInEntry({ entries: [] }, "X")).toBeNull();
  });

  it("names the stand-in side and its school in the prediction", () => {
    const row = standInEntry(dataset, "Gunn ZZ", "Gunn")!;
    const p = predictWatchMatchup(strong, row, dataset, datasets, "R1", null, "v5");
    expect(p).toMatchObject({ basis: "rankings", standIn: "neg", standInSchool: "Gunn", season: null });
    // A weak school's average sits below the field's median.
    const plain = predictWatchMatchup(strong, standInEntry(dataset, "Q")!, dataset, datasets, "R1", null, "v5");
    expect(p.affWin).toBeGreaterThan(plain.affWin);
    expect(plain.standInSchool).toBeNull();
  });
});

describe("predictCollegeHistoryMatchup", () => {
  const row = (rank: number, name: string, mu: number, sigma = 1.3) => ({
    rank, school: "U", name, rating: mu - 4, mu, sigma,
  });
  const top = row(1, "A & B", 47);
  const mid = row(50, "C & D", 33);
  const last = row(100, "E & F", 23);
  const rows = [top, mid, last];

  it("favors the higher skill, more so on a panel, with no side term", () => {
    const prelim = predictCollegeHistoryMatchup(top, mid, rows, 2016, "R2", null, "c1")!;
    expect(prelim).toMatchObject({ basis: "debatedata", season: 2016, panel: 1, favorite: "aff", standIn: null });
    const semis = predictCollegeHistoryMatchup(top, mid, rows, 2016, "Semis", null, "c1")!;
    expect(semis.affWin).toBeGreaterThan(prelim.affWin);
    const swapped = predictCollegeHistoryMatchup(mid, top, rows, 2016, "R2", null, "c1")!;
    expect(swapped.negWin).toBeCloseTo(prelim.affWin, 6);
  });

  it("plays a missing team just below the table and skips rounds it can't predict", () => {
    const p = predictCollegeHistoryMatchup(null, mid, rows, 2016, "R1", true, "c2")!;
    expect(p).toMatchObject({ standIn: "aff", favorite: "neg", actual: "aff", upset: true });
    expect(predictCollegeHistoryMatchup(null, null, rows, 2016, "R1", null)).toBeNull();
    expect(predictCollegeHistoryMatchup(top, top, rows, 2016, "R1", null)).toBeNull();
    expect(predictCollegeHistoryMatchup(top, null, [], 2016, "R1", null)).toBeNull();
  });
});

describe("WatchMatchupPrediction", () => {
  it("says which side is a stand-in and which season's ratings it used", () => {
    const p = predictCollegeHistoryMatchup(
      { rank: 1, school: "U", name: "A & B", rating: 43, mu: 47, sigma: 1.3 },
      null,
      [{ rank: 100, school: "V", name: "E & F", rating: 19, mu: 23, sigma: 1.5 }],
      2016,
      "Finals",
      null,
    )!;
    const html = renderToStaticMarkup(
      createElement(WatchMatchupPrediction, { prediction: p, affLabel: "Kansas AB", negLabel: "Utah EF" }),
    );
    expect(html).toContain("Utah EF is not in debatedata&#x27;s top 100");
    expect(html).toContain("debatedata&#x27;s 2015-16 college ratings");
    expect(html).toContain("5-judge Final panel");
  });

  it("labels itself a simulation and names the predicted winner and the panel", () => {
    const prediction = predictWatchMatchup(strong, weak, dataset, datasets, "Quarters", false, "v4");
    const html = renderToStaticMarkup(
      createElement(WatchMatchupPrediction, { prediction, affLabel: "Harker LL", negLabel: "Gunn AB", decision: "2-1" }),
    );
    expect(html).toContain("Simulated matchup");
    expect(html).toContain("Simulation");
    expect(html).toContain("Predicted winner:");
    expect(html).toContain("Harker LL (aff)");
    expect(html).toContain("3-judge Quarters panel");
    expect(html).toContain("Simulated 1,000 rounds");
    expect(html).toContain("an upset");
  });
});

describe("WatchTeamStats", () => {
  const round: VideoType = [
    "vid-1", "Harker LL vs Gunn AB", "2026-09-20", "Channel", 10, "",
    2, "Yale", "Octos", "Harker LL", "Gunn AB", true, "3-0", null, null, false, null, 2027,
  ];

  it("shows the prediction when either team is ranked, with a stand-in for the other", async () => {
    vi.resetModules();
    vi.doMock("@debate-ai/rankings/src/leaderboard/hooks/useAllRankingDatasets", () => ({
      useAllRankingDatasets: () => ({ datasets }),
    }));
    vi.doMock("../src/hooks/useVideoTeamRankings", () => ({ isRankedSeasonRound: () => true }));
    vi.doMock("@debate-ai/rankings/src/leaderboard/profile/TeamRadarChart", () => ({ TeamRadarChart: () => null }));
    const { WatchTeamStats } = await import("../src/components/videos/watch/WatchTeamStats");

    const both = renderToStaticMarkup(createElement(WatchTeamStats, { video: round }));
    expect(both).toContain("Team rankings");
    expect(both).toContain("Simulated matchup");
    expect(both).toContain("3-judge Octas panel");
    expect(both).toContain("the favorite won");

    const one = [...round] as VideoType;
    one[10] = "Nobody ZZ";
    const single = renderToStaticMarkup(createElement(WatchTeamStats, { video: one }));
    expect(single).toContain("Team rankings");
    expect(single).toContain("Simulated matchup");
    expect(single).toContain("has no ranking of its own, so it plays as a typical team in the field");

    const none = [...round] as VideoType;
    none[9] = "Nobody YY";
    none[10] = "Nobody ZZ";
    expect(renderToStaticMarkup(createElement(WatchTeamStats, { video: none }))).toBe("");
  });

  it("puts a college team's mascot on top of its card", async () => {
    const kansas = entry(2, "University of Kansas", "Larson & Schultz", 95);
    const emory = entry(9, "Emory University", "Ghosh & Norris", 80);
    const cpd: RankingDataset = { ...dataset, id: "cpd", label: "College Policy", entries: [kansas, emory] };
    vi.resetModules();
    vi.doMock("@debate-ai/rankings/src/leaderboard/hooks/useAllRankingDatasets", () => ({
      useAllRankingDatasets: () => ({ datasets: [cpd] }),
    }));
    vi.doMock("../src/hooks/useVideoTeamRankings", () => ({ isRankedSeasonRound: () => true }));
    vi.doMock("@debate-ai/rankings/src/leaderboard/profile/TeamRadarChart", () => ({ TeamRadarChart: () => null }));
    const { WatchTeamStats } = await import("../src/components/videos/watch/WatchTeamStats");
    const college = [...round] as VideoType;
    college[6] = 4;
    college[9] = "Kansas LS";
    college[10] = "Emory GN";
    const html = renderToStaticMarkup(createElement(WatchTeamStats, { video: college }));
    expect(html).toContain('alt="University of Kansas mascot"');
    expect(html).toContain('alt="Emory University mascot"');
    expect(html.indexOf("Kansas mascot")).toBeLessThan(html.indexOf("Rank of 2"));
    // The team label badge is the card's only name: no school · names subtitle, format or side tag.
    expect(html).not.toContain("Emory University · Ghosh &amp; Norris");
    expect(html).not.toContain(">College Policy<");
    expect(html).not.toMatch(/>(aff|neg)</);
  });
});
