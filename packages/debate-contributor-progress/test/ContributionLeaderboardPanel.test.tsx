// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `ContributionLeaderboardPanel` — previously
 * uncovered by any component test. Focused on the panel's header
 * `description` (the tools-page-wide "mini guide" convention `PanelShell`
 * renders under every panel's title), which this panel previously never set
 * on either its empty or loaded `PanelShell` call — the explanation of what
 * the panel does lived only in an inline paragraph under the loaded roster,
 * so a first-time or empty-roster visitor saw a bare title.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";

import { ContributionLeaderboardPanel } from "../src/panels/ContributionLeaderboardPanel";
import { saveContribution } from "@debate/research-evidence/src/state/contributions";
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

describe("ContributionLeaderboardPanel description", () => {
  it("shows the mini-guide description on the empty roster", async () => {
    view = await mount(createElement(ContributionLeaderboardPanel));

    expect(view.container.textContent).toContain("No contributions yet.");
    expect(view.container.textContent).toContain(
      "Rank contributors by helpfulness score, tier, badges, and quest streak.",
    );
  });

  it("keeps the mini-guide description once the roster has rows", async () => {
    saveContribution(contribution("card-1", "alice"));
    view = await mount(createElement(ContributionLeaderboardPanel));

    expect(view.container.textContent).toContain("alice");
    expect(view.container.textContent).toContain(
      "Rank contributors by helpfulness score, tier, badges, and quest streak.",
    );
  });
});
