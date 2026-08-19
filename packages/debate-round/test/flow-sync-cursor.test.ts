import { describe, expect, it } from "vitest";
import { advanceSyncCursor } from "../src/flow/flow-sync-cursor";
import type { FlowEdit } from "../src/flow/shared-flow-sync";

function edit(timestampMs: number, id = `edit-${timestampMs}`): FlowEdit {
  return { id, flowId: 1, boxPath: [0], authorId: "alice", content: "x", timestampMs };
}

describe("advanceSyncCursor", () => {
  it("returns the current cursor unchanged when nothing was pulled", () => {
    expect(advanceSyncCursor(500, [])).toBe(500);
  });

  it("advances to the latest pulled edit's timestamp", () => {
    expect(advanceSyncCursor(0, [edit(100), edit(300), edit(200)])).toBe(300);
  });

  it("never moves backwards past the current cursor", () => {
    expect(advanceSyncCursor(1000, [edit(100), edit(500)])).toBe(1000);
  });

  it("mixes current and pulled correctly when pulled has a later max", () => {
    expect(advanceSyncCursor(250, [edit(100), edit(400)])).toBe(400);
  });
});
