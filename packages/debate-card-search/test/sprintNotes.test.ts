import { beforeEach, describe, expect, it } from "vitest";
import {
  assignPersistedSprintNote,
  buildSprintNotesPanelView,
  deleteSprintNote,
  getSprintNote,
  listSprintNotes,
  listSprintNotesForTopic,
  nextSprintNoteStatus,
  saveSprintNote,
  updatePersistedSprintNoteStatus,
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

describe("updatePersistedSprintNoteStatus", () => {
  it("applies the status change and persists it", () => {
    saveSprintNote(SOLVENCY_NOTE);
    const updated = updatePersistedSprintNoteStatus("note-1", "covered", 150);

    expect(updated).toEqual({ ...SOLVENCY_NOTE, status: "covered", updatedAt: 150 });
    expect(getSprintNote("note-1")).toEqual({ ...SOLVENCY_NOTE, status: "covered", updatedAt: 150 });
  });

  it("returns undefined and leaves storage untouched when the id isn't stored", () => {
    saveSprintNote(TOPICALITY_NOTE);
    const updated = updatePersistedSprintNoteStatus("missing", "covered", 150);

    expect(updated).toBeUndefined();
    expect(listSprintNotes()).toEqual([TOPICALITY_NOTE]);
  });
});

describe("assignPersistedSprintNote", () => {
  it("assigns the note to a teammate and persists it", () => {
    saveSprintNote(SOLVENCY_NOTE);
    const updated = assignPersistedSprintNote("note-1", "dave", 150);

    expect(updated).toEqual({ ...SOLVENCY_NOTE, assignedToId: "dave", updatedAt: 150 });
    expect(getSprintNote("note-1")).toEqual({ ...SOLVENCY_NOTE, assignedToId: "dave", updatedAt: 150 });
  });

  it("unassigns the note when assignedToId is null and persists it", () => {
    saveSprintNote(TOPICALITY_NOTE);
    const updated = assignPersistedSprintNote("note-2", null, 250);

    expect(updated).toEqual({ ...TOPICALITY_NOTE, updatedAt: 250, assignedToId: undefined });
    expect(updated?.assignedToId).toBeUndefined();
    expect(getSprintNote("note-2")).toEqual({ ...TOPICALITY_NOTE, updatedAt: 250, assignedToId: undefined });
  });

  it("returns undefined and leaves storage untouched when the id isn't stored", () => {
    saveSprintNote(SOLVENCY_NOTE);
    const updated = assignPersistedSprintNote("missing", "dave", 150);

    expect(updated).toBeUndefined();
    expect(listSprintNotes()).toEqual([SOLVENCY_NOTE]);
  });
});

describe("nextSprintNoteStatus", () => {
  it("cycles open -> covered -> needs-follow-up -> open", () => {
    expect(nextSprintNoteStatus("open")).toBe("covered");
    expect(nextSprintNoteStatus("covered")).toBe("needs-follow-up");
    expect(nextSprintNoteStatus("needs-follow-up")).toBe("open");
  });
});

describe("buildSprintNotesPanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildSprintNotesPanelView()).toEqual([]);
  });

  it("groups stored notes by topic, first-seen order, each group oldest first", () => {
    const secondSolvencyNote: SprintNote = { ...SOLVENCY_NOTE, id: "note-3", createdAt: 50 };
    saveSprintNote(TOPICALITY_NOTE);
    saveSprintNote(SOLVENCY_NOTE);
    saveSprintNote(secondSolvencyNote);

    expect(buildSprintNotesPanelView()).toEqual([
      { topic: "topicality", notes: [TOPICALITY_NOTE] },
      { topic: "solvency", notes: [secondSolvencyNote, SOLVENCY_NOTE] },
    ]);
  });

  it("reflects a status update made through updatePersistedSprintNoteStatus", () => {
    saveSprintNote(SOLVENCY_NOTE);
    updatePersistedSprintNoteStatus("note-1", "covered", 150);

    expect(buildSprintNotesPanelView()).toEqual([
      { topic: "solvency", notes: [{ ...SOLVENCY_NOTE, status: "covered", updatedAt: 150 }] },
    ]);
  });
});
