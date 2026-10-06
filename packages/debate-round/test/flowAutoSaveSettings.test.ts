import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FLOW_AUTO_SAVE_MODE,
  isFlowAutoSaveMode,
  normalizeFlowAutoSaveModePatch,
  readFlowAutoSaveMode,
  setFlowAutoSaveMode,
} from "../src/state/flowAutoSaveSettings";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("flow auto-save preference", () => {
  it("defaults to saved-only", () => {
    expect(readFlowAutoSaveMode()).toBe(DEFAULT_FLOW_AUTO_SAVE_MODE);
    expect(DEFAULT_FLOW_AUTO_SAVE_MODE).toBe("saved");
  });

  it("round-trips each mode", () => {
    for (const mode of ["off", "saved", "all"] as const) {
      setFlowAutoSaveMode(mode);
      expect(readFlowAutoSaveMode()).toBe(mode);
    }
  });

  it("ignores unknown stored values", () => {
    localStorage.setItem("debate:flow-auto-save", "sometimes");
    expect(readFlowAutoSaveMode()).toBe("saved");
    expect(isFlowAutoSaveMode("sometimes")).toBe(false);
    expect(isFlowAutoSaveMode(undefined)).toBe(false);
  });

  it("falls back to the default when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readFlowAutoSaveMode()).toBe("saved");
    expect(() => setFlowAutoSaveMode("all")).not.toThrow();
  });
});

describe("normalizeFlowAutoSaveModePatch", () => {
  it("treats an absent field as nothing to save", () => {
    expect(normalizeFlowAutoSaveModePatch(undefined)).toEqual({ valid: {}, errors: [] });
  });

  it("accepts every known mode", () => {
    for (const mode of ["off", "saved", "all"] as const) {
      expect(normalizeFlowAutoSaveModePatch(mode)).toEqual({ valid: { flowAutoSaveMode: mode }, errors: [] });
    }
  });

  it("rejects unknown, null and non-string values", () => {
    for (const bad of ["sometimes", null, 1, {}]) {
      const result = normalizeFlowAutoSaveModePatch(bad);
      expect(result.valid).toEqual({});
      expect(result.errors).toHaveLength(1);
    }
  });
});
