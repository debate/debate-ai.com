import { beforeEach, describe, expect, it } from "vitest";
import {
  deletePrepNote,
  getPrepNote,
  listPrepNotes,
  listPrepNotesForFlow,
  savePrepNote,
} from "../src/state/prepNotes";
import type { PrepNote } from "../src/flow/strategy-sync-notes";

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

const OPEN_NOTE: PrepNote = {
  id: "note-1",
  flowId: 1,
  boxPath: [0, 1],
  authorId: "alice",
  text: "Answer the solvency turn",
  status: "open",
  createdAt: 100,
  updatedAt: 100,
};
const OTHER_FLOW_NOTE: PrepNote = {
  id: "note-2",
  flowId: 2,
  boxPath: [0],
  authorId: "bob",
  text: "Cover the topicality shell",
  status: "needs-follow-up",
  createdAt: 200,
  updatedAt: 200,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listPrepNotes", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listPrepNotes()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("prepNotes", "{not json");
    expect(listPrepNotes()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("prepNotes", JSON.stringify({ not: "an array" }));
    expect(listPrepNotes()).toEqual([]);
  });

  it("lists every saved note across flows", () => {
    savePrepNote(OPEN_NOTE);
    savePrepNote(OTHER_FLOW_NOTE);
    expect(listPrepNotes()).toEqual([OPEN_NOTE, OTHER_FLOW_NOTE]);
  });
});

describe("listPrepNotesForFlow", () => {
  it("returns only notes for the given flow, oldest first", () => {
    savePrepNote(OTHER_FLOW_NOTE);
    savePrepNote(OPEN_NOTE);
    expect(listPrepNotesForFlow(1)).toEqual([OPEN_NOTE]);
    expect(listPrepNotesForFlow(2)).toEqual([OTHER_FLOW_NOTE]);
  });

  it("returns an empty list for a flow with no notes", () => {
    savePrepNote(OPEN_NOTE);
    expect(listPrepNotesForFlow(999)).toEqual([]);
  });
});

describe("getPrepNote", () => {
  it("finds a saved note by id", () => {
    savePrepNote(OPEN_NOTE);
    expect(getPrepNote("note-1")).toEqual(OPEN_NOTE);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getPrepNote("missing")).toBeUndefined();
  });
});

describe("savePrepNote", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    savePrepNote(OPEN_NOTE);
    const covered: PrepNote = { ...OPEN_NOTE, status: "covered", updatedAt: 150 };
    savePrepNote(covered);

    expect(listPrepNotes()).toEqual([covered]);
    expect(getPrepNote("note-1")).toEqual(covered);
  });
});

describe("deletePrepNote", () => {
  it("removes a stored note by id", () => {
    savePrepNote(OPEN_NOTE);
    savePrepNote(OTHER_FLOW_NOTE);
    deletePrepNote("note-1");

    expect(listPrepNotes()).toEqual([OTHER_FLOW_NOTE]);
    expect(getPrepNote("note-1")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    savePrepNote(OTHER_FLOW_NOTE);
    deletePrepNote("missing");
    expect(listPrepNotes()).toEqual([OTHER_FLOW_NOTE]);
  });
});
