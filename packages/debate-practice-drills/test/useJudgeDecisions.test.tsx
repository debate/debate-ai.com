// @vitest-environment jsdom
/**
 * @fileoverview `useJudgeDecisions` — the local-first judge-decision history
 * hook: it reads local storage on mount, merges the account's decisions once
 * per page load when signed in, pushes local mutations best-effort, and
 * refreshes on another tab's `storage` event.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JudgeDecisionRecord } from "../src/state/judgeDecisions";
import { flush } from "./helpers/mount";
import { renderHook, type RenderedHook } from "./helpers/render-hook";

const client = vi.hoisted(() => ({
  listSavedJudgeDecisions: vi.fn<() => Promise<JudgeDecisionRecord[] | null>>(),
  saveJudgeDecisionToAccount: vi.fn<(record: JudgeDecisionRecord) => Promise<void>>(),
  deleteSavedJudgeDecisionFromAccount: vi.fn<(id: string) => Promise<void>>(),
}));
const listOverride = vi.hoisted(() => ({ current: null as null | (() => Promise<JudgeDecisionRecord[] | null>) }));
vi.mock("../src/round/judge-decisions-client", () => ({
  ...client,
  listSavedJudgeDecisions: () => (listOverride.current ? listOverride.current() : client.listSavedJudgeDecisions()),
}));

const INPUT: Omit<JudgeDecisionRecord, "id"> = {
  roundId: "round-1",
  paradigmName: "Flow / Tech Judge",
  sideNames: { primary: "Affirmative", secondary: "Negative" },
  result: { winner: "primary", keyVotingIssues: ["Dropped DA"], rationale: "The neg dropped the DA." },
  generatedAt: 1000,
};

type Hook = typeof import("../src/hooks/useJudgeDecisions");
type State = typeof import("../src/state/judgeDecisions");

let hookModule: Hook;
let state: State;
let rendered: RenderedHook<ReturnType<Hook["useJudgeDecisions"]>> | null = null;

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  listOverride.current = null;
  client.saveJudgeDecisionToAccount.mockResolvedValue(undefined);
  client.deleteSavedJudgeDecisionFromAccount.mockResolvedValue(undefined);
  // The merge promise and "signed in" flag are module-level; a fresh module
  // per test keeps one test's merge from leaking into the next.
  vi.resetModules();
  hookModule = await import("../src/hooks/useJudgeDecisions");
  state = await import("../src/state/judgeDecisions");
});

afterEach(async () => {
  await rendered?.unmount();
  rendered = null;
});

async function render() {
  rendered = await renderHook(() => hookModule.useJudgeDecisions());
  await flush(async () => {});
  return rendered.result;
}

describe("useJudgeDecisions signed out", () => {
  beforeEach(() => client.listSavedJudgeDecisions.mockResolvedValue(null));

  it("reads local history on mount and reports not synced", async () => {
    state.appendJudgeDecision(INPUT);
    const result = await render();
    expect(result.current.synced).toBe(false);
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups?.[0]?.roundId).toBe("round-1");
  });

  it("appends and deletes locally without touching the account", async () => {
    const result = await render();
    await flush(() => result.current.appendDecision(INPUT));
    expect(state.listJudgeDecisions()).toHaveLength(1);
    const id = state.listJudgeDecisions()[0]!.id;

    await flush(() => result.current.deleteDecision(id));
    expect(state.listJudgeDecisions()).toHaveLength(0);
    expect(client.saveJudgeDecisionToAccount).not.toHaveBeenCalled();
    expect(client.deleteSavedJudgeDecisionFromAccount).not.toHaveBeenCalled();
  });

  it("deleteRoundHistory is a no-op for a round with no decisions", async () => {
    const result = await render();
    const before = result.current.groups;
    await flush(() => result.current.deleteRoundHistory("missing"));
    expect(result.current.groups).toBe(before);
  });

  it("treats a failing account fetch like being signed out", async () => {
    // A plain rejecting function rather than a rejecting `vi.fn` result,
    // which Vitest reports as a test error even once the hook has caught it.
    listOverride.current = () => Promise.reject(new Error("offline"));
    const result = await render();
    expect(result.current.synced).toBe(false);
    expect(result.current.groups).toEqual([]);
  });
});

describe("useJudgeDecisions signed in", () => {
  it("adopts remote-only decisions and pushes local-only ones", async () => {
    const local = state.appendJudgeDecision(INPUT).record;
    const remote: JudgeDecisionRecord = { ...INPUT, id: "remote-1", roundId: "round-2", generatedAt: 2000 };
    client.listSavedJudgeDecisions.mockResolvedValue([remote]);

    const result = await render();
    expect(result.current.synced).toBe(true);
    expect(state.getJudgeDecision("remote-1")).toMatchObject({ roundId: "round-2" });
    expect(result.current.groups?.map((group) => group.roundId).sort()).toEqual(["round-1", "round-2"]);
    expect(client.saveJudgeDecisionToAccount).toHaveBeenCalledWith(local);
  });

  it("merges only once per page load across several mounts", async () => {
    client.listSavedJudgeDecisions.mockResolvedValue([]);
    await render();
    const second = await renderHook(() => hookModule.useJudgeDecisions());
    await flush(async () => {});
    expect(client.listSavedJudgeDecisions).toHaveBeenCalledTimes(1);
    expect(second.result.current.synced).toBe(true);
    await second.unmount();
  });

  it("pushes appends and deletes to the account", async () => {
    client.listSavedJudgeDecisions.mockResolvedValue([]);
    const result = await render();

    await flush(() => result.current.appendDecision(INPUT));
    const record = state.listJudgeDecisions()[0]!;
    expect(client.saveJudgeDecisionToAccount).toHaveBeenCalledWith(record);

    await flush(() => result.current.deleteDecision(record.id));
    expect(client.deleteSavedJudgeDecisionFromAccount).toHaveBeenCalledWith(record.id);
  });

  it("deletes every decision of a cleared round from the account", async () => {
    client.listSavedJudgeDecisions.mockResolvedValue([]);
    const result = await render();
    await flush(() => {
      result.current.appendDecision(INPUT);
      result.current.appendDecision({ ...INPUT, generatedAt: 2000 });
    });
    const ids = state.listJudgeDecisions().map((record) => record.id);

    await flush(() => result.current.deleteRoundHistory("round-1"));
    expect(state.listJudgeDecisions()).toHaveLength(0);
    expect(client.deleteSavedJudgeDecisionFromAccount.mock.calls.map(([id]) => id).sort()).toEqual([...ids].sort());
  });

  it("never lets a failing push break the local write", async () => {
    client.listSavedJudgeDecisions.mockResolvedValue([]);
    client.saveJudgeDecisionToAccount.mockImplementation(() => Promise.reject(new Error("500")));
    const result = await render();
    await flush(() => result.current.appendDecision(INPUT));
    expect(state.listJudgeDecisions()).toHaveLength(1);
  });
});

describe("useJudgeDecisions live update", () => {
  it("re-reads local storage when another tab writes the decisions store", async () => {
    client.listSavedJudgeDecisions.mockResolvedValue(null);
    const result = await render();
    expect(result.current.groups).toEqual([]);

    state.appendJudgeDecision(INPUT);
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(result.current.groups).toHaveLength(1);
  });
});
