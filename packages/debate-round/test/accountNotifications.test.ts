import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchAccountNotifications,
  markAccountNotificationRead,
  markAllAccountNotificationsRead,
} from "../src/state/accountNotifications";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAccountNotifications", () => {
  it("GETs the endpoint and returns the parsed page", async () => {
    const page = { notifications: [], unreadCount: 0 };
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => page })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchAccountNotifications()).toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications");
  });

  it("returns null on a 401 rather than throwing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchAccountNotifications()).toBeNull();
  });

  it("returns null when fetch itself throws", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchAccountNotifications()).toBeNull();
  });
});

describe("markAccountNotificationRead", () => {
  it("PATCHes the endpoint with the notification id", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await markAccountNotificationRead(7);

    expect(fetchMock).toHaveBeenCalledWith("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 7 }),
    });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({ error: "Invalid notification id." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(markAccountNotificationRead(7)).rejects.toThrow("Invalid notification id.");
  });
});

describe("markAllAccountNotificationsRead", () => {
  it("PATCHes the endpoint with all: true", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await markAllAccountNotificationsRead();

    expect(fetchMock).toHaveBeenCalledWith("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  });
});
