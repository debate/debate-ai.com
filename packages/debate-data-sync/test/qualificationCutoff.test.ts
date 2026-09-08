import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_QUALIFICATION_CUTOFF,
  getEffectiveQualificationCutoff,
  getPersistedQualificationCutoff,
  isQualificationCutoffConfigured,
  resetPersistedQualificationCutoff,
  savePersistedQualificationCutoff,
  toQualificationOptions,
  type QualificationCutoffSettings,
} from "../src/state/qualificationCutoff";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
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

const CUSTOM_CUTOFF: QualificationCutoffSettings = { minPoints: 25, maxQualifiers: 8 };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("getPersistedQualificationCutoff", () => {
  it("returns null when nothing is stored", () => {
    expect(getPersistedQualificationCutoff()).toBeNull();
  });

  it("returns null when the stored value is corrupt JSON", () => {
    localStorage.setItem("qualificationCutoff", "{not json");
    expect(getPersistedQualificationCutoff()).toBeNull();
  });

  it("returns null when a field isn't a finite number or null", () => {
    localStorage.setItem(
      "qualificationCutoff",
      JSON.stringify({ minPoints: "twenty-five", maxQualifiers: 8 }),
    );
    expect(getPersistedQualificationCutoff()).toBeNull();
  });

  it("returns the saved cutoff once one is stored", () => {
    savePersistedQualificationCutoff(CUSTOM_CUTOFF);
    expect(getPersistedQualificationCutoff()).toEqual(CUSTOM_CUTOFF);
  });

  it("accepts a cutoff with only one half configured", () => {
    const halfCutoff: QualificationCutoffSettings = { minPoints: 10, maxQualifiers: null };
    savePersistedQualificationCutoff(halfCutoff);
    expect(getPersistedQualificationCutoff()).toEqual(halfCutoff);
  });
});

describe("resetPersistedQualificationCutoff", () => {
  it("clears a previously saved cutoff", () => {
    savePersistedQualificationCutoff(CUSTOM_CUTOFF);
    resetPersistedQualificationCutoff();
    expect(getPersistedQualificationCutoff()).toBeNull();
  });
});

describe("getEffectiveQualificationCutoff", () => {
  it("falls back to 'not configured' when nothing is saved", () => {
    expect(getEffectiveQualificationCutoff()).toEqual(DEFAULT_QUALIFICATION_CUTOFF);
  });

  it("prefers a saved cutoff over the default", () => {
    savePersistedQualificationCutoff(CUSTOM_CUTOFF);
    expect(getEffectiveQualificationCutoff()).toEqual(CUSTOM_CUTOFF);
  });

  it("falls back to 'not configured' again after a reset", () => {
    savePersistedQualificationCutoff(CUSTOM_CUTOFF);
    resetPersistedQualificationCutoff();
    expect(getEffectiveQualificationCutoff()).toEqual(DEFAULT_QUALIFICATION_CUTOFF);
  });
});

describe("isQualificationCutoffConfigured", () => {
  it("is false when neither field is set", () => {
    expect(isQualificationCutoffConfigured(DEFAULT_QUALIFICATION_CUTOFF)).toBe(false);
  });

  it("is true when only minPoints is set", () => {
    expect(isQualificationCutoffConfigured({ minPoints: 5, maxQualifiers: null })).toBe(true);
  });

  it("is true when only maxQualifiers is set", () => {
    expect(isQualificationCutoffConfigured({ minPoints: null, maxQualifiers: 5 })).toBe(true);
  });

  it("is true when both fields are set", () => {
    expect(isQualificationCutoffConfigured(CUSTOM_CUTOFF)).toBe(true);
  });
});

describe("toQualificationOptions", () => {
  it("omits both keys when nothing is configured", () => {
    expect(toQualificationOptions(DEFAULT_QUALIFICATION_CUTOFF)).toEqual({});
  });

  it("carries over only the configured half", () => {
    expect(toQualificationOptions({ minPoints: 25, maxQualifiers: null })).toEqual({ minPoints: 25 });
    expect(toQualificationOptions({ minPoints: null, maxQualifiers: 8 })).toEqual({ maxQualifiers: 8 });
  });

  it("carries over both halves when both are configured", () => {
    expect(toQualificationOptions(CUSTOM_CUTOFF)).toEqual({ minPoints: 25, maxQualifiers: 8 });
  });
});
