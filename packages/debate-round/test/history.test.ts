import { describe, expect, it } from "vitest";
import { History, deepClone } from "../src/state/history";
import type { Box, Flow } from "../src/types/flow";

function box(content: string, index: number, level = 1, children: Box[] = []): Box {
  return { content, children, index, level, focus: false };
}

function makeFlow(children: Box[] = []): Flow {
  return {
    content: "1AC",
    level: 0,
    columns: ["1AC", "1NC"],
    invert: false,
    focus: false,
    index: 0,
    lastFocus: [],
    children,
    id: 1,
  };
}

describe("deepClone", () => {
  it("returns a structurally equal but distinct copy", () => {
    const src = { a: [1, { b: 2 }] };
    const copy = deepClone(src);
    expect(copy).toEqual(src);
    expect(copy).not.toBe(src);
    expect(copy.a[1]).not.toBe(src.a[1]);
  });
});

describe("History", () => {
  it("starts empty with nothing to undo or redo", () => {
    const h = new History(makeFlow());
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(false);
    expect(h.lastAction()).toBeUndefined();
    // Undo/redo on an empty stack are no-ops that still return a snapshot.
    expect(h.undo().children).toEqual([]);
    expect(h.redo().children).toEqual([]);
  });

  it("undoes and redoes an `add`", () => {
    const flow = makeFlow([box("a", 0)]);
    const h = new History(flow);
    flow.children.push(box("", 1));
    h.add("add", [1]);
    expect(h.canUndo()).toBe(true);

    const undone = h.undo();
    expect(undone.children.map((c) => c.content)).toEqual(["a"]);
    expect(h.canUndo()).toBe(false);
    expect(h.canRedo()).toBe(true);

    const redone = h.redo();
    expect(redone.children).toHaveLength(2);
    expect(redone.children[1]).toMatchObject({ content: "", index: 1, level: 1 });
    expect(h.canRedo()).toBe(false);
  });

  it("re-indexes siblings after undoing an insert in the middle", () => {
    const flow = makeFlow([box("a", 0), box("new", 1), box("b", 2)]);
    const h = new History(flow);
    h.add("addBox", [1], { box: box("new", 1) });
    const undone = h.undo();
    expect(undone.children.map((c) => [c.content, c.index])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
    const redone = h.redo();
    expect(redone.children.map((c) => [c.content, c.index])).toEqual([
      ["a", 0],
      ["new", 1],
      ["b", 2],
    ]);
  });

  it("restores a deleted box on undo and removes it again on redo", () => {
    const deleted = box("gone", 0);
    const flow = makeFlow([box("keep", 0)]);
    const h = new History(flow);
    h.add("deleteBox", [0], { box: deleted });

    const undone = h.undo();
    expect(undone.children.map((c) => [c.content, c.index])).toEqual([
      ["gone", 0],
      ["keep", 1],
    ]);
    const redone = h.redo();
    expect(redone.children.map((c) => c.content)).toEqual(["keep"]);
  });

  it("undoes and redoes an edit", () => {
    const flow = makeFlow([box("after", 0)]);
    const h = new History(flow);
    h.add("edit", [0], { lastContent: "before", nextContent: "after" });
    expect(h.undo().children[0].content).toBe("before");
    expect(h.redo().children[0].content).toBe("after");
  });

  it("undoes and redoes a cross-out toggle", () => {
    const flow = makeFlow([box("x", 0)]);
    flow.children[0].crossed = true;
    const h = new History(flow);
    h.add("cross", [0], { crossed: true });
    expect(h.undo().children[0].crossed).toBe(false);
    expect(h.redo().children[0].crossed).toBe(true);
  });

  it("drops the redo tail when a new action is added", () => {
    const flow = makeFlow([box("a", 0)]);
    const h = new History(flow);
    h.add("edit", [0], { lastContent: "", nextContent: "a" });
    h.undo();
    expect(h.canRedo()).toBe(true);
    h.add("cross", [0], { crossed: true });
    expect(h.canRedo()).toBe(false);
    expect(h.data).toHaveLength(1);
    expect(h.lastAction().type).toBe("cross");
  });

  it("caps history at ten entries", () => {
    const flow = makeFlow([box("a", 0)]);
    const h = new History(flow);
    for (let i = 0; i < 15; i++) {
      h.add("edit", [0], { lastContent: String(i), nextContent: String(i + 1) });
    }
    expect(h.data).toHaveLength(10);
    expect(h.index).toBe(9);
    expect(h.data[0].other.lastContent).toBe("5");
  });

  it("caps pending entries at ten as well", () => {
    const h = new History(makeFlow([box("a", 0)]));
    for (let i = 0; i < 12; i++) h.addPending("cross", [0], { crossed: true });
    expect(h.data).toHaveLength(10);
    expect(h.index).toBe(9);
  });

  it("resolves a pending edit using its deferred next content", () => {
    const flow = makeFlow([box("typed", 0)]);
    const h = new History(flow);
    h.addPending("edit", [0], { lastContent: "", getNextContent: () => "typed" });
    expect(h.lastAction().pending).toBe(true);

    h.resolveAllPending();
    const action = h.lastAction();
    expect(action.pending).toBe(false);
    expect(action.other.nextContent).toBe("typed");
    expect(action.lastFocus).toEqual([0]);
    expect(action.nextFocus).toEqual([0]);
  });

  it("discards a pending edit that did not change the content", () => {
    const h = new History(makeFlow([box("same", 0)]));
    h.add("cross", [0], { crossed: true });
    h.addPending("edit", [0], { lastContent: "same", getNextContent: () => "same" });
    expect(h.data).toHaveLength(2);
    h.resolveAllPending();
    expect(h.data).toHaveLength(1);
    expect(h.index).toBe(0);
    expect(h.lastAction().type).toBe("cross");
  });

  it("keeps pending non-edit actions when resolving", () => {
    const h = new History(makeFlow([box("a", 0)]));
    h.addPending("cross", [0], { crossed: true });
    h.resolveAllPending();
    expect(h.data).toHaveLength(1);
    expect(h.lastAction().pending).toBe(false);
  });

  it("records focus on the latest action only once", () => {
    const h = new History(makeFlow([box("a", 0), box("b", 1)]));
    h.addFocus([0]);
    expect(h.lastFocus).toEqual([0]);

    h.add("edit", [1], { lastContent: "", nextContent: "b" });
    expect(h.lastAction().lastFocus).toEqual([0]);
    h.addFocus([1]);
    expect(h.lastAction().nextFocus).toEqual([1]);
    h.addFocus([0]);
    expect(h.lastAction().nextFocus).toEqual([1]);
  });

  it("focuses the recorded box on undo and redo", () => {
    const flow = makeFlow([box("a", 0), box("b", 1)]);
    const h = new History(flow);
    h.addFocus([0]);
    h.add("edit", [1], { lastContent: "", nextContent: "b" });
    h.addFocus([1]);

    const undone = h.undo();
    expect(undone.children[0].focus).toBe(true);
    const redone = h.redo();
    expect(redone.children[1].focus).toBe(true);
  });

  it("ignores focus paths that no longer exist", () => {
    const h = new History(makeFlow());
    expect(() => h.focus([5])).not.toThrow();
    expect(() => h.focus(null)).not.toThrow();
  });

  it("throws when an action's target box is missing", () => {
    const h = new History(makeFlow());
    const base = { lastFocus: null, nextFocus: null, pending: false };
    for (const type of ["add", "edit", "cross"] as const) {
      const action = { ...base, type, path: [3, 0], other: { box: box("", 0) } };
      expect(() => h.undoAction(action)).toThrow();
      expect(() => h.redoAction(action)).toThrow();
    }
  });
});
