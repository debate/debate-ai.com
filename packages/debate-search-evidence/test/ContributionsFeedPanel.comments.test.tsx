// @vitest-environment jsdom
/**
 * @fileoverview Covers the per-entry "Comments" toggle added to
 * `ContributionsFeedPanel`, which mounts `debate-comments`' `CommentSection`
 * against `resourceType: "contribution"` — previously accepted by the API/DB
 * (`COMMENT_RESOURCE_TYPES`) but unreachable from any UI.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";

import { ContributionsFeedPanel } from "../src/panels/ContributionsFeedPanel";
import { saveContribution } from "../src/state/contributions";
import type { AttributedContribution } from "../src/lib/contribution-leaderboard";
import { click, mount } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

const ALICE_CARD: AttributedContribution = {
  id: "contrib-1",
  contributorId: "alice",
  kind: "card",
  likes: 12,
  saves: 4,
  qualitySignals: [0.8, 0.9],
  reviewerEndorsements: [{ reviewerWeight: 0.7 }],
};

let view: Mounted;

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
});

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === text,
  );
  if (!button) throw new Error(`No button with text "${text}"`);
  return button as HTMLButtonElement;
}

describe("ContributionsFeedPanel comments", () => {
  it("does not mount a discussion thread until the entry's Comments toggle is clicked", async () => {
    saveContribution(ALICE_CARD);
    view = await mount(createElement(ContributionsFeedPanel));

    expect(view.container.querySelector('section[aria-label="Comments"]')).toBeNull();
  });

  it("mounts the entry's discussion thread once Comments is clicked, and unmounts it on Hide", async () => {
    saveContribution(ALICE_CARD);
    view = await mount(createElement(ContributionsFeedPanel));

    await click(findButton(view.container, "Comments"));

    const section = view.container.querySelector('section[aria-label="Comments"]');
    expect(section).not.toBeNull();

    await click(findButton(view.container, "Hide comments"));

    expect(view.container.querySelector('section[aria-label="Comments"]')).toBeNull();
  });
});
