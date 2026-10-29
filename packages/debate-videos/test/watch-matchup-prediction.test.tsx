/**
 * @fileoverview The watch page's simulated matchup: the prediction uses the
 * round's real sides and stage (prelim = one judge, elims = 3, finals = 5),
 * its simulation is stable across renders, and it compares against the
 * recorded decision. Also pins that the Team rankings section shows it only
 * when both teams are ranked.
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

const { predictWatchMatchup, PREDICTION_SIM_ROUNDS } = await import("../src/lib/watch-matchup-prediction");
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

describe("WatchMatchupPrediction", () => {
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

  it("shows the prediction only when both teams are ranked", async () => {
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
    expect(single).not.toContain("Simulated matchup");
  });
});
