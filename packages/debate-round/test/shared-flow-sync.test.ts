import { describe, expect, it } from "vitest";
import {
  applyMergedEditsToFlow,
  buildSharedFlowSyncSummaryText,
  groupEditsByBox,
  mergeFlowEdits,
  type FlowEdit,
  type MergeFlowEditsResult,
} from "../src/flow/shared-flow-sync";
import { newBox } from "../src/utils/flow-utils";

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

describe("groupEditsByBox", () => {
  it("groups edits by boxPath, preserving relative order", () => {
    const edits = [
      edit({ id: "a", boxPath: [0] }),
      edit({ id: "b", boxPath: [0, 1] }),
      edit({ id: "c", boxPath: [0] }),
    ];

    const grouped = groupEditsByBox(edits);
    expect(Array.from(grouped.keys())).toEqual(["0", "0.1"]);
    expect(grouped.get("0")?.map((e) => e.id)).toEqual(["a", "c"]);
    expect(grouped.get("0.1")?.map((e) => e.id)).toEqual(["b"]);
  });
});

describe("mergeFlowEdits", () => {
  it("merges a single edit as-is", () => {
    const result = mergeFlowEdits([edit({ id: "a" })]);
    expect(result.conflicts).toEqual([]);
    expect(result.merged).toEqual([
      { boxPath: [0], content: "some content", authorId: "alice", timestampMs: 1000 },
    ]);
  });

  it("takes the latest edit as last-write-wins when edits are sequential, not concurrent", () => {
    const result = mergeFlowEdits([
      edit({ id: "a", authorId: "alice", content: "first draft", timestampMs: 1000 }),
      edit({ id: "b", authorId: "bob", content: "second draft", timestampMs: 20000 }),
    ]);

    expect(result.conflicts).toEqual([]);
    expect(result.merged).toEqual([
      { boxPath: [0], content: "second draft", authorId: "bob", timestampMs: 20000 },
    ]);
  });

  it("does not conflict when concurrent edits from different authors converge on the same content", () => {
    const result = mergeFlowEdits([
      edit({ id: "a", authorId: "alice", content: "same text", timestampMs: 1000 }),
      edit({ id: "b", authorId: "bob", content: "same text", timestampMs: 1500 }),
    ]);

    expect(result.conflicts).toEqual([]);
    expect(result.merged).toHaveLength(1);
    expect(result.merged[0].content).toBe("same text");
  });

  it("flags a conflict when different authors diverge within the conflict window", () => {
    const editA = edit({ id: "a", authorId: "alice", content: "alice's version", timestampMs: 1000 });
    const editB = edit({ id: "b", authorId: "bob", content: "bob's version", timestampMs: 3000 });

    const result = mergeFlowEdits([editA, editB]);

    expect(result.merged).toEqual([]);
    expect(result.conflicts).toEqual([{ boxPath: [0], edits: [editA, editB] }]);
  });

  it("does not conflict when a divergent edit from another author is outside the conflict window", () => {
    const result = mergeFlowEdits(
      [
        edit({ id: "a", authorId: "alice", content: "alice's version", timestampMs: 1000 }),
        edit({ id: "b", authorId: "bob", content: "bob's version", timestampMs: 30000 }),
      ],
      { conflictWindowMs: 5000 },
    );

    expect(result.conflicts).toEqual([]);
    expect(result.merged).toEqual([
      { boxPath: [0], content: "bob's version", authorId: "bob", timestampMs: 30000 },
    ]);
  });

  it("does not conflict on sequential revisions from the same author", () => {
    const result = mergeFlowEdits([
      edit({ id: "a", authorId: "alice", content: "draft one", timestampMs: 1000 }),
      edit({ id: "b", authorId: "alice", content: "draft two", timestampMs: 1200 }),
    ]);

    expect(result.conflicts).toEqual([]);
    expect(result.merged[0].content).toBe("draft two");
  });

  it("breaks timestamp ties by edit id for determinism", () => {
    const result = mergeFlowEdits([
      edit({ id: "z", authorId: "alice", content: "z content", timestampMs: 1000 }),
      edit({ id: "a", authorId: "alice", content: "a content", timestampMs: 1000 }),
    ]);

    expect(result.merged[0].content).toBe("z content");
  });

  it("handles multiple boxes independently", () => {
    const result = mergeFlowEdits([
      edit({ id: "a", boxPath: [0], content: "box 0" }),
      edit({ id: "b", boxPath: [1], content: "box 1" }),
    ]);

    expect(result.merged).toHaveLength(2);
    expect(result.merged.map((m) => m.content).sort()).toEqual(["box 0", "box 1"]);
  });

  it("uses the default conflict window when none is supplied", () => {
    const result = mergeFlowEdits([
      edit({ id: "a", authorId: "alice", content: "alice's version", timestampMs: 0 }),
      edit({ id: "b", authorId: "bob", content: "bob's version", timestampMs: 4999 }),
    ]);

    expect(result.conflicts).toHaveLength(1);
  });
});

describe("applyMergedEditsToFlow", () => {
  const baseFlow = {
    id: 1,
    content: "1AC",
    level: 0,
    columns: ["1AC"],
    invert: false,
    focus: false,
    index: 0,
    lastFocus: [],
    children: [
      { ...newBox(0, 1), children: [newBox(0, 2), newBox(1, 2)] },
      newBox(1, 1),
    ],
  };

  it("applies content to a top-level box without mutating the input", () => {
    const result = applyMergedEditsToFlow(baseFlow, [
      { boxPath: [1], content: "warming DA", authorId: "alice", timestampMs: 1000 },
    ]);

    expect(result.children[1].content).toBe("warming DA");
    expect(baseFlow.children[1].content).toBe("");
    expect(result).not.toBe(baseFlow);
    expect(result.children).not.toBe(baseFlow.children);
  });

  it("applies content to a nested box", () => {
    const result = applyMergedEditsToFlow(baseFlow, [
      { boxPath: [0, 1], content: "link answer", authorId: "bob", timestampMs: 1000 },
    ]);

    expect(result.children[0].children[1].content).toBe("link answer");
    expect(result.children[0].children[0].content).toBe("");
  });

  it("applies multiple edits across boxes in one pass", () => {
    const result = applyMergedEditsToFlow(baseFlow, [
      { boxPath: [1], content: "box one", authorId: "alice", timestampMs: 1000 },
      { boxPath: [0, 0], content: "box nested", authorId: "bob", timestampMs: 2000 },
    ]);

    expect(result.children[1].content).toBe("box one");
    expect(result.children[0].children[0].content).toBe("box nested");
  });

  it("skips an edit whose boxPath no longer resolves to a box", () => {
    const result = applyMergedEditsToFlow(baseFlow, [
      { boxPath: [99], content: "orphaned", authorId: "alice", timestampMs: 1000 },
    ]);

    expect(result.children).toHaveLength(baseFlow.children.length);
    expect(result.children.every((box) => box.content === "")).toBe(true);
  });

  it("skips an edit with an empty boxPath rather than throwing", () => {
    const result = applyMergedEditsToFlow(baseFlow, [
      { boxPath: [], content: "orphaned", authorId: "alice", timestampMs: 1000 },
    ]);

    expect(result.children.every((box) => box.content === "")).toBe(true);
  });
});

describe("buildSharedFlowSyncSummaryText", () => {
  it("reports no edits when nothing was merged or conflicted", () => {
    const result: MergeFlowEditsResult = { merged: [], conflicts: [] };
    expect(buildSharedFlowSyncSummaryText(result)).toBe("No edits to merge.");
  });

  it("reports a singular box count for one merged edit", () => {
    const result: MergeFlowEditsResult = {
      merged: [{ boxPath: [0], content: "x", authorId: "alice", timestampMs: 1000 }],
      conflicts: [],
    };
    expect(buildSharedFlowSyncSummaryText(result)).toBe("1 box updated.");
  });

  it("reports a plural box count for multiple merged edits", () => {
    const result: MergeFlowEditsResult = {
      merged: [
        { boxPath: [0], content: "x", authorId: "alice", timestampMs: 1000 },
        { boxPath: [1], content: "y", authorId: "bob", timestampMs: 1000 },
      ],
      conflicts: [],
    };
    expect(buildSharedFlowSyncSummaryText(result)).toBe("2 boxes updated.");
  });

  it("lists conflicts with their contending authors", () => {
    const editA = edit({ id: "a", authorId: "alice", content: "a's take", timestampMs: 1000 });
    const editB = edit({ id: "b", authorId: "bob", content: "b's take", timestampMs: 1500 });
    const result: MergeFlowEditsResult = {
      merged: [],
      conflicts: [{ boxPath: [0, 1], edits: [editA, editB] }],
    };

    expect(buildSharedFlowSyncSummaryText(result)).toBe(
      "No edits to merge.\n1 conflict needs review:\n- Box [0,1]: alice vs bob",
    );
  });

  it("uses plural conflict wording for multiple conflicts", () => {
    const result: MergeFlowEditsResult = {
      merged: [],
      conflicts: [
        { boxPath: [0], edits: [edit({ id: "a" }), edit({ id: "b", authorId: "bob" })] },
        { boxPath: [1], edits: [edit({ id: "c" }), edit({ id: "d", authorId: "carol" })] },
      ],
    };

    expect(buildSharedFlowSyncSummaryText(result)).toContain("2 conflicts need review:");
  });
});
