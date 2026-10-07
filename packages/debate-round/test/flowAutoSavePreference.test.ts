import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FLOW_AUTO_SAVE_PREF_KEY,
  isFlowAutoSaveEnabled,
  setFlowAutoSaveEnabled,
  subscribeFlowAutoSavePreference,
} from "../src/state/flowAutoSavePreference";

let data: Map<string, string>;

beforeEach(() => {
  data = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("flow auto-save preference", () => {
  it("is on by default", () => {
    expect(isFlowAutoSaveEnabled()).toBe(true);
  });

  it("persists an opt-out and clears it when re-enabled", () => {
    setFlowAutoSaveEnabled(false);
    expect(data.get(FLOW_AUTO_SAVE_PREF_KEY)).toBe("off");
    expect(isFlowAutoSaveEnabled()).toBe(false);
    setFlowAutoSaveEnabled(true);
    expect(data.has(FLOW_AUTO_SAVE_PREF_KEY)).toBe(false);
    expect(isFlowAutoSaveEnabled()).toBe(true);
  });

  it("treats unrecognised stored values as enabled", () => {
    data.set(FLOW_AUTO_SAVE_PREF_KEY, "garbage");
    expect(isFlowAutoSaveEnabled()).toBe(true);
  });

  it("notifies subscribers until they unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFlowAutoSavePreference(listener);
    setFlowAutoSaveEnabled(false);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setFlowAutoSaveEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("falls back to enabled when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(isFlowAutoSaveEnabled()).toBe(true);
    expect(() => setFlowAutoSaveEnabled(false)).not.toThrow();
  });
});
