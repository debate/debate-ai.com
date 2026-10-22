// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `GroupChallengesPanel`: validating and
 * creating contribution and win challenges, the squad board, recording a win
 * (prefilled from the signed-in contributor), and removing a challenge.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GroupChallengesPanel } from "../src/panels/GroupChallengesPanel";
import { listGroupChallenges } from "../src/state/groupChallenges";
import { button, choose, dateInput } from "./helpers/dom";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

let view: Mounted;
const text = () => view.container.textContent ?? "";
const field = (selector: string) => view.container.querySelector(selector) as HTMLInputElement;
const create = () => click(button(view.container, "Create challenge"));

async function fillBasics(title: string, members: string, target: string) {
  await type(field("#group-challenge-title"), title);
  await type(field("#group-challenge-members"), members);
  await type(field("#group-challenge-target-count"), target);
}

async function fillDates(startDays: number, endDays: number) {
  await type(field("#group-challenge-starts"), dateInput(startDays));
  await type(field("#group-challenge-ends"), dateInput(endDays));
}

async function remount(props: Parameters<typeof GroupChallengesPanel>[0] = {}) {
  await view.unmount();
  view = await mount(<GroupChallengesPanel {...props} />);
}

beforeEach(async () => {
  localStorage.clear();
  view = await mount(createElement(GroupChallengesPanel));
});

afterEach(async () => {
  await view.unmount();
});

describe("GroupChallengesPanel", () => {
  it("validates the title, roster, target and dates in turn", async () => {
    expect(text()).toContain("No group challenges yet.");
    await create();
    expect(text()).toContain("A challenge title and at least one squad member are required.");

    await fillBasics("Solvency hunt", "alice", "0");
    await create();
    expect(text()).toContain("Target count must be a positive number.");

    await type(field("#group-challenge-target-count"), "5");
    await fillDates(3, 1);
    await create();
    expect(text()).toContain("the end date must be after the start date");
    expect(listGroupChallenges()).toEqual([]);
  });

  it("creates a contribution challenge with a kind and block filter", async () => {
    await fillBasics("Solvency hunt", "alice, bob", "1");
    await flush(() => choose(field("#group-challenge-kind") as unknown as HTMLSelectElement, "card"));
    await type(field("#group-challenge-arg-block"), "solvency");
    await fillDates(-1, 7);
    await create();

    expect(text()).toContain("Solvency hunt");
    expect(text()).toContain('Reach 1 matching contribution (card, "solvency")');
    expect(text()).toContain('"Solvency hunt": 0/1');
    expect(text()).toContain("alice: 0");
    expect(listGroupChallenges()[0].goal).toEqual({
      kind: "contribution_target",
      targetCount: 1,
      target: { kind: "card", argBlock: "solvency" },
    });
    expect(field("#group-challenge-title").value).toBe("");

    await click(button(view.container, "Remove"));
    expect(text()).toContain("No group challenges yet.");
  });

  it("records wins on a win challenge and ranks the squad", async () => {
    await fillBasics("Rebuttal wins", "alice, bob", "2");
    await click(button(view.container, "Win target"));
    expect(field("#group-challenge-kind")).toBeNull();
    await fillDates(-1, 7);
    await create();
    expect(text()).toContain("Reach 2 recorded wins");

    const id = listGroupChallenges()[0].id;
    const winInput = () => field(`#record-win-${CSS.escape(id)}`);
    await click(button(view.container, "Record win"));
    expect(text()).toContain("A contributor ID is required to record a win.");

    await type(winInput(), "alice");
    await click(button(view.container, "Record win"));
    expect(text()).not.toContain("A contributor ID is required");
    expect(winInput().value).toBe("");
    expect(text()).toContain("alice: 1");

    await remount({ signedInContributorId: "bob" });
    expect(winInput().value).toBe("bob");
    await click(button(view.container, "Record win"));
    expect(text()).toContain('"Rebuttal wins" complete! (2/2)');
    expect(text()).toContain("bob: 1");
    // Recording clears the field outright, so the signed-in prefill does not come back.
    expect(winInput().value).toBe("");
  });
});
