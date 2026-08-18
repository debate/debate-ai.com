import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteContributorAvailability,
  getContributorAvailability,
  listContributorAvailability,
  recordPersistedTaskAssigned,
  recordPersistedTaskCompleted,
  saveContributorAvailability,
} from "../src/state/contributorAvailability";
import type { ContributorAvailability } from "../src/lib/research-task-routing";

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

const ALICE: ContributorAvailability = {
  contributorId: "alice",
  skillLevel: "advanced",
  activeTaskCount: 1,
  maxConcurrentTasks: 3,
};
const BOB: ContributorAvailability = {
  contributorId: "bob",
  skillLevel: "novice",
  activeTaskCount: 0,
  maxConcurrentTasks: 2,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listContributorAvailability", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listContributorAvailability()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("contributorAvailability", "{not json");
    expect(listContributorAvailability()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("contributorAvailability", JSON.stringify({ not: "an array" }));
    expect(listContributorAvailability()).toEqual([]);
  });

  it("lists every saved profile", () => {
    saveContributorAvailability(ALICE);
    saveContributorAvailability(BOB);
    expect(listContributorAvailability()).toEqual([ALICE, BOB]);
  });
});

describe("getContributorAvailability", () => {
  it("finds a saved profile by contributorId", () => {
    saveContributorAvailability(ALICE);
    expect(getContributorAvailability("alice")).toEqual(ALICE);
  });

  it("returns undefined for a contributorId that isn't stored", () => {
    expect(getContributorAvailability("missing")).toBeUndefined();
  });
});

describe("saveContributorAvailability", () => {
  it("upserts — saving an existing contributorId overwrites rather than duplicating it", () => {
    saveContributorAvailability(ALICE);
    const busier: ContributorAvailability = { ...ALICE, activeTaskCount: 2 };
    saveContributorAvailability(busier);

    expect(listContributorAvailability()).toEqual([busier]);
    expect(getContributorAvailability("alice")).toEqual(busier);
  });
});

describe("deleteContributorAvailability", () => {
  it("removes a stored profile by contributorId", () => {
    saveContributorAvailability(ALICE);
    saveContributorAvailability(BOB);
    deleteContributorAvailability("alice");

    expect(listContributorAvailability()).toEqual([BOB]);
    expect(getContributorAvailability("alice")).toBeUndefined();
  });

  it("is a no-op when the contributorId isn't stored", () => {
    saveContributorAvailability(BOB);
    deleteContributorAvailability("missing");
    expect(listContributorAvailability()).toEqual([BOB]);
  });
});

describe("recordPersistedTaskAssigned", () => {
  it("increments a stored profile's activeTaskCount by one and saves it", () => {
    saveContributorAvailability(BOB);
    const updated = recordPersistedTaskAssigned("bob");

    expect(updated).toEqual({ ...BOB, activeTaskCount: 1 });
    expect(getContributorAvailability("bob")).toEqual({ ...BOB, activeTaskCount: 1 });
  });

  it("returns undefined and leaves storage untouched when no profile is stored for that contributorId", () => {
    expect(recordPersistedTaskAssigned("ghost")).toBeUndefined();
    expect(listContributorAvailability()).toEqual([]);
  });
});

describe("recordPersistedTaskCompleted", () => {
  it("decrements a stored profile's activeTaskCount by one and saves it", () => {
    saveContributorAvailability(ALICE);
    const updated = recordPersistedTaskCompleted("alice");

    expect(updated).toEqual({ ...ALICE, activeTaskCount: 0 });
    expect(getContributorAvailability("alice")).toEqual({ ...ALICE, activeTaskCount: 0 });
  });

  it("never decrements activeTaskCount below zero", () => {
    saveContributorAvailability(BOB);
    const updated = recordPersistedTaskCompleted("bob");

    expect(updated).toEqual({ ...BOB, activeTaskCount: 0 });
  });

  it("returns undefined and leaves storage untouched when no profile is stored for that contributorId", () => {
    expect(recordPersistedTaskCompleted("ghost")).toBeUndefined();
    expect(listContributorAvailability()).toEqual([]);
  });
});
