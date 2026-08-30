import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_SETTINGS,
  isValidColorTheme,
  isValidThemeMode,
  normalizeThemeSettingsPatch,
  THEME_MODES,
  THEME_NAMES,
} from "../src/state/themeSettings";

describe("isValidColorTheme", () => {
  it("accepts every registered theme name", () => {
    for (const name of THEME_NAMES) {
      expect(isValidColorTheme(name)).toBe(true);
    }
  });

  it.each(["not-a-theme", "", "Modern-Minimal", null, undefined, 5])(
    "rejects an unregistered/non-string value %p",
    (value) => {
      expect(isValidColorTheme(value)).toBe(false);
    },
  );
});

describe("isValidThemeMode", () => {
  it("accepts every registered mode", () => {
    for (const mode of THEME_MODES) {
      expect(isValidThemeMode(mode)).toBe(true);
    }
  });

  it.each(["Light", "auto", "", null, undefined, 1])(
    "rejects an unregistered/non-string value %p",
    (value) => {
      expect(isValidThemeMode(value)).toBe(false);
    },
  );
});

describe("normalizeThemeSettingsPatch", () => {
  it("accepts a full valid patch", () => {
    const result = normalizeThemeSettingsPatch({ colorTheme: "cyberpunk", themeMode: "dark" });
    expect(result).toEqual({ valid: { colorTheme: "cyberpunk", themeMode: "dark" }, errors: [] });
  });

  it("accepts a partial patch (only one field present)", () => {
    const result = normalizeThemeSettingsPatch({ themeMode: "system" });
    expect(result).toEqual({ valid: { themeMode: "system" }, errors: [] });
  });

  it("ignores unknown fields", () => {
    const result = normalizeThemeSettingsPatch({ colorTheme: "notebook", debateStyle: 1 });
    expect(result.valid).toEqual({ colorTheme: "notebook" });
    expect(result.errors).toEqual([]);
  });

  it("reports an error for an unregistered colorTheme", () => {
    const result = normalizeThemeSettingsPatch({ colorTheme: "not-a-theme" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("reports an error for an unregistered themeMode", () => {
    const result = normalizeThemeSettingsPatch({ themeMode: "auto" });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it("reports errors for both fields when both are invalid", () => {
    const result = normalizeThemeSettingsPatch({ colorTheme: "nope", themeMode: "nope" });
    expect(result.errors).toHaveLength(2);
  });

  it.each([null, undefined, "not an object", 5, ["array"]])(
    "rejects a non-object body %p",
    (body) => {
      const result = normalizeThemeSettingsPatch(body);
      expect(result.valid).toEqual({});
      expect(result.errors).toHaveLength(1);
    },
  );

  it("returns no valid fields and no errors for an empty object", () => {
    expect(normalizeThemeSettingsPatch({})).toEqual({ valid: {}, errors: [] });
  });
});

describe("DEFAULT_THEME_SETTINGS", () => {
  it("is itself a valid payload", () => {
    expect(isValidColorTheme(DEFAULT_THEME_SETTINGS.colorTheme)).toBe(true);
    expect(isValidThemeMode(DEFAULT_THEME_SETTINGS.themeMode)).toBe(true);
  });
});
