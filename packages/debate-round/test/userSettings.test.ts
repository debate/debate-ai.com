import { beforeEach, describe, expect, it } from "vitest";
import {
  applyUserSettingsToLocalStore,
  DEBATE_STYLE_OPTIONS,
  DEFAULT_USER_SETTINGS,
  FONT_SIZE_OPTIONS,
  isValidDebateStyleIndex,
  isValidFontSize,
  normalizeUserSettingsPatch,
  readLocalUserSettings,
} from "../src/state/userSettings";
import { settings } from "../src/state/settings";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment has no DOM by default here. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
  settings.resetToAuto();
});

describe("isValidDebateStyleIndex", () => {
  it("accepts every in-range option index", () => {
    for (let i = 0; i < DEBATE_STYLE_OPTIONS.length; i++) {
      expect(isValidDebateStyleIndex(i)).toBe(true);
    }
  });

  it.each([-1, DEBATE_STYLE_OPTIONS.length, 1.5, "0", null, undefined])(
    "rejects out-of-range/non-integer value %p",
    (value) => {
      expect(isValidDebateStyleIndex(value)).toBe(false);
    },
  );
});

describe("isValidFontSize", () => {
  it("accepts every listed font size", () => {
    for (const px of FONT_SIZE_OPTIONS) {
      expect(isValidFontSize(px)).toBe(true);
    }
  });

  it.each([11, 21, 14.5, "14", null, undefined])("rejects unlisted value %p", (value) => {
    expect(isValidFontSize(value)).toBe(false);
  });
});

describe("normalizeUserSettingsPatch", () => {
  it("accepts a full valid patch", () => {
    const result = normalizeUserSettingsPatch({ debateStyle: 1, fontSize: FONT_SIZE_OPTIONS[0] });
    expect(result).toEqual({ valid: { debateStyle: 1, fontSize: FONT_SIZE_OPTIONS[0] }, errors: [] });
  });

  it("accepts a partial patch (only one field present)", () => {
    const result = normalizeUserSettingsPatch({ fontSize: FONT_SIZE_OPTIONS[1] });
    expect(result).toEqual({ valid: { fontSize: FONT_SIZE_OPTIONS[1] }, errors: [] });
  });

  it("ignores unknown fields", () => {
    const result = normalizeUserSettingsPatch({ debateStyle: 0, theme: "dark" });
    expect(result.valid).toEqual({ debateStyle: 0 });
    expect(result.errors).toEqual([]);
  });

  it("reports an error for an out-of-range debateStyle", () => {
    const result = normalizeUserSettingsPatch({ debateStyle: 999 });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("reports an error for an unlisted fontSize", () => {
    const result = normalizeUserSettingsPatch({ fontSize: 999 });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("reports errors for both fields when both are invalid", () => {
    const result = normalizeUserSettingsPatch({ debateStyle: -1, fontSize: 0 });
    expect(result.errors).toHaveLength(2);
  });

  it.each([null, undefined, "not an object", 5, ["array"]])(
    "rejects a non-object body %p",
    (body) => {
      const result = normalizeUserSettingsPatch(body);
      expect(result.valid).toEqual({});
      expect(result.errors).toHaveLength(1);
    },
  );

  it("returns no valid fields and no errors for an empty object", () => {
    expect(normalizeUserSettingsPatch({})).toEqual({ valid: {}, errors: [] });
  });
});

describe("applyUserSettingsToLocalStore / readLocalUserSettings", () => {
  it("writes a valid patch into the local settings singleton", () => {
    applyUserSettingsToLocalStore({ debateStyle: 2, fontSize: FONT_SIZE_OPTIONS[3] });
    expect(readLocalUserSettings()).toEqual({ debateStyle: 2, fontSize: FONT_SIZE_OPTIONS[3] });
  });

  it("applies only the fields present in the patch", () => {
    applyUserSettingsToLocalStore({ debateStyle: 3 });
    expect(readLocalUserSettings().debateStyle).toBe(3);
    expect(readLocalUserSettings().fontSize).toBe(DEFAULT_USER_SETTINGS.fontSize);
  });

  it("ignores an invalid value slipped past validation rather than corrupting the store", () => {
    applyUserSettingsToLocalStore({ debateStyle: 1 });
    applyUserSettingsToLocalStore({ debateStyle: 999 as unknown as number });
    expect(readLocalUserSettings().debateStyle).toBe(1);
  });

  it("persists the applied values to localStorage", () => {
    applyUserSettingsToLocalStore({ debateStyle: 1, fontSize: FONT_SIZE_OPTIONS[0] });
    const stored = JSON.parse(localStorage.getItem("settings")!);
    expect(stored.debateStyle).toBe(1);
    expect(stored.fontSize).toBe(FONT_SIZE_OPTIONS[0]);
  });
});
