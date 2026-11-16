// @vitest-environment jsdom
/**
 * @fileoverview `?decision=` deep links on the AI Judge Decision page — the
 * link Settings → Saved to your account puts on each judge-decision row. The
 * named decision (or the multi-judge panel run holding it) is outlined,
 * marked `aria-current` and scrolled into view; an id that isn't on this
 * device shows a note instead.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JudgeDecisionPanel } from "../src/panels/JudgeDecisionPanel";
import { buildJudgeDecisionOpenHref, type JudgeDecisionRecord } from "../src/state/judgeDecisions";
import { mount, type Mounted } from "./helpers/mount";

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }));
vi.mock("../src/round/judge-decision-client", () => ({ requestJudgeDecision: vi.fn() }));
vi.mock("../src/round/judge-decisions-client", () => ({
  listSavedJudgeDecisions: async () => null,
  saveJudgeDecisionToAccount: async () => {},
  deleteSavedJudgeDecisionFromAccount: async () => {},
}));

const record = (id: string, overrides: Partial<JudgeDecisionRecord> = {}): JudgeDecisionRecord => ({
  id,
  roundId: "round-1",
  paradigmName: "Tabula Rasa",
  sideNames: { primary: "Aff", secondary: "Neg" },
  result: { winner: "primary", keyVotingIssues: [`Issue ${id}`], rationale: `Rationale ${id}` },
  generatedAt: Number(id.replace(/\D/g, "")) || 1,
  ...overrides,
});

let view: Mounted | null = null;
const scrolled: Element[] = [];

async function open(search: string, records: JudgeDecisionRecord[]) {
  localStorage.setItem("judgeDecisions", JSON.stringify(records));
  nav.params = new URLSearchParams(search);
  view = await mount(createElement(JudgeDecisionPanel));
  return view.container;
}

beforeEach(() => {
  localStorage.clear();
  scrolled.length = 0;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
});

afterEach(async () => {
  await view?.unmount();
  view = null;
});

describe("buildJudgeDecisionOpenHref", () => {
  it("links to the page with the decision id encoded", () => {
    expect(buildJudgeDecisionOpenHref("decision-1-ab")).toBe("/practice/judge-decision?decision=decision-1-ab");
    expect(buildJudgeDecisionOpenHref("a&b c")).toBe("/practice/judge-decision?decision=a%26b%20c");
  });
});

describe("JudgeDecisionPanel ?decision=", () => {
  it("outlines and scrolls to the linked single decision only", async () => {
    const container = await open("decision=d2", [record("d1"), record("d2"), record("d3")]);
    const linked = container.querySelectorAll('[data-linked="true"]');
    expect(linked).toHaveLength(1);
    expect(linked[0].getAttribute("aria-current")).toBe("true");
    expect(linked[0].textContent).toContain("Rationale d2");
    expect(scrolled).toEqual([linked[0]]);
    expect(container.textContent).not.toContain("isn't on this device");
  });

  it("outlines the multi-judge panel run holding the linked decision and marks its row", async () => {
    const container = await open("decision=d5", [
      record("d4", { batchId: "panel-1", paradigmName: "Policymaker" }),
      record("d5", { batchId: "panel-1", paradigmName: "Tabula Rasa", result: { winner: "secondary", keyVotingIssues: ["T"], rationale: "Neg row" } }),
    ]);
    const linked = container.querySelector('[data-linked="true"]');
    expect(linked?.textContent).toContain("Multi-judge panel (2 paradigms)");
    expect(scrolled).toEqual([linked]);
    const row = container.querySelector('tr[aria-current="true"]');
    expect(row?.textContent).toContain("Neg row");
  });

  it("says when the linked decision isn't on this device, without highlighting anything", async () => {
    const container = await open("decision=missing", [record("d1")]);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("isn't on this device");
    expect(container.querySelector('[data-linked="true"]')).toBeNull();
    expect(scrolled).toEqual([]);
  });

  it("does nothing special without the param", async () => {
    const container = await open("", [record("d1")]);
    expect(container.querySelector('[data-linked="true"]')).toBeNull();
    expect(container.textContent).not.toContain("isn't on this device");
    expect(scrolled).toEqual([]);
  });
});
