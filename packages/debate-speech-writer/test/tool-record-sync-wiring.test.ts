/**
 * @fileoverview Pins that this package's localStorage-backed tool stores
 * mirror their writes to the signed-in user's account — see
 * `debate-practice-rounds`' file of the same name for why this is worth a
 * test of its own (the mirror is invisible from inside a store, so dropping
 * the wiring breaks nothing any other test would notice).
 *
 * `judgeRoundRecords` gets the most attention here because it is the one
 * store whose writes cascade: logging a round rebuilds that judge's derived
 * profile, so one call has to mirror into two collections.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setToolRecordSyncEnabled } from "debate-data-sync/src/state/tool-record-mirror";
import { deleteJudgeProfile, saveJudgeProfile } from "../src/state/judgeProfiles";
import {
  deleteJudgeRoundRecord,
  recordJudgeRound,
  updateJudgeRoundRecord,
} from "../src/state/judgeRoundRecords";
import {
  appendCoachConversationTurn,
  clearCoachConversationHistory,
} from "../src/state/coachConversation";
import type { JudgeProfile } from "../src/judge/judge-profile";
import type { JudgeRoundRecordEntry } from "../src/state/judgeRoundRecords";

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

const ROUND: JudgeRoundRecordEntry = {
  id: "round-1",
  judgeId: "kim",
  tournamentName: "Berkeley",
  date: "2026-02-14",
  division: "Open",
  winningSide: "aff",
  affSpeakerPoints: 29,
  negSpeakerPoints: 28.5,
  theoryArgumentRaised: false,
  theoryArgumentWon: false,
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

describe("judge profiles", () => {
  it("mirrors under judgeId, the field this collection is keyed by", async () => {
    const profile = { judgeId: "kim", roundsJudged: 0 } as unknown as JudgeProfile;

    saveJudgeProfile(profile);
    deleteJudgeProfile("kim");
    await settle();

    expect(calls).toEqual([
      { url: "/api/tool-records/judgeProfiles/kim", method: "PUT" },
      { url: "/api/tool-records/judgeProfiles/kim", method: "DELETE" },
    ]);
  });
});

describe("judge round records", () => {
  it("mirrors the logged round and the profile it rebuilds", async () => {
    recordJudgeRound(ROUND);
    await settle();

    expect(calls).toEqual([
      { url: "/api/tool-records/judgeRoundRecords/round-1", method: "PUT" },
      { url: "/api/tool-records/judgeProfiles/kim", method: "PUT" },
    ]);
  });

  it("mirrors an edit to the round", async () => {
    recordJudgeRound(ROUND);
    calls = [];

    updateJudgeRoundRecord({ ...ROUND, affSpeakerPoints: 30 });
    await settle();

    expect(calls[0]).toEqual({ url: "/api/tool-records/judgeRoundRecords/round-1", method: "PUT" });
  });

  it("mirrors a delete, and the profile it drops with it", async () => {
    recordJudgeRound(ROUND);
    calls = [];

    deleteJudgeRoundRecord("round-1");
    await settle();

    expect(calls).toEqual([
      { url: "/api/tool-records/judgeRoundRecords/round-1", method: "DELETE" },
      // The judge's last round is gone, so the derived profile goes too.
      { url: "/api/tool-records/judgeProfiles/kim", method: "DELETE" },
    ]);
  });
});

describe("coach conversation", () => {
  it("mirrors each new turn, and clears the whole collection on reset", async () => {
    const turn = appendCoachConversationTurn({ question: "How do I turn this?", answer: "Slowly." });
    await settle();

    expect(calls).toEqual([
      { url: `/api/tool-records/coachConversation/${turn.id}`, method: "PUT" },
    ]);

    calls = [];
    clearCoachConversationHistory();
    await settle();

    expect(calls).toEqual([{ url: "/api/tool-records/coachConversation", method: "DELETE" }]);
  });
});
