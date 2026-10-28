// @vitest-environment jsdom
/**
 * @fileoverview `useWordCountRounds` — local word-count round history: save,
 * delete and clear, and the cross-tab `storage` refresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WordCountRoundRecord } from "@debate-ai/round/src/state/wordCountRounds";
import { flush } from "./helpers/mount";
import { renderHook, type RenderedHook } from "./helpers/render-hook";

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

describe("useWordCountRounds", () => {
  it("lists local rounds sorted by id", async () => {
    state.adoptWordCountRound(round({ roundId: "b" }));
    state.adoptWordCountRound(round({ roundId: "a" }));
    const result = await render();
    expect(result.current.rounds?.map((record) => record.roundId)).toEqual(["a", "b"]);
  });

  it("saves, deletes and clears", async () => {
    const result = await render();

    await flush(() => result.current.saveRound(round()));
    expect(result.current.rounds).toHaveLength(1);

    await flush(() => result.current.deleteRound("round-1"));
    expect(result.current.rounds).toEqual([]);

    await flush(() => result.current.saveRound(round({ roundId: "round-2" })));
    await flush(() => result.current.clearAllRounds());
    expect(result.current.rounds).toEqual([]);
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
