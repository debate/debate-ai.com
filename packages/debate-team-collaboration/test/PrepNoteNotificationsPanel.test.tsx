// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `PrepNoteNotificationsPanel`, which had no
 * component test at all before this file — unlike its state layer
 * (`state/prepNoteNotifications.ts`, `flow/prep-note-notifications.ts`),
 * both already covered by `prepNoteNotifications.test.ts`/
 * `prep-note-notifications.test.ts`. This is the same "real logic, zero
 * component coverage" gap `debate-search-evidence/test/ArgumentLibraryPanel.test.tsx`
 * closed for that panel: the recipient lookup, digest grouping, expand/
 * collapse, and mark-read/mark-all-read actions were all wired together but
 * never exercised by a test.
 *
 * Uses the same jsdom + `react-dom/client` + `act` pattern
 * `debate-search-evidence/test/ArgumentLibraryPanel.test.tsx`,
 * `debate-round/test/FlowEditLogPanel.test.tsx` and
 * `debate-videos/test/glowing-effect-listeners.test.tsx` established for a
 * component that loads its own data inside a `useEffect` (a `node`-environment
 * `renderToStaticMarkup` snapshot never runs effects, so it can't see this
 * panel's notifications at all) — this package's first use of that pattern,
 * so it also adds `test/helpers/mount.tsx`, mirroring
 * `debate-search-evidence/test/helpers/mount.tsx`'s `mount`/`click`/`type`/
 * `flush` API exactly rather than inventing a new one.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";

import { PrepNoteNotificationsPanel } from "../src/panels/PrepNoteNotificationsPanel";
import { saveNotification } from "../src/state/prepNoteNotifications";
import type { PrepNoteNotification } from "../src/flow/prep-note-notifications";
import { click, flush, mount, type } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

const RECIPIENT_STORAGE_KEY = "prepNoteNotifications:lastRecipientId";

function makeNotification(overrides: Partial<PrepNoteNotification> = {}): PrepNoteNotification {
  return {
    id: "notif-1",
    recipientId: "alice",
    prepNoteId: "note-1",
    noteText: "Cut the warming impact card",
    noteAuthorId: "bob",
    createdAt: Date.UTC(2026, 7, 15, 10, 0, 0),
    read: false,
    ...overrides,
  };
}

function byTagText(container: HTMLElement, tag: string, text: string): HTMLElement | null {
  return (
    (Array.from(container.querySelectorAll(tag)).find((el) => el.textContent?.trim() === text) as
      | HTMLElement
      | undefined) ?? null
  );
}

const buttonByText = (container: HTMLElement, text: string) =>
  byTagText(container, "button", text) as HTMLButtonElement | null;

function getInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector("input") as HTMLInputElement;
}

let view: Mounted;

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  localStorage.clear();
});

describe("PrepNoteNotificationsPanel empty state", () => {
  it("shows the empty state when nothing has been looked up yet", async () => {
    view = await mount(createElement(PrepNoteNotificationsPanel));
    expect(view.container.textContent).toContain("No notifications for this id yet.");
    expect(view.container.textContent).toContain("0 unread");
  });

  it("shows an empty state after looking up a recipient with no notifications", async () => {
    saveNotification(makeNotification({ recipientId: "alice" }));
    view = await mount(createElement(PrepNoteNotificationsPanel));

    await type(getInput(view.container), "bob");
    await click(buttonByText(view.container, "Look up")!);

    expect(view.container.textContent).toContain("No notifications for this id yet.");
  });
});

describe("PrepNoteNotificationsPanel recipient lookup", () => {
  it("loads the last looked-up recipient's notifications on mount", async () => {
    localStorage.setItem(RECIPIENT_STORAGE_KEY, "alice");
    saveNotification(makeNotification());

    view = await mount(createElement(PrepNoteNotificationsPanel));

    expect(view.container.textContent).toContain("1 notification on 2026-08-15 (1 unread)");
  });

  it("persists the looked-up recipient id so it's restored on the next mount", async () => {
    view = await mount(createElement(PrepNoteNotificationsPanel));
    await type(getInput(view.container), "carol");
    await click(buttonByText(view.container, "Look up")!);

    expect(localStorage.getItem(RECIPIENT_STORAGE_KEY)).toBe("carol");
  });

  it("looks up on pressing Enter in the recipient field", async () => {
    saveNotification(makeNotification({ recipientId: "dave" }));
    view = await mount(createElement(PrepNoteNotificationsPanel));

    const input = getInput(view.container);
    await type(input, "dave");
    await flush(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(view.container.textContent).toContain("1 notification on 2026-08-15 (1 unread)");
  });
});

describe("PrepNoteNotificationsPanel digest grouping", () => {
  it("groups a recipient's notifications into one digest per UTC day, newest day first", async () => {
    saveNotification(makeNotification({ id: "n1", createdAt: Date.UTC(2026, 7, 15, 10, 0, 0) }));
    saveNotification(
      makeNotification({ id: "n2", createdAt: Date.UTC(2026, 7, 16, 10, 0, 0), noteText: "Answer the CP" }),
    );

    localStorage.setItem(RECIPIENT_STORAGE_KEY, "alice");
    view = await mount(createElement(PrepNoteNotificationsPanel));

    const headings = Array.from(view.container.querySelectorAll(".truncate")).map((el) => el.textContent);
    expect(headings[0]).toBe("1 notification on 2026-08-16 (1 unread)");
    expect(headings[1]).toBe("1 notification on 2026-08-15 (1 unread)");
  });

  it("shows the total unread count across every digest group", async () => {
    saveNotification(makeNotification({ id: "n1", createdAt: Date.UTC(2026, 7, 15, 10, 0, 0) }));
    saveNotification(
      makeNotification({ id: "n2", createdAt: Date.UTC(2026, 7, 16, 10, 0, 0), noteText: "Answer the CP" }),
    );

    localStorage.setItem(RECIPIENT_STORAGE_KEY, "alice");
    view = await mount(createElement(PrepNoteNotificationsPanel));

    expect(view.container.textContent).toContain("2 unread");
  });
});

describe("PrepNoteNotificationsPanel expand/collapse", () => {
  it("expands a digest group to reveal its individual notifications", async () => {
    saveNotification(makeNotification());
    localStorage.setItem(RECIPIENT_STORAGE_KEY, "alice");
    view = await mount(createElement(PrepNoteNotificationsPanel));

    expect(view.container.textContent).not.toContain('Assigned: "Cut the warming impact card"');

    await click(buttonByText(view.container, "Expand (1)")!);

    expect(view.container.textContent).toContain('Assigned: "Cut the warming impact card"');
    expect(view.container.textContent).toContain("from a note by bob");
    expect(buttonByText(view.container, "Collapse")).not.toBeNull();

    await click(buttonByText(view.container, "Collapse")!);
    expect(view.container.textContent).not.toContain('Assigned: "Cut the warming impact card"');
  });
});

describe("PrepNoteNotificationsPanel mark read", () => {
  it("marks a single notification read, replacing its action with a Read badge", async () => {
    saveNotification(makeNotification());
    localStorage.setItem(RECIPIENT_STORAGE_KEY, "alice");
    view = await mount(createElement(PrepNoteNotificationsPanel));

    await click(buttonByText(view.container, "Expand (1)")!);
    await click(buttonByText(view.container, "Mark read")!);

    expect(buttonByText(view.container, "Mark read")).toBeNull();
    expect(view.container.textContent).toContain("Read");
    expect(view.container.textContent).toContain("0 unread");
  });

  it("marks every notification in a digest group read via Mark all read", async () => {
    saveNotification(makeNotification({ id: "n1", noteText: "Cut the warming impact card" }));
    saveNotification(makeNotification({ id: "n2", noteText: "Answer the CP" }));
    localStorage.setItem(RECIPIENT_STORAGE_KEY, "alice");
    view = await mount(createElement(PrepNoteNotificationsPanel));

    expect(view.container.textContent).toContain("2 unread");
    await click(buttonByText(view.container, "Mark all read")!);

    expect(view.container.textContent).toContain("0 unread");
    expect(buttonByText(view.container, "Mark all read")).toBeNull();
  });
});

describe("PrepNoteNotificationsPanel cross-tab live update", () => {
  it("refreshes the current recipient's notifications when another tab writes to the shared storage key", async () => {
    localStorage.setItem(RECIPIENT_STORAGE_KEY, "alice");
    view = await mount(createElement(PrepNoteNotificationsPanel));
    expect(view.container.textContent).toContain("No notifications for this id yet.");

    saveNotification(makeNotification());
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "prepNoteNotifications" }));
    });

    expect(view.container.textContent).toContain("1 unread");
  });

  it("ignores a storage event for an unrelated key", async () => {
    localStorage.setItem(RECIPIENT_STORAGE_KEY, "alice");
    view = await mount(createElement(PrepNoteNotificationsPanel));

    saveNotification(makeNotification());
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "someOtherKey" }));
    });

    expect(view.container.textContent).toContain("No notifications for this id yet.");
  });
});
