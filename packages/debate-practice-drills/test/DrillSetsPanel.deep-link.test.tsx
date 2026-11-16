// @vitest-environment jsdom
/**
 * @fileoverview `?drillSet=` deep links in the Practice Drills tab — the link
 * Settings → Saved to your account puts on each drill set. The named set is
 * outlined, marked `aria-current` and scrolled into view; an id that isn't on
 * this device shows a note instead.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrillSetRecord } from "../src/state/drillSets";
import { buildDrillSetOpenHref } from "../src/state/savedDrillSets";
import { flush, mount, type Mounted } from "./helpers/mount";

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }));
vi.mock("../src/round/drill-script-client", () => ({ requestDrillScript: vi.fn() }));
vi.mock("../src/round/drill-sets-client", () => ({
  listSavedDrillSets: async () => null,
  saveDrillSetToAccount: async () => {},
  deleteSavedDrillSetFromAccount: async () => {},
}));
vi.mock("@debate-ai/community", () => ({ recordDebaterActivity: vi.fn() }));

const drillSet = (roundId: string, sideKey = "aff"): DrillSetRecord => ({
  roundId,
  sideKey,
  drills: [{ kind: "overview", rowIndex: null, prompt: `Overview for ${roundId}`, difficulty: "easy" }],
  updatedAt: 1,
});

let view: Mounted | null = null;
const scrolled: Element[] = [];

async function open(search: string, sets: DrillSetRecord[]) {
  localStorage.setItem("drillSets", JSON.stringify(sets));
  nav.params = new URLSearchParams(search);
  const { DrillSetsPanel } = await import("../src/panels/DrillSetsPanel");
  view = await mount(createElement(DrillSetsPanel));
  await flush(async () => {});
  return view.container;
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  scrolled.length = 0;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
});

afterEach(async () => {
  await view?.unmount();
  view = null;
});

describe("buildDrillSetOpenHref", () => {
  it("links straight to the Practice Drills tab with the round id encoded", () => {
    expect(buildDrillSetOpenHref("7")).toBe("/practice/debates?section=drills&drillSet=7");
    expect(buildDrillSetOpenHref("a&b c")).toBe("/practice/debates?section=drills&drillSet=a%26b%20c");
  });
});

describe("DrillSetsPanel ?drillSet=", () => {
  it("outlines and scrolls to the linked drill set only", async () => {
    const container = await open("section=drills&drillSet=8", [drillSet("7"), drillSet("8", "neg"), drillSet("9")]);
    const linked = container.querySelectorAll('[data-linked="true"]');
    expect(linked).toHaveLength(1);
    expect(linked[0].getAttribute("aria-current")).toBe("true");
    expect(linked[0].textContent).toContain("Round 8");
    expect(linked[0].textContent).toContain("Overview for 8");
    expect(scrolled).toEqual([linked[0]]);
    expect(container.textContent).not.toContain("isn't on this device");
  });

  it("says when the linked drill set isn't on this device, without highlighting anything", async () => {
    const container = await open("drillSet=gone", [drillSet("7")]);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "The linked drill set isn't on this device",
    );
    expect(container.querySelector('[data-linked="true"]')).toBeNull();
    expect(scrolled).toEqual([]);
  });

  it("does nothing special without the param", async () => {
    const container = await open("section=drills", [drillSet("7")]);
    expect(container.querySelector('[data-linked="true"]')).toBeNull();
    expect(container.textContent).not.toContain("isn't on this device");
    expect(scrolled).toEqual([]);
  });
});
