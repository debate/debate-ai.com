// @vitest-environment jsdom
/**
 * @fileoverview `useWordCountRounds` — word-count round history: local save,
 * delete and clear, the cross-tab `storage` refresh, and, signed in, the
 * once-per-page-load account merge (newer `updatedAt` wins) plus the
 * best-effort account writes after each change.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WordCountRoundRecord } from "@debate-ai/round/src/state/wordCountRounds";
import { flush } from "./helpers/mount";
import { renderHook, type RenderedHook } from "./helpers/render-hook";

const client = vi.hoisted(() => ({
  listSavedWordCountRounds: vi.fn<() => Promise<WordCountRoundRecord[] | null>>(),
  saveWordCountRoundToAccount: vi.fn<(record: WordCountRoundRecord) => Promise<void>>(),
  deleteSavedWordCountRoundFromAccount: vi.fn<(roundId: string) => Promise<void>>(),
}));
const listOverride = vi.hoisted(() => ({
  current: null as null | (() => Promise<WordCountRoundRecord[] | null>),
}));
vi.mock("../src/round/word-count-rounds-client", () => ({
  ...client,
  // A plain rejecting function rather than a rejecting `vi.fn` result,
  // which Vitest reports as a test error even once the hook has caught it.
  listSavedWordCountRounds: () =>
    listOverride.current ? listOverride.current() : client.listSavedWordCountRounds(),
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
type State = typeof import("@debate-ai/round/src/state/wordCountRounds");

let hookModule: Hook;
let state: State;
let rendered: RenderedHook<ReturnType<Hook["useWordCountRounds"]>> | null = null;

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  listOverride.current = null;
  client.saveWordCountRoundToAccount.mockResolvedValue(undefined);
  client.deleteSavedWordCountRoundFromAccount.mockResolvedValue(undefined);
  vi.resetModules();
  hookModule = await import("../src/hooks/useWordCountRounds");
  state = await import("@debate-ai/round/src/state/wordCountRounds");
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

  it("lists local rounds sorted by id, unsynced", async () => {
    state.adoptWordCountRound(round({ roundId: "b" }));
    state.adoptWordCountRound(round({ roundId: "a" }));
    const result = await render();
    expect(result.current.synced).toBe(false);
    expect(result.current.syncNotice).toBe("");
    expect(result.current.rounds?.map((record) => record.roundId)).toEqual(["a", "b"]);
  });

  it("saves, deletes and clears locally without calling the account", async () => {
    const result = await render();

    await flush(() => result.current.saveRound(round()));
    expect(result.current.rounds).toHaveLength(1);

    await flush(() => result.current.deleteRound("round-1"));
    expect(result.current.rounds).toEqual([]);

    await flush(() => result.current.saveRound(round({ roundId: "round-2" })));
    await flush(() => result.current.clearAllRounds());
    expect(result.current.rounds).toEqual([]);

    expect(client.saveWordCountRoundToAccount).not.toHaveBeenCalled();
    expect(client.deleteSavedWordCountRoundFromAccount).not.toHaveBeenCalled();
  });

  it("re-reads on another tab's write to the rounds store", async () => {
    const result = await render();
    state.adoptWordCountRound(round());
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "wordCountRounds" }));
    });
    expect(result.current.rounds).toHaveLength(1);
  });
});

describe("useWordCountRounds signed in", () => {
  it("adopts account-only rounds, pushes local-only ones and shows a sync notice", async () => {
    state.adoptWordCountRound(round({ roundId: "local-only", updatedAt: 5 }));
    client.listSavedWordCountRounds.mockResolvedValue([round({ roundId: "remote-only", updatedAt: 7 })]);

    const result = await render();

    expect(result.current.synced).toBe(true);
    expect(result.current.rounds?.map((record) => record.roundId)).toEqual(["local-only", "remote-only"]);
    expect(state.getWordCountRound("remote-only")?.updatedAt).toBe(7);
    expect(client.saveWordCountRoundToAccount).toHaveBeenCalledTimes(1);
    expect(client.saveWordCountRoundToAccount.mock.calls[0][0].roundId).toBe("local-only");
    expect(result.current.syncNotice).toContain("remote-only");

    await flush(() => result.current.dismissSyncNotice());
    expect(result.current.syncNotice).toBe("");
  });

  it("keeps the newer copy when a round exists on both sides", async () => {
    state.adoptWordCountRound(round({ roundId: "newer-here", updatedAt: 20, submittedSpeeches: [] }));
    state.adoptWordCountRound(round({ roundId: "newer-there", updatedAt: 1, submittedSpeeches: [] }));
    client.listSavedWordCountRounds.mockResolvedValue([
      round({ roundId: "newer-here", updatedAt: 10 }),
      round({ roundId: "newer-there", updatedAt: 30 }),
    ]);

    await render();

    expect(state.getWordCountRound("newer-there")?.updatedAt).toBe(30);
    expect(state.getWordCountRound("newer-here")?.updatedAt).toBe(20);
    expect(client.saveWordCountRoundToAccount.mock.calls.map(([record]) => record.roundId)).toEqual(["newer-here"]);
  });

  it("shows no notice when the merge adopts nothing", async () => {
    client.listSavedWordCountRounds.mockResolvedValue([]);
    const result = await render();
    expect(result.current.synced).toBe(true);
    expect(result.current.syncNotice).toBe("");
  });

  it("pushes each save with its fresh timestamps and deletes from the account", async () => {
    client.listSavedWordCountRounds.mockResolvedValue([]);
    const result = await render();

    await flush(() => result.current.saveRound(round()));
    expect(client.saveWordCountRoundToAccount).toHaveBeenCalledTimes(1);
    const pushed = client.saveWordCountRoundToAccount.mock.calls[0][0];
    expect(pushed.roundId).toBe("round-1");
    expect(typeof pushed.updatedAt).toBe("number");
    expect(typeof pushed.createdAt).toBe("number");

    await flush(() => result.current.deleteRound("round-1"));
    expect(client.deleteSavedWordCountRoundFromAccount).toHaveBeenCalledWith("round-1");
  });

  it("clears every round from the account too, and does nothing when there is nothing to clear", async () => {
    client.listSavedWordCountRounds.mockResolvedValue([]);
    const result = await render();

    await flush(() => result.current.clearAllRounds());
    expect(client.deleteSavedWordCountRoundFromAccount).not.toHaveBeenCalled();

    await flush(() => result.current.saveRound(round({ roundId: "a" })));
    await flush(() => result.current.saveRound(round({ roundId: "b" })));
    await flush(() => result.current.clearAllRounds());
    expect(result.current.rounds).toEqual([]);
    expect(client.deleteSavedWordCountRoundFromAccount.mock.calls.map(([id]) => id).sort()).toEqual(["a", "b"]);
  });

  it("keeps the local change when an account write fails", async () => {
    client.listSavedWordCountRounds.mockResolvedValue([]);
    client.saveWordCountRoundToAccount.mockImplementation(() => Promise.reject(new Error("offline")));
    const result = await render();

    await flush(() => result.current.saveRound(round()));
    expect(result.current.rounds).toHaveLength(1);
    expect(state.getWordCountRound("round-1")).toBeDefined();
  });

  it("falls back to local rounds when the account list fails", async () => {
    state.adoptWordCountRound(round());
    listOverride.current = () => Promise.reject(new Error("Server error"));
    const result = await render();

    expect(result.current.synced).toBe(false);
    expect(result.current.rounds).toHaveLength(1);
    await flush(() => result.current.saveRound(round({ roundId: "round-2" })));
    expect(client.saveWordCountRoundToAccount).not.toHaveBeenCalled();
  });

  it("fetches the account list once for several mounts", async () => {
    client.listSavedWordCountRounds.mockResolvedValue([]);
    await render();
    const second = await renderHook(() => hookModule.useWordCountRounds());
    await flush(async () => {});
    expect(second.result.current.synced).toBe(true);
    expect(client.listSavedWordCountRounds).toHaveBeenCalledTimes(1);
    await second.unmount();
  });
});
