// @vitest-environment jsdom
/**
 * @fileoverview Tests for `state/coachPersonaPreferences.ts`: the coaching
 * style each AI coach picker remembers (and the account sync carries).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COACH_PERSONA_PREFERENCES_STORAGE_KEY,
  getCoachPersonaPreference,
  isCoachPersonaPreferencesStorageEvent,
  listCoachPersonaPreferences,
  saveCoachPersonaPreference,
} from "../src/state/coachPersonaPreferences";

const KEY = COACH_PERSONA_PREFERENCES_STORAGE_KEY;
const stored = () => JSON.parse(localStorage.getItem(KEY) ?? "null");

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("getCoachPersonaPreference", () => {
  it("is Standard when nothing is saved", () => {
    expect(getCoachPersonaPreference("ai-coach-feedback")).toBe("standard");
  });

  it.each([
    ["bad JSON", "{oops"],
    ["a non-array", JSON.stringify({ id: "ai-coach-feedback", personaId: "socratic" })],
    ["an unknown persona", JSON.stringify([{ id: "ai-coach-feedback", personaId: "drill-sergeant", updatedAt: 1 }])],
    ["a missing updatedAt", JSON.stringify([{ id: "ai-coach-feedback", personaId: "socratic" }])],
  ])("falls back to Standard for %s", (_label, raw) => {
    localStorage.setItem(KEY, raw);
    expect(getCoachPersonaPreference("ai-coach-feedback")).toBe("standard");
  });

  it("reads each surface independently", () => {
    saveCoachPersonaPreference("ai-coach-feedback", "socratic", 10);
    saveCoachPersonaPreference("team-coach", "fact-checker", 20);
    expect(getCoachPersonaPreference("ai-coach-feedback")).toBe("socratic");
    expect(getCoachPersonaPreference("team-coach")).toBe("fact-checker");
  });
});

describe("saveCoachPersonaPreference", () => {
  it("stores one synced record per surface, keyed by id", () => {
    expect(saveCoachPersonaPreference("ai-coach-feedback", "socratic", 10)).toBe(true);
    expect(saveCoachPersonaPreference("ai-coach-feedback", "devils-advocate", 20)).toBe(true);
    expect(stored()).toEqual([{ id: "ai-coach-feedback", personaId: "devils-advocate", updatedAt: 20 }]);
  });

  it("writes nothing when the style is already saved", () => {
    saveCoachPersonaPreference("ai-coach-feedback", "socratic", 10);
    expect(saveCoachPersonaPreference("ai-coach-feedback", "socratic", 99)).toBe(false);
    expect(stored()[0].updatedAt).toBe(10);
  });

  it("ignores an unknown persona or surface", () => {
    expect(saveCoachPersonaPreference("ai-coach-feedback", "drill-sergeant")).toBe(false);
    expect(saveCoachPersonaPreference("nowhere" as never, "socratic")).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps records it doesn't recognize and replaces a malformed copy of its own", () => {
    const future = { id: "debate-room", personaId: "socratic", updatedAt: 5 };
    localStorage.setItem(KEY, JSON.stringify([future, { id: "ai-coach-feedback", personaId: "nope" }]));
    saveCoachPersonaPreference("ai-coach-feedback", "fact-checker", 7);
    expect(stored()).toEqual([future, { id: "ai-coach-feedback", personaId: "fact-checker", updatedAt: 7 }]);
    expect(listCoachPersonaPreferences()).toEqual([{ id: "ai-coach-feedback", personaId: "fact-checker", updatedAt: 7 }]);
  });

  it("returns false instead of throwing when storage is full", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(saveCoachPersonaPreference("ai-coach-feedback", "socratic")).toBe(false);
  });
});

describe("isCoachPersonaPreferencesStorageEvent", () => {
  it("matches its key and a full clear only", () => {
    expect(isCoachPersonaPreferencesStorageEvent({ key: KEY })).toBe(true);
    expect(isCoachPersonaPreferencesStorageEvent({ key: null })).toBe(true);
    expect(isCoachPersonaPreferencesStorageEvent({ key: "coachingSessions" })).toBe(false);
  });
});
