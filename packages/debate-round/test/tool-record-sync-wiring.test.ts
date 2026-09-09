/**
 * @fileoverview Pins that this package's localStorage-backed tool stores
 * mirror their writes to the signed-in user's account — see
 * `debate-practice-rounds`' file of the same name for why this needs its own
 * test (the mirror is invisible from inside a store, so dropping the wiring
 * breaks nothing any other test would notice).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setToolRecordSyncEnabled } from "debate-data-sync/src/state/tool-record-mirror";
import { deletePracticeRound, savePracticeRound } from "../src/state/practiceRounds";
import { deletePreRoundBriefing, savePreRoundBriefing } from "../src/state/preRoundBriefings";
import { deleteArgumentTree, saveArgumentTree } from "../src/state/argumentTrees";
import { buildPracticeRoundSetup } from "../src/round/practice-round-simulator";
import type { PreRoundBriefing } from "../src/round/pre-round-briefing";

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
  body: unknown;
}

let calls: Call[] = [];

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
  calls = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  });
  setToolRecordSyncEnabled(true);
});

afterEach(() => {
  setToolRecordSyncEnabled(false);
  vi.unstubAllGlobals();
});

describe("practice rounds", () => {
  const setup = buildPracticeRoundSetup({ styleKey: "lincolnDouglas", judgeParadigm: "lay" });

  it("mirrors a save and a delete under the round id", async () => {
    savePracticeRound({ roundId: "round-1", setup });
    deletePracticeRound("round-1");
    await settle();

    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["PUT", "/api/tool-records/practiceRounds/round-1"],
      ["DELETE", "/api/tool-records/practiceRounds/round-1"],
    ]);
  });

  it("mirrors the record as stored, with its stamped createdAt", async () => {
    savePracticeRound({ roundId: "round-1", setup });
    await settle();

    const record = (calls[0]!.body as { record: { createdAt?: number } }).record;
    // `savePracticeRound` stamps `createdAt` itself, so the account must get
    // the stored record rather than the caller's argument.
    expect(typeof record.createdAt).toBe("number");
  });
});

describe("pre-round briefings", () => {
  const briefing = {
    event: { tournamentName: "Berkeley", round: "Round 3" },
    priorMeetings: { count: 0, records: [] },
    sections: [],
  } as unknown as PreRoundBriefing;

  it("mirrors a save and a delete under the round id", async () => {
    savePreRoundBriefing({ roundId: "round-2", briefing }, 1_700_000_000_000);
    deletePreRoundBriefing("round-2");
    await settle();

    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["PUT", "/api/tool-records/preRoundBriefings/round-2"],
      ["DELETE", "/api/tool-records/preRoundBriefings/round-2"],
    ]);
  });

  it("mirrors the stamped record, not the caller's", async () => {
    savePreRoundBriefing({ roundId: "round-2", briefing }, 1_700_000_000_000);
    await settle();

    expect((calls[0]!.body as { record: { updatedAt: number } }).record.updatedAt).toBe(
      1_700_000_000_000,
    );
  });
});

describe("argument trees", () => {
  it("mirrors a save and a delete under the round id", async () => {
    saveArgumentTree({ roundId: "round-3", tree: [] });
    deleteArgumentTree("round-3");
    await settle();

    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ["PUT", "/api/tool-records/argumentTrees/round-3"],
      ["DELETE", "/api/tool-records/argumentTrees/round-3"],
    ]);
  });
});
