import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FLOW_AUTO_SAVE_MODE,
  LEGACY_FLOW_AUTO_SAVE_ENABLED_KEY,
  isFlowAutoSaveMode,
  normalizeFlowAutoSavePatch,
  parseFlowAutoSave,
  readFlowAutoSaveMode,
  setFlowAutoSaveMode,
  subscribeFlowAutoSaveMode,
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

describe("retired device-only auto-save checkbox", () => {
  it("reads a legacy opt-out as mode off when no mode is stored", () => {
    localStorage.setItem(LEGACY_FLOW_AUTO_SAVE_ENABLED_KEY, "off");
    expect(readFlowAutoSaveMode()).toBe("off");
  });

  it("lets a stored mode win over the legacy key", () => {
    localStorage.setItem(LEGACY_FLOW_AUTO_SAVE_ENABLED_KEY, "off");
    localStorage.setItem("debate:flow-auto-save", "all");
    expect(readFlowAutoSaveMode()).toBe("all");
  });

  it("ignores legacy values other than off", () => {
    localStorage.setItem(LEGACY_FLOW_AUTO_SAVE_ENABLED_KEY, "garbage");
    expect(readFlowAutoSaveMode()).toBe("saved");
  });

  it("drops the legacy key once a mode is set", () => {
    localStorage.setItem(LEGACY_FLOW_AUTO_SAVE_ENABLED_KEY, "off");
    setFlowAutoSaveMode("saved");
    expect(localStorage.getItem(LEGACY_FLOW_AUTO_SAVE_ENABLED_KEY)).toBeNull();
    expect(readFlowAutoSaveMode()).toBe("saved");
  });
});

describe("subscribeFlowAutoSaveMode", () => {
  it("notifies on a set in this tab until unsubscribed", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeFlowAutoSaveMode(listener);
    setFlowAutoSaveMode("off");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setFlowAutoSaveMode("all");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("notifies on another tab's change to either key, and not on unrelated keys", () => {
    const target = new EventTarget();
    vi.stubGlobal("window", target);
    const listener = vi.fn();
    const unsubscribe = subscribeFlowAutoSaveMode(listener);
    const fire = (key: string | null) => {
      const event = new Event("storage") as Event & { key: string | null };
      event.key = key;
      target.dispatchEvent(event);
    };
    fire("debate:flow-auto-save");
    fire(LEGACY_FLOW_AUTO_SAVE_ENABLED_KEY);
    fire(null);
    fire("something-else");
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    fire("debate:flow-auto-save");
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

describe("flowAutoSave account patch", () => {
  it("accepts each valid mode", () => {
    for (const mode of ["off", "saved", "all"] as const) {
      expect(normalizeFlowAutoSavePatch({ flowAutoSave: mode })).toEqual({ valid: { flowAutoSave: mode }, errors: [] });
    }
  });

  it("rejects unknown values and ignores bodies without the field", () => {
    expect(normalizeFlowAutoSavePatch({ flowAutoSave: "sometimes" }).errors).toHaveLength(1);
    expect(normalizeFlowAutoSavePatch({ flowAutoSave: 3 }).valid).toEqual({});
    expect(normalizeFlowAutoSavePatch({ fontSize: 14 })).toEqual({ valid: {}, errors: [] });
    expect(normalizeFlowAutoSavePatch(null)).toEqual({ valid: {}, errors: [] });
  });

  it("parses stored values with a default fallback", () => {
    expect(parseFlowAutoSave("all")).toBe("all");
    expect(parseFlowAutoSave(null)).toBe("saved");
    expect(parseFlowAutoSave("junk")).toBe("saved");
  });
});
