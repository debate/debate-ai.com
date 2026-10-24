// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `BrainstormBoardPanel`: submitting ideas
 * into category boards, upvoting and ranking, AI ideas from the form and from
 * a board, sending an idea to the Argument Library, topic-seeded boards, and
 * the session timer.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrainstormBoardPanel } from "../src/panels/BrainstormBoardPanel";
import { listBrainstormIdeas } from "../src/state/brainstormIdeas";
import { saveTrackedArgument } from "@debate-ai/research-evidence/src/state/trackedArguments";
import { button } from "./helpers/dom";
import { click, mount, type, type Mounted } from "./helpers/mount";

const mocks = vi.hoisted(() => ({
  requestIdeas: vi.fn(),
  fetchTimer: vi.fn(),
  saveTimer: vi.fn(),
}));
vi.mock("../src/lib/team-brainstorm-client", () => ({ requestTeamBrainstormAiIdeas: mocks.requestIdeas }));
vi.mock("../src/lib/brainstorm-session-timer-sync-client", () => ({
  fetchBrainstormSessionTimer: mocks.fetchTimer,
  saveBrainstormSessionTimer: mocks.saveTimer,
}));

let view: Mounted;
const text = () => view.container.textContent ?? "";
const field = (selector: string) => view.container.querySelector(selector) as HTMLInputElement;
const startsWith = (prefix: string, nth = 0) =>
  Array.from(view.container.querySelectorAll("button")).filter((el) => el.textContent?.trim().startsWith(prefix))[nth];

async function submit(argBlock: string, contributor: string, idea: string) {
  await type(field("#brainstorm-arg-block"), argBlock);
  if (contributor) await type(field("#brainstorm-contributor-id"), contributor);
  await type(field("#brainstorm-idea-text") as unknown as HTMLTextAreaElement, idea);
  await click(button(view.container, "Submit idea"));
}

beforeEach(() => {
  localStorage.clear();
  mocks.requestIdeas.mockReset().mockResolvedValue(["AI idea one", "AI idea two"]);
  mocks.fetchTimer.mockReset().mockResolvedValue(null);
  mocks.saveTimer.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  await view.unmount();
});

describe("BrainstormBoardPanel", () => {
  it("requires every field, then files ideas into a board and keeps the contributor id", async () => {
    view = await mount(createElement(BrainstormBoardPanel));
    expect(text()).toContain("No brainstorm ideas yet.");
    await submit("solvency", "", "Federal funding");
    expect(text()).toContain("Argument block, contributor ID, and idea text are all required.");

    await submit("solvency", "alice", "Federal funding unlocks state grants");
    expect(text()).not.toContain("are all required");
    expect(text()).toContain("New Arguments");
    expect(text()).toContain("Federal funding unlocks state grants");
    expect(field("#brainstorm-contributor-id").value).toBe("alice");
    expect(field("#brainstorm-arg-block").value).toBe("");

    await click(field("#brainstorm-category-frontline"));
    await submit("solvency", "", "Perm do both solves");
    expect(listBrainstormIdeas().map((idea) => idea.category).sort()).toEqual(["argument", "frontline"]);
    expect(text()).toContain("Frontline Answers");
  });

  it("upvotes ideas so the board re-ranks", async () => {
    view = await mount(<BrainstormBoardPanel signedInContributorId="alice" />);
    expect(field("#brainstorm-contributor-id").value).toBe("alice");
    await submit("impacts", "", "Extinction outweighs");
    await submit("impacts", "", "Structural violence first");

    const upvoteFor = (idea: string) =>
      Array.from(view.container.querySelectorAll("button")).find(
        (el) => el.textContent?.startsWith("Upvote") && el.closest("div.flex")?.parentElement?.textContent?.includes(idea),
      )!;
    await click(upvoteFor("Structural violence first"));
    const ideas = listBrainstormIdeas();
    expect(ideas.find((idea) => idea.text === "Structural violence first")?.upvotes).toBe(1);
    expect(text()).toContain("Upvote (1)");
  });

  it("generates AI ideas from the form and from a board, and reports failures", async () => {
    view = await mount(createElement(BrainstormBoardPanel));
    await click(button(view.container, "Generate AI ideas"));
    expect(text()).toContain("Enter an argument block above before generating AI ideas.");

    await type(field("#brainstorm-arg-block"), "grid DA");
    await click(button(view.container, "Generate AI ideas"));
    expect(mocks.requestIdeas).toHaveBeenCalledTimes(1);
    expect(listBrainstormIdeas().filter((idea) => idea.isAiGenerated)).toHaveLength(2);
    expect(text()).toContain("AI idea one");

    mocks.requestIdeas.mockRejectedValueOnce(new Error("Model busy"));
    await click(button(view.container, "Generate AI ideas", 1));
    expect(text()).toContain("Model busy");

    mocks.requestIdeas.mockResolvedValueOnce(["Board idea"]);
    await click(button(view.container, "Generate AI ideas", 1));
    expect(text()).toContain("Board idea");
    expect(text()).not.toContain("Model busy");

    mocks.requestIdeas.mockRejectedValueOnce(new Error("Form failure"));
    await click(button(view.container, "Generate AI ideas"));
    expect(text()).toContain("Form failure");
  });

  it("sends an idea to the Argument Library", async () => {
    view = await mount(createElement(BrainstormBoardPanel));
    await submit("solvency", "alice", "States lead on energy");

    await click(button(view.container, "Send to Argument Library"));
    await click(button(view.container, "Cancel"));
    expect(text()).not.toContain("Confirm send");

    await click(button(view.container, "Send to Argument Library"));
    await click(button(view.container, "Confirm send"));
    expect(text()).toContain("Topic and case area are both required.");

    const topicInput = view.container.querySelector('input[id^="send-topic-"]') as HTMLInputElement;
    const caseInput = view.container.querySelector('input[id^="send-case-area-"]') as HTMLInputElement;
    await type(topicInput, "Energy Policy");
    await type(caseInput, "Aff");
    await click(button(view.container, "Confirm send"));
    expect(text()).toContain("✓ In Argument Library");
  });

  it("seeds boards from a topic's coverage gaps", async () => {
    saveTrackedArgument({ id: "t-1", topic: "Energy", argBlock: "Grid DA", category: "DA" });
    view = await mount(createElement(BrainstormBoardPanel));

    await click(button(view.container, "Energy"));
    expect(text()).toContain('Showing every under-covered tracked argument\'s board for "Energy"');
    expect(text()).toContain("Grid DA");
    expect(text()).toContain("No ideas submitted yet.");

    await type(field("#brainstorm-topic"), "Unknown");
    expect(text()).toContain('No coverage-gap boards for "Unknown".');
  });

  it("runs the session timer", async () => {
    view = await mount(createElement(BrainstormBoardPanel));
    expect(text()).toContain("Session timer");
    await click(button(view.container, "10 min"));
    expect(text()).toContain("10:00");

    await click(button(view.container, "Start"));
    expect(startsWith("Pause")).toBeTruthy();
    expect(() => button(view.container, "10 min")).toThrow();

    await click(button(view.container, "Pause"));
    expect(button(view.container, "Start")).toBeTruthy();
    await click(button(view.container, "Reset"));
    expect(button(view.container, "10 min")).toBeTruthy();
  });
});
