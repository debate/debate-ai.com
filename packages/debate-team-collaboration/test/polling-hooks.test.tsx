// @vitest-environment jsdom
/**
 * @fileoverview Tests the three polling hooks — `useCardShares`,
 * `useAccountNotifications` and `useContacts`: the first load, the
 * visible-tab poll, the "toast only what arrived after the first load"
 * watermark, and that each mutation refreshes the list afterwards. The
 * network-facing state modules, `sonner` and the router are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush } from "./helpers/mount";
import { renderHook, settle } from "./helpers/render-hook";

const m = vi.hoisted(() => ({
  toast: vi.fn(),
  push: vi.fn(),
  fetchCardShares: vi.fn(),
  shareCard: vi.fn(),
  markCardShareOpened: vi.fn(),
  removeCardShare: vi.fn(),
  fetchAccountNotifications: vi.fn(),
  markAccountNotificationRead: vi.fn(),
  markAllAccountNotificationsRead: vi.fn(),
  fetchContacts: vi.fn(),
  sendContactRequest: vi.fn(),
  acceptContactRequest: vi.fn(),
  declineContactRequest: vi.fn(),
  removeContact: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: m.toast }));
// One stable router, as Next's is: the hook's `load` callback depends on it.
const router = vi.hoisted(() => ({ push: (href: string) => m.push(href) }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../src/state/cardShares", () => ({
  fetchCardShares: m.fetchCardShares,
  shareCard: m.shareCard,
  markCardShareOpened: m.markCardShareOpened,
  removeCardShare: m.removeCardShare,
}));
vi.mock("../src/state/accountNotifications", () => ({
  fetchAccountNotifications: m.fetchAccountNotifications,
  markAccountNotificationRead: m.markAccountNotificationRead,
  markAllAccountNotificationsRead: m.markAllAccountNotificationsRead,
}));
vi.mock("../src/state/contacts", () => ({
  ORGANIZATION_CHANGED_EVENT: "debate:organization-changed",
  fetchContacts: m.fetchContacts,
  sendContactRequest: m.sendContactRequest,
  acceptContactRequest: m.acceptContactRequest,
  declineContactRequest: m.declineContactRequest,
  removeContact: m.removeContact,
  blockUser: m.blockUser,
  unblockUser: m.unblockUser,
}));

const { useCardShares } = await import("../src/hooks/useCardShares");
const { useAccountNotifications } = await import("../src/hooks/useAccountNotifications");
const { useContacts } = await import("../src/hooks/useContacts");

function share(id: number, updatedAt: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    user: { id: `u${id}`, name: `User ${id}`, email: null, image: null },
    roomId: `room-${id}`,
    shareCode: "code",
    guestPass: null,
    title: `Card ${id}`,
    message: null,
    createdAt: updatedAt,
    updatedAt,
    openedAt: null,
    ...extra,
  } as any;
}

function notification(id: number, extra: Record<string, unknown> = {}) {
  return { id, type: "t", title: `Note ${id}`, body: null, link: null, createdAt: "", readAt: null, ...extra };
}

// `useAccountNotifications` and `useContacts` share one request per ~28s
// window across every mounted copy (module-level, see `lib/shared-fetch`), so
// each test starts its fake clock a day after the last one: no test can reuse
// a request a previous test started.
let testDay = 0;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(Date.UTC(2030, 0, 1) + ++testDay * 86_400_000);
  localStorage.clear();
  for (const fn of Object.values(m)) fn.mockReset();
  for (const fn of [
    m.shareCard,
    m.markCardShareOpened,
    m.removeCardShare,
    m.markAccountNotificationRead,
    m.markAllAccountNotificationsRead,
    m.sendContactRequest,
    m.acceptContactRequest,
    m.declineContactRequest,
    m.removeContact,
    m.blockUser,
    m.unblockUser,
  ]) {
    fn.mockResolvedValue(undefined);
  }
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("useCardShares", () => {
  it("does nothing while disabled", async () => {
    const hook = await renderHook(() => useCardShares(false));
    expect(m.fetchCardShares).not.toHaveBeenCalled();
    expect(hook.result.current).toMatchObject({ received: [], sent: [], loaded: false, unopenedCount: 0 });
  });

  it("loads shares, counts unopened, and toasts only later arrivals", async () => {
    const first = share(1, "2026-01-01T00:00:00Z");
    m.fetchCardShares.mockResolvedValue({ received: [first, share(2, "2026-01-01T00:00:00Z", { openedAt: "x" })], sent: [] });
    const onOpen = vi.fn();
    const hook = await renderHook(() => useCardShares(true, { onOpen }));
    await settle();

    expect(hook.result.current.loaded).toBe(true);
    expect(hook.result.current.unopenedCount).toBe(1);
    expect(m.toast).not.toHaveBeenCalled();
    expect(localStorage.getItem("cardShares:lastSeenUpdatedAt")).toBe(String(Date.parse("2026-01-01T00:00:00Z")));

    const arrived = share(3, "2026-02-01T00:00:00Z", { message: "look" });
    const seenButOpened = share(4, "2026-02-02T00:00:00Z", { openedAt: "y" });
    m.fetchCardShares.mockResolvedValue({ received: [first, arrived, seenButOpened], sent: [] });
    await flush(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(m.toast).toHaveBeenCalledTimes(1);
    const [title, opts] = m.toast.mock.calls[0];
    expect(title).toBe('User 3 shared "Card 3" with you');
    expect(opts.description).toBe("look");
    opts.action.onClick();
    expect(onOpen).toHaveBeenCalledWith(arrived);
  });

  it("skips the poll while the tab is hidden and resumes the watermark from storage", async () => {
    localStorage.setItem("cardShares:lastSeenUpdatedAt", String(Date.parse("2026-03-01T00:00:00Z")));
    m.fetchCardShares.mockResolvedValue({ received: [share(1, "2026-01-01T00:00:00Z")], sent: [] });
    await renderHook(() => useCardShares(true, { toastOnArrival: true }));
    await settle();
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await flush(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(m.fetchCardShares).toHaveBeenCalledTimes(1);
    spy.mockRestore();
    expect(localStorage.getItem("cardShares:lastSeenUpdatedAt")).toBe(String(Date.parse("2026-03-01T00:00:00Z")));
  });

  it("does not toast with toastOnArrival off and has no action without onOpen", async () => {
    m.fetchCardShares.mockResolvedValue({ received: [], sent: [] });
    const quiet = await renderHook(() => useCardShares(true, { toastOnArrival: false }));
    await settle();
    m.fetchCardShares.mockResolvedValue({ received: [share(9, "2027-01-01T00:00:00Z")], sent: [] });
    await flush(() => quiet.result.current.refresh());
    expect(m.toast).not.toHaveBeenCalled();
    await quiet.unmount();

    m.fetchCardShares.mockResolvedValue({ received: [], sent: [] });
    const loud = await renderHook(() => useCardShares(true));
    await settle();
    m.fetchCardShares.mockResolvedValue({ received: [share(10, "2028-01-01T00:00:00Z")], sent: [] });
    await flush(() => loud.result.current.refresh());
    expect(m.toast).toHaveBeenCalledTimes(1);
    expect(m.toast.mock.calls[0][1].action).toBeUndefined();
  });

  it("keeps the previous page when a fetch returns null", async () => {
    m.fetchCardShares.mockResolvedValueOnce({ received: [share(1, "2026-01-01T00:00:00Z")], sent: [] });
    const hook = await renderHook(() => useCardShares(true));
    await settle();
    m.fetchCardShares.mockResolvedValueOnce(null);
    await flush(() => hook.result.current.refresh());
    expect(hook.result.current.received).toHaveLength(1);
  });

  it("shares, marks opened, and removes — refreshing where needed", async () => {
    const entry = share(1, "2026-01-01T00:00:00Z");
    m.fetchCardShares.mockResolvedValue({ received: [entry], sent: [] });
    m.shareCard.mockResolvedValue({ ok: true });
    const hook = await renderHook(() => useCardShares(true));
    await settle();

    let result: unknown;
    await flush(async () => {
      result = await hook.result.current.share({ recipient: "x" } as any);
    });
    expect(result).toEqual({ ok: true });
    expect(m.shareCard).toHaveBeenCalledWith({ recipient: "x" });
    expect(m.fetchCardShares).toHaveBeenCalledTimes(2);

    await flush(() => hook.result.current.markOpened(entry));
    expect(m.markCardShareOpened).toHaveBeenCalledWith(1);
    expect(hook.result.current.received[0].openedAt).toEqual(expect.any(String));
    expect(hook.result.current.unopenedCount).toBe(0);

    await flush(() => hook.result.current.markOpened({ ...entry, openedAt: "already" }));
    expect(m.markCardShareOpened).toHaveBeenCalledTimes(1);

    await flush(() => hook.result.current.remove(1));
    expect(m.removeCardShare).toHaveBeenCalledWith(1);
    expect(m.fetchCardShares).toHaveBeenCalledTimes(3);
  });

  it("clears the page when it becomes disabled", async () => {
    m.fetchCardShares.mockResolvedValue({ received: [share(1, "2026-01-01T00:00:00Z")], sent: [] });
    let enabled = true;
    const hook = await renderHook(() => useCardShares(enabled));
    await settle();
    expect(hook.result.current.received).toHaveLength(1);
    enabled = false;
    const { createElement } = await import("react");
    function Probe() {
      Object.assign(hook.result, { current: useCardShares(enabled) });
      return null;
    }
    await hook.rerender(createElement(Probe));
    expect(hook.result.current.received).toEqual([]);
    expect(hook.result.current.loaded).toBe(false);
  });
});

describe("useAccountNotifications", () => {
  it("polls nothing while disabled", async () => {
    const hook = await renderHook(() => useAccountNotifications(false));
    expect(m.fetchAccountNotifications).not.toHaveBeenCalled();
    expect(hook.result.current.unreadCount).toBe(0);
  });

  it("loads without toasting the backlog, then toasts new ones with a View action", async () => {
    m.fetchAccountNotifications.mockResolvedValue({ notifications: [notification(1), notification(2)], unreadCount: 2 });
    const hook = await renderHook(() => useAccountNotifications(true));
    await settle();
    expect(hook.result.current.notifications).toHaveLength(2);
    expect(hook.result.current.unreadCount).toBe(2);
    expect(m.toast).not.toHaveBeenCalled();
    expect(localStorage.getItem("accountNotifications:lastSeenId")).toBe("2");

    m.fetchAccountNotifications.mockResolvedValue({
      notifications: [notification(3, { body: "hi", link: "/inbox" }), notification(4), notification(2)],
      unreadCount: 3,
    });
    await flush(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(m.toast).toHaveBeenCalledTimes(2);
    const [title, opts] = m.toast.mock.calls[0];
    expect(title).toBe("Note 3");
    expect(opts.description).toBe("hi");
    opts.action.onClick();
    expect(m.push).toHaveBeenCalledWith("/inbox");
    expect(m.toast.mock.calls[1][1].action).toBeUndefined();
  });

  it("marks one or all read and reloads; ignores a null page", async () => {
    m.fetchAccountNotifications.mockResolvedValue({ notifications: [notification(5)], unreadCount: 1 });
    const hook = await renderHook(() => useAccountNotifications(true));
    await settle();

    m.fetchAccountNotifications.mockResolvedValue({ notifications: [notification(5, { readAt: "now" })], unreadCount: 0 });
    await flush(() => hook.result.current.markRead(5));
    expect(m.markAccountNotificationRead).toHaveBeenCalledWith(5);
    expect(hook.result.current.unreadCount).toBe(0);

    await flush(() => hook.result.current.markAllRead());
    expect(m.markAllAccountNotificationsRead).toHaveBeenCalled();

    m.fetchAccountNotifications.mockResolvedValue(null);
    await flush(() => hook.result.current.refresh());
    expect(hook.result.current.notifications).toHaveLength(1);
    expect(hook.result.current.loading).toBe(false);
  });

  it("does not poll a hidden tab", async () => {
    m.fetchAccountNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 });
    await renderHook(() => useAccountNotifications(true));
    await settle();
    const spy = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await flush(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(m.fetchAccountNotifications).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe("useContacts", () => {
  const page = { contacts: [{ id: 1 }], incoming: [{ id: 2 }], outgoing: [], blocked: [] };

  it("stays empty while disabled", async () => {
    const hook = await renderHook(() => useContacts(false));
    expect(m.fetchContacts).not.toHaveBeenCalled();
    expect(hook.result.current).toMatchObject({ contacts: [], incoming: [], loaded: false });
  });

  it("loads, polls a visible tab, and keeps the page on a null fetch", async () => {
    m.fetchContacts.mockResolvedValue(page);
    const hook = await renderHook(() => useContacts(true));
    await settle();
    expect(hook.result.current.contacts).toEqual([{ id: 1 }]);
    expect(hook.result.current.loaded).toBe(true);

    m.fetchContacts.mockResolvedValue(null);
    await flush(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(m.fetchContacts).toHaveBeenCalledTimes(2);
    expect(hook.result.current.incoming).toEqual([{ id: 2 }]);
  });

  it("runs each mutation then refreshes", async () => {
    m.fetchContacts.mockResolvedValue(page);
    m.sendContactRequest.mockResolvedValue({ status: "sent" });
    const hook = await renderHook(() => useContacts(true));
    await settle();
    const api = hook.result.current;

    let sent: unknown;
    await flush(async () => {
      sent = await api.request({ email: "a@b.c" });
    });
    expect(sent).toEqual({ status: "sent" });
    expect(m.sendContactRequest).toHaveBeenCalledWith({ email: "a@b.c" });

    await flush(async () => {
      await api.accept(1);
      await api.decline(2);
      await api.remove(3);
      await api.block("u1");
      await api.unblock("u1");
    });
    expect(m.acceptContactRequest).toHaveBeenCalledWith(1);
    expect(m.declineContactRequest).toHaveBeenCalledWith(2);
    expect(m.removeContact).toHaveBeenCalledWith(3);
    expect(m.blockUser).toHaveBeenCalledWith("u1");
    expect(m.unblockUser).toHaveBeenCalledWith("u1");
    expect(m.fetchContacts).toHaveBeenCalledTimes(7);
  });
});
