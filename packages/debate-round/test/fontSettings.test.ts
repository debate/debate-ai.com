import { describe, expect, it } from "vitest";
import { FONT_OPTIONS, isValidFontFamily, normalizeFontFamilyPatch } from "../src/state/fontSettings";

describe("normalizeFontFamilyPatch", () => {
  it("accepts every offered font option", () => {
    for (const { value } of FONT_OPTIONS) {
      expect(normalizeFontFamilyPatch({ fontFamily: value })).toEqual({ valid: { fontFamily: value }, errors: [] });
    }
  });

  it("treats an absent field as no change", () => {
    expect(normalizeFontFamilyPatch({ fontSize: 12 })).toEqual({ valid: {}, errors: [] });
  });

  it.each(["Comic Sans", "", null, 5, undefined])("rejects an unknown or non-string value %p", (fontFamily) => {
    const result = normalizeFontFamilyPatch({ fontFamily });
    expect(result.valid).toEqual({});
    expect(result.errors).toHaveLength(1);
  });

  it.each([null, "x", 3, [], undefined])("ignores a non-object body %p", (body) => {
    expect(normalizeFontFamilyPatch(body)).toEqual({ valid: {}, errors: [] });
  });
});

describe("isValidFontFamily", () => {
  it("accepts the system default and rejects look-alikes", () => {
    expect(isValidFontFamily("system-default")).toBe(true);
    expect(isValidFontFamily("arial")).toBe(false);
  });
});
