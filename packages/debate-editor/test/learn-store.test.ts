/**
 * @fileoverview The Learn annotation store — the per-user layer that never
 * enters the document.
 *
 * Its identity split is the thing to hold onto: content and schedule live per
 * `cardId`, while grounding lives per (`cardId`, `docId`). That is what lets a
 * debater copy a file and keep one logical card on one schedule, and it is
 * what makes Save As, forget-a-file and the review queue behave — each of
 * which is checked below against that split rather than against one code path.
 */

import { describe, expect, it, vi } from "vitest";
import { LearnStore, type CardDef, type Note, type AiThread } from "../src/editor/learn-store";
import { addDays, newSchedule } from "../src/editor/learn-scheduler";

const TODAY = "2026-03-14";
const NOW = "2026-03-14T12:00:00.000Z";

const card = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id,
  type: "qa",
  front: "What warms?",
  back: "Carbon",
  ...over,
});

const thread = (threadId: string, docId: string): AiThread => ({
  threadId,
  docId,
  anchor: null,
  comments: [{ author: "user", text: "why?", at: NOW }],
} as AiThread);

const note = (noteId: string, docId: string, over: Partial<Note> = {}): Note => ({
  noteId,
  docId,
  anchor: null,
  comments: [{ author: "user", text: "note", at: NOW }],
  ...over,
} as Note);

/** A store plus the JSON it was last asked to persist. */
function makeStore() {
  const persisted: string[] = [];
  const store = new LearnStore((json) => persisted.push(json));
  return { store, persisted };
}

describe("loadJson and toJson", () => {
  it("round-trips a store's whole contents", () => {
    const { store } = makeStore();
    store.upsertCard(card("c1"), TODAY);
    store.setAnchor("c1", "doc-1", null);
    store.createDeck("Impacts", "d1", NOW);

    const restored = new LearnStore();
    restored.loadJson(store.toJson());
    expect(restored.getCard("c1")).toEqual(card("c1"));
    expect(restored.anchorsForDoc("doc-1")).toHaveLength(1);
    expect(restored.listDecks().map((d) => d.name)).toEqual(["Impacts"]);
  });

  it("loads an empty store from nothing at all", () => {
    const { store } = makeStore();
    store.loadJson(null);
    expect(store.listCards()).toEqual([]);
    expect(store.listDecks()).toEqual([]);
  });

  it("loads an empty store rather than throwing on a corrupt blob", () => {
    const { store } = makeStore();
    expect(() => store.loadJson("{not json")).not.toThrow();
    expect(store.listCards()).toEqual([]);
  });

  it("fills in every collection a partial blob leaves out", () => {
    const { store } = makeStore();
    store.loadJson(JSON.stringify({ version: 1, cards: [card("c1")] }));
    expect(store.listCards()).toHaveLength(1);
    expect(store.listAnchors()).toEqual([]);
    expect(store.listDocs()).toEqual([]);
  });

  it("notifies subscribers without persisting, since a load is not a change", () => {
    const { store, persisted } = makeStore();
    const seen = vi.fn();
    store.subscribe(seen);
    store.loadJson(store.toJson());
    expect(seen).toHaveBeenCalled();
    expect(persisted).toHaveLength(0);
  });

  it("stamps the blob with its version", () => {
    const { store } = makeStore();
    expect(JSON.parse(store.toJson()).version).toBe(1);
  });
});

describe("subscribe", () => {
  it("calls a subscriber on every change", () => {
    const { store } = makeStore();
    const seen = vi.fn();
    store.subscribe(seen);
    store.upsertCard(card("c1"), TODAY);
    expect(seen).toHaveBeenCalledTimes(1);
    store.upsertCard(card("c2"), TODAY);
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("stops calling one that unsubscribed", () => {
    const { store } = makeStore();
    const seen = vi.fn();
    store.subscribe(seen)();
    store.upsertCard(card("c1"), TODAY);
    expect(seen).not.toHaveBeenCalled();
  });

  it("persists on every change", () => {
    const { store, persisted } = makeStore();
    store.upsertCard(card("c1"), TODAY);
    expect(persisted).toHaveLength(1);
    expect(JSON.parse(persisted[0]!).cards).toHaveLength(1);
  });
});

describe("upsertCard", () => {
  it("stores the card and gives it a schedule due today", () => {
    const { store } = makeStore();
    store.upsertCard(card("c1"), TODAY);
    expect(store.getCard("c1")).toEqual(card("c1"));
    expect(store.getSchedule("c1")).toEqual(newSchedule("c1", TODAY));
  });

  it("replaces a card's content without resetting its schedule", () => {
    const { store } = makeStore();
    store.upsertCard(card("c1"), TODAY);
    store.grade("c1", "remembered", TODAY, NOW);
    const scheduled = store.getSchedule("c1")!;

    store.upsertCard(card("c1", { front: "Edited" }), addDays(TODAY, 30));
    expect(store.getCard("c1")!.front).toBe("Edited");
    expect(store.getSchedule("c1")).toEqual(scheduled);
  });
});

describe("scopes", () => {
  function seeded() {
    const { store } = makeStore();
    store.upsertCard(card("c1"), TODAY);
    store.upsertCard(card("c2"), TODAY);
    store.upsertCard(card("c3"), TODAY);
    store.setAnchor("c1", "doc-1", null);
    store.setAnchor("c2", "doc-1", null);
    store.setAnchor("c3", "doc-2", null);
    store.createDeck("Impacts", "d1", NOW);
    store.setDeckMembership("d1", "c1", true);
    return store;
  }

  it("counts every card under the all scope", () => {
    expect(seeded().totalCount({ kind: "all" })).toBe(3);
  });

  it("counts a file's cards under its own scope", () => {
    expect(seeded().totalCount({ kind: "file", docId: "doc-1" })).toBe(2);
    expect(seeded().totalCount({ kind: "file", docId: "doc-2" })).toBe(1);
  });

  it("counts a deck's members under its scope", () => {
    expect(seeded().totalCount({ kind: "deck", deckId: "d1" })).toBe(1);
  });

  it("counts nothing for a file or deck it does not hold", () => {
    expect(seeded().totalCount({ kind: "file", docId: "nope" })).toBe(0);
    expect(seeded().totalCount({ kind: "deck", deckId: "nope" })).toBe(0);
  });

  it("queues the due cards of a scope", () => {
    const store = seeded();
    expect(store.queue({ kind: "file", docId: "doc-1" }, TODAY).sort()).toEqual(["c1", "c2"]);
  });

  it("counts the due cards of a scope", () => {
    const store = seeded();
    expect(store.dueCount({ kind: "all" }, TODAY)).toBe(3);
    store.grade("c1", "remembered", TODAY, NOW);
    expect(store.dueCount({ kind: "all" }, TODAY)).toBe(2);
  });

  it("reviews a card grounded in two files once", () => {
    const store = seeded();
    store.setAnchor("c1", "doc-2", null);
    expect(store.queue({ kind: "all" }, TODAY).filter((id) => id === "c1")).toHaveLength(1);
  });
});

describe("grade", () => {
  it("advances the schedule and reports whether to retry in session", () => {
    const { store } = makeStore();
    store.upsertCard(card("c1"), TODAY);
    expect(store.grade("c1", "remembered", TODAY, NOW)).toBe(false);
    expect(store.getSchedule("c1")!.state).toBe("review");
    expect(store.grade("c1", "forgot", TODAY, NOW)).toBe(true);
    expect(store.getSchedule("c1")!.state).toBe("learning");
  });

  it("logs the grade with the intervals either side of it", () => {
    const { store } = makeStore();
    store.upsertCard(card("c1"), TODAY);
    store.grade("c1", "remembered", TODAY, NOW);
    const log = JSON.parse(store.toJson()).log;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ cardId: "c1", grade: "remembered", intervalBefore: 0 });
    expect(log[0].intervalAfter).toBeGreaterThan(0);
  });

  it("does nothing for a card it does not hold", () => {
    const { store, persisted } = makeStore();
    expect(store.grade("gone", "remembered", TODAY, NOW)).toBe(false);
    expect(persisted).toHaveLength(0);
  });
});

describe("suspending", () => {
  const seeded = () => {
    const { store } = makeStore();
    store.upsertCard(card("c1"), TODAY);
    return store;
  };

  it("takes a suspended card out of the queue", () => {
    const store = seeded();
    store.setSuspended("c1", true);
    expect(store.queue({ kind: "all" }, TODAY)).toEqual([]);
    expect(store.dueCount({ kind: "all" }, TODAY)).toBe(0);
  });

  it("still counts it as a card of the scope", () => {
    const store = seeded();
    store.setSuspended("c1", true);
    expect(store.totalCount({ kind: "all" })).toBe(1);
  });

  it("resumes a never-reviewed card as new, keeping its due date", () => {
    const store = seeded();
    const due = store.getSchedule("c1")!.dueOn;
    store.setSuspended("c1", true);
    store.setSuspended("c1", false);
    expect(store.getSchedule("c1")).toMatchObject({ state: "new", dueOn: due });
  });

  it("resumes a reviewed card as a review", () => {
    const store = seeded();
    store.grade("c1", "remembered", TODAY, NOW);
    store.setSuspended("c1", true);
    store.setSuspended("c1", false);
    expect(store.getSchedule("c1")!.state).toBe("review");
  });

  it("does nothing when the card is already in the state asked for", () => {
    const store = seeded();
    store.setSuspended("c1", true);
    const before = store.toJson();
    store.setSuspended("c1", true);
    store.setSuspended("gone", true);
    expect(store.toJson()).toBe(before);
  });

  it("suspends through the older single-card call too", () => {
    const store = seeded();
    store.suspend("c1");
    expect(store.getSchedule("c1")!.state).toBe("suspended");
  });
});

describe("deleteCard", () => {
  it("removes the card everywhere it is referenced", () => {
    const { store } = makeStore();
    store.upsertCard(card("c1"), TODAY);
    store.setAnchor("c1", "doc-1", null);
    store.createDeck("Impacts", "d1", NOW);
    store.setDeckMembership("d1", "c1", true);
    store.grade("c1", "remembered", TODAY, NOW);

    store.deleteCard("c1");

    expect(store.getCard("c1")).toBeUndefined();
    expect(store.getSchedule("c1")).toBeUndefined();
    expect(store.listAnchors()).toEqual([]);
    expect(store.listDecks()[0]!.cardIds).toEqual([]);
    expect(JSON.parse(store.toJson()).log).toEqual([]);
  });

  it("leaves the other cards alone", () => {
    const { store } = makeStore();
    store.upsertCard(card("c1"), TODAY);
    store.upsertCard(card("c2"), TODAY);
    store.deleteCard("c1");
    expect(store.listCards().map((c) => c.id)).toEqual(["c2"]);
  });
});

describe("setAnchor", () => {
  it("grounds a card in a file", () => {
    const { store } = makeStore();
    store.setAnchor("c1", "doc-1", null);
    expect(store.anchorsForDoc("doc-1")).toEqual([{ cardId: "c1", docId: "doc-1", anchor: null }]);
  });

  it("keeps one grounding per card and file", () => {
    const { store } = makeStore();
    store.setAnchor("c1", "doc-1", null);
    store.setAnchor("c1", "doc-1", { kind: "text" } as never);
    expect(store.anchorsForDoc("doc-1")).toHaveLength(1);
    expect(store.anchorsForDoc("doc-1")[0]!.anchor).toEqual({ kind: "text" });
  });

  it("lets one card be grounded in several files", () => {
    const { store } = makeStore();
    store.setAnchor("c1", "doc-1", null);
    store.setAnchor("c1", "doc-2", null);
    expect(store.listAnchors()).toHaveLength(2);
  });
});

describe("AI threads and notes", () => {
  it("keeps each file's threads and notes apart", () => {
    const { store } = makeStore();
    store.addAiThread(thread("t1", "doc-1"));
    store.addAiThread(thread("t2", "doc-2"));
    store.addNote(note("n1", "doc-1"));
    expect(store.aiThreadsForDoc("doc-1").map((t) => t.threadId)).toEqual(["t1"]);
    expect(store.notesForDoc("doc-2")).toEqual([]);
  });

  it("appends a turn to a thread and to a note", () => {
    const { store } = makeStore();
    store.addAiThread(thread("t1", "doc-1"));
    store.addNote(note("n1", "doc-1"));
    store.appendAiComment("t1", { author: "ai", text: "because", at: NOW } as never);
    store.appendNoteComment("n1", { author: "user", text: "more", at: NOW } as never);
    expect(store.getAiThread("t1")!.comments).toHaveLength(2);
    expect(store.getNote("n1")!.comments).toHaveLength(2);
  });

  it("edits and deletes a note's turn by index, ignoring a bad one", () => {
    const { store } = makeStore();
    store.addNote(note("n1", "doc-1"));
    store.editNoteComment("n1", 0, "edited");
    expect(store.getNote("n1")!.comments[0]!.text).toBe("edited");

    store.editNoteComment("n1", 9, "nowhere");
    store.removeNoteComment("n1", 9);
    store.removeNoteComment("n1", -1);
    expect(store.getNote("n1")!.comments).toHaveLength(1);

    store.removeNoteComment("n1", 0);
    expect(store.getNote("n1")!.comments).toEqual([]);
  });

  it("anchors and unanchors a thread and a note", () => {
    const { store } = makeStore();
    store.addAiThread(thread("t1", "doc-1"));
    store.addNote(note("n1", "doc-1"));
    store.setAiThreadAnchor("t1", { kind: "text" } as never);
    store.setNoteAnchor("n1", { kind: "text" } as never);
    expect(store.getAiThread("t1")!.anchor).toEqual({ kind: "text" });
    store.setAiThreadAnchor("t1", null);
    store.setNoteAnchor("n1", null);
    expect(store.getAiThread("t1")!.anchor).toBeNull();
    expect(store.getNote("n1")!.anchor).toBeNull();
  });

  it("removes a thread and a note", () => {
    const { store } = makeStore();
    store.addAiThread(thread("t1", "doc-1"));
    store.addNote(note("n1", "doc-1"));
    store.removeAiThread("t1");
    store.removeNote("n1");
    expect(store.getAiThread("t1")).toBeUndefined();
    expect(store.getNote("n1")).toBeUndefined();
  });

  it("ignores a turn appended to a thread or note it does not hold", () => {
    const { store, persisted } = makeStore();
    store.appendAiComment("gone", { author: "ai", text: "x", at: NOW } as never);
    store.appendNoteComment("gone", { author: "user", text: "x", at: NOW } as never);
    store.setAiThreadAnchor("gone", null);
    store.setNoteAnchor("gone", null);
    expect(persisted).toHaveLength(0);
  });

  it("separates the two kinds of cutter note a file carries", () => {
    const { store } = makeStore();
    store.addNote(note("n1", "doc-1", { kind: "cutter-section" } as never));
    store.addNote(note("n2", "doc-1", { kind: "cutter-guidance" } as never));
    store.addNote(note("n3", "doc-1"));
    expect(store.cutterSectionNotes("doc-1").map((n) => n.noteId)).toEqual(["n1"]);
    expect(store.cutterGuidanceNote("doc-1")!.noteId).toBe("n2");
  });
});

describe("decks", () => {
  it("creates, renames and deletes a deck", () => {
    const { store } = makeStore();
    store.createDeck("Impacts", "d1", NOW);
    expect(store.listDecks()[0]).toMatchObject({ deckId: "d1", name: "Impacts", cardIds: [] });
    store.renameDeck("d1", "Impact Cards");
    expect(store.listDecks()[0]!.name).toBe("Impact Cards");
    store.deleteDeck("d1");
    expect(store.listDecks()).toEqual([]);
  });

  it("adds and removes a member without duplicating it", () => {
    const { store } = makeStore();
    store.createDeck("Impacts", "d1", NOW);
    store.setDeckMembership("d1", "c1", true);
    store.setDeckMembership("d1", "c1", true);
    expect(store.listDecks()[0]!.cardIds).toEqual(["c1"]);
    store.setDeckMembership("d1", "c1", false);
    expect(store.listDecks()[0]!.cardIds).toEqual([]);
  });

  it("ignores a deck it does not hold", () => {
    const { store, persisted } = makeStore();
    store.renameDeck("gone", "x");
    store.setDeckMembership("gone", "c1", true);
    expect(persisted).toHaveLength(0);
  });
});

describe("the doc registry", () => {
  it("records a file's name and format", () => {
    const { store } = makeStore();
    store.registerDoc({ docId: "doc-1", name: "Warming", format: "cmir" });
    expect(store.listDocs()[0]).toMatchObject({ docId: "doc-1", lastName: "Warming", format: "cmir" });
  });

  it("remembers where a file has been, newest first and without repeats", () => {
    const { store } = makeStore();
    store.registerDoc({ docId: "doc-1", name: "W", format: "cmir", path: "/a.cmir" });
    store.registerDoc({ docId: "doc-1", name: "W", format: "cmir", path: "/b.cmir" });
    store.registerDoc({ docId: "doc-1", name: "W", format: "cmir", path: "/a.cmir" });
    expect(store.listDocs()[0]!.knownPaths).toEqual(["/a.cmir", "/b.cmir"]);
  });

  it("keeps only the eight most recent paths", () => {
    const { store } = makeStore();
    for (let i = 0; i < 12; i++) {
      store.registerDoc({ docId: "doc-1", name: "W", format: "cmir", path: `/p${i}.cmir` });
    }
    expect(store.listDocs()[0]!.knownPaths).toHaveLength(8);
    expect(store.listDocs()[0]!.knownPaths[0]).toBe("/p11.cmir");
  });

  it("updates the name and format of a file it already knows", () => {
    const { store } = makeStore();
    store.registerDoc({ docId: "doc-1", name: "Old", format: "cmir" });
    store.registerDoc({ docId: "doc-1", name: "New", format: "docx" });
    expect(store.listDocs()).toHaveLength(1);
    expect(store.listDocs()[0]).toMatchObject({ lastName: "New", format: "docx" });
  });
});

describe("copyDocAnnotations", () => {
  function forked() {
    const { store } = makeStore();
    store.upsertCard(card("c1"), TODAY);
    store.setAnchor("c1", "doc-1", null);
    store.addAiThread(thread("t1", "doc-1"));
    store.addNote(note("n1", "doc-1"));
    store.copyDocAnnotations("doc-1", "doc-2");
    return store;
  }

  it("gives the fork its own grounding for the same card", () => {
    const store = forked();
    expect(store.anchorsForDoc("doc-2").map((a) => a.cardId)).toEqual(["c1"]);
    expect(store.listCards()).toHaveLength(1);
  });

  it("keeps one schedule, since content and schedule live per card", () => {
    const store = forked();
    expect(JSON.parse(store.toJson()).schedules).toHaveLength(1);
  });

  it("gives the fork's threads and notes fresh ids", () => {
    const store = forked();
    const copiedThread = store.aiThreadsForDoc("doc-2")[0]!;
    const copiedNote = store.notesForDoc("doc-2")[0]!;
    expect(copiedThread.threadId).not.toBe("t1");
    expect(copiedNote.noteId).not.toBe("n1");
    expect(copiedThread.comments[0]!.text).toBe("why?");
  });

  it("leaves the source file untouched", () => {
    const store = forked();
    expect(store.anchorsForDoc("doc-1")).toHaveLength(1);
    expect(store.aiThreadsForDoc("doc-1").map((t) => t.threadId)).toEqual(["t1"]);
  });

  it("copies a thread's turns rather than sharing them", () => {
    const store = forked();
    const copied = store.aiThreadsForDoc("doc-2")[0]!;
    store.appendAiComment(copied.threadId, { author: "ai", text: "new", at: NOW } as never);
    expect(store.getAiThread("t1")!.comments).toHaveLength(1);
  });

  it("does nothing when the two ids are the same", () => {
    const { store } = makeStore();
    store.setAnchor("c1", "doc-1", null);
    const before = store.toJson();
    store.copyDocAnnotations("doc-1", "doc-1");
    expect(store.toJson()).toBe(before);
  });

  it("does nothing for a file with nothing to copy", () => {
    const { store, persisted } = makeStore();
    store.copyDocAnnotations("empty", "doc-2");
    expect(persisted).toHaveLength(0);
  });
});

describe("rekeyDoc", () => {
  it("moves every annotation onto the real doc id", () => {
    const { store } = makeStore();
    store.setAnchor("c1", "session-1", null);
    store.addAiThread(thread("t1", "session-1"));
    store.addNote(note("n1", "session-1"));
    store.registerDoc({ docId: "session-1", name: "Untitled", format: null });

    store.rekeyDoc("session-1", "doc-1");

    expect(store.anchorsForDoc("session-1")).toEqual([]);
    expect(store.anchorsForDoc("doc-1")).toHaveLength(1);
    expect(store.aiThreadsForDoc("doc-1").map((t) => t.threadId)).toEqual(["t1"]);
    expect(store.notesForDoc("doc-1")).toHaveLength(1);
    expect(store.listDocs().map((d) => d.docId)).toEqual(["doc-1"]);
  });

  it("keeps the thread ids, since this is the same file rather than a fork", () => {
    const { store } = makeStore();
    store.addAiThread(thread("t1", "session-1"));
    store.rekeyDoc("session-1", "doc-1");
    expect(store.getAiThread("t1")!.docId).toBe("doc-1");
  });
});

describe("forgetDoc", () => {
  function seeded() {
    const { store } = makeStore();
    store.upsertCard(card("shared"), TODAY);
    store.upsertCard(card("only-here"), TODAY);
    store.setAnchor("shared", "doc-1", null);
    store.setAnchor("shared", "doc-2", null);
    store.setAnchor("only-here", "doc-1", null);
    store.addAiThread(thread("t1", "doc-1"));
    store.addNote(note("n1", "doc-1"));
    return store;
  }

  it("archiving suspends the file's cards and keeps everything", () => {
    const store = seeded();
    store.forgetDoc("doc-1", "archive");
    expect(store.getSchedule("shared")!.state).toBe("suspended");
    expect(store.getSchedule("only-here")!.state).toBe("suspended");
    expect(store.getCard("only-here")).toBeDefined();
    expect(store.anchorsForDoc("doc-1")).toHaveLength(2);
  });

  it("deleting drops the file's grounding, threads and notes", () => {
    const store = seeded();
    store.forgetDoc("doc-1", "delete");
    expect(store.anchorsForDoc("doc-1")).toEqual([]);
    expect(store.aiThreadsForDoc("doc-1")).toEqual([]);
    expect(store.notesForDoc("doc-1")).toEqual([]);
  });

  it("deleting prunes only a card left grounded nowhere", () => {
    const store = seeded();
    store.forgetDoc("doc-1", "delete");
    expect(store.getCard("only-here")).toBeUndefined();
    expect(store.getSchedule("only-here")).toBeUndefined();
    // Still anchored in doc-2, so the shared card survives with its schedule.
    expect(store.getCard("shared")).toBeDefined();
    expect(store.getSchedule("shared")).toBeDefined();
  });

  it("deleting drops a pruned card's deck membership", () => {
    const store = seeded();
    store.createDeck("Impacts", "d1", NOW);
    store.setDeckMembership("d1", "only-here", true);
    store.forgetDoc("doc-1", "delete");
    expect(store.listDecks()[0]!.cardIds).toEqual([]);
  });

  it("leaves another file's annotations alone", () => {
    const store = seeded();
    store.forgetDoc("doc-1", "delete");
    expect(store.anchorsForDoc("doc-2")).toHaveLength(1);
  });
});

describe("exportCards and importCards", () => {
  function seeded() {
    const { store } = makeStore();
    store.upsertCard(card("c1"), TODAY);
    store.setAnchor("c1", "doc-1", null);
    store.grade("c1", "remembered", TODAY, NOW);
    return store;
  }

  it("exports a card with its content, schedule and grounding", () => {
    const [exported] = seeded().exportCards();
    expect(exported).toMatchObject({ type: "qa", front: "What warms?", back: "Carbon" });
    expect(exported!.schedule!.state).toBe("review");
    expect(exported!.anchors).toEqual([{ docId: "doc-1", anchor: null }]);
  });

  it("exports a card that has no schedule as having none", () => {
    const { store } = makeStore();
    store.loadJson(JSON.stringify({ version: 1, cards: [card("c1")] }));
    expect(store.exportCards()[0]!.schedule).toBeNull();
  });

  it("imports cards under fresh ids, so an import never overwrites", () => {
    const source = seeded();
    const target = seeded();
    expect(target.importCards(source.exportCards(), TODAY)).toBe(1);
    expect(target.listCards()).toHaveLength(2);
    expect(new Set(target.listCards().map((c) => c.id)).size).toBe(2);
  });

  it("re-importing the same file duplicates, by design", () => {
    const store = seeded();
    const snapshot = store.exportCards();
    store.importCards(snapshot, TODAY);
    store.importCards(snapshot, TODAY);
    expect(store.listCards()).toHaveLength(3);
  });

  it("carries the imported schedule onto the new id", () => {
    const source = seeded();
    const { store: target } = makeStore();
    target.importCards(source.exportCards(), TODAY);
    const [id] = target.listCards().map((c) => c.id);
    expect(target.getSchedule(id!)!.state).toBe("review");
    expect(target.getSchedule(id!)!.cardId).toBe(id);
  });

  it("gives an imported card with no schedule a fresh one", () => {
    const { store } = makeStore();
    store.importCards([{ type: "qa", front: "F", back: "B", schedule: null, anchors: [] }], TODAY);
    const [id] = store.listCards().map((c) => c.id);
    expect(store.getSchedule(id!)).toEqual(newSchedule(id!, TODAY));
  });

  it("carries the imported grounding", () => {
    const source = seeded();
    const { store: target } = makeStore();
    target.importCards(source.exportCards(), TODAY);
    expect(target.anchorsForDoc("doc-1")).toHaveLength(1);
  });

  it("imports nothing from an empty list, and does not persist", () => {
    const { store, persisted } = makeStore();
    expect(store.importCards([], TODAY)).toBe(0);
    expect(persisted).toHaveLength(0);
  });
});
