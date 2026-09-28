// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `EvidenceLibraryPanel`'s empty-state sample
 * data — TODO.md's "every other tool page that shows an empty state for a
 * new user ... the Evidence Library" follow-up to the `/tools` "My Saved
 * Items" widget's sample-data fix, applied here. Confirms the panel shows
 * `getSampleEvidenceLibraryEntries()`'s sample card/block (badged "Sample")
 * only while the persisted repository is genuinely empty, and falls back to
 * the plain "No entries match this search." state once a real entry exists
 * but a search matches nothing — never showing samples alongside or instead
 * of real search misses. Uses the same jsdom + `react-dom/client` + `act`
 * pattern `ArgumentLibraryPanel.test.tsx` established in this package.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

import { EvidenceLibraryPanel } from "../src/panels/EvidenceLibraryPanel";
import { saveEvidenceLibraryEntry } from "../src/state/evidenceLibraryEntries";
import type { EvidenceLibraryEntry } from "../src/lib/shared-evidence-library";
import { flush, mount, type Mounted } from "./helpers/mount";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

function makeEntry(overrides: Partial<EvidenceLibraryEntry> = {}): EvidenceLibraryEntry {
  return {
    id: "real-1",
    argBlock: "Real Submitted Block",
    wordCount: 3,
    topic: "Some Topic",
    caseArea: "Neg",
    tags: [],
    kind: "card",
    text: "Real entry text.",
    cite: "Real 24",
    ...overrides,
  };
}

function badgeTexts(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[data-slot='badge']")).map((el) => el.textContent ?? "");
}

let view: Mounted;

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
});

describe("EvidenceLibraryPanel empty-state sample data", () => {
  it("shows the sample card and block, each badged Sample, when the repository is empty", async () => {
    view = await mount(createElement(EvidenceLibraryPanel));

    expect(view.container.textContent).toContain("No entries yet");
    expect(view.container.textContent).toContain("Warming DA");
    expect(view.container.textContent).toContain("Federalism Net Benefit");
    expect(badgeTexts(view.container).filter((text) => text === "Sample")).toHaveLength(2);
    expect(view.container.textContent).not.toContain("No entries match this search.");
  });

  it("does not show samples once a real entry has been submitted", async () => {
    saveEvidenceLibraryEntry(makeEntry());
    view = await mount(createElement(EvidenceLibraryPanel));
    await flush(() => {});

    expect(view.container.textContent).toContain("Real Submitted Block");
    expect(view.container.textContent).not.toContain("No entries yet");
    expect(view.container.textContent).not.toContain("Warming DA");
  });

  it("shows the plain no-match empty state, not samples, when a search on a non-empty repository matches nothing", async () => {
    saveEvidenceLibraryEntry(makeEntry());
    view = await mount(createElement(EvidenceLibraryPanel));
    await flush(() => {});

    const searchInput = view.container.querySelector(
      "input[aria-label='Search the evidence library']",
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await flush(() => {
      setter?.call(searchInput, "nonexistent-keyword-xyz");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(view.container.textContent).toContain("No entries match this search.");
    expect(view.container.textContent).not.toContain("No entries yet");
    expect(view.container.textContent).not.toContain("Warming DA");
  });
});
