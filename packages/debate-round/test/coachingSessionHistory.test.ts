import { beforeEach, describe, expect, it } from "vitest";
import {
  appendCoachingSessionVersion,
  coachingSessionFromVersion,
  deleteVersionsForCoachingSession,
  listVersionsForCoachingSession,
  MAX_COACHING_SESSION_VERSIONS,
  type CoachingSessionSnapshotInput,
} from "../src/state/coachingSessionHistory";

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

const SESSION: CoachingSessionSnapshotInput = {
  roundId: "round-1",
  sideKey: "AFF",
  prompts: [
    { kind: "refutation", rowIndex: 0, prompt: 'Answer "Solvency deficit" before it\'s extended against you.' },
  ],
  aiFeedback: "Lead with the solvency deficit.",
  createdAt: 500,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("appendCoachingSessionVersion", () => {
  it("snapshots a session's fields under its roundId+sideKey with a replacedAt timestamp", () => {
    const version = appendCoachingSessionVersion(SESSION, 1000);

    expect(version).toEqual({
      id: "round-1-AFF-v1000-0",
      roundId: "round-1",
      sideKey: "AFF",
      prompts: SESSION.prompts,
      aiFeedback: "Lead with the solvency deficit.",
      createdAt: 500,
      replacedAt: 1000,
    });
    expect(listVersionsForCoachingSession("round-1", "AFF")).toEqual([version]);
  });

  it("defaults replacedAt to the current time when not given", () => {
    const before = Date.now();
    const version = appendCoachingSessionVersion(SESSION);
    expect(version.replacedAt).toBeGreaterThanOrEqual(before);
  });

  it("assigns distinct ids for two overwrites within the same millisecond", () => {
    const first = appendCoachingSessionVersion(SESSION, 5000);
    const second = appendCoachingSessionVersion({ ...SESSION, aiFeedback: "Revised." }, 5000);
    expect(first.id).not.toBe(second.id);
  });

  it("keeps versions for different roundId+sideKey pairs separate", () => {
    appendCoachingSessionVersion(SESSION, 1000);
    appendCoachingSessionVersion({ ...SESSION, sideKey: "NEG" }, 2000);

    expect(listVersionsForCoachingSession("round-1", "AFF")).toHaveLength(1);
    expect(listVersionsForCoachingSession("round-1", "NEG")).toHaveLength(1);
  });

  it("caps versions per pair at MAX_COACHING_SESSION_VERSIONS, dropping the oldest", () => {
    for (let i = 0; i < MAX_COACHING_SESSION_VERSIONS + 3; i++) {
      appendCoachingSessionVersion({ ...SESSION, aiFeedback: `Revision ${i}` }, 1000 + i);
    }

    const versions = listVersionsForCoachingSession("round-1", "AFF");
    expect(versions).toHaveLength(MAX_COACHING_SESSION_VERSIONS);
    // Newest first; the three oldest (Revision 0, 1, 2) should be gone.
    expect(versions[0]?.aiFeedback).toBe(`Revision ${MAX_COACHING_SESSION_VERSIONS + 2}`);
    expect(versions.some((v) => v.aiFeedback === "Revision 0")).toBe(false);
  });
});

describe("listVersionsForCoachingSession", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listVersionsForCoachingSession("round-1", "AFF")).toEqual([]);
  });

  it("returns versions newest first", () => {
    appendCoachingSessionVersion({ ...SESSION, aiFeedback: "First" }, 1000);
    appendCoachingSessionVersion({ ...SESSION, aiFeedback: "Second" }, 2000);

    const versions = listVersionsForCoachingSession("round-1", "AFF");
    expect(versions.map((v) => v.aiFeedback)).toEqual(["Second", "First"]);
  });
});

describe("deleteVersionsForCoachingSession", () => {
  it("removes every version of the given roundId+sideKey pair only", () => {
    appendCoachingSessionVersion(SESSION, 1000);
    appendCoachingSessionVersion({ ...SESSION, sideKey: "NEG" }, 2000);

    deleteVersionsForCoachingSession("round-1", "AFF");

    expect(listVersionsForCoachingSession("round-1", "AFF")).toEqual([]);
    expect(listVersionsForCoachingSession("round-1", "NEG")).toHaveLength(1);
  });

  it("is a no-op when no versions exist for the pair", () => {
    expect(() => deleteVersionsForCoachingSession("missing", "AFF")).not.toThrow();
  });

  it("returns the ids that were removed, and an empty array when none were", () => {
    const version = appendCoachingSessionVersion(SESSION, 1000);
    expect(deleteVersionsForCoachingSession("round-1", "AFF")).toEqual([version.id]);
    expect(deleteVersionsForCoachingSession("missing", "AFF")).toEqual([]);
  });
});

describe("coachingSessionFromVersion", () => {
  it("rebuilds a CoachingSessionSnapshotInput from a version snapshot, keyed by roundId+sideKey", () => {
    const version = appendCoachingSessionVersion(SESSION, 1000);
    expect(coachingSessionFromVersion(version)).toEqual(SESSION);
  });
});
