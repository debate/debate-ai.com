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
  it("updates and persists the status of a stored note", () => {
    saveSprintNote(SOLVENCY_NOTE);
    const updated = updatePersistedSprintNoteStatus("note-1", "covered", 500);

    expect(updated).toEqual({ ...SOLVENCY_NOTE, status: "covered", updatedAt: 500 });
    expect(getSprintNote("note-1")).toEqual({ ...SOLVENCY_NOTE, status: "covered", updatedAt: 500 });
  });

  it("returns undefined and leaves storage untouched when the id isn't stored", () => {
    saveSprintNote(SOLVENCY_NOTE);
    const updated = updatePersistedSprintNoteStatus("missing", "covered", 500);

    expect(updated).toBeUndefined();
    expect(listSprintNotes()).toEqual([SOLVENCY_NOTE]);
  });
});

describe("assignPersistedSprintNote", () => {
  it("assigns and persists an assignee on a stored note", () => {
    saveSprintNote(SOLVENCY_NOTE);
    const updated = assignPersistedSprintNote("note-1", "dana", 600);

    expect(updated).toEqual({ ...SOLVENCY_NOTE, assignedToId: "dana", updatedAt: 600 });
    expect(getSprintNote("note-1")).toEqual({ ...SOLVENCY_NOTE, assignedToId: "dana", updatedAt: 600 });
  });

  it("unassigns (removes assignedToId) when passed null", () => {
    saveSprintNote(TOPICALITY_NOTE);
    const updated = assignPersistedSprintNote("note-2", null, 700);

    expect(updated?.assignedToId).toBeUndefined();
    expect(getSprintNote("note-2")?.assignedToId).toBeUndefined();
  });

  it("returns undefined and leaves storage untouched when the id isn't stored", () => {
    saveSprintNote(SOLVENCY_NOTE);
    const updated = assignPersistedSprintNote("missing", "dana", 600);

    expect(updated).toBeUndefined();
    expect(listSprintNotes()).toEqual([SOLVENCY_NOTE]);
  });
});

describe("buildSprintNotesPanelView", () => {
  it("returns every status group, empty, when nothing is stored", () => {
    expect(buildSprintNotesPanelView()).toEqual([
      { status: "needs-follow-up", notes: [] },
      { status: "open", notes: [] },
      { status: "covered", notes: [] },
    ]);
  });

  it("groups every persisted note by status, needs-follow-up first", () => {
    saveSprintNote(SOLVENCY_NOTE);
    saveSprintNote(TOPICALITY_NOTE);

    expect(buildSprintNotesPanelView()).toEqual([
      { status: "needs-follow-up", notes: [TOPICALITY_NOTE] },
      { status: "open", notes: [SOLVENCY_NOTE] },
      { status: "covered", notes: [] },
    ]);
  });

  it("sorts each group's notes oldest first without mutating the underlying stored order", () => {
    const laterNote: SprintNote = { ...SOLVENCY_NOTE, id: "note-3", createdAt: 50 };
    saveSprintNote(SOLVENCY_NOTE);
    saveSprintNote(laterNote);

    expect(buildSprintNotesPanelView()).toEqual([
      { status: "needs-follow-up", notes: [] },
      { status: "open", notes: [laterNote, SOLVENCY_NOTE] },
      { status: "covered", notes: [] },
    ]);
    expect(listSprintNotes()).toEqual([SOLVENCY_NOTE, laterNote]);
  });
});

describe("nextSprintNoteStatus", () => {
  it("cycles open -> covered -> needs-follow-up -> open", () => {
    expect(nextSprintNoteStatus("open")).toBe("covered");
    expect(nextSprintNoteStatus("covered")).toBe("needs-follow-up");
    expect(nextSprintNoteStatus("needs-follow-up")).toBe("open");
  });
});
