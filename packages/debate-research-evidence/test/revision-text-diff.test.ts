import { describe, expect, it } from "vitest";
import {
  buildCardRevisionTextDiff,
  buildEvidenceEntryTextSnapshot,
  diffText,
} from "../src/lib/revision-text-diff";
import type { EvidenceLibraryEntry } from "../src/lib/shared-evidence-library";

describe("diffText", () => {
  it("returns a single equal segment on both sides for identical text", () => {
    const { before, after } = diffText("no change here", "no change here");
    expect(before).toEqual([{ text: "no change here", type: "equal" }]);
    expect(after).toEqual([{ text: "no change here", type: "equal" }]);
  });

  it("returns empty segment lists for two empty strings", () => {
    expect(diffText("", "")).toEqual({ before: [], after: [] });
  });

  it("marks appended words as added on the after side only", () => {
    const { before, after } = diffText("the plan solves", "the plan solves the case");
    expect(before.every((s) => s.type === "equal")).toBe(true);
    expect(after.some((s) => s.type === "added")).toBe(true);
    expect(after.filter((s) => s.type === "added").map((s) => s.text).join("")).toContain("the case");
  });

  it("marks removed words as removed on the before side only", () => {
    const { before, after } = diffText("the plan solves the case", "the plan solves");
    expect(before.some((s) => s.type === "removed")).toBe(true);
    expect(after.every((s) => s.type === "equal")).toBe(true);
  });

  it("marks a full replacement as removed/added on their respective sides", () => {
    const { before, after } = diffText("old text", "new text");
    expect(before.some((s) => s.type === "removed" && s.text === "old")).toBe(true);
    expect(after.some((s) => s.type === "added" && s.text === "new")).toBe(true);
    expect(before.some((s) => s.type === "equal" && s.text === "text")).toBe(true);
  });

  it("falls back to a coarse whole-string diff for very long input, without throwing", () => {
    const longBefore = Array.from({ length: 7000 }, (_, i) => `word${i}`).join(" ");
    const longAfter = `${longBefore} extra`;

    const { before, after } = diffText(longBefore, longAfter);
    expect(before).toEqual([{ text: longBefore, type: "removed" }]);
    expect(after).toEqual([{ text: longAfter, type: "added" }]);
  });

  it("treats an empty string on one side as a single-sided diff with no equal segments", () => {
    const { before, after } = diffText("", "brand new text");
    expect(before).toEqual([]);
    expect(after.filter((s) => s.type === "added").length).toBeGreaterThan(0);
  });
});

describe("buildEvidenceEntryTextSnapshot", () => {
  it("captures only the diffable text fields, not tags/topic/case-area", () => {
    const entry: EvidenceLibraryEntry = {
      id: "entry-1",
      argBlock: "Warming DA",
      wordCount: 10,
      topic: "Energy Policy",
      caseArea: "DA",
      tags: ["warming"],
      kind: "card",
      text: "Emissions accelerate warming.",
      cite: "Smith 24",
    };
    expect(buildEvidenceEntryTextSnapshot(entry)).toEqual({
      argBlock: "Warming DA",
      text: "Emissions accelerate warming.",
      cite: "Smith 24",
    });
  });
});

describe("buildCardRevisionTextDiff", () => {
  const before = { argBlock: "Warming DA", text: "Emissions cause warming.", cite: "Smith 20" };

  it("flags every field unchanged when before and after are identical", () => {
    const diff = buildCardRevisionTextDiff(before, before);
    expect(diff.every((field) => !field.changed)).toBe(true);
    expect(diff.map((field) => field.field)).toEqual(["argBlock", "text", "cite"]);
  });

  it("flags only the fields that actually changed", () => {
    const after = { ...before, cite: "Smith 2024" };
    const diff = buildCardRevisionTextDiff(before, after);

    expect(diff.find((f) => f.field === "argBlock")?.changed).toBe(false);
    expect(diff.find((f) => f.field === "text")?.changed).toBe(false);
    expect(diff.find((f) => f.field === "cite")?.changed).toBe(true);
  });

  it("produces a word-level diff for a changed text field", () => {
    const after = { ...before, text: "Emissions cause catastrophic warming." };
    const diff = buildCardRevisionTextDiff(before, after);
    const textField = diff.find((f) => f.field === "text")!;

    expect(textField.changed).toBe(true);
    expect(textField.after.some((s) => s.type === "added" && s.text === "catastrophic")).toBe(true);
  });

  it("flags every field changed when nothing carries over", () => {
    const after = { argBlock: "Solvency", text: "The plan solves.", cite: "" };
    const diff = buildCardRevisionTextDiff(before, after);
    expect(diff.every((field) => field.changed)).toBe(true);
  });
});
