/**
 * @fileoverview Pins that this package's own localStorage-backed tool stores —
 * the Opponent Team Profiles roster and the scouted-round history it is
 * aggregated from — mirror their writes to the signed-in user's account.
 *
 * Same reason the sibling packages each have a file of this name: the mirror
 * is invisible from inside a store (a fire-and-forget call that no-ops while
 * signed out), so dropping the wiring breaks nothing `opponentRoundRecords.test.ts`
 * or `opponentTeamProfiles.test.ts` would notice, and the Opponent Team
 * Profiles tool would quietly go back to being per-browser.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setToolRecordSyncEnabled } from "../src/state/tool-record-mirror";
import {
  deleteOpponentTeamProfile,
  saveOpponentTeamProfile,
} from "../src/state/opponentTeamProfiles";
import {
  bulkImportOpponentRoundRecords,
  deleteOpponentRoundRecord,
  recordOpponentRound,
  updateOpponentRoundRecord,
  type OpponentRoundRecordEntry,
} from "../src/state/opponentRoundRecords";
import type { OpponentTeamProfile } from "../src/rankings/opponent-team-profile";

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

const ROUND: OpponentRoundRecordEntry = {
  id: "round-1",
  teamId: "Westwood BK",
  tournamentName: "Berkeley",
  date: "2026-02-14",
  division: "Open",
  side: "aff",
  won: true,
};

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

/** `[method, url]` pairs, which is what these assertions are about. */
const routes = () => calls.map((call) => [call.method, call.url]);

describe("opponent team profiles", () => {
  it("mirrors under teamId, the field this collection is keyed by", async () => {
    saveOpponentTeamProfile({ teamId: "Westwood BK", roundsRecorded: 0 } as unknown as OpponentTeamProfile);
    deleteOpponentTeamProfile("Westwood BK");
    await settle();

    // The id is a team name, so it has to survive URL encoding intact.
    expect(routes()).toEqual([
      ["PUT", "/api/tool-records/opponentTeamProfiles/Westwood%20BK"],
      ["DELETE", "/api/tool-records/opponentTeamProfiles/Westwood%20BK"],
    ]);
  });
});

describe("opponent round records", () => {
  it("mirrors the scouted round and the profile it rebuilds", async () => {
    recordOpponentRound(ROUND);
    await settle();

    expect(routes()).toEqual([
      ["PUT", "/api/tool-records/opponentRoundRecords/round-1"],
      ["PUT", "/api/tool-records/opponentTeamProfiles/Westwood%20BK"],
    ]);
  });

  it("mirrors an edit to the round", async () => {
    recordOpponentRound(ROUND);
    calls = [];

    updateOpponentRoundRecord({ ...ROUND, won: false });
    await settle();

    expect(routes()[0]).toEqual(["PUT", "/api/tool-records/opponentRoundRecords/round-1"]);
  });

  it("mirrors a delete, and the profile it drops with it", async () => {
    recordOpponentRound(ROUND);
    calls = [];

    deleteOpponentRoundRecord("round-1");
    await settle();

    expect(routes()).toEqual([
      ["DELETE", "/api/tool-records/opponentRoundRecords/round-1"],
      ["DELETE", "/api/tool-records/opponentTeamProfiles/Westwood%20BK"],
    ]);
  });

  it("sends a CSV import as one bulk write, not one request per row", async () => {
    const csv = [
      "teamId,tournamentName,date,division,side,won",
      "Westwood BK,Berkeley,2026-02-14,Open,aff,true",
      "Westwood BK,Berkeley,2026-02-14,Open,neg,false",
    ].join("\n");

    const result = bulkImportOpponentRoundRecords(csv);
    await settle();

    expect(result.importedCount).toBe(2);
    const bulk = calls.filter((call) => call.url === "/api/tool-records/opponentRoundRecords");
    expect(bulk).toHaveLength(1);
    expect((bulk[0]!.body as { records: unknown[] }).records).toHaveLength(2);
  });
});
