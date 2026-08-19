import { beforeEach, describe, expect, it } from "vitest";
import {
  createAssignmentNotification,
  markNotificationRead,
  getNotificationsForRecipient,
  getUnreadNotifications,
  buildNotificationSummaryText,
} from "../src/notifications/notifications";
import {
  assignPersistedPrepNoteAndNotify,
  getNotification,
  listNotifications,
  listNotificationsForRecipient,
  markPersistedNotificationRead,
  notifyPrepNoteAssignment,
  saveNotification,
} from "../src/state/notifications";
import { savePrepNote } from "../src/state/prepNotes";
import type { Notification } from "../src/notifications/notifications";
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

const ASSIGNED_NOTE: PrepNote = {
  id: "note-1",
  flowId: 1,
  boxPath: [0, 1],
  authorId: "alice",
  text: "Answer the solvency turn",
  status: "open",
  assignedToId: "bob",
  createdAt: 100,
  updatedAt: 100,
};

const UNASSIGNED_NOTE: PrepNote = {
  id: "note-2",
  flowId: 1,
  boxPath: [0, 1],
  authorId: "alice",
  text: "Answer the solvency turn",
  status: "open",
  createdAt: 100,
  updatedAt: 100,
};

const SELF_ASSIGNED_NOTE: PrepNote = { ...ASSIGNED_NOTE, id: "note-3", assignedToId: "alice" };

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("createAssignmentNotification", () => {
  it("builds a notification for the note's assignee", () => {
    const notification = createAssignmentNotification(ASSIGNED_NOTE, "n-1", 200);
    expect(notification).toEqual({
      id: "n-1",
      kind: "prep-note-assigned",
      recipientId: "bob",
      message: 'alice assigned you a prep note: "Answer the solvency turn"',
      sourceId: "note-1",
      read: false,
      createdAt: 200,
    });
  });

  it("returns null when the note has no assignee", () => {
    expect(createAssignmentNotification(UNASSIGNED_NOTE, "n-1", 200)).toBeNull();
  });

  it("returns null for a self-assignment", () => {
    expect(createAssignmentNotification(SELF_ASSIGNED_NOTE, "n-1", 200)).toBeNull();
  });
});

describe("markNotificationRead", () => {
  it("marks an unread notification read", () => {
    const notification = createAssignmentNotification(ASSIGNED_NOTE, "n-1", 200)!;
    expect(markNotificationRead(notification)).toEqual({ ...notification, read: true });
  });

  it("is a no-op on an already-read notification", () => {
    const notification: Notification = {
      ...createAssignmentNotification(ASSIGNED_NOTE, "n-1", 200)!,
      read: true,
    };
    expect(markNotificationRead(notification)).toBe(notification);
  });
});

describe("getNotificationsForRecipient / getUnreadNotifications", () => {
  const older: Notification = { ...createAssignmentNotification(ASSIGNED_NOTE, "n-1", 100)! };
  const newer: Notification = {
    ...createAssignmentNotification(ASSIGNED_NOTE, "n-2", 200)!,
    read: true,
  };
  const otherRecipient: Notification = { ...older, id: "n-3", recipientId: "carol" };

  it("returns only the given recipient's notifications, newest first", () => {
    expect(getNotificationsForRecipient([older, newer, otherRecipient], "bob")).toEqual([newer, older]);
  });

  it("returns only unread notifications, newest first", () => {
    expect(getUnreadNotifications([older, newer])).toEqual([older]);
  });
});

describe("buildNotificationSummaryText", () => {
  it("reports no notifications", () => {
    expect(buildNotificationSummaryText([])).toBe("No notifications yet.");
  });

  it("reports unread count and lines for unread notifications", () => {
    const unread = createAssignmentNotification(ASSIGNED_NOTE, "n-1", 100)!;
    const read: Notification = { ...createAssignmentNotification(ASSIGNED_NOTE, "n-2", 200)!, read: true };
    expect(buildNotificationSummaryText([unread, read])).toBe(
      '2 notifications: 1 unread\n- alice assigned you a prep note: "Answer the solvency turn"',
    );
  });
});

describe("state/notifications persistence", () => {
  it("listNotifications returns an empty list when nothing is stored", () => {
    expect(listNotifications()).toEqual([]);
  });

  it("listNotifications returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("notifications", "{not json");
    expect(listNotifications()).toEqual([]);
  });

  it("saveNotification upserts by id", () => {
    const notification = createAssignmentNotification(ASSIGNED_NOTE, "n-1", 100)!;
    saveNotification(notification);
    const read = { ...notification, read: true };
    saveNotification(read);

    expect(listNotifications()).toEqual([read]);
    expect(getNotification("n-1")).toEqual(read);
  });

  it("listNotificationsForRecipient scopes to one recipient, newest first", () => {
    saveNotification(createAssignmentNotification(ASSIGNED_NOTE, "n-1", 100)!);
    saveNotification(createAssignmentNotification({ ...ASSIGNED_NOTE, id: "note-4" }, "n-2", 200)!);
    saveNotification({ ...createAssignmentNotification(ASSIGNED_NOTE, "n-3", 150)!, recipientId: "carol" });

    expect(listNotificationsForRecipient("bob").map((n) => n.id)).toEqual(["n-2", "n-1"]);
    expect(listNotificationsForRecipient("carol").map((n) => n.id)).toEqual(["n-3"]);
  });

  it("markPersistedNotificationRead marks and persists, returns undefined when missing", () => {
    saveNotification(createAssignmentNotification(ASSIGNED_NOTE, "n-1", 100)!);
    const updated = markPersistedNotificationRead("n-1");

    expect(updated?.read).toBe(true);
    expect(getNotification("n-1")?.read).toBe(true);
    expect(markPersistedNotificationRead("missing")).toBeUndefined();
  });

  it("notifyPrepNoteAssignment saves a notification for an assigned note", () => {
    const notification = notifyPrepNoteAssignment(ASSIGNED_NOTE, "n-1", 200);
    expect(notification?.recipientId).toBe("bob");
    expect(getNotification("n-1")).toEqual(notification);
  });

  it("notifyPrepNoteAssignment saves nothing for an unassigned or self-assigned note", () => {
    expect(notifyPrepNoteAssignment(UNASSIGNED_NOTE, "n-1", 200)).toBeUndefined();
    expect(notifyPrepNoteAssignment(SELF_ASSIGNED_NOTE, "n-2", 200)).toBeUndefined();
    expect(listNotifications()).toEqual([]);
  });
});

describe("assignPersistedPrepNoteAndNotify", () => {
  const OPEN_NOTE: PrepNote = { ...UNASSIGNED_NOTE, id: "note-5" };

  it("assigns the note and creates the assignee's notification", () => {
    savePrepNote(OPEN_NOTE);
    const updated = assignPersistedPrepNoteAndNotify("note-5", "bob", 300, "n-1");

    expect(updated?.assignedToId).toBe("bob");
    const notifications = listNotificationsForRecipient("bob");
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ sourceId: "note-5", recipientId: "bob", read: false });
  });

  it("does not create a notification for a self-assignment", () => {
    savePrepNote(OPEN_NOTE);
    assignPersistedPrepNoteAndNotify("note-5", "alice", 300, "n-1");

    expect(listNotificationsForRecipient("alice")).toEqual([]);
  });

  it("does not create a notification when unassigning", () => {
    savePrepNote({ ...OPEN_NOTE, assignedToId: "bob" });
    assignPersistedPrepNoteAndNotify("note-5", null, 300, "n-1");

    expect(listNotifications()).toEqual([]);
  });

  it("returns undefined and creates no notification when the note id isn't stored", () => {
    const updated = assignPersistedPrepNoteAndNotify("missing", "bob", 300, "n-1");

    expect(updated).toBeUndefined();
    expect(listNotifications()).toEqual([]);
  });
});
