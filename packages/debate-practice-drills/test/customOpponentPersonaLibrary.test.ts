import { beforeEach, describe, expect, it } from "vitest";
import {
  buildCustomOpponentPersonaLibraryPanelView,
  createOrUpdateCustomOpponentPersonaLibraryEntry,
  deleteCustomOpponentPersonaLibraryEntry,
  getCustomOpponentPersonaLibraryEntry,
  listCustomOpponentPersonaLibrary,
  planCustomOpponentPersonaLibraryMerge,
  resolveCustomOpponentPersonaLibraryConflict,
  saveCustomOpponentPersonaLibraryEntry,
} from "../src/state/customOpponentPersonaLibrary";
import type { SavedCustomOpponentPersona } from "../src/state/customOpponentPersonaLibrary";

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

const KRITIK_BOT: SavedCustomOpponentPersona = {
  id: "kritik-bot",
  name: "Kritik Bot",
  notes: "Opens on framework.",
  shared: false,
  createdAt: 100,
  updatedAt: 100,
};

const LAY_BOT: SavedCustomOpponentPersona = {
  id: "lay-bot",
  name: "Lay Bot",
  notes: "Plain language.",
  shared: true,
  createdAt: 200,
  updatedAt: 200,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listCustomOpponentPersonaLibrary", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listCustomOpponentPersonaLibrary()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("customOpponentPersonaLibrary", "{not json");
    expect(listCustomOpponentPersonaLibrary()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("customOpponentPersonaLibrary", JSON.stringify({ not: "an array" }));
    expect(listCustomOpponentPersonaLibrary()).toEqual([]);
  });

  it("lists every saved entry", () => {
    saveCustomOpponentPersonaLibraryEntry(KRITIK_BOT);
    saveCustomOpponentPersonaLibraryEntry(LAY_BOT);
    expect(listCustomOpponentPersonaLibrary()).toEqual([KRITIK_BOT, LAY_BOT]);
  });
});

describe("getCustomOpponentPersonaLibraryEntry", () => {
  it("finds a saved entry by id", () => {
    saveCustomOpponentPersonaLibraryEntry(KRITIK_BOT);
    expect(getCustomOpponentPersonaLibraryEntry("kritik-bot")).toEqual(KRITIK_BOT);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getCustomOpponentPersonaLibraryEntry("missing")).toBeUndefined();
  });
});

describe("saveCustomOpponentPersonaLibraryEntry", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveCustomOpponentPersonaLibraryEntry(KRITIK_BOT);
    const revised: SavedCustomOpponentPersona = { ...KRITIK_BOT, name: "Renamed Bot" };
    saveCustomOpponentPersonaLibraryEntry(revised);

    expect(listCustomOpponentPersonaLibrary()).toEqual([revised]);
  });
});

describe("createOrUpdateCustomOpponentPersonaLibraryEntry", () => {
  it("creates a fresh entry with a generated id when none is given", () => {
    const entry = createOrUpdateCustomOpponentPersonaLibraryEntry({ name: "Speedster", notes: "Spreads." });
    expect(entry.id.length).toBeGreaterThan(0);
    expect(listCustomOpponentPersonaLibrary()).toEqual([entry]);
  });

  it("revises an existing entry in place, preserving its original createdAt", () => {
    const created = createOrUpdateCustomOpponentPersonaLibraryEntry({ name: "Speedster", notes: "Spreads." });
    const revised = createOrUpdateCustomOpponentPersonaLibraryEntry({
      id: created.id,
      name: "Speedster Prime",
      notes: "Spreads even faster.",
    });

    expect(revised.id).toBe(created.id);
    expect(revised.createdAt).toBe(created.createdAt);
    expect(revised.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    expect(listCustomOpponentPersonaLibrary()).toEqual([revised]);
  });

  it("throws when name/notes is empty, without saving anything", () => {
    expect(() => createOrUpdateCustomOpponentPersonaLibraryEntry({ name: "   ", notes: "Spreads." })).toThrow();
    expect(listCustomOpponentPersonaLibrary()).toEqual([]);
  });
});

describe("deleteCustomOpponentPersonaLibraryEntry", () => {
  it("removes a stored entry by id", () => {
    saveCustomOpponentPersonaLibraryEntry(KRITIK_BOT);
    saveCustomOpponentPersonaLibraryEntry(LAY_BOT);
    deleteCustomOpponentPersonaLibraryEntry("kritik-bot");

    expect(listCustomOpponentPersonaLibrary()).toEqual([LAY_BOT]);
  });

  it("is a no-op when the id isn't stored", () => {
    saveCustomOpponentPersonaLibraryEntry(LAY_BOT);
    deleteCustomOpponentPersonaLibraryEntry("missing");
    expect(listCustomOpponentPersonaLibrary()).toEqual([LAY_BOT]);
  });
});

describe("buildCustomOpponentPersonaLibraryPanelView", () => {
  it("sorts every persisted entry alphabetically by name", () => {
    saveCustomOpponentPersonaLibraryEntry(LAY_BOT);
    saveCustomOpponentPersonaLibraryEntry(KRITIK_BOT);

    expect(buildCustomOpponentPersonaLibraryPanelView()).toEqual([KRITIK_BOT, LAY_BOT]);
  });
});

describe("resolveCustomOpponentPersonaLibraryConflict", () => {
  it("picks the newer remote copy", () => {
    const local = { ...KRITIK_BOT, updatedAt: 100 };
    const remote = { ...KRITIK_BOT, updatedAt: 200 };
    expect(resolveCustomOpponentPersonaLibraryConflict(local, remote)).toBe("remote");
  });

  it("picks the newer local copy", () => {
    const local = { ...KRITIK_BOT, updatedAt: 300 };
    const remote = { ...KRITIK_BOT, updatedAt: 200 };
    expect(resolveCustomOpponentPersonaLibraryConflict(local, remote)).toBe("local");
  });

  it("returns none when timestamps are equal", () => {
    expect(resolveCustomOpponentPersonaLibraryConflict(KRITIK_BOT, KRITIK_BOT)).toBe("none");
  });
});

describe("planCustomOpponentPersonaLibraryMerge", () => {
  it("adopts a remote-only entry", () => {
    const plan = planCustomOpponentPersonaLibraryMerge([], [KRITIK_BOT]);
    expect(plan.adopt).toEqual([KRITIK_BOT]);
    expect(plan.pushLocal).toEqual([]);
  });

  it("pushes a local-only entry", () => {
    const plan = planCustomOpponentPersonaLibraryMerge([KRITIK_BOT], []);
    expect(plan.adopt).toEqual([]);
    expect(plan.pushLocal).toEqual([KRITIK_BOT]);
  });

  it("adopts the remote copy when it's newer for a shared id", () => {
    const local = { ...KRITIK_BOT, updatedAt: 100 };
    const remote = { ...KRITIK_BOT, name: "Updated", updatedAt: 200 };
    const plan = planCustomOpponentPersonaLibraryMerge([local], [remote]);
    expect(plan.adopt).toEqual([remote]);
    expect(plan.pushLocal).toEqual([]);
  });

  it("pushes the local copy when it's newer for a shared id", () => {
    const local = { ...KRITIK_BOT, name: "Updated locally", updatedAt: 300 };
    const remote = { ...KRITIK_BOT, updatedAt: 200 };
    const plan = planCustomOpponentPersonaLibraryMerge([local], [remote]);
    expect(plan.adopt).toEqual([]);
    expect(plan.pushLocal).toEqual([local]);
  });

  it("does nothing for an identical shared id", () => {
    const plan = planCustomOpponentPersonaLibraryMerge([KRITIK_BOT], [KRITIK_BOT]);
    expect(plan.adopt).toEqual([]);
    expect(plan.pushLocal).toEqual([]);
  });
});
