import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFlowAutoSaver } from "../src/state/flowAutoSave";
import {
  getFlowAccountStatus,
  getFlowAccountUpdatedAt,
  recordFlowSavedToAccount,
  resetFlowAccountStatus,
} from "../src/state/flowAccountStatus";
import type { Flow } from "../src/types/flow";

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    content: "1AC",
    level: 0,
    columns: ["1AC", "1NC"],
    invert: false,
    focus: false,
    index: 0,
    lastFocus: [0],
    children: [],
    id: 1,
    ...overrides,
  };
}

const summary = (updatedAt: string) => ({ clientId: 1, updatedAt }) as never;

beforeEach(() => {
  vi.useFakeTimers();
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
});

afterEach(() => {
  resetFlowAccountStatus();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createFlowAutoSaver", () => {
  it("saves an edited, previously saved flow after the debounce and marks it saved", async () => {
    const flow = makeFlow();
    recordFlowSavedToAccount(flow, "t1");
    const edited = makeFlow({ content: "1AC edited" });
    const save = vi.fn().mockResolvedValue({ conflict: false, summary: summary("t2") });
    const saver = createFlowAutoSaver({ save, delayMs: 1000 });

    saver.schedule([edited]);
    await vi.advanceTimersByTimeAsync(999);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(save).toHaveBeenCalledWith(edited, { baseUpdatedAt: "t1" });
    expect(getFlowAccountStatus(edited)).toBe("saved");
    expect(getFlowAccountUpdatedAt(edited)).toBe("t2");
  });

  it("restarts the debounce on each schedule", async () => {
    recordFlowSavedToAccount(makeFlow(), "t1");
    const save = vi.fn().mockResolvedValue({ conflict: false, summary: summary("t2") });
    const saver = createFlowAutoSaver({ save, delayMs: 1000 });
    saver.schedule([makeFlow({ content: "a" })]);
    await vi.advanceTimersByTimeAsync(800);
    saver.schedule([makeFlow({ content: "b" })]);
    await vi.advanceTimersByTimeAsync(800);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].content).toBe("b");
  });

  it("never uploads flows without a baseline, clean flows, or archived flows", async () => {
    const clean = makeFlow({ id: 2 });
    recordFlowSavedToAccount(clean, "t1");
    const archived = makeFlow({ id: 3, archived: true, content: "x" });
    recordFlowSavedToAccount(makeFlow({ id: 3 }), "t1");
    const save = vi.fn();
    const saver = createFlowAutoSaver({ save });
    saver.schedule([makeFlow({ id: 1 }), clean, archived]);
    expect(await saver.flush()).toEqual([]);
    expect(save).not.toHaveBeenCalled();
  });

  it("leaves a conflicting flow alone until its content changes", async () => {
    recordFlowSavedToAccount(makeFlow(), "t1");
    const save = vi.fn().mockResolvedValue({ conflict: true, current: summary("t9") });
    const saver = createFlowAutoSaver({ save });
    const edited = makeFlow({ content: "edit" });
    saver.schedule([edited]);
    expect(await saver.flush()).toEqual([]);
    expect(await saver.flush()).toEqual([]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(getFlowAccountStatus(edited)).toBe("unsaved");

    save.mockResolvedValue({ conflict: false, summary: summary("t10") });
    saver.schedule([makeFlow({ content: "edit again" })]);
    expect(await saver.flush()).toEqual([1]);
  });

  it("swallows save failures and keeps saving other flows", async () => {
    recordFlowSavedToAccount(makeFlow({ id: 1 }), "t1");
    recordFlowSavedToAccount(makeFlow({ id: 2 }), "t1");
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ conflict: false, summary: summary("t2") });
    const saver = createFlowAutoSaver({ save });
    saver.schedule([makeFlow({ id: 1, content: "a" }), makeFlow({ id: 2, content: "b" })]);
    expect(await saver.flush()).toEqual([2]);
  });

  it("dispose cancels a pending save", async () => {
    recordFlowSavedToAccount(makeFlow(), "t1");
    const save = vi.fn();
    const saver = createFlowAutoSaver({ save, delayMs: 100 });
    saver.schedule([makeFlow({ content: "e" })]);
    saver.dispose();
    await vi.advanceTimersByTimeAsync(500);
    expect(save).not.toHaveBeenCalled();
  });
});
