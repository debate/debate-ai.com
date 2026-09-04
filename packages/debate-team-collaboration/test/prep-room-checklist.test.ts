import { describe, expect, it } from "vitest";
import {
  MAX_PREP_ROOM_CHECKLIST_ITEM_TEXT_LENGTH,
  addChecklistItem,
  buildChecklistSummaryText,
  deleteChecklistItem,
  listChecklistItemsForTopic,
  toggleChecklistItem,
  type PrepRoomChecklistItem,
} from "../src/lib/prep-room-checklist";

describe("addChecklistItem", () => {
  it("appends a new open item with trimmed text and createdBy", () => {
    const items = addChecklistItem([], {
      id: "item-1",
      topic: "Immigration",
      text: "  Book the practice room  ",
      createdBy: " alice ",
      atMs: 1_000,
    });

    expect(items).toEqual([
      {
        id: "item-1",
        topic: "Immigration",
        text: "Book the practice room",
        done: false,
        createdBy: "alice",
        createdAt: 1_000,
      },
    ]);
  });

  it("caps text at MAX_PREP_ROOM_CHECKLIST_ITEM_TEXT_LENGTH", () => {
    const longText = "x".repeat(MAX_PREP_ROOM_CHECKLIST_ITEM_TEXT_LENGTH + 50);
    const items = addChecklistItem([], { id: "item-1", topic: "Immigration", text: longText, createdBy: "alice", atMs: 1_000 });
    expect(items[0].text).toHaveLength(MAX_PREP_ROOM_CHECKLIST_ITEM_TEXT_LENGTH);
  });

  it("doesn't mutate the original items array", () => {
    const original: PrepRoomChecklistItem[] = [];
    addChecklistItem(original, { id: "item-1", topic: "Immigration", text: "Task", createdBy: "alice", atMs: 1_000 });
    expect(original).toEqual([]);
  });
});

describe("toggleChecklistItem", () => {
  const base = addChecklistItem([], { id: "item-1", topic: "Immigration", text: "Task", createdBy: "alice", atMs: 1_000 });

  it("marks an item done, stamping completedAt/completedBy", () => {
    const toggled = toggleChecklistItem(base, "item-1", true, "bob", 2_000);
    expect(toggled[0]).toEqual({
      ...base[0],
      done: true,
      completedAt: 2_000,
      completedBy: "bob",
    });
  });

  it("marks a done item open again, clearing completedAt/completedBy", () => {
    const done = toggleChecklistItem(base, "item-1", true, "bob", 2_000);
    const reopened = toggleChecklistItem(done, "item-1", false, "bob", 3_000);
    expect(reopened[0]).toEqual(base[0]);
  });

  it("is a no-op copy when no item matches the id", () => {
    expect(toggleChecklistItem(base, "missing", true, "bob", 2_000)).toEqual(base);
  });
});

describe("deleteChecklistItem", () => {
  it("removes the matching item", () => {
    const items = addChecklistItem([], { id: "item-1", topic: "Immigration", text: "Task", createdBy: "alice", atMs: 1_000 });
    expect(deleteChecklistItem(items, "item-1")).toEqual([]);
  });

  it("is a no-op copy when no item matches the id", () => {
    const items = addChecklistItem([], { id: "item-1", topic: "Immigration", text: "Task", createdBy: "alice", atMs: 1_000 });
    expect(deleteChecklistItem(items, "missing")).toEqual(items);
  });
});

describe("listChecklistItemsForTopic", () => {
  it("scopes items to the given topic only", () => {
    let items = addChecklistItem([], { id: "item-1", topic: "Immigration", text: "Task A", createdBy: "alice", atMs: 1_000 });
    items = addChecklistItem(items, { id: "item-2", topic: "Trade", text: "Task B", createdBy: "bob", atMs: 2_000 });

    expect(listChecklistItemsForTopic(items, "Immigration").map((item) => item.id)).toEqual(["item-1"]);
  });

  it("orders open items oldest first, then done items newest-completed first", () => {
    let items: PrepRoomChecklistItem[] = [];
    items = addChecklistItem(items, { id: "item-1", topic: "Immigration", text: "First", createdBy: "alice", atMs: 1_000 });
    items = addChecklistItem(items, { id: "item-2", topic: "Immigration", text: "Second", createdBy: "alice", atMs: 2_000 });
    items = addChecklistItem(items, { id: "item-3", topic: "Immigration", text: "Third", createdBy: "alice", atMs: 3_000 });
    items = toggleChecklistItem(items, "item-1", true, "alice", 4_000);
    items = toggleChecklistItem(items, "item-3", true, "alice", 5_000);

    expect(listChecklistItemsForTopic(items, "Immigration").map((item) => item.id)).toEqual(["item-2", "item-3", "item-1"]);
  });
});

describe("buildChecklistSummaryText", () => {
  it("reports no checklist tasks yet when the topic has none", () => {
    expect(buildChecklistSummaryText([], "Immigration")).toBe("No checklist tasks yet.");
  });

  it("counts done vs total items scoped to the topic", () => {
    let items: PrepRoomChecklistItem[] = [];
    items = addChecklistItem(items, { id: "item-1", topic: "Immigration", text: "A", createdBy: "alice", atMs: 1_000 });
    items = addChecklistItem(items, { id: "item-2", topic: "Immigration", text: "B", createdBy: "alice", atMs: 2_000 });
    items = addChecklistItem(items, { id: "item-3", topic: "Trade", text: "C", createdBy: "alice", atMs: 3_000 });
    items = toggleChecklistItem(items, "item-1", true, "alice", 4_000);

    expect(buildChecklistSummaryText(items, "Immigration")).toBe("1 of 2 tasks done");
  });
});
