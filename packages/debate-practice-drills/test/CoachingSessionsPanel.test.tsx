// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `CoachingSessionsPanel`: generating a
 * session from the round workspace's selected flow, downloading it, asking
 * for AI feedback, the regenerate/restore history, and clearing.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoachingSessionsPanel } from "../src/panels/CoachingSessionsPanel";
import { listCoachingSessions } from "../src/state/coachingSessions";
import { button, buttons, captureDownloads } from "./helpers/dom";
import { sampleFlow, selectFlow } from "./helpers/flow";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

const coach = vi.hoisted(() => ({ requestCoachFeedback: vi.fn() }));
vi.mock("../src/round/coach-feedback-client", () => coach);

let view: Mounted;
const sideInput = () => view.container.querySelector("#coaching-session-generate-side") as HTMLInputElement;

async function generate(side: string) {
  await type(sideInput(), side);
  await click(button(view.container, "Generate coaching session"));
}

beforeEach(async () => {
  localStorage.clear();
  coach.requestCoachFeedback.mockReset();
  selectFlow(sampleFlow());
  view = await mount(createElement(CoachingSessionsPanel));
});

afterEach(async () => {
  await view.unmount();
  selectFlow(null);
});

describe("CoachingSessionsPanel", () => {
  it("starts empty and needs a side to generate", async () => {
    expect(view.container.textContent).toContain("No coaching sessions yet.");
    await click(button(view.container, "Generate coaching session"));
    expect(view.container.textContent).toContain("A side (e.g. aff or neg) is required");
    expect(listCoachingSessions()).toEqual([]);
  });

  it("generates a session for the selected flow and downloads it", async () => {
    await generate("aff");
    expect(view.container.textContent).toContain("Round 7");
    expect(listCoachingSessions()).toHaveLength(1);
    expect(sideInput().value).toBe("");

    const downloads = captureDownloads();
    await click(button(view.container, "Download"));
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/7/);
  });

  it("asks for AI feedback and shows it, or the error", async () => {
    await generate("aff");
    coach.requestCoachFeedback.mockRejectedValueOnce(new Error("Rate limited"));
    await click(button(view.container, "Get AI feedback"));
    expect(view.container.textContent).toContain("Rate limited");

    coach.requestCoachFeedback.mockResolvedValueOnce("Collapse to the turn in the 2NR.");
    await click(button(view.container, "Get AI feedback"));
    expect(view.container.textContent).toContain("Collapse to the turn in the 2NR.");
    expect(coach.requestCoachFeedback).toHaveBeenCalledWith(expect.objectContaining({ sideKey: "aff" }));
    expect(buttons(view.container, "Regenerate AI feedback")).toHaveLength(1);
  });

  it("keeps the replaced version in history and restores it", async () => {
    await generate("aff");
    await click(button(view.container, "History"));
    expect(view.container.textContent).toContain("No prior versions");
    await click(button(view.container, "Hide history"));

    coach.requestCoachFeedback.mockResolvedValueOnce("First feedback");
    await click(button(view.container, "Get AI feedback"));
    await generate("aff");
    await click(button(view.container, "History"));
    expect(view.container.textContent).toContain("Replaced");
    await click(buttons(view.container, "Restore this version")[0]);
    expect(listCoachingSessions()).toHaveLength(1);
  });

  it("clears a session", async () => {
    await generate("neg");
    await click(button(view.container, "History"));
    await click(button(view.container, "Clear"));
    expect(listCoachingSessions()).toEqual([]);
    expect(view.container.textContent).toContain("No coaching sessions yet.");
  });

  it("refreshes when another tab saves a session", async () => {
    await generate("aff");
    localStorage.clear();
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "coachingSessions" }));
    });
    expect(view.container.textContent).toContain("No coaching sessions yet.");
  });

  it("offers a comparison once two sessions exist and asks for two picks", async () => {
    await generate("aff");
    await generate("neg");
    await click(button(view.container, "Compare"));
    expect(view.container.textContent).toContain("Choose two sessions to compare.");
  });

  it("disables generating without a selected flow", async () => {
    await view.unmount();
    selectFlow(null);
    view = await mount(createElement(CoachingSessionsPanel));
    expect(button(view.container, "Generate coaching session").disabled).toBe(true);
    expect(view.container.textContent).toContain("Select a round's flow");
  });
});
