// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `ContributorProfilePanel` — previously
 * uncovered by any component test, matching the "real logic, zero component
 * coverage" gap `ProgressUnlocksPanel.test.tsx` closed for its own panel.
 * Focused here on the panel's header `description` (the tools-page-wide
 * "mini guide" convention `PanelShell` renders under every panel's title —
 * see `packages/debate-help-docs/content/docs/features/user-settings.mdx`'s
 * sibling panels), which the empty ("no activity yet") branch previously
 * rendered without while the loaded branch already had one.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";

import { ContributorProfilePanel } from "../src/panels/ContributorProfilePanel";
import { saveContribution } from "@debate/research-evidence/src/state/contributions";
import { giveJudgeAward } from "../src/state/judgeAwards";
import type { AttributedContribution } from "@debate/research-evidence/src/lib/contribution-leaderboard";
import { mount } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

function contribution(id: string, contributorId: string): AttributedContribution {
  return {
    id,
    contributorId,
    kind: "card",
    likes: 0,
    saves: 0,
    qualitySignals: [1],
    reviewerEndorsements: [{ reviewerWeight: 1 }],
  };
}

let view: Mounted;

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
});

describe("ContributorProfilePanel empty state", () => {
  it("shows the panel's mini-guide description alongside the no-activity empty state", async () => {
    view = await mount(createElement(ContributorProfilePanel, { contributorId: "nobody" }));

    expect(view.container.textContent).toContain("No activity yet for this contributor.");
    expect(view.container.textContent).toContain("Not yet ranked on the leaderboard");
  });
});

describe("ContributorProfilePanel loaded state", () => {
  it("still shows a rank-based description once the contributor has activity", async () => {
    saveContribution(contribution("card-1", "alice"));
    view = await mount(createElement(ContributorProfilePanel, { contributorId: "alice" }));

    expect(view.container.textContent).toContain("alice");
    expect(view.container.textContent).toMatch(/Ranked #\d+ on the leaderboard/);
  });
});

describe("ContributorProfilePanel judge awards", () => {
  it("shows each judge award with the judge's name underneath, even with no other activity", async () => {
    giveJudgeAward({ kind: "best_speaker", debaterId: "nobody", judgeName: "Jane Doe", tournament: "Glenbrooks" });
    view = await mount(createElement(ContributorProfilePanel, { contributorId: "nobody" }));

    const badge = view.container.querySelector('img[alt="Best Speaker"]');
    expect(badge?.getAttribute("src")).toBe("https://i.imgur.com/olUMP6H.png");
    expect(badge?.className).toContain("h-32 w-32");
    expect(view.container.textContent).toContain("Awarded by Jane Doe");
    expect(view.container.textContent).toContain("Glenbrooks");
  });

  it("refreshes when a judge gives a new award in the same tab", async () => {
    view = await mount(createElement(ContributorProfilePanel, { contributorId: "nobody" }));
    expect(view.container.textContent).toContain("No judge awards yet.");

    await act(async () => {
      giveJudgeAward({ kind: "most_improved", debaterId: "nobody", judgeName: "Sam Lee", tournament: "TOC" });
    });
    expect(view.container.textContent).toContain("Awarded by Sam Lee");
  });
});
