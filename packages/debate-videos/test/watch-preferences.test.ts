// @vitest-environment jsdom
/**
 * @fileoverview The watch page's remembered choices (`lib/watch-preferences`):
 * one JSON store the account sync can read, with the pre-sync per-choice keys
 * still honoured until a choice is written again.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_WATCH_PREFERENCES,
  LEGACY_WATCH_PREFERENCE_KEYS,
  WATCH_PREFERENCES_STORAGE_KEY,
  readWatchPreference,
  sanitizeWatchPreferences,
  writeWatchPreference,
} from "../src/lib/watch-preferences";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

const stored = () => JSON.parse(window.localStorage.getItem(WATCH_PREFERENCES_STORAGE_KEY) ?? "null");

describe("readWatchPreference", () => {
  it("gives the defaults when nothing was chosen", () => {
    expect(readWatchPreference("copyFormat")).toBe("url");
    expect(readWatchPreference("autoScroll")).toBe(true);
    expect(readWatchPreference("skipBreaks")).toBe(true);
    expect(readWatchPreference("liveCaption")).toBe(true);
    expect(DEFAULT_WATCH_PREFERENCES).toEqual({ copyFormat: "url", autoScroll: true, skipBreaks: true, liveCaption: true });
  });

  it("reads the combined store", () => {
    window.localStorage.setItem(
      WATCH_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ copyFormat: "citation", autoScroll: false, skipBreaks: false, liveCaption: false }),
    );
    expect(readWatchPreference("copyFormat")).toBe("citation");
    expect(readWatchPreference("autoScroll")).toBe(false);
    expect(readWatchPreference("skipBreaks")).toBe(false);
    expect(readWatchPreference("liveCaption")).toBe(false);
  });

  it("still reads a choice saved under its pre-sync key", () => {
    window.localStorage.setItem(LEGACY_WATCH_PREFERENCE_KEYS.copyFormat, "url-title");
    window.localStorage.setItem(LEGACY_WATCH_PREFERENCE_KEYS.autoScroll, "off");
    window.localStorage.setItem(LEGACY_WATCH_PREFERENCE_KEYS.skipBreaks, "on");
    expect(readWatchPreference("copyFormat")).toBe("url-title");
    expect(readWatchPreference("autoScroll")).toBe(false);
    expect(readWatchPreference("skipBreaks")).toBe(true);
  });

  it("prefers the combined store over a pre-sync key", () => {
    window.localStorage.setItem(LEGACY_WATCH_PREFERENCE_KEYS.liveCaption, "off");
    window.localStorage.setItem(WATCH_PREFERENCES_STORAGE_KEY, JSON.stringify({ liveCaption: true }));
    expect(readWatchPreference("liveCaption")).toBe(true);
  });

  it("ignores an unknown or corrupt value", () => {
    window.localStorage.setItem(LEGACY_WATCH_PREFERENCE_KEYS.copyFormat, "bogus");
    expect(readWatchPreference("copyFormat")).toBe("url");
    window.localStorage.setItem(WATCH_PREFERENCES_STORAGE_KEY, "{not json");
    expect(readWatchPreference("autoScroll")).toBe(true);
    window.localStorage.setItem(WATCH_PREFERENCES_STORAGE_KEY, JSON.stringify({ autoScroll: "off", copyFormat: 3 }));
    expect(readWatchPreference("autoScroll")).toBe(true);
    expect(readWatchPreference("copyFormat")).toBe("url");
  });

  it("falls back to the default when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readWatchPreference("skipBreaks")).toBe(true);
    expect(readWatchPreference("copyFormat")).toBe("url");
  });
});

describe("writeWatchPreference", () => {
  it("saves one choice as JSON and keeps the others", () => {
    writeWatchPreference("copyFormat", "citation");
    writeWatchPreference("skipBreaks", false);
    expect(stored()).toEqual({ copyFormat: "citation", skipBreaks: false });
    expect(readWatchPreference("copyFormat")).toBe("citation");
    expect(readWatchPreference("skipBreaks")).toBe(false);
  });

  it("drops the choice's pre-sync key so the old value can't come back", () => {
    window.localStorage.setItem(LEGACY_WATCH_PREFERENCE_KEYS.autoScroll, "off");
    window.localStorage.setItem(LEGACY_WATCH_PREFERENCE_KEYS.liveCaption, "off");
    writeWatchPreference("autoScroll", true);
    expect(window.localStorage.getItem(LEGACY_WATCH_PREFERENCE_KEYS.autoScroll)).toBeNull();
    // Another choice's pre-sync key is left for its own next write.
    expect(window.localStorage.getItem(LEGACY_WATCH_PREFERENCE_KEYS.liveCaption)).toBe("off");
    expect(readWatchPreference("liveCaption")).toBe(false);
  });

  it("does not throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeWatchPreference("liveCaption", false)).not.toThrow();
  });
});

describe("sanitizeWatchPreferences", () => {
  it("keeps only known formats and real booleans", () => {
    expect(
      sanitizeWatchPreferences({ copyFormat: "citation", autoScroll: false, skipBreaks: "no", extra: 1 }),
    ).toEqual({ copyFormat: "citation", autoScroll: false });
  });

  it("is empty for anything that isn't an object", () => {
    expect(sanitizeWatchPreferences(null)).toEqual({});
    expect(sanitizeWatchPreferences("citation")).toEqual({});
    expect(sanitizeWatchPreferences([true])).toEqual({});
  });
});
