import { beforeEach, describe, expect, it } from "vitest";
import {
  addRoundPrepNote,
  assignPersistedPrepNote,
  buildPrepNotesPanelView,
  deletePrepNote,
  getPrepNote,
  listPrepNotes,
  listPrepNotesForBox,
  listPrepNotesForFlow,
  listPrepNotesForRound,
  nextPrepNoteStatus,
  savePrepNote,
  updatePersistedPrepNotePriority,
  updatePersistedPrepNoteStatus,
} from "../src/state/prepNotes";
import { listNotificationsForRecipient } from "../src/state/prepNoteNotifications";
import { listRepliesForNote, postPrepNoteReply } from "../src/state/prepNoteReplies";
import type { PrepNote } from "debate-round/src/flow/strategy-sync-notes";

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

describe("listPrepNotesForBox", () => {
  it("returns only notes for the given flow and box path, oldest first", () => {
    const sameBoxOlder: PrepNote = { ...OPEN_NOTE, id: "note-3", createdAt: 50 };
    const differentBoxSameFlow: PrepNote = { ...OPEN_NOTE, id: "note-4", boxPath: [0, 2] };
    savePrepNote(OTHER_FLOW_NOTE);
    savePrepNote(OPEN_NOTE);
    savePrepNote(sameBoxOlder);
    savePrepNote(differentBoxSameFlow);

    expect(listPrepNotesForBox(1, [0, 1])).toEqual([sameBoxOlder, OPEN_NOTE]);
  });

  it("returns an empty list for a box with no notes", () => {
    savePrepNote(OPEN_NOTE);
    expect(listPrepNotesForBox(1, [9, 9])).toEqual([]);
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

  it("also deletes every reply posted to the note's thread", () => {
    savePrepNote(OPEN_NOTE);
    savePrepNote(OTHER_FLOW_NOTE);
    postPrepNoteReply({ noteId: "note-1", authorId: "alex", text: "reply on deleted note" });
    const keptReply = postPrepNoteReply({ noteId: "note-2", authorId: "alex", text: "reply on kept note" });

    deletePrepNote("note-1");

    expect(listRepliesForNote("note-1")).toEqual([]);
    expect(listRepliesForNote("note-2")).toEqual([keptReply]);
  });
});

describe("updatePersistedPrepNoteStatus", () => {
  it("applies the status change and persists it", () => {
    savePrepNote(OPEN_NOTE);
    const updated = updatePersistedPrepNoteStatus("note-1", "covered", 150);

    expect(updated).toEqual({ ...OPEN_NOTE, status: "covered", updatedAt: 150 });
    expect(getPrepNote("note-1")).toEqual({ ...OPEN_NOTE, status: "covered", updatedAt: 150 });
  });

  it("returns undefined and leaves storage untouched when the id isn't stored", () => {
    savePrepNote(OTHER_FLOW_NOTE);
    const updated = updatePersistedPrepNoteStatus("missing", "covered", 150);

    expect(updated).toBeUndefined();
    expect(listPrepNotes()).toEqual([OTHER_FLOW_NOTE]);
  });
});

describe("updatePersistedPrepNotePriority", () => {
  it("flags the note high priority and persists it", () => {
    savePrepNote(OPEN_NOTE);
    const updated = updatePersistedPrepNotePriority("note-1", "high", 150);

    expect(updated).toEqual({ ...OPEN_NOTE, priority: "high", updatedAt: 150 });
    expect(getPrepNote("note-1")).toEqual({ ...OPEN_NOTE, priority: "high", updatedAt: 150 });
  });

  it("clears the priority flag and persists it", () => {
    const flagged: PrepNote = { ...OPEN_NOTE, priority: "high" };
    savePrepNote(flagged);
    const updated = updatePersistedPrepNotePriority("note-1", "normal", 200);

    expect(updated).toEqual({ ...OPEN_NOTE, updatedAt: 200 });
    expect(updated?.priority).toBeUndefined();
    expect(getPrepNote("note-1")).toEqual({ ...OPEN_NOTE, updatedAt: 200 });
  });

  it("returns undefined and leaves storage untouched when the id isn't stored", () => {
    savePrepNote(OTHER_FLOW_NOTE);
    const updated = updatePersistedPrepNotePriority("missing", "high", 150);

    expect(updated).toBeUndefined();
    expect(listPrepNotes()).toEqual([OTHER_FLOW_NOTE]);
  });
});

describe("assignPersistedPrepNote", () => {
  it("assigns the note to a teammate and persists it", () => {
    savePrepNote(OPEN_NOTE);
    const updated = assignPersistedPrepNote("note-1", "carol", 150);

    expect(updated).toEqual({ ...OPEN_NOTE, assignedToId: "carol", updatedAt: 150 });
    expect(getPrepNote("note-1")).toEqual({ ...OPEN_NOTE, assignedToId: "carol", updatedAt: 150 });
  });

  it("records a notification for the new assignee", () => {
    savePrepNote(OPEN_NOTE);
    assignPersistedPrepNote("note-1", "carol", 150);

    const notifications = listNotificationsForRecipient("carol");
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toEqual({
      id: "note-1-notif-150",
      recipientId: "carol",
      prepNoteId: "note-1",
      noteText: OPEN_NOTE.text,
      noteAuthorId: OPEN_NOTE.authorId,
      createdAt: 150,
      read: false,
    });
  });

  it("unassigns the note when assignedToId is null and persists it, without recording a notification", () => {
    const assigned: PrepNote = { ...OPEN_NOTE, assignedToId: "carol" };
    savePrepNote(assigned);
    const updated = assignPersistedPrepNote("note-1", null, 200);

    expect(updated).toEqual({ ...OPEN_NOTE, updatedAt: 200 });
    expect(updated?.assignedToId).toBeUndefined();
    expect(getPrepNote("note-1")).toEqual({ ...OPEN_NOTE, updatedAt: 200 });
    expect(listNotificationsForRecipient("carol")).toEqual([]);
  });

  it("returns undefined and leaves storage untouched when the id isn't stored", () => {
    savePrepNote(OTHER_FLOW_NOTE);
    const updated = assignPersistedPrepNote("missing", "carol", 150);

    expect(updated).toBeUndefined();
    expect(listPrepNotes()).toEqual([OTHER_FLOW_NOTE]);
    expect(listNotificationsForRecipient("carol")).toEqual([]);
  });
});

describe("nextPrepNoteStatus", () => {
  it("cycles open -> covered -> needs-follow-up -> open", () => {
    expect(nextPrepNoteStatus("open")).toBe("covered");
    expect(nextPrepNoteStatus("covered")).toBe("needs-follow-up");
    expect(nextPrepNoteStatus("needs-follow-up")).toBe("open");
  });
});

describe("buildPrepNotesPanelView", () => {
  it("returns every status group, empty, when nothing is stored", () => {
    expect(buildPrepNotesPanelView()).toEqual([
      { status: "needs-follow-up", notes: [] },
      { status: "open", notes: [] },
      { status: "covered", notes: [] },
    ]);
  });

  it("groups stored notes by status, needs-follow-up first, each group oldest first", () => {
    const secondOpenNote: PrepNote = { ...OPEN_NOTE, id: "note-3", createdAt: 50 };
    savePrepNote(OPEN_NOTE);
    savePrepNote(OTHER_FLOW_NOTE);
    savePrepNote(secondOpenNote);

    expect(buildPrepNotesPanelView()).toEqual([
      { status: "needs-follow-up", notes: [OTHER_FLOW_NOTE] },
      { status: "open", notes: [secondOpenNote, OPEN_NOTE] },
      { status: "covered", notes: [] },
    ]);
  });

  it("reflects a status update made through updatePersistedPrepNoteStatus", () => {
    savePrepNote(OPEN_NOTE);
    updatePersistedPrepNoteStatus("note-1", "covered", 150);

    expect(buildPrepNotesPanelView()).toEqual([
      { status: "needs-follow-up", notes: [] },
      { status: "open", notes: [] },
      { status: "covered", notes: [{ ...OPEN_NOTE, status: "covered", updatedAt: 150 }] },
    ]);
  });

  it("sorts high-priority notes ahead of normal-priority notes within a status group", () => {
    const olderOpenNote: PrepNote = { ...OPEN_NOTE, id: "note-3", createdAt: 50 };
    const flaggedNewerOpenNote: PrepNote = { ...OPEN_NOTE, id: "note-4", createdAt: 300, priority: "high" };
    savePrepNote(olderOpenNote);
    savePrepNote(OPEN_NOTE);
    savePrepNote(flaggedNewerOpenNote);

    const [, openGroup] = buildPrepNotesPanelView();
    expect(openGroup.notes.map((n) => n.id)).toEqual(["note-4", "note-3", "note-1"]);
  });
});

describe("listPrepNotesForRound", () => {
  it("returns an empty list when nothing is stored for that round", () => {
    savePrepNote(OPEN_NOTE);
    expect(listPrepNotesForRound("round-1")).toEqual([]);
  });

  it("returns only notes anchored to the given round, oldest first", () => {
    savePrepNote(OPEN_NOTE);
    const roundNoteA = addRoundPrepNote({ roundId: "round-1", authorId: "alice", text: "later note" });
    const roundNoteB = addRoundPrepNote({ roundId: "round-1", authorId: "bob", text: "earlier note" });
    addRoundPrepNote({ roundId: "round-2", authorId: "alice", text: "other round" });

    const ids = listPrepNotesForRound("round-1").map((n) => n.id);
    expect(new Set(ids)).toEqual(new Set([roundNoteA.id, roundNoteB.id]));
    expect(ids).not.toContain(OPEN_NOTE.id);
  });
});

describe("addRoundPrepNote", () => {
  it("persists a round-anchored note and returns it", () => {
    const note = addRoundPrepNote({ roundId: "round-1", authorId: "alice", text: "strong on framework" });

    expect(note.roundId).toBe("round-1");
    expect(note.authorId).toBe("alice");
    expect(note.text).toBe("strong on framework");
    expect(note.status).toBe("open");
    expect("flowId" in note).toBe(false);
    expect(getPrepNote(note.id)).toEqual(note);
  });

  it("generates a distinct id for each note, even for the same round", () => {
    const a = addRoundPrepNote({ roundId: "round-1", authorId: "alice", text: "note a" });
    const b = addRoundPrepNote({ roundId: "round-1", authorId: "alice", text: "note b" });

    expect(a.id).not.toBe(b.id);
    expect(listPrepNotesForRound("round-1")).toHaveLength(2);
  });

  it("throws for blank text, without persisting anything", () => {
    expect(() => addRoundPrepNote({ roundId: "round-1", authorId: "alice", text: "   " })).toThrow(/text/);
    expect(listPrepNotesForRound("round-1")).toEqual([]);
  });
});
