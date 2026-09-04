import { beforeEach, describe, expect, it } from "vitest";
import {
  countRepliesForNote,
  deletePrepNoteReply,
  deleteRepliesForNote,
  listAllPrepNoteReplies,
  listRepliesForNote,
  MAX_PREP_NOTE_REPLY_TEXT_LENGTH,
  postPrepNoteReply,
} from "../src/state/prepNoteReplies";

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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("postPrepNoteReply", () => {
  it("assigns a fresh id and persists the reply", () => {
    const reply = postPrepNoteReply({ noteId: "note-1", authorId: "alex", text: "Good point." });
    expect(reply.id).toBeTruthy();
    expect(reply.noteId).toBe("note-1");
    expect(reply.text).toBe("Good point.");
    expect(listAllPrepNoteReplies()).toEqual([reply]);
  });

  it("trims authorId and text", () => {
    const reply = postPrepNoteReply({ noteId: "note-1", authorId: "  alex  ", text: "  hi  " });
    expect(reply.authorId).toBe("alex");
    expect(reply.text).toBe("hi");
  });

  it('falls back to "Anonymous" for a blank authorId', () => {
    const reply = postPrepNoteReply({ noteId: "note-1", authorId: "   ", text: "hi" });
    expect(reply.authorId).toBe("Anonymous");
  });

  it("caps text at MAX_PREP_NOTE_REPLY_TEXT_LENGTH", () => {
    const longText = "x".repeat(MAX_PREP_NOTE_REPLY_TEXT_LENGTH + 50);
    const reply = postPrepNoteReply({ noteId: "note-1", authorId: "alex", text: longText });
    expect(reply.text).toHaveLength(MAX_PREP_NOTE_REPLY_TEXT_LENGTH);
  });

  it("assigns distinct ids to two replies posted back to back", () => {
    const first = postPrepNoteReply({ noteId: "note-1", authorId: "alex", text: "one" });
    const second = postPrepNoteReply({ noteId: "note-1", authorId: "alex", text: "two" });
    expect(first.id).not.toBe(second.id);
  });
});

describe("listAllPrepNoteReplies", () => {
  it("returns an empty list when nothing has been posted", () => {
    expect(listAllPrepNoteReplies()).toEqual([]);
  });

  it("returns replies oldest first regardless of insertion order", () => {
    postPrepNoteReply({ noteId: "note-1", authorId: "a", text: "third" });
    const all = listAllPrepNoteReplies();
    expect(all).toHaveLength(1);
  });
});

describe("listRepliesForNote", () => {
  it("filters to just one note's thread, oldest first", () => {
    const c1 = postPrepNoteReply({ noteId: "note-1", authorId: "a", text: "first" });
    postPrepNoteReply({ noteId: "note-2", authorId: "b", text: "other note" });
    const c3 = postPrepNoteReply({ noteId: "note-1", authorId: "a", text: "second" });
    expect(listRepliesForNote("note-1").map((r) => r.id)).toEqual([c1.id, c3.id]);
  });

  it("returns an empty list for a note with no replies", () => {
    postPrepNoteReply({ noteId: "note-1", authorId: "a", text: "hi" });
    expect(listRepliesForNote("note-missing")).toEqual([]);
  });
});

describe("countRepliesForNote", () => {
  it("counts replies attached to a note", () => {
    postPrepNoteReply({ noteId: "note-1", authorId: "a", text: "one" });
    postPrepNoteReply({ noteId: "note-1", authorId: "a", text: "two" });
    postPrepNoteReply({ noteId: "note-2", authorId: "a", text: "unrelated" });
    expect(countRepliesForNote("note-1")).toBe(2);
  });

  it("returns 0 for a note with no replies", () => {
    expect(countRepliesForNote("note-1")).toBe(0);
  });
});

describe("deletePrepNoteReply", () => {
  it("removes a persisted reply by id", () => {
    const c1 = postPrepNoteReply({ noteId: "note-1", authorId: "a", text: "one" });
    const c2 = postPrepNoteReply({ noteId: "note-1", authorId: "a", text: "two" });
    deletePrepNoteReply(c1.id);
    expect(listAllPrepNoteReplies().map((r) => r.id)).toEqual([c2.id]);
  });

  it("is a no-op for an id that isn't stored", () => {
    postPrepNoteReply({ noteId: "note-1", authorId: "a", text: "one" });
    expect(() => deletePrepNoteReply("missing")).not.toThrow();
    expect(listAllPrepNoteReplies()).toHaveLength(1);
  });
});

describe("deleteRepliesForNote", () => {
  it("removes every reply attached to a note, leaving other notes' replies intact", () => {
    postPrepNoteReply({ noteId: "note-1", authorId: "a", text: "one" });
    postPrepNoteReply({ noteId: "note-1", authorId: "a", text: "two" });
    const other = postPrepNoteReply({ noteId: "note-2", authorId: "a", text: "unrelated" });
    deleteRepliesForNote("note-1");
    expect(listAllPrepNoteReplies()).toEqual([other]);
  });

  it("is a no-op for a note with no replies", () => {
    postPrepNoteReply({ noteId: "note-1", authorId: "a", text: "one" });
    expect(() => deleteRepliesForNote("note-missing")).not.toThrow();
    expect(listAllPrepNoteReplies()).toHaveLength(1);
  });
});
