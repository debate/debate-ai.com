import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FLOW_AUTO_SAVE_MODE,
  isFlowAutoSaveMode,
  normalizeFlowAutoSavePatch,
  parseStoredFlowAutoSave,
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

describe("flowAutoSave account patch", () => {
  it("ignores bodies without the field", () => {
    expect(normalizeFlowAutoSavePatch({ fontSize: 3 })).toEqual({ valid: {}, errors: [] });
    expect(normalizeFlowAutoSavePatch(null)).toEqual({ valid: {}, errors: [] });
  });

  it("accepts each mode and rejects anything else", () => {
    for (const mode of ["off", "saved", "all"]) {
      expect(normalizeFlowAutoSavePatch({ flowAutoSave: mode }).valid).toEqual({ flowAutoSave: mode });
    }
    for (const bad of ["always", "", null, 1, undefined]) {
      const result = normalizeFlowAutoSavePatch({ flowAutoSave: bad });
      expect(result.valid).toEqual({});
      expect(result.errors).toHaveLength(1);
    }
  });

  it("parses stored values, treating unknown/null as not synced", () => {
    expect(parseStoredFlowAutoSave("all")).toBe("all");
    expect(parseStoredFlowAutoSave("bogus")).toBeNull();
    expect(parseStoredFlowAutoSave(null)).toBeNull();
  });
});
