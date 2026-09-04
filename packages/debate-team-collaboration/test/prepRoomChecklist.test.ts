import { beforeEach, describe, expect, it } from "vitest";
import {
  addPersistedChecklistItem,
  deletePersistedChecklistItem,
  listAllPrepRoomChecklistItems,
  listPersistedChecklistItems,
  togglePersistedChecklistItem,
} from "../src/state/prepRoomChecklist";

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

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("addPersistedChecklistItem", () => {
  it("persists a new item and returns it", () => {
    const item = addPersistedChecklistItem("Immigration", "Book the practice room", "alice", 1_000);
    expect(item?.text).toBe("Book the practice room");
    expect(item?.done).toBe(false);
    expect(listAllPrepRoomChecklistItems()).toHaveLength(1);
  });

  it("returns undefined and stores nothing for blank text", () => {
    expect(addPersistedChecklistItem("Immigration", "   ", "alice", 1_000)).toBeUndefined();
    expect(listAllPrepRoomChecklistItems()).toEqual([]);
  });

  it("returns undefined and stores nothing for a blank createdBy", () => {
    expect(addPersistedChecklistItem("Immigration", "Task", "   ", 1_000)).toBeUndefined();
    expect(listAllPrepRoomChecklistItems()).toEqual([]);
  });

  it("generates a distinct id per item", () => {
    const first = addPersistedChecklistItem("Immigration", "Task A", "alice", 1_000);
    const second = addPersistedChecklistItem("Immigration", "Task B", "alice", 1_001);
    expect(first?.id).not.toBe(second?.id);
  });
});

describe("listPersistedChecklistItems", () => {
  it("scopes to the given topic and orders open-first via listChecklistItemsForTopic", () => {
    addPersistedChecklistItem("Immigration", "Task A", "alice", 1_000);
    addPersistedChecklistItem("Trade", "Task B", "bob", 2_000);

    const items = listPersistedChecklistItems("Immigration");
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("Task A");
  });

  it("returns an empty list for a topic with no items", () => {
    expect(listPersistedChecklistItems("Immigration")).toEqual([]);
  });
});

describe("togglePersistedChecklistItem", () => {
  it("marks a persisted item done and saves the change", () => {
    const item = addPersistedChecklistItem("Immigration", "Task", "alice", 1_000)!;
    const updated = togglePersistedChecklistItem(item.id, true, "bob", 2_000);

    expect(updated?.done).toBe(true);
    expect(updated?.completedBy).toBe("bob");
    expect(listPersistedChecklistItems("Immigration")[0].done).toBe(true);
  });

  it("returns undefined when no item matches the id", () => {
    expect(togglePersistedChecklistItem("missing", true, "bob", 2_000)).toBeUndefined();
  });
});

describe("deletePersistedChecklistItem", () => {
  it("removes a persisted item", () => {
    const item = addPersistedChecklistItem("Immigration", "Task", "alice", 1_000)!;
    deletePersistedChecklistItem(item.id);
    expect(listPersistedChecklistItems("Immigration")).toEqual([]);
  });

  it("is a no-op when no item matches the id", () => {
    addPersistedChecklistItem("Immigration", "Task", "alice", 1_000);
    deletePersistedChecklistItem("missing");
    expect(listPersistedChecklistItems("Immigration")).toHaveLength(1);
  });
});
