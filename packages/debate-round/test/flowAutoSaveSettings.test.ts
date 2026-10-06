import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FLOW_AUTO_SAVE_MODE,
  adoptAccountFlowAutoSave,
  isFlowAutoSaveMode,
  normalizeFlowAutoSavePatch,
  parseFlowAutoSave,
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

describe("flow auto-save account sync helpers", () => {
  it("accepts each valid mode and ignores bodies without the field", () => {
    for (const mode of ["off", "saved", "all"] as const) {
      expect(normalizeFlowAutoSavePatch({ flowAutoSave: mode })).toEqual({
        valid: { flowAutoSave: mode },
        errors: [],
      });
    }
    expect(normalizeFlowAutoSavePatch({ fontSize: 14 })).toEqual({ valid: {}, errors: [] });
    expect(normalizeFlowAutoSavePatch(null)).toEqual({ valid: {}, errors: [] });
    expect(normalizeFlowAutoSavePatch([])).toEqual({ valid: {}, errors: [] });
  });

  it("reports invalid values instead of clamping", () => {
    for (const bad of ["sometimes", "", null, 1, undefined, {}]) {
      const result = normalizeFlowAutoSavePatch({ flowAutoSave: bad });
      expect(result.valid).toEqual({});
      expect(result.errors).toHaveLength(1);
    }
  });

  it("parses stored column values, treating unknown or missing as never chosen", () => {
    expect(parseFlowAutoSave("all")).toBe("all");
    expect(parseFlowAutoSave("bogus")).toBeNull();
    expect(parseFlowAutoSave(null)).toBeNull();
    expect(parseFlowAutoSave(undefined)).toBeNull();
  });

  it("adopts the account's mode locally, but keeps the local choice when the account has none", () => {
    expect(adoptAccountFlowAutoSave("off")).toBe("off");
    expect(readFlowAutoSaveMode()).toBe("off");

    setFlowAutoSaveMode("all");
    expect(adoptAccountFlowAutoSave(null)).toBe("all");
    expect(adoptAccountFlowAutoSave("bogus")).toBe("all");
    expect(readFlowAutoSaveMode()).toBe("all");
  });
});
