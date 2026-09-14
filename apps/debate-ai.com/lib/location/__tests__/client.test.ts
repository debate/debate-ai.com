/**
 * @fileoverview Covers the browser-side lookup. The regression these tests
 * exist for is the `429`: a component that calls the lookup on every render,
 * or ten components that each call it on mount, must still produce a single
 * network request per browser per cache window. So the properties pinned here
 * are the cache, the in-flight sharing, the failure cooldown — and that every
 * failure path resolves to `null` instead of throwing into the caller.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const grab = vi.hoisted(() => vi.fn());
vi.mock("grab-url", () => ({ default: grab }));

import {
  clearCachedVisitorLocation,
  getVisitorLocation,
  readCachedVisitorLocation,
} from "../client";

/** A minimal localStorage, since these tests run in the node environment. */
function installLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  });
  return store;
}

const EDGE_ANSWER = {
  city: "Sunnyvale",
  region: "California",
  country: "US",
  latitude: 37.36883,
  longitude: -122.03615,
  timezone: "America/Los_Angeles",
};

beforeEach(() => {
  installLocalStorage();
  grab.mockReset();
});

afterEach(() => {
  clearCachedVisitorLocation();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("getVisitorLocation", () => {
  it("returns the app's own edge answer without touching a third party", async () => {
    grab.mockResolvedValueOnce(EDGE_ANSWER);

    await expect(getVisitorLocation()).resolves.toEqual(EDGE_ANSWER);
    expect(grab).toHaveBeenCalledTimes(1);
    expect(grab.mock.calls[0][0]).toBe("/api/location");
  });

  it("pins the endpoint to this origin, ignoring any page-wide grab baseURL", async () => {
    grab.mockResolvedValueOnce(EDGE_ANSWER);

    await getVisitorLocation();

    expect(grab.mock.calls[0][1]).toMatchObject({ baseURL: "" });
  });

  it("serves later calls from the cache, making no further requests", async () => {
    grab.mockResolvedValueOnce(EDGE_ANSWER);

    await getVisitorLocation();
    await getVisitorLocation();
    await getVisitorLocation();

    expect(grab).toHaveBeenCalledTimes(1);
    expect(readCachedVisitorLocation()).toEqual(EDGE_ANSWER);
  });

  it("shares one request between callers that ask at the same time", async () => {
    grab.mockResolvedValueOnce(EDGE_ANSWER);

    const results = await Promise.all([
      getVisitorLocation(),
      getVisitorLocation(),
      getVisitorLocation(),
    ]);

    expect(grab).toHaveBeenCalledTimes(1);
    expect(results).toEqual([EDGE_ANSWER, EDGE_ANSWER, EDGE_ANSWER]);
  });

  it("re-looks-up when asked to refresh", async () => {
    grab.mockResolvedValueOnce(EDGE_ANSWER);
    await getVisitorLocation();

    grab.mockResolvedValueOnce({ ...EDGE_ANSWER, city: "Austin" });
    await expect(getVisitorLocation({ refresh: true })).resolves.toMatchObject({
      city: "Austin",
    });
  });

  it("falls back to ipwho.is when the app's own endpoint has no location (local dev)", async () => {
    grab
      .mockResolvedValueOnce({ city: null, latitude: null, longitude: null })
      .mockResolvedValueOnce({
        success: true,
        city: "Austin",
        region: "Texas",
        country_code: "US",
        latitude: 30.26715,
        longitude: -97.74306,
        timezone: { id: "America/Chicago" },
      });

    await expect(getVisitorLocation()).resolves.toEqual({
      city: "Austin",
      region: "Texas",
      country: "US",
      latitude: 30.26715,
      longitude: -97.74306,
      timezone: "America/Chicago",
    });
    expect(grab.mock.calls[1][0]).toBe("https://ipwho.is/");
  });

  it("treats an ipwho.is quota reply (success: false) as no location", async () => {
    grab
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ success: false, message: "Rate limit exceeded" });

    await expect(getVisitorLocation()).resolves.toBeNull();
  });

  it("resolves to null rather than throwing when a lookup rejects", async () => {
    grab.mockRejectedValue(new Error("network down"));

    await expect(getVisitorLocation()).resolves.toBeNull();
  });

  it("does not re-ask a provider that just failed, until the cooldown lapses", async () => {
    grab.mockResolvedValue({});

    await expect(getVisitorLocation()).resolves.toBeNull();
    const callsAfterFirstAttempt = grab.mock.calls.length;

    await expect(getVisitorLocation()).resolves.toBeNull();
    expect(grab).toHaveBeenCalledTimes(callsAfterFirstAttempt);
  });

  it("looks up again once the cached answer has expired", async () => {
    vi.useFakeTimers();
    grab.mockResolvedValueOnce(EDGE_ANSWER);
    await getVisitorLocation();

    // Past the 12-hour cache window.
    vi.advanceTimersByTime(13 * 60 * 60 * 1000);
    expect(readCachedVisitorLocation()).toBeNull();

    grab.mockResolvedValueOnce({ ...EDGE_ANSWER, city: "Austin" });
    await expect(getVisitorLocation()).resolves.toMatchObject({ city: "Austin" });
  });

  it("works with no localStorage at all, just without remembering the answer", async () => {
    vi.stubGlobal("localStorage", undefined);
    grab.mockResolvedValue(EDGE_ANSWER);

    await expect(getVisitorLocation()).resolves.toEqual(EDGE_ANSWER);
    await expect(getVisitorLocation()).resolves.toEqual(EDGE_ANSWER);
    expect(grab).toHaveBeenCalledTimes(2);
  });

  it("ignores a malformed cache entry instead of throwing", async () => {
    localStorage.setItem("visitorLocation:v1", "{not json");
    grab.mockResolvedValueOnce(EDGE_ANSWER);

    await expect(getVisitorLocation()).resolves.toEqual(EDGE_ANSWER);
  });
});
