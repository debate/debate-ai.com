/**
 * @fileoverview Pins that this package's localStorage-backed tool stores
 * mirror their writes to the signed-in user's account — see
 * `debate-practice-rounds`' file of the same name for why this needs its own
 * test (the mirror is invisible from inside a store, so dropping the wiring
 * breaks nothing any other test would notice).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setToolRecordSyncEnabled } from "debate-data-sync/src/state/tool-record-mirror";
import {
  deletePrepNote,
  savePrepNote,
  updatePersistedPrepNoteStatus,
} from "../src/state/prepNotes";
import { deleteCoachingProgram, saveCoachingProgram } from "../src/state/coachingPrograms";
import type { PrepNote } from "debate-round/src/flow/strategy-sync-notes";

/** Minimal in-memory `localStorage` mock — this package's environment is `node`. */
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

interface Call {
  url: string;
  method: string;
}

let calls: Call[] = [];

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const NOTE: PrepNote = {
  id: "note-1",
  flowId: 1,
  boxPath: [0, 1],
  authorId: "alice",
  text: "Answer the solvency turn",
  status: "open",
  createdAt: 100,
  updatedAt: 100,
};

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  calls = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET" });
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  });
  setToolRecordSyncEnabled(true);
});

afterEach(() => {
  setToolRecordSyncEnabled(false);
  vi.unstubAllGlobals();
});

describe("prep notes", () => {
  it("mirrors a save and a delete under the note id", async () => {
    savePrepNote(NOTE);
    deletePrepNote("note-1");
    await settle();

    expect(calls).toEqual([
      { url: "/api/tool-records/prepNotes/note-1", method: "PUT" },
      { url: "/api/tool-records/prepNotes/note-1", method: "DELETE" },
    ]);
  });

  it("mirrors an in-place status change, which goes through savePrepNote", async () => {
    savePrepNote(NOTE);
    calls = [];

    updatePersistedPrepNoteStatus("note-1", "covered", 200);
    await settle();

    expect(calls).toEqual([{ url: "/api/tool-records/prepNotes/note-1", method: "PUT" }]);
  });
});

describe("coaching programs", () => {
  it("mirrors a save and a delete under the program id", async () => {
    saveCoachingProgram({ id: "program-1", name: "Novice squad", memberIds: ["alice"] });
    deleteCoachingProgram("program-1");
    await settle();

    expect(calls).toEqual([
      { url: "/api/tool-records/coachingPrograms/program-1", method: "PUT" },
      { url: "/api/tool-records/coachingPrograms/program-1", method: "DELETE" },
    ]);
  });
});
