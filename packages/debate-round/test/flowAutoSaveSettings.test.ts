import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FLOW_AUTO_SAVE_MODE,
  isFlowAutoSaveMode,
  normalizeFlowAutoSavePatch,
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

describe("normalizeFlowAutoSavePatch", () => {
  it("accepts each mode", () => {
    for (const mode of ["off", "saved", "all"] as const) {
      expect(normalizeFlowAutoSavePatch({ flowAutoSave: mode })).toEqual({ valid: { flowAutoSave: mode }, errors: [] });
    }
  });

  it("ignores bodies without the field", () => {
    expect(normalizeFlowAutoSavePatch({ fontSize: 14 })).toEqual({ valid: {}, errors: [] });
  });

  it("reports unknown values and non-object bodies", () => {
    expect(normalizeFlowAutoSavePatch({ flowAutoSave: "sometimes" }).errors).toHaveLength(1);
    expect(normalizeFlowAutoSavePatch({ flowAutoSave: null }).valid).toEqual({});
    expect(normalizeFlowAutoSavePatch([]).errors).toHaveLength(1);
    expect(normalizeFlowAutoSavePatch(null).errors).toHaveLength(1);
  });
});
