// @vitest-environment jsdom
/**
 * @fileoverview `useDrillSets` — the local-first drill-set hook: the
 * once-per-page-load account merge keyed by `roundId` (newer `updatedAt`
 * wins), best-effort pushes after each mutation, the "drill practiced"
 * activity ping on first completion, and the cross-tab `storage` refresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrillSetRecord } from "../src/state/drillSets";
import { flush } from "./helpers/mount";
import { renderHook, type RenderedHook } from "./helpers/render-hook";

const client = vi.hoisted(() => ({
  listSavedDrillSets: vi.fn<() => Promise<DrillSetRecord[] | null>>(),
  saveDrillSetToAccount: vi.fn<(record: DrillSetRecord) => Promise<void>>(),
  deleteSavedDrillSetFromAccount: vi.fn<(roundId: string) => Promise<void>>(),
}));
const listOverride = vi.hoisted(() => ({ current: null as null | (() => Promise<DrillSetRecord[] | null>) }));
vi.mock("../src/round/drill-sets-client", () => ({
  ...client,
  // A plain rejecting function rather than a rejecting `vi.fn` result,
  // which Vitest reports as a test error even once the hook has caught it.
  listSavedDrillSets: () => (listOverride.current ? listOverride.current() : client.listSavedDrillSets()),
}));
const community = vi.hoisted(() => ({ recordDebaterActivity: vi.fn() }));
vi.mock("@debate/community", () => community);

const DRILLS: DrillSetRecord["drills"] = [
  { kind: "overview", rowIndex: null, prompt: "Write an overview.", difficulty: "medium" },
  { kind: "frontline", rowIndex: 0, prompt: "Frontline the turn.", difficulty: "hard" },
];

function record(overrides: Partial<DrillSetRecord> = {}): DrillSetRecord {
  return { roundId: "round-1", sideKey: "aff", drills: DRILLS, ...overrides };
}

type Hook = typeof import("../src/hooks/useDrillSets");
type State = typeof import("../src/state/drillSets");

let hookModule: Hook;
let state: State;
let rendered: RenderedHook<ReturnType<Hook["useDrillSets"]>> | null = null;

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  listOverride.current = null;
  client.saveDrillSetToAccount.mockResolvedValue(undefined);
  client.deleteSavedDrillSetFromAccount.mockResolvedValue(undefined);
  vi.resetModules();
  hookModule = await import("../src/hooks/useDrillSets");
  state = await import("../src/state/drillSets");
});

afterEach(async () => {
  await rendered?.unmount();
  rendered = null;
});

async function render() {
  rendered = await renderHook(() => hookModule.useDrillSets());
  await flush(async () => {});
  return rendered.result;
}

describe("useDrillSets signed out", () => {
  beforeEach(() => client.listSavedDrillSets.mockResolvedValue(null));

  it("lists local drill sets sorted by round, unsynced", async () => {
    state.adoptDrillSet(record({ roundId: "round-b" }));
    state.adoptDrillSet(record({ roundId: "round-a" }));
    const result = await render();
    expect(result.current.synced).toBe(false);
    expect(result.current.drillSets?.map((set) => set.roundId)).toEqual(["round-a", "round-b"]);
  });

  it("applies every mutation locally and never calls the account", async () => {
    const result = await render();
    await flush(() => result.current.saveDrillSet(record()));
    await flush(() => result.current.saveDrillAiScript("round-1", 0, "Script"));
    await flush(() => result.current.scheduleDrillReview("round-1", 1, "2026-10-08"));
    await flush(() => result.current.toggleDrillCompletion("round-1", 0));

    const stored = state.getDrillSet("round-1");
    expect(stored?.aiScripts).toEqual({ 0: "Script" });
    expect(stored?.scheduledReviewAt).toEqual({ 1: "2026-10-08" });
    expect(stored?.completedDrillIndexes).toEqual([0]);
    expect(result.current.drillSets).toEqual([stored]);

    await flush(() => result.current.deleteDrillSet("round-1"));
    expect(result.current.drillSets).toEqual([]);
    expect(client.saveDrillSetToAccount).not.toHaveBeenCalled();
    expect(client.deleteSavedDrillSetFromAccount).not.toHaveBeenCalled();
  });

  it("records practice activity only when a drill becomes completed", async () => {
    const result = await render();
    await flush(() => result.current.saveDrillSet(record()));

    await flush(() => result.current.toggleDrillCompletion("round-1", 1));
    expect(community.recordDebaterActivity).toHaveBeenCalledTimes(1);
    expect(community.recordDebaterActivity).toHaveBeenCalledWith("drill_practiced");

    // Un-completing it again is not practice.
    await flush(() => result.current.toggleDrillCompletion("round-1", 1));
    expect(community.recordDebaterActivity).toHaveBeenCalledTimes(1);

    // An out-of-range index changes nothing and records nothing.
    await flush(() => result.current.toggleDrillCompletion("round-1", 9));
    expect(community.recordDebaterActivity).toHaveBeenCalledTimes(1);
  });

  it("builds a drill set from a flow and returns the stored record", async () => {
    const result = await render();
    let built: DrillSetRecord | undefined;
    await flush(() => {
      built = result.current.buildAndSaveDrillSet({ children: [], columns: ["1AC", "1NC"] }, "round-9", "aff");
    });
    expect(built?.roundId).toBe("round-9");
    expect(built?.updatedAt).toEqual(expect.any(Number));
    expect(result.current.drillSets).toEqual([built]);
  });

  it("treats a failing account fetch like being signed out", async () => {
    listOverride.current = () => Promise.reject(new Error("offline"));
    const result = await render();
    expect(result.current.synced).toBe(false);
  });
});

describe("useDrillSets signed in", () => {
  it("adopts newer remote copies and pushes newer or local-only ones", async () => {
    state.adoptDrillSet(record({ roundId: "older-here", updatedAt: 100 }));
    state.adoptDrillSet(record({ roundId: "newer-here", updatedAt: 900 }));
    state.adoptDrillSet(record({ roundId: "local-only", updatedAt: 50 }));
    client.listSavedDrillSets.mockResolvedValue([
      record({ roundId: "older-here", updatedAt: 500, sideKey: "neg" }),
      record({ roundId: "newer-here", updatedAt: 200 }),
      record({ roundId: "remote-only", updatedAt: 300 }),
    ]);

    const result = await render();
    expect(result.current.synced).toBe(true);
    expect(state.getDrillSet("older-here")?.sideKey).toBe("neg");
    expect(state.getDrillSet("remote-only")).toBeDefined();
    expect(client.saveDrillSetToAccount.mock.calls.map(([pushed]) => pushed.roundId).sort()).toEqual([
      "local-only",
      "newer-here",
    ]);
    expect(result.current.drillSets).toHaveLength(4);
  });

  it("pushes the freshly stamped record after each mutation", async () => {
    client.listSavedDrillSets.mockResolvedValue([]);
    const result = await render();

    await flush(() => result.current.saveDrillSet(record()));
    await flush(() => result.current.saveDrillAiScript("round-1", 1, "AI script"));
    const pushed = client.saveDrillSetToAccount.mock.calls.at(-1)?.[0];
    expect(pushed?.aiScripts).toEqual({ 1: "AI script" });
    expect(pushed?.updatedAt).toEqual(expect.any(Number));

    await flush(() => result.current.deleteDrillSet("round-1"));
    expect(client.deleteSavedDrillSetFromAccount).toHaveBeenCalledWith("round-1");
  });

  it("does not push a mutation against a round that isn't stored", async () => {
    client.listSavedDrillSets.mockResolvedValue([]);
    const result = await render();
    await flush(() => result.current.saveDrillAiScript("missing", 0, "Script"));
    expect(client.saveDrillSetToAccount).not.toHaveBeenCalled();
  });
});

describe("useDrillSets live update", () => {
  it("re-reads drill sets on another tab's storage event", async () => {
    client.listSavedDrillSets.mockResolvedValue(null);
    const result = await render();
    state.adoptDrillSet(record());
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "drillSets" }));
    });
    expect(result.current.drillSets).toHaveLength(1);
  });

  it("ignores another store's storage event", async () => {
    client.listSavedDrillSets.mockResolvedValue(null);
    const result = await render();
    state.adoptDrillSet(record());
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated-store" }));
    });
    expect(result.current.drillSets).toEqual([]);
  });
});
