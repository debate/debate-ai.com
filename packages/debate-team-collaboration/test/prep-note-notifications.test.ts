import { describe, expect, it } from "vitest";
import {
  buildNotificationSummaryText,
  countUnreadForRecipient,
  createPrepNoteAssignedNotification,
  getNotificationsForRecipient,
  getUnreadNotifications,
  markNotificationRead,
  sortNotificationsByCreatedAt,
  type PrepNoteNotification,
} from "../src/flow/prep-note-notifications";
import type { PrepNote } from "debate-round/src/flow/strategy-sync-notes";

function prepNote(overrides: Partial<PrepNote> = {}): PrepNote {
  return {
    id: "n1",
    flowId: 1,
    boxPath: [0],
    authorId: "alex",
    text: "Answer the solvency turn",
    status: "open",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function notification(overrides: Partial<PrepNoteNotification> = {}): PrepNoteNotification {
  return {
    id: "notif-1",
    recipientId: "carol",
    prepNoteId: "n1",
    noteText: "Answer the solvency turn",
    noteAuthorId: "alex",
    createdAt: 100,
    read: false,
    ...overrides,
  };
}

describe("createPrepNoteAssignedNotification", () => {
  it("builds an unread notification addressed to the recipient from the note's current text/author", () => {
    expect(
      createPrepNoteAssignedNotification({
        id: "notif-1",
        note: prepNote(),
        recipientId: "carol",
        createdAt: 100,
      }),
    ).toEqual({
      id: "notif-1",
      recipientId: "carol",
      prepNoteId: "n1",
      noteText: "Answer the solvency turn",
      noteAuthorId: "alex",
      createdAt: 100,
      read: false,
    });
  });

  it("throws when recipientId is blank", () => {
    expect(() =>
      createPrepNoteAssignedNotification({
        id: "notif-1",
        note: prepNote(),
        recipientId: "   ",
        createdAt: 100,
      }),
    ).toThrow(/recipientId is required/);
  });
});

describe("markNotificationRead", () => {
  it("returns a copy marked read", () => {
    const unread = notification();
    const read = markNotificationRead(unread);

    expect(read).toEqual({ ...unread, read: true });
    expect(unread.read).toBe(false);
  });

  it("is a no-op (stays read) when already read", () => {
    const alreadyRead = notification({ read: true });
    expect(markNotificationRead(alreadyRead)).toEqual(alreadyRead);
  });
});

describe("sortNotificationsByCreatedAt", () => {
  it("sorts descending by createdAt (newest first) without mutating the input", () => {
    const oldest = notification({ id: "n-old", createdAt: 100 });
    const newest = notification({ id: "n-new", createdAt: 300 });
    const middle = notification({ id: "n-mid", createdAt: 200 });
    const input = [oldest, newest, middle];

    expect(sortNotificationsByCreatedAt(input)).toEqual([newest, middle, oldest]);
    expect(input).toEqual([oldest, newest, middle]);
  });
});

describe("getNotificationsForRecipient", () => {
  it("returns only notifications addressed to the given recipient, newest first", () => {
    const forCarol = notification({ id: "n1", recipientId: "carol", createdAt: 100 });
    const forCarolNewer = notification({ id: "n2", recipientId: "carol", createdAt: 200 });
    const forBob = notification({ id: "n3", recipientId: "bob", createdAt: 300 });

    expect(getNotificationsForRecipient([forCarol, forCarolNewer, forBob], "carol")).toEqual([
      forCarolNewer,
      forCarol,
    ]);
  });

  it("returns an empty list for a recipient with no notifications", () => {
    expect(getNotificationsForRecipient([notification()], "nobody")).toEqual([]);
  });
});

describe("getUnreadNotifications", () => {
  it("returns only unread notifications, newest first", () => {
    const unreadOld = notification({ id: "n1", createdAt: 100, read: false });
    const read = notification({ id: "n2", createdAt: 200, read: true });
    const unreadNew = notification({ id: "n3", createdAt: 300, read: false });

    expect(getUnreadNotifications([unreadOld, read, unreadNew])).toEqual([unreadNew, unreadOld]);
  });
});

describe("countUnreadForRecipient", () => {
  it("counts only unread notifications for the given recipient", () => {
    const notifications = [
      notification({ id: "n1", recipientId: "carol", read: false }),
      notification({ id: "n2", recipientId: "carol", read: true }),
      notification({ id: "n3", recipientId: "bob", read: false }),
    ];
    expect(countUnreadForRecipient(notifications, "carol")).toBe(1);
    expect(countUnreadForRecipient(notifications, "bob")).toBe(1);
    expect(countUnreadForRecipient(notifications, "nobody")).toBe(0);
  });
});

describe("buildNotificationSummaryText", () => {
  it("reports no notifications when the recipient has none", () => {
    expect(buildNotificationSummaryText([], "carol")).toBe("No notifications yet.");
  });

  it("summarizes counts and lists unread notifications", () => {
    const unread = notification({ id: "n1", read: false, noteText: "Answer the solvency turn" });
    const read = notification({ id: "n2", read: true });

    expect(buildNotificationSummaryText([unread, read], "carol")).toBe(
      '2 notifications: 1 unread\n- "Answer the solvency turn" (from a note by alex)',
    );
  });
});
