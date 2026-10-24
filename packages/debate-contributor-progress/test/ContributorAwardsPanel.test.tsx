// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `ContributorAwardsPanel` — live category
 * winners, the announce-and-freeze flow, the Hall of Fame, peer nominations
 * (submit, second, delete) and the announced history. Runs against the real
 * localStorage-backed stores with `Date` pinned to a fixed UTC day.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

import { ContributorAwardsPanel } from "../src/panels/ContributorAwardsPanel";
import { saveContribution } from "@debate-ai/research-evidence/src/state/contributions";
import { DEFAULT_AWARD_CATEGORY_LABELS } from "@debate-ai/research-evidence/src/lib/contributor-awards";
import type { AttributedContribution } from "@debate-ai/research-evidence/src/lib/contribution-leaderboard";
import {
  announceContributorAwards,
  getAnnouncedContributorAwards,
} from "../src/state/contributorAwardAnnouncements";
import { listAllPeerNominations, submitPeerNomination } from "../src/state/contributorAwardNominations";
import { buttonByText, buttonsByText, click, flush, mount, query, type } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date("2026-04-02T15:00:00Z");
const YESTERDAY = new Date("2026-04-01T15:00:00Z");

function contribution(id: string, contributorId: string, kind: AttributedContribution["kind"]): AttributedContribution {
  return {
    id,
    contributorId,
    kind,
    likes: 2,
    saves: 1,
    qualitySignals: [1],
    reviewerEndorsements: [{ reviewerWeight: 1 }],
  };
}

let view: Mounted;
const text = () => view.container.textContent ?? "";
const input = (id: string) => query<HTMLInputElement>(view.container, `#${id}`);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
  vi.useRealTimers();
});

describe("ContributorAwardsPanel standings", () => {
  it("shows the empty state with announcing disabled when nothing is submitted", async () => {
    view = await mount(createElement(ContributorAwardsPanel));
    expect(text()).toContain("No awards yet.");
    expect(text()).toContain("Not yet announced today.");
    expect(buttonByText(view.container, "Announce today's awards").disabled).toBe(true);
    expect(text()).toContain("No nominations yet.");
    expect(text()).toContain("No prior days have been announced yet.");
    expect(text()).not.toContain("Hall of Fame");
  });

  it("renders live winners per category and freezes them on announce", async () => {
    saveContribution(contribution("c1", "alice", "card"));
    saveContribution(contribution("s1", "bob", "summary"));
    view = await mount(createElement(ContributorAwardsPanel));

    expect(text()).toContain(DEFAULT_AWARD_CATEGORY_LABELS.card);
    expect(text()).toContain(DEFAULT_AWARD_CATEGORY_LABELS.summary);
    expect(text()).toContain("alice");
    expect(text()).toContain("1 contribution ·");

    await click(buttonByText(view.container, "Announce today's awards"));
    expect(getAnnouncedContributorAwards("2026-04-02")?.awards.map((a) => a.contributorId).sort()).toEqual([
      "alice",
      "bob",
    ]);
    expect(text()).toContain("Today's awards are announced and frozen.");
    // Today's own announcement isn't repeated in the "history" list...
    expect(text()).toContain("No prior days have been announced yet.");
    // ...but it does count toward the Hall of Fame.
    expect(text()).toContain("🏅 Hall of Fame");
    expect(text()).toContain("#1");
    expect(text()).toContain("1 win");
  });

  it("lists previously announced days and sums wins in the Hall of Fame", async () => {
    saveContribution(contribution("c1", "alice", "card"));
    saveContribution(contribution("c2", "alice", "card"));
    announceContributorAwards(YESTERDAY.getTime());
    announceContributorAwards(new Date("2026-03-31T10:00:00Z").getTime());

    view = await mount(createElement(ContributorAwardsPanel));
    expect(text()).toContain("2026-04-01");
    expect(text()).toContain("2026-03-31");
    expect(text()).toContain("2 contributions ·");
    expect(text()).toContain("2 wins");
    expect(text()).toContain(`${DEFAULT_AWARD_CATEGORY_LABELS.card} ×2`);
  });

  it("refreshes when another tab writes a watched key", async () => {
    view = await mount(createElement(ContributorAwardsPanel));
    saveContribution(contribution("c1", "carol", "card"));
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "some-other-key" }));
    });
    expect(text()).toContain("No awards yet.");
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(text()).toContain("carol");
  });
});

describe("ContributorAwardsPanel peer nominations", () => {
  it("disables nominating yourself and explains why", async () => {
    view = await mount(createElement(ContributorAwardsPanel));
    const nominate = buttonByText(view.container, "Nominate");
    expect(nominate.disabled).toBe(true);

    await type(input("nomination-nominee"), "Dana");
    await type(input("nomination-nominator"), "dana");
    expect(nominate.disabled).toBe(true);
    expect(text()).toContain("A nominee can't be the same as the nominator");
  });

  it("submits a nomination, keeps the nominator for the next one, and shows the tally on the winner card", async () => {
    saveContribution(contribution("c1", "alice", "card"));
    view = await mount(createElement(ContributorAwardsPanel));

    await type(input("nomination-nominee"), "alice");
    await type(input("nomination-nominator"), "erin");
    await type(query<HTMLTextAreaElement>(view.container, "#nomination-note"), "  Great cards  ");
    await click(buttonByText(view.container, "Nominate"));

    const [nomination] = listAllPeerNominations();
    expect(nomination).toMatchObject({ kind: "card", nomineeId: "alice", nominatorId: "erin", note: "Great cards" });
    expect(input("nomination-nominee").value).toBe("");
    expect(input("nomination-nominator").value).toBe("erin");
    expect(text()).toContain(`${DEFAULT_AWARD_CATEGORY_LABELS.card}: alice`);
    expect(text()).toContain("Nominated by erin");
    expect(text()).toContain('"Great cards"');
    expect(text()).toContain("🗳️ Nominated:");
    expect(text()).toContain("alice ×1");
  });

  it("seconds a nomination once per seconder and deletes it", async () => {
    saveContribution(contribution("c1", "alice", "card"));
    submitPeerNomination({ kind: "card", nomineeId: "alice", nominatorId: "erin" });
    view = await mount(createElement(ContributorAwardsPanel));

    const second = () => buttonsByText(view.container, "👍 Second").concat(buttonsByText(view.container, "👍 Second (1)"))[0];
    expect(second().disabled).toBe(true);

    await type(input("nomination-seconder"), "erin");
    expect(second().disabled).toBe(true);

    await type(input("nomination-seconder"), "frank");
    expect(second().disabled).toBe(false);
    await click(second());
    expect(listAllPeerNominations()[0].seconderIds).toEqual(["frank"]);
    expect(text()).toContain("👍 Second (1)");
    expect(text()).toContain("(1 second)");
    expect(text()).toContain("alice ×2");
    // Already seconded by frank.
    expect(second().disabled).toBe(true);

    await click(buttonByText(view.container, "Delete"));
    expect(listAllPeerNominations()).toEqual([]);
    expect(text()).toContain("No nominations yet.");
  });

  it("reports an error when the nomination was removed elsewhere before seconding", async () => {
    submitPeerNomination({ kind: "card", nomineeId: "alice", nominatorId: "erin" });
    view = await mount(createElement(ContributorAwardsPanel));
    await type(input("nomination-seconder"), "frank");

    // Another tab cleared the store but no storage event reached this tab yet.
    localStorage.setItem("contributorAwardNominations", "[]");
    await click(buttonByText(view.container, "👍 Second"));
    const error = view.container.querySelector("p.text-destructive");
    expect(error?.textContent).toContain("Enter your name to second this nomination");

    // Editing the seconder name clears the error.
    await type(input("nomination-seconder"), "frankie");
    expect(view.container.querySelector("p.text-destructive")).toBeNull();
  });
});
