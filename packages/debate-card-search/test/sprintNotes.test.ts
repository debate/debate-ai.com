import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteSprintNote,
  getSprintNote,
  listSprintNotes,
  listSprintNotesForTopic,
  saveSprintNote,
} from "../src/state/sprintNotes";
import type { SprintNote } from "../src/lib/team-collaboration-mode";

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

const SOLVENCY_NOTE: SprintNote = {
  id: "note-1",
  topic: "solvency",
  authorId: "alice",
  text: "Find a 2026 solvency card for the affirmative",
  status: "open",
  createdAt: 100,
  updatedAt: 100,
};
const TOPICALITY_NOTE: SprintNote = {
  id: "note-2",
  topic: "topicality",
  authorId: "bob",
  text: "Cover the substantially-limits shell",
  status: "needs-follow-up",
  createdAt: 200,
  updatedAt: 200,
  assignedToId: "carol",
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listSprintNotes", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listSprintNotes()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("sprintNotes", "{not json");
    expect(listSprintNotes()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("sprintNotes", JSON.stringify({ not: "an array" }));
    expect(listSprintNotes()).toEqual([]);
  });

  it("lists every saved note across topics", () => {
    saveSprintNote(SOLVENCY_NOTE);
    saveSprintNote(TOPICALITY_NOTE);
    expect(listSprintNotes()).toEqual([SOLVENCY_NOTE, TOPICALITY_NOTE]);
  });
});

describe("listSprintNotesForTopic", () => {
  it("returns only notes for the given topic, oldest first", () => {
    saveSprintNote(TOPICALITY_NOTE);
    saveSprintNote(SOLVENCY_NOTE);
    expect(listSprintNotesForTopic("solvency")).toEqual([SOLVENCY_NOTE]);
    expect(listSprintNotesForTopic("topicality")).toEqual([TOPICALITY_NOTE]);
  });

  it("returns an empty list for a topic with no notes", () => {
    saveSprintNote(SOLVENCY_NOTE);
    expect(listSprintNotesForTopic("inherency")).toEqual([]);
  });
});

describe("getSprintNote", () => {
  it("finds a saved note by id", () => {
    saveSprintNote(SOLVENCY_NOTE);
    expect(getSprintNote("note-1")).toEqual(SOLVENCY_NOTE);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getSprintNote("missing")).toBeUndefined();
  });
});

describe("saveSprintNote", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveSprintNote(SOLVENCY_NOTE);
    const covered: SprintNote = { ...SOLVENCY_NOTE, status: "covered", updatedAt: 150 };
    saveSprintNote(covered);

    expect(listSprintNotes()).toEqual([covered]);
    expect(getSprintNote("note-1")).toEqual(covered);
  });
});

describe("deleteSprintNote", () => {
  it("removes a stored note by id", () => {
    saveSprintNote(SOLVENCY_NOTE);
    saveSprintNote(TOPICALITY_NOTE);
    deleteSprintNote("note-1");

    expect(listSprintNotes()).toEqual([TOPICALITY_NOTE]);
    expect(getSprintNote("note-1")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    saveSprintNote(TOPICALITY_NOTE);
    deleteSprintNote("missing");
    expect(listSprintNotes()).toEqual([TOPICALITY_NOTE]);
  });
});
