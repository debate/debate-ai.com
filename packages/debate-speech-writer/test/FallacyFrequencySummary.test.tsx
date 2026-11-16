// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { FallacyFrequencySummary } from "../src/ui/FallacyFrequencySummary";
import type { FallacyFrequencySpeech } from "../src/analysis/fallacy-frequency";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(speeches: FallacyFrequencySpeech[], emptyMessage?: string) {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(<FallacyFrequencySummary speeches={speeches} emptyMessage={emptyMessage} />);
  });
  return container.textContent ?? "";
}

describe("FallacyFrequencySummary", () => {
  it("shows the empty message when nothing has text", async () => {
    expect(await render([])).toBe("No saved speeches to scan yet.");
    expect(await render([{ label: "x", text: " " }], "Save a round first.")).toBe("Save a round first.");
  });

  it("says when scanned speeches have no hints", async () => {
    expect(await render([{ label: "AC", text: "We affirm." }])).toBe("No fallacy hints across 1 speech, 2 words.");
  });

  it("summarises totals, the most common kind, per-kind counts and the top speeches", async () => {
    const text = await render([
      { label: "R1 · AC", text: "Either we act or we fail." },
      { label: "R1 · NC", text: "You are a liar and they are biased." },
      { label: "R2 · AC", text: "Either now or never." },
      { label: "R3 · AC", text: "Either up or down." },
    ]);
    expect(text).toContain("5 hints across 4 speeches");
    expect(text).toContain("Most common: False dichotomy.");
    expect(text).toContain("Ad hominem: 2");
    expect(text).toContain("Straw man: 0");
    expect(text).toContain("False dichotomy: 3");
    // Top three only, most hints first, with an ellipsis for the rest.
    expect(text).toContain("Most hints: R1 · NC (2), R1 · AC (1), R2 · AC (1), …");
    expect(text).toContain("not a verdict");
  });
});
