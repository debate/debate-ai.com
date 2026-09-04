import { beforeEach, describe, expect, it } from "vitest";
import {
  buildCoachingProgramsPanelView,
  deleteCoachingProgram,
  getCoachingProgram,
  listCoachingPrograms,
  saveCoachingProgram,
} from "../src/state/coachingPrograms";
import type { CoachingProgramConfig } from "../src/round/coaching-program";

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

const VARSITY: CoachingProgramConfig = { id: "varsity", name: "Varsity Squad", memberIds: ["alice", "bob"] };
const JV: CoachingProgramConfig = { id: "jv", name: "JV Squad", memberIds: ["carol"] };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listCoachingPrograms", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listCoachingPrograms()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("coachingPrograms", "{not json");
    expect(listCoachingPrograms()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("coachingPrograms", JSON.stringify({ not: "an array" }));
    expect(listCoachingPrograms()).toEqual([]);
  });

  it("lists every saved program", () => {
    saveCoachingProgram(VARSITY);
    saveCoachingProgram(JV);
    expect(listCoachingPrograms()).toEqual([VARSITY, JV]);
  });
});

describe("getCoachingProgram", () => {
  it("finds a saved program by id", () => {
    saveCoachingProgram(VARSITY);
    expect(getCoachingProgram("varsity")).toEqual(VARSITY);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getCoachingProgram("missing")).toBeUndefined();
  });
});

describe("saveCoachingProgram", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveCoachingProgram(VARSITY);
    const renamed: CoachingProgramConfig = { ...VARSITY, name: "Varsity A", memberIds: ["alice", "bob", "dan"] };
    saveCoachingProgram(renamed);

    expect(listCoachingPrograms()).toEqual([renamed]);
    expect(getCoachingProgram("varsity")).toEqual(renamed);
  });
});

describe("deleteCoachingProgram", () => {
  it("removes a stored program by id", () => {
    saveCoachingProgram(VARSITY);
    saveCoachingProgram(JV);
    deleteCoachingProgram("varsity");

    expect(listCoachingPrograms()).toEqual([JV]);
    expect(getCoachingProgram("varsity")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    saveCoachingProgram(JV);
    deleteCoachingProgram("missing");
    expect(listCoachingPrograms()).toEqual([JV]);
  });
});

describe("buildCoachingProgramsPanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildCoachingProgramsPanelView()).toEqual([]);
  });

  it("sorts persisted programs by name", () => {
    saveCoachingProgram(VARSITY);
    saveCoachingProgram(JV);
    expect(buildCoachingProgramsPanelView()).toEqual([JV, VARSITY]);
  });

  it("does not mutate the underlying stored order", () => {
    saveCoachingProgram(VARSITY);
    saveCoachingProgram(JV);
    buildCoachingProgramsPanelView();
    expect(listCoachingPrograms()).toEqual([VARSITY, JV]);
  });
});
