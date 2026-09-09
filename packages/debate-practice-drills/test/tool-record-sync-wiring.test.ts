/**
 * @fileoverview Pins that this package's localStorage-backed tool stores
 * actually mirror their writes to the signed-in user's account.
 *
 * The mirror is deliberately invisible from inside a store — it is a
 * fire-and-forget call that no-ops while signed out — so nothing about a
 * store's own behaviour changes when the wiring is dropped. That makes it
 * exactly the kind of thing that silently rots: `saveFlowAnnotation` would go
 * on passing every test in `flowAnnotations.test.ts` with its
 * `mirrorToolRecordSave` line deleted, and the Flow Annotations tool would
 * quietly go back to being per-browser.
 *
 * This walks each of the package's synced stores through save-then-delete
 * with the mirror switched on, and asserts the requests it made.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setToolRecordSyncEnabled } from "debate-data-sync/src/state/tool-record-mirror";
import { deleteFlowAnnotation, saveFlowAnnotation } from "../src/state/flowAnnotations";
import { deleteFlowSummary, saveFlowSummary } from "../src/state/flowSummaries";
import {
  deleteJudgeParadigmSelection,
  saveJudgeParadigmSelection,
} from "../src/state/judgeParadigmSelections";
import { judgeParadigms } from "debate-speech-writer/src/judge/judge-paradigms";

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

/** Lets the fire-and-forget mirror's promise settle before asserting. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

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

describe("flow annotations", () => {
  const annotation = {
    id: "anno-1",
    flowId: 1,
    boxPath: [0],
    speechId: "1AC",
    timestampMs: 1_000,
    note: "Solvency claim starts here",
    createdAt: 100,
  };

  it("mirrors a save and a delete to the account", async () => {
    saveFlowAnnotation(annotation);
    deleteFlowAnnotation("anno-1");
    await settle();

    expect(calls).toEqual([
      { url: "/api/tool-records/flowAnnotations/anno-1", method: "PUT" },
      { url: "/api/tool-records/flowAnnotations/anno-1", method: "DELETE" },
    ]);
  });

  it("still writes locally when the account rejects the sync", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "D1 is down" }),
    }) as Response);

    expect(() => saveFlowAnnotation(annotation)).not.toThrow();
    await settle();

    expect(JSON.parse(localStorage.getItem("flowAnnotations")!)).toEqual([annotation]);
  });

  it("makes no request while signed out", async () => {
    setToolRecordSyncEnabled(false);

    saveFlowAnnotation(annotation);
    deleteFlowAnnotation("anno-1");
    await settle();

    expect(calls).toEqual([]);
  });
});

describe("flow summaries", () => {
  it("mirrors under the round it is keyed by", async () => {
    saveFlowSummary({ roundId: "round-7", summaries: [] });
    deleteFlowSummary("round-7");
    await settle();

    expect(calls).toEqual([
      { url: "/api/tool-records/flowSummaries/round-7", method: "PUT" },
      { url: "/api/tool-records/flowSummaries/round-7", method: "DELETE" },
    ]);
  });
});

describe("judge paradigm selections", () => {
  it("mirrors under the round it is keyed by", async () => {
    saveJudgeParadigmSelection({ roundId: "round-7", paradigm: judgeParadigms.policymaker });
    deleteJudgeParadigmSelection("round-7");
    await settle();

    expect(calls).toEqual([
      { url: "/api/tool-records/judgeParadigmSelections/round-7", method: "PUT" },
      { url: "/api/tool-records/judgeParadigmSelections/round-7", method: "DELETE" },
    ]);
  });
});
