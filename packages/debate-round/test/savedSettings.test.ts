import { describe, expect, it } from "vitest";
import { isValidSettingsData, MAX_SAVED_SETTINGS_BYTES } from "../src/state/savedSettings";

describe("isValidSettingsData", () => {
  it("accepts an empty object", () => {
    expect(isValidSettingsData({})).toBe(true);
  });

  it("accepts a map of string/number/boolean values", () => {
    expect(
      isValidSettingsData({ debateStyle: 1, fontSize: 14, theme: "dark", enabled: true }),
    ).toBe(true);
  });

  it("rejects a non-object value", () => {
    expect(isValidSettingsData(null)).toBe(false);
    expect(isValidSettingsData(undefined)).toBe(false);
    expect(isValidSettingsData("settings")).toBe(false);
    expect(isValidSettingsData(42)).toBe(false);
  });

  it("rejects an array", () => {
    expect(isValidSettingsData([1, 2, 3])).toBe(false);
  });

  it("rejects a value that isn't a string, number, or boolean", () => {
    expect(isValidSettingsData({ fontSize: { nested: true } })).toBe(false);
    expect(isValidSettingsData({ fontSize: [14] })).toBe(false);
    expect(isValidSettingsData({ fontSize: null })).toBe(false);
    expect(isValidSettingsData({ fontSize: undefined })).toBe(false);
  });

  it("rejects a map that serializes over the byte cap", () => {
    const oversized = { blob: "x".repeat(MAX_SAVED_SETTINGS_BYTES) };
    expect(isValidSettingsData(oversized)).toBe(false);
  });

  it("accepts a map right at the byte cap boundary", () => {
    // Account for the JSON wrapper (`{"k":"..."}`) so the whole payload lands
    // exactly at the cap.
    const overhead = JSON.stringify({ k: "" }).length;
    const value = { k: "x".repeat(MAX_SAVED_SETTINGS_BYTES - overhead) };
    expect(isValidSettingsData(value)).toBe(true);
  });
});
