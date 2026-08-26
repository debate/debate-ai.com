import { beforeEach, describe, expect, it } from "vitest";
import {
  getEffectiveQualificationPointsTable,
  getPersistedQualificationPointsTable,
  resetPersistedQualificationPointsTable,
  savePersistedQualificationPointsTable,
} from "../src/state/qualificationPointsTable";
import { DEFAULT_QUALIFICATION_POINTS_TABLE, type QualificationPointsTable } from "../src/rankings/ndca-standings";

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

const CUSTOM_TABLE: QualificationPointsTable = {
  outroundPoints: {
    champion: 100,
    finalist: 80,
    semifinalist: 60,
    quarterfinalist: 45,
    octofinalist: 30,
    doubleOctofinalist: 15,
    tripleOctofinalist: 5,
    prelims: 0,
  },
  pointsPerPrelimWin: 2,
  bidLevelBonusRate: 0.25,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("getPersistedQualificationPointsTable", () => {
  it("returns null when nothing is stored", () => {
    expect(getPersistedQualificationPointsTable()).toBeNull();
  });

  it("returns null when the stored value is corrupt JSON", () => {
    localStorage.setItem("qualificationPointsTable", "{not json");
    expect(getPersistedQualificationPointsTable()).toBeNull();
  });

  it("returns null when the stored value is missing required fields", () => {
    localStorage.setItem(
      "qualificationPointsTable",
      JSON.stringify({ outroundPoints: { champion: 1 }, pointsPerPrelimWin: 1, bidLevelBonusRate: 0.1 }),
    );
    expect(getPersistedQualificationPointsTable()).toBeNull();
  });

  it("returns null when a required field isn't a finite number", () => {
    localStorage.setItem(
      "qualificationPointsTable",
      JSON.stringify({ ...CUSTOM_TABLE, pointsPerPrelimWin: "two" }),
    );
    expect(getPersistedQualificationPointsTable()).toBeNull();
  });

  it("returns the saved table once one is stored", () => {
    savePersistedQualificationPointsTable(CUSTOM_TABLE);
    expect(getPersistedQualificationPointsTable()).toEqual(CUSTOM_TABLE);
  });
});

describe("resetPersistedQualificationPointsTable", () => {
  it("clears a previously saved table", () => {
    savePersistedQualificationPointsTable(CUSTOM_TABLE);
    resetPersistedQualificationPointsTable();
    expect(getPersistedQualificationPointsTable()).toBeNull();
  });
});

describe("getEffectiveQualificationPointsTable", () => {
  it("falls back to the illustrative default when nothing is saved", () => {
    expect(getEffectiveQualificationPointsTable()).toEqual(DEFAULT_QUALIFICATION_POINTS_TABLE);
  });

  it("prefers a saved custom table over the default", () => {
    savePersistedQualificationPointsTable(CUSTOM_TABLE);
    expect(getEffectiveQualificationPointsTable()).toEqual(CUSTOM_TABLE);
  });

  it("falls back to the default again after a reset", () => {
    savePersistedQualificationPointsTable(CUSTOM_TABLE);
    resetPersistedQualificationPointsTable();
    expect(getEffectiveQualificationPointsTable()).toEqual(DEFAULT_QUALIFICATION_POINTS_TABLE);
  });
});
