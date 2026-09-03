import { describe, expect, it } from "vitest";
import {
  buildFlowEditConflictDiff,
  diffFlowEditContent,
} from "../src/flow/flow-edit-diff";
import type { FlowEdit, FlowEditConflict } from "../src/flow/shared-flow-sync";

function edit(overrides: Partial<FlowEdit> = {}): FlowEdit {
  return {
    id: "e1",
    flowId: 1,
    boxPath: [0],
    authorId: "alice",
    content: "some content",
    timestampMs: 1000,
    ...overrides,
  };
}

describe("diffFlowEditContent", () => {
  it("marks unchanged words equal on both sides", () => {
    const { left, right } = diffFlowEditContent("no warming impact", "no warming impact");
    expect(left.every((s) => s.type === "equal")).toBe(true);
    expect(right.every((s) => s.type === "equal")).toBe(true);
    expect(left.map((s) => s.text).join("")).toBe("no warming impact");
  });

  it("flags a changed word as removed on the left and added on the right", () => {
    const { left, right } = diffFlowEditContent("extend warming", "extend adaptation");
    expect(left.map((s) => ({ text: s.text, type: s.type }))).toEqual([
      { text: "extend", type: "equal" },
      { text: " ", type: "equal" },
      { text: "warming", type: "removed" },
    ]);
    expect(right.map((s) => ({ text: s.text, type: s.type }))).toEqual([
      { text: "extend", type: "equal" },
      { text: " ", type: "equal" },
      { text: "adaptation", type: "added" },
    ]);
  });

  it("handles a cleared side (empty string) as all-removed / all-added", () => {
    const { left, right } = diffFlowEditContent("some tag", "");
    expect(left.every((s) => s.type === "removed" || s.text === " ")).toBe(true);
    expect(right).toEqual([]);
  });

  it("handles two disjoint strings as fully removed/added", () => {
    const { left, right } = diffFlowEditContent("aff", "neg");
    expect(left).toEqual([{ text: "aff", type: "removed" }]);
    expect(right).toEqual([{ text: "neg", type: "added" }]);
  });
});

describe("buildFlowEditConflictDiff", () => {
  it("picks the last edit (mergeFlowEdits' winner) and diffs every other edit against it", () => {
    const conflict: FlowEditConflict = {
      boxPath: [1],
      edits: [
        edit({ id: "e1", authorId: "alice", content: "extend warming", timestampMs: 1000 }),
        edit({ id: "e2", authorId: "bob", content: "extend adaptation", timestampMs: 1200 }),
      ],
    };

    const diff = buildFlowEditConflictDiff(conflict);

    expect(diff.boxPath).toEqual([1]);
    expect(diff.winner.id).toBe("e2");
    expect(diff.challengers).toHaveLength(1);
    expect(diff.challengers[0].edit.id).toBe("e1");
    // Winner's content ("extend adaptation") diffed against the challenger's
    // ("extend warming"): "adaptation" is only on the winner's side, so it's
    // "removed" relative to the challenger; the challenger's own "warming" is "added".
    expect(diff.challengers[0].winnerDiff.some((s) => s.type === "removed" && s.text === "adaptation")).toBe(true);
    expect(diff.challengers[0].challengerDiff.some((s) => s.type === "added" && s.text === "warming")).toBe(true);
  });

  it("produces one challenger diff per non-winning edit when three or more edits conflict", () => {
    const conflict: FlowEditConflict = {
      boxPath: [2],
      edits: [
        edit({ id: "e1", authorId: "alice", content: "a", timestampMs: 1000 }),
        edit({ id: "e2", authorId: "bob", content: "b", timestampMs: 1100 }),
        edit({ id: "e3", authorId: "carol", content: "c", timestampMs: 1200 }),
      ],
    };

    const diff = buildFlowEditConflictDiff(conflict);

    expect(diff.winner.id).toBe("e3");
    expect(diff.challengers.map((c) => c.edit.id)).toEqual(["e1", "e2"]);
  });
});
