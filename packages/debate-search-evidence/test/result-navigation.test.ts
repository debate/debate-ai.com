import { describe, expect, it } from "vitest";
import { isTypingTarget, nextSelectionIndex } from "../src/lib/result-navigation";

describe("isTypingTarget", () => {
  const element = (tagName: string, isContentEditable = false) =>
    ({ tagName, isContentEditable }) as unknown as EventTarget;

  it("recognizes text-entry elements", () => {
    expect(isTypingTarget(element("INPUT"))).toBe(true);
    expect(isTypingTarget(element("TEXTAREA"))).toBe(true);
    expect(isTypingTarget(element("SELECT"))).toBe(true);
  });

  it("recognizes a contenteditable region", () => {
    expect(isTypingTarget(element("DIV", true))).toBe(true);
  });

  it("lets ordinary elements through", () => {
    expect(isTypingTarget(element("DIV"))).toBe(false);
    expect(isTypingTarget(element("BODY"))).toBe(false);
  });

  it("handles a missing or non-element target", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({} as EventTarget)).toBe(false);
  });
});

describe("nextSelectionIndex", () => {
  it("moves forward on both down and right", () => {
    expect(nextSelectionIndex("ArrowDown", 0, 5)).toBe(1);
    expect(nextSelectionIndex("ArrowRight", 0, 5)).toBe(1);
  });

  it("moves backward on both up and left", () => {
    expect(nextSelectionIndex("ArrowUp", 3, 5)).toBe(2);
    expect(nextSelectionIndex("ArrowLeft", 3, 5)).toBe(2);
  });

  it("selects the first result when nothing is selected yet", () => {
    expect(nextSelectionIndex("ArrowDown", -1, 5)).toBe(0);
  });

  it("does not move backward from an empty selection", () => {
    expect(nextSelectionIndex("ArrowUp", -1, 5)).toBeNull();
  });

  it("stops at both ends rather than wrapping", () => {
    expect(nextSelectionIndex("ArrowDown", 4, 5)).toBeNull();
    expect(nextSelectionIndex("ArrowUp", 0, 5)).toBeNull();
  });

  it("jumps to the ends with Home and End", () => {
    expect(nextSelectionIndex("Home", 3, 5)).toBe(0);
    expect(nextSelectionIndex("End", 1, 5)).toBe(4);
    expect(nextSelectionIndex("Home", 0, 5)).toBeNull();
    expect(nextSelectionIndex("End", 4, 5)).toBeNull();
  });

  it("ignores keys that do not navigate", () => {
    expect(nextSelectionIndex("a", 1, 5)).toBeNull();
    expect(nextSelectionIndex("Enter", 1, 5)).toBeNull();
  });

  it("does nothing when the list is empty", () => {
    expect(nextSelectionIndex("ArrowDown", -1, 0)).toBeNull();
  });
});
