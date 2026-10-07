// @vitest-environment jsdom
/**
 * @fileoverview `useWordCountRounds` — local-first word-count round history:
 * the once-per-page-load account merge (newer `updatedAt` wins), the
 * one-shot "synced from another device" notice, best-effort pushes and
 * deletes, and the cross-tab `storage` refresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WordCountRoundRecord } from "@debate/round/src/state/wordCountRounds";
import { flush } from "./helpers/mount";
import { renderHook, type RenderedHook } from "./helpers/render-hook";

const client = vi.hoisted(() => ({
  listSavedWordCountRounds: vi.fn<() => Promise<WordCountRoundRecord[] | null>>(),
  saveWordCountRoundToAccount: vi.fn<(record: WordCountRoundRecord) => Promise<void>>(),
  deleteSavedWordCountRoundFromAccount: vi.fn<(roundId: string) => Promise<void>>(),
  deleteAllSavedWordCountRoundsFromAccount: vi.fn<() => Promise<void>>(),
}));
const listOverride = vi.hoisted(() => ({ current: null as null | (() => Promise<WordCountRoundRecord[] | null>) }));
vi.mock("../src/round/word-count-rounds-client", () => ({
  ...client,
  // A plain rejecting function rather than a rejecting `vi.fn` result,
  // which Vitest reports as a test error even once the hook has caught it.
  listSavedWordCountRounds: () => (listOverride.current ? listOverride.current() : client.listSavedWordCountRounds()),
}));

function round(overrides: Partial<WordCountRoundRecord> = {}): WordCountRoundRecord {
  return {
    roundId: "round-1",
    styleKey: "practicePublicForum",
    submittedSpeeches: [{ name: "AC", speaker: "A1", text: "Contention one is..." }],
    ...overrides,
  };
}

type Hook = typeof import("../src/hooks/useWordCountRounds");
type State = typeof import("@debate/round/src/state/wordCountRounds");

let hookModule: Hook;
let state: State;
let rendered: RenderedHook<ReturnType<Hook["useWordCountRounds"]>> | null = null;

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  listOverride.current = null;
  client.saveWordCountRoundToAccount.mockResolvedValue(undefined);
  client.deleteSavedWordCountRoundFromAccount.mockResolvedValue(undefined);
  client.deleteAllSavedWordCountRoundsFromAccount.mockResolvedValue(undefined);
  vi.resetModules();
  hookModule = await import("../src/hooks/useWordCountRounds");
  state = await import("@debate/round/src/state/wordCountRounds");
});

afterEach(async () => {
  await rendered?.unmount();
  rendered = null;
});

async function render() {
  rendered = await renderHook(() => hookModule.useWordCountRounds());
  await flush(async () => {});
  return rendered.result;
}

describe("useWordCountRounds signed out", () => {
  beforeEach(() => client.listSavedWordCountRounds.mockResolvedValue(null));

  it("lists local rounds sorted by id with no sync notice", async () => {
    state.adoptWordCountRound(round({ roundId: "b" }));
    state.adoptWordCountRound(round({ roundId: "a" }));
    const result = await render();
    expect(result.current.synced).toBe(false);
    expect(result.current.rounds?.map((record) => record.roundId)).toEqual(["a", "b"]);
    expect(result.current.justSyncedRoundIds).toEqual([]);
  });

  it("saves, deletes and clears locally only", async () => {
    const result = await render();
    await flush(() => {
      result.current.saveRound(round({ roundId: "a" }));
      result.current.saveRound(round({ roundId: "b" }));
    });
    expect(result.current.rounds).toHaveLength(2);

    await flush(() => result.current.deleteRound("a"));
    expect(result.current.rounds?.map((record) => record.roundId)).toEqual(["b"]);

    await flush(() => result.current.clearAllRounds());
    expect(result.current.rounds).toEqual([]);
    expect(client.saveWordCountRoundToAccount).not.toHaveBeenCalled();
    expect(client.deleteSavedWordCountRoundFromAccount).not.toHaveBeenCalled();
    expect(client.deleteAllSavedWordCountRoundsFromAccount).not.toHaveBeenCalled();
  });

  it("treats a failing account fetch like being signed out", async () => {
    listOverride.current = () => Promise.reject(new Error("offline"));
    const result = await render();
    expect(result.current.synced).toBe(false);
  });
});

describe("useWordCountRounds signed in", () => {
  it("adopts remote rounds, pushes newer local ones, and raises a dismissible notice", async () => {
    state.adoptWordCountRound(round({ roundId: "stale-here", updatedAt: 1 }));
    state.adoptWordCountRound(round({ roundId: "fresh-here", updatedAt: 9 }));
    client.listSavedWordCountRounds.mockResolvedValue([
      round({ roundId: "stale-here", updatedAt: 5 }),
      round({ roundId: "fresh-here", updatedAt: 3 }),
      round({ roundId: "remote-only", updatedAt: 4 }),
    ]);

    const result = await render();
    expect(result.current.synced).toBe(true);
    expect(result.current.justSyncedRoundIds.sort()).toEqual(["remote-only", "stale-here"]);
    expect(state.getWordCountRound("stale-here")?.updatedAt).toBe(5);
    expect(client.saveWordCountRoundToAccount.mock.calls.map(([pushed]) => pushed.roundId)).toEqual(["fresh-here"]);

    await flush(() => result.current.dismissSyncNotice());
    expect(result.current.justSyncedRoundIds).toEqual([]);
  });

  it("hands the sync notice to only the first mounted instance", async () => {
    client.listSavedWordCountRounds.mockResolvedValue([round({ roundId: "remote-only", updatedAt: 4 })]);
    const first = await render();
    const second = await renderHook(() => hookModule.useWordCountRounds());
    await flush(async () => {});
    expect(first.current.justSyncedRoundIds).toEqual(["remote-only"]);
    expect(second.result.current.justSyncedRoundIds).toEqual([]);
    expect(client.listSavedWordCountRounds).toHaveBeenCalledTimes(1);
    await second.unmount();
  });

  it("pushes the stamped round on save, and deletes on delete and clear", async () => {
    client.listSavedWordCountRounds.mockResolvedValue([]);
    const result = await render();

    await flush(() => result.current.saveRound(round()));
    const pushed = client.saveWordCountRoundToAccount.mock.calls[0]![0];
    expect(pushed.roundId).toBe("round-1");
    expect(pushed.updatedAt).toEqual(expect.any(Number));

    await flush(() => result.current.deleteRound("round-1"));
    expect(client.deleteSavedWordCountRoundFromAccount).toHaveBeenCalledWith("round-1");

    // Clearing an already-empty history is a no-op, with no account call.
    await flush(() => result.current.clearAllRounds());
    expect(client.deleteAllSavedWordCountRoundsFromAccount).not.toHaveBeenCalled();

    await flush(() => result.current.saveRound(round({ roundId: "round-2" })));
    await flush(() => result.current.clearAllRounds());
    expect(client.deleteAllSavedWordCountRoundsFromAccount).toHaveBeenCalledTimes(1);
  });
});

describe("useWordCountRounds live update", () => {
  it("re-reads on another tab's write to the rounds store", async () => {
    client.listSavedWordCountRounds.mockResolvedValue(null);
    const result = await render();
    state.adoptWordCountRound(round());
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "wordCountRounds" }));
    });
    expect(result.current.rounds).toHaveLength(1);
  });
});
