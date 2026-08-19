import { beforeEach, describe, expect, it } from "vitest";
import {
  buildNotificationsPanelView,
  getNotification,
  listNotifications,
  listNotificationsForRecipient,
  markPersistedNotificationRead,
  recordPrepNoteAssignedNotification,
  saveNotification,
} from "../src/state/prepNoteNotifications";
import type { PrepNoteNotification } from "../src/flow/prep-note-notifications";
import type { PrepNote } from "../src/flow/strategy-sync-notes";

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

const NOTE: PrepNote = {
  id: "n1",
  flowId: 1,
  boxPath: [0, 1],
  authorId: "alex",
  text: "Answer the solvency turn",
  status: "open",
  createdAt: 0,
  updatedAt: 0,
};

const NOTIFICATION_FOR_CAROL: PrepNoteNotification = {
  id: "notif-1",
  recipientId: "carol",
  prepNoteId: "n1",
  noteText: "Answer the solvency turn",
  noteAuthorId: "alex",
  createdAt: 100,
  read: false,
};
const NOTIFICATION_FOR_BOB: PrepNoteNotification = {
  id: "notif-2",
  recipientId: "bob",
  prepNoteId: "n2",
  noteText: "Cover the topicality shell",
  noteAuthorId: "alex",
  createdAt: 200,
  read: false,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listNotifications", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listNotifications()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("prepNoteNotifications", "{not json");
    expect(listNotifications()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("prepNoteNotifications", JSON.stringify({ not: "an array" }));
    expect(listNotifications()).toEqual([]);
  });

  it("lists every saved notification across recipients", () => {
    saveNotification(NOTIFICATION_FOR_CAROL);
    saveNotification(NOTIFICATION_FOR_BOB);
    expect(listNotifications()).toEqual([NOTIFICATION_FOR_CAROL, NOTIFICATION_FOR_BOB]);
  });
});

describe("listNotificationsForRecipient", () => {
  it("returns only the given recipient's notifications, newest first", () => {
    saveNotification(NOTIFICATION_FOR_CAROL);
    saveNotification(NOTIFICATION_FOR_BOB);
    expect(listNotificationsForRecipient("carol")).toEqual([NOTIFICATION_FOR_CAROL]);
    expect(listNotificationsForRecipient("bob")).toEqual([NOTIFICATION_FOR_BOB]);
  });

  it("returns an empty list for a recipient with no notifications", () => {
    saveNotification(NOTIFICATION_FOR_CAROL);
    expect(listNotificationsForRecipient("nobody")).toEqual([]);
  });
});

describe("getNotification", () => {
  it("finds a saved notification by id", () => {
    saveNotification(NOTIFICATION_FOR_CAROL);
    expect(getNotification("notif-1")).toEqual(NOTIFICATION_FOR_CAROL);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getNotification("missing")).toBeUndefined();
  });
});

describe("saveNotification", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveNotification(NOTIFICATION_FOR_CAROL);
    const read = { ...NOTIFICATION_FOR_CAROL, read: true };
    saveNotification(read);

    expect(listNotifications()).toEqual([read]);
    expect(getNotification("notif-1")).toEqual(read);
  });
});

describe("recordPrepNoteAssignedNotification", () => {
  it("builds and persists an assignment notification for the recipient", () => {
    const result = recordPrepNoteAssignedNotification("notif-3", NOTE, "carol", 500);

    expect(result).toEqual({
      id: "notif-3",
      recipientId: "carol",
      prepNoteId: "n1",
      noteText: "Answer the solvency turn",
      noteAuthorId: "alex",
      createdAt: 500,
      read: false,
    });
    expect(getNotification("notif-3")).toEqual(result);
  });
});

describe("markPersistedNotificationRead", () => {
  it("marks a stored notification read and persists it", () => {
    saveNotification(NOTIFICATION_FOR_CAROL);
    const updated = markPersistedNotificationRead("notif-1");

    expect(updated).toEqual({ ...NOTIFICATION_FOR_CAROL, read: true });
    expect(getNotification("notif-1")).toEqual({ ...NOTIFICATION_FOR_CAROL, read: true });
  });

  it("returns undefined and leaves storage untouched when the id isn't stored", () => {
    saveNotification(NOTIFICATION_FOR_BOB);
    const updated = markPersistedNotificationRead("missing");

    expect(updated).toBeUndefined();
    expect(listNotifications()).toEqual([NOTIFICATION_FOR_BOB]);
  });
});

describe("buildNotificationsPanelView", () => {
  it("returns an empty list when the recipient has no notifications", () => {
    expect(buildNotificationsPanelView("carol")).toEqual([]);
  });

  it("returns the recipient's notifications, newest first", () => {
    const olderForCarol = { ...NOTIFICATION_FOR_CAROL, id: "notif-0", createdAt: 50 };
    saveNotification(olderForCarol);
    saveNotification(NOTIFICATION_FOR_CAROL);
    saveNotification(NOTIFICATION_FOR_BOB);

    expect(buildNotificationsPanelView("carol")).toEqual([NOTIFICATION_FOR_CAROL, olderForCarol]);
  });
});
