import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteWhiteboardNote,
  listWhiteboardNotes,
  listWhiteboardNotesForTopic,
  saveWhiteboardNote,
  updatePersistedWhiteboardNotePosition,
} from "../src/state/sprintWhiteboard";
import type { WhiteboardNote } from "../src/lib/team-collaboration-mode";

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

const SOLVENCY_NOTE: WhiteboardNote = {
  id: "note-1",
  topic: "solvency",
  text: "What if the plan solves via a different mechanism?",
  color: "yellow",
  authorId: "alice",
  createdAt: 100,
  x: 4,
  y: 4,
};
const TOPICALITY_NOTE: WhiteboardNote = {
  id: "note-2",
  topic: "topicality",
  text: "We should read a we-meet",
  color: "blue",
  authorId: "bob",
  createdAt: 200,
  x: 26,
  y: 4,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listWhiteboardNotes", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listWhiteboardNotes()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("sprintWhiteboardNotes", "{not json");
    expect(listWhiteboardNotes()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("sprintWhiteboardNotes", JSON.stringify({ not: "an array" }));
    expect(listWhiteboardNotes()).toEqual([]);
  });

  it("lists every saved note across topics", () => {
    saveWhiteboardNote(SOLVENCY_NOTE);
    saveWhiteboardNote(TOPICALITY_NOTE);
    expect(listWhiteboardNotes()).toEqual([SOLVENCY_NOTE, TOPICALITY_NOTE]);
  });
});

describe("listWhiteboardNotesForTopic", () => {
  it("returns only notes for the given topic, oldest first", () => {
    const laterSolvencyNote: WhiteboardNote = { ...SOLVENCY_NOTE, id: "note-3", createdAt: 300 };
    saveWhiteboardNote(laterSolvencyNote);
    saveWhiteboardNote(SOLVENCY_NOTE);
    saveWhiteboardNote(TOPICALITY_NOTE);

    expect(listWhiteboardNotesForTopic("solvency")).toEqual([SOLVENCY_NOTE, laterSolvencyNote]);
    expect(listWhiteboardNotesForTopic("topicality")).toEqual([TOPICALITY_NOTE]);
  });

  it("returns an empty list for a topic with no notes", () => {
    saveWhiteboardNote(SOLVENCY_NOTE);
    expect(listWhiteboardNotesForTopic("inherency")).toEqual([]);
  });
});

describe("saveWhiteboardNote", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveWhiteboardNote(SOLVENCY_NOTE);
    const edited: WhiteboardNote = { ...SOLVENCY_NOTE, text: "Edited text" };
    saveWhiteboardNote(edited);

    expect(listWhiteboardNotes()).toEqual([edited]);
  });
});

describe("deleteWhiteboardNote", () => {
  it("removes a stored note by id", () => {
    saveWhiteboardNote(SOLVENCY_NOTE);
    saveWhiteboardNote(TOPICALITY_NOTE);
    deleteWhiteboardNote("note-1");

    expect(listWhiteboardNotes()).toEqual([TOPICALITY_NOTE]);
  });

  it("is a no-op when the id isn't stored", () => {
    saveWhiteboardNote(TOPICALITY_NOTE);
    deleteWhiteboardNote("missing");
    expect(listWhiteboardNotes()).toEqual([TOPICALITY_NOTE]);
  });
});

describe("updatePersistedWhiteboardNotePosition", () => {
  it("persists a note's new x/y position", () => {
    saveWhiteboardNote(SOLVENCY_NOTE);
    saveWhiteboardNote(TOPICALITY_NOTE);
    updatePersistedWhiteboardNotePosition("note-1", 60, 75);

    expect(listWhiteboardNotes()).toEqual([{ ...SOLVENCY_NOTE, x: 60, y: 75 }, TOPICALITY_NOTE]);
  });

  it("clamps the position into the 0-100 range", () => {
    saveWhiteboardNote(SOLVENCY_NOTE);
    updatePersistedWhiteboardNotePosition("note-1", -20, 140);

    expect(listWhiteboardNotes()).toEqual([{ ...SOLVENCY_NOTE, x: 0, y: 100 }]);
  });

  it("is a no-op when the id isn't stored", () => {
    saveWhiteboardNote(SOLVENCY_NOTE);
    updatePersistedWhiteboardNotePosition("missing", 60, 75);
    expect(listWhiteboardNotes()).toEqual([SOLVENCY_NOTE]);
  });
});
