// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `DrillSetsPanel`: generating drills from the
 * selected flow, marking them practiced (and the practice tier that counts
 * them), AI scripts, review reminders, and clearing.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrillSetsPanel } from "../src/panels/DrillSetsPanel";
import { listDrillSets } from "../src/state/drillSets";
import { button, buttons } from "./helpers/dom";
import { sampleFlow, selectFlow } from "./helpers/flow";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

const script = vi.hoisted(() => ({ requestDrillScript: vi.fn() }));
vi.mock("../src/round/drill-script-client", () => script);
// Signed out: the account list comes back null and nothing is pushed.
vi.mock("../src/round/drill-sets-client", () => ({
  listSavedDrillSets: async () => null,
  saveDrillSetToAccount: async () => {},
  deleteSavedDrillSetFromAccount: async () => {},
}));
vi.mock("@debate/community", () => ({ recordDebaterActivity: vi.fn() }));

let view: Mounted;
const text = () => view.container.textContent ?? "";

async function generate(side = "aff") {
  await type(view.container.querySelector("#drill-set-generate-side") as HTMLInputElement, side);
  await click(button(view.container, "Generate drills"));
}

beforeEach(async () => {
  localStorage.clear();
  script.requestDrillScript.mockReset();
  selectFlow(sampleFlow());
  view = await mount(createElement(DrillSetsPanel));
});

afterEach(async () => {
  await view.unmount();
  selectFlow(null);
});

describe("DrillSetsPanel", () => {
  it("starts empty and asks for a side", async () => {
    expect(text()).toContain("No practice drills yet.");
    expect(text()).toContain("Sign in to sync your drill sets");
    await click(button(view.container, "Generate drills"));
    expect(text()).toContain("A side (e.g. aff or neg) is required to generate drills.");
  });

  it("generates a round's drills with the practice tier above them", async () => {
    await generate();
    expect(text()).toContain("Round 7");
    expect(text()).toContain("Practice tier");
    expect(text()).toContain("0 drills practiced");
    expect(listDrillSets()).toHaveLength(1);
    expect(buttons(view.container, "Mark practiced").length).toBeGreaterThan(0);
  });

  it("marks a drill practiced and back", async () => {
    await generate();
    await click(buttons(view.container, "Mark practiced")[0]);
    expect(text()).toContain("1 drill practiced");
    expect(listDrillSets()[0].completedDrillIndexes).toEqual([0]);
    await click(button(view.container, "✓ Practiced"));
    expect(listDrillSets()[0].completedDrillIndexes ?? []).toEqual([]);
  });

  it("gets an AI script for a drill, or shows why not", async () => {
    await generate();
    script.requestDrillScript.mockRejectedValueOnce(new Error("Model unavailable"));
    await click(buttons(view.container, "Get AI script")[0]);
    expect(text()).toContain("Model unavailable");

    script.requestDrillScript.mockResolvedValueOnce("Judge, start with the overview…");
    await click(buttons(view.container, "Get AI script")[0]);
    expect(text()).toContain("Judge, start with the overview…");
    expect(buttons(view.container, "Regenerate AI script")).toHaveLength(1);
  });

  it("schedules a review reminder and flags it due", async () => {
    await generate();
    const input = view.container.querySelector('input[type="date"]') as HTMLInputElement;
    await flush(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "2000-01-01");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(text()).toContain("1 due for review");
    const clears = buttons(view.container, "Clear");
    // The reminder's own Clear comes after the round's.
    await click(clears[clears.length - 1]);
    expect(text()).not.toContain("due for review");
  });

  it("clears a round's drills", async () => {
    await generate();
    await click(buttons(view.container, "Clear")[0]);
    expect(listDrillSets()).toEqual([]);
    expect(text()).toContain("No practice drills yet.");
  });
});
