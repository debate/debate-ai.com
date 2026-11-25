// @vitest-environment jsdom
/**
 * @fileoverview The watch page's "Simulated matchup" card keeps the actual
 * decision (who won and whether it was an upset) hidden until "Reveal
 * decision" is clicked, while the simulation itself stays visible.
 */

import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { RankingDataset, RankingEntry } from "@debate-ai/rankings";
import { mount, type Mounted } from "./helpers/mount";
import { WatchMatchupPrediction } from "../src/components/videos/watch/WatchMatchupPrediction";
import { predictWatchMatchup } from "../src/lib/watch-matchup-prediction";
import { resetRevealedDecisions, revealDecision } from "../src/hooks/useDecisionReveal";

let view: Mounted | null = null;

afterEach(async () => {
  await view?.unmount();
  view = null;
  resetRevealedDecisions();
});

function entry(rank: number, school: string, name: string, rating: number): RankingEntry {
  return {
    rank,
    school,
    name,
    adjustedRating: rating,
    deviation: 6,
    matches: 40,
    rating,
    hash: `${school}-${name}`,
    affWinRate: 50,
    negWinRate: 50,
    affElimWinRate: null,
    negElimWinRate: null,
  };
}

const strong = entry(1, "Harker", "Lee & Liu", 90);
const weak = entry(40, "Gunn", "Adams & Bell", 60);
const dataset: RankingDataset = {
  id: "hspf",
  label: "PF",
  tournaments: [],
  majors: [],
  entries: [strong, weak],
  field: null,
};

async function mountCard(videoId: string, affWin: boolean): Promise<HTMLElement> {
  const prediction = predictWatchMatchup(strong, weak, dataset, [dataset], "Quarters", affWin, videoId);
  view = await mount(
    <WatchMatchupPrediction
      prediction={prediction}
      affLabel="Harker LL"
      negLabel="Gunn AB"
      decision="2-1"
      videoId={videoId}
    />,
  );
  return view.container;
}

describe("simulated matchup decision reveal", () => {
  it("hides the actual decision until Reveal decision is clicked", async () => {
    const root = await mountCard("vid-a", false);
    expect(root.textContent).toContain("Predicted winner:");
    expect(root.textContent).toContain("Simulated 1,000 rounds");
    expect(root.textContent).not.toContain("Actual decision:");
    expect(root.textContent).not.toContain("an upset");

    const button = [...root.querySelectorAll("button")].find((b) => b.textContent?.includes("Reveal decision"));
    expect(button).toBeTruthy();
    await act(async () => button!.click());

    expect(root.textContent).toContain("Actual decision:");
    expect(root.textContent).toContain("Gunn AB (neg) 2-1 — an upset.");
    expect(root.textContent).not.toContain("Reveal decision");
  });

  it("follows a reveal made elsewhere on the page for the same video only", async () => {
    const root = await mountCard("vid-b", true);
    await act(async () => revealDecision("vid-other"));
    expect(root.textContent).not.toContain("the favorite won");
    await act(async () => revealDecision("vid-b"));
    expect(root.textContent).toContain("the favorite won");
  });
});
