import { beforeEach, describe, expect, it } from "vitest";
import {
  clearFlowEditsForFlow,
  deleteFlowEdit,
  listFlowEdits,
  listFlowEditsForFlow,
  saveFlowEdit,
} from "../src/state/flowEdits";
import type { FlowEdit } from "../src/flow/shared-flow-sync";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const EARLY_EDIT: FlowEdit = {
  id: "edit-1",
  flowId: 1,
  boxPath: [0, 1],
  authorId: "alice",
  content: "Emissions cause extinction",
  timestampMs: 1_000,
};
const LATE_EDIT: FlowEdit = {
  id: "edit-2",
  flowId: 1,
  boxPath: [0, 2],
  authorId: "bob",
  content: "No warming impact",
  timestampMs: 5_000,
};
const OTHER_FLOW_EDIT: FlowEdit = {
  id: "edit-3",
  flowId: 2,
  boxPath: [0],
  authorId: "carol",
  content: "Adaptation solves",
  timestampMs: 2_000,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listFlowEdits", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listFlowEdits()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("flowEdits", "{not json");
    expect(listFlowEdits()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("flowEdits", JSON.stringify({ not: "an array" }));
    expect(listFlowEdits()).toEqual([]);
  });

  it("lists every saved edit across flows, oldest first", () => {
    saveFlowEdit(LATE_EDIT);
    saveFlowEdit(EARLY_EDIT);
    saveFlowEdit(OTHER_FLOW_EDIT);

    expect(listFlowEdits().map((e) => e.id)).toEqual(["edit-1", "edit-3", "edit-2"]);
  });
});

describe("listFlowEditsForFlow", () => {
  it("returns only edits for the given flow, oldest first", () => {
    saveFlowEdit(LATE_EDIT);
    saveFlowEdit(EARLY_EDIT);
    saveFlowEdit(OTHER_FLOW_EDIT);

    expect(listFlowEditsForFlow(1)).toEqual([EARLY_EDIT, LATE_EDIT]);
    expect(listFlowEditsForFlow(2)).toEqual([OTHER_FLOW_EDIT]);
  });

  it("returns an empty list for a flow with no edits", () => {
    saveFlowEdit(EARLY_EDIT);
    expect(listFlowEditsForFlow(999)).toEqual([]);
  });
});

describe("saveFlowEdit", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveFlowEdit(EARLY_EDIT);
    const edited: FlowEdit = { ...EARLY_EDIT, content: "Updated content" };
    saveFlowEdit(edited);

    expect(listFlowEdits()).toEqual([edited]);
  });
});

describe("deleteFlowEdit", () => {
  it("removes a stored edit by id", () => {
    saveFlowEdit(EARLY_EDIT);
    saveFlowEdit(OTHER_FLOW_EDIT);
    deleteFlowEdit("edit-1");

    expect(listFlowEdits()).toEqual([OTHER_FLOW_EDIT]);
  });

  it("is a no-op when the id isn't stored", () => {
    saveFlowEdit(OTHER_FLOW_EDIT);
    deleteFlowEdit("missing");
    expect(listFlowEdits()).toEqual([OTHER_FLOW_EDIT]);
  });
});

describe("clearFlowEditsForFlow", () => {
  it("removes every edit belonging to the given flow, leaving other flows untouched", () => {
    saveFlowEdit(EARLY_EDIT);
    saveFlowEdit(LATE_EDIT);
    saveFlowEdit(OTHER_FLOW_EDIT);

    clearFlowEditsForFlow(1);

    expect(listFlowEdits()).toEqual([OTHER_FLOW_EDIT]);
  });

  it("is a no-op when the flow has no edits", () => {
    saveFlowEdit(OTHER_FLOW_EDIT);
    clearFlowEditsForFlow(999);
    expect(listFlowEdits()).toEqual([OTHER_FLOW_EDIT]);
  });
});
