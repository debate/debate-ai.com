/**
 * @fileoverview The browser client for `/api/market`: each call's path,
 * method and JSON body, a custom base path and fetch, and errors carrying the
 * server's message or a per-call fallback.
 */
import { describe, expect, it, vi } from "vitest";

import {
  copyListing,
  fetchListing,
  fetchMarketBoard,
  purchaseListing,
  sellFile,
  startTopUp,
  stopSelling,
} from "../src/client";

function fakeFetch(body: unknown, init: { status?: number; raw?: string } = {}) {
  return vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
    new Response(init.raw ?? JSON.stringify(body), { status: init.status ?? 200 }),
  );
}

describe("market client", () => {
  it("loads the board from the default base path", async () => {
    const fetchImpl = fakeFetch({ listings: [] });
    await expect(fetchMarketBoard({ fetchImpl })).resolves.toEqual({ listings: [] });
    expect(fetchImpl).toHaveBeenCalledWith("/api/market", { headers: {} });
  });

  it("falls back to the global fetch", async () => {
    const original = globalThis.fetch;
    const global = fakeFetch({ listings: [1] });
    globalThis.fetch = global as unknown as typeof fetch;
    try {
      await expect(fetchMarketBoard()).resolves.toEqual({ listings: [1] });
      expect(global).toHaveBeenCalledWith("/api/market", expect.anything());
    } finally {
      globalThis.fetch = original;
    }
  });

  it("unwraps a listing and encodes its id", async () => {
    const fetchImpl = fakeFetch({ listing: { id: "a b" } });
    await expect(fetchListing("a b", { fetchImpl, basePath: "/m" })).resolves.toEqual({ id: "a b" });
    expect(fetchImpl.mock.calls[0][0]).toBe("/m/listings/a%20b");
  });

  it("posts a sell request as JSON", async () => {
    const fetchImpl = fakeFetch({ listing: { id: "1" } });
    await sellFile({ documentId: 7, priceCents: 500 }, { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/market/listings");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(String(init!.body))).toEqual({ documentId: 7, priceCents: 500 });
  });

  it.each([
    ["stopSelling", () => stopSelling("x", { fetchImpl: f }), "/api/market/listings/x", "DELETE"],
    ["purchaseListing", () => purchaseListing("x", { fetchImpl: f }), "/api/market/listings/x/purchase", "POST"],
    ["copyListing", () => copyListing("x", { fetchImpl: f }), "/api/market/listings/x/copy", "POST"],
  ] as const)("%s hits its route", async (_name, call, url, method) => {
    f.mockClear();
    await call();
    expect(f.mock.calls[0][0]).toBe(url);
    expect(f.mock.calls[0][1]).toMatchObject({ method, headers: {} });
  });

  it("starts a top-up with where to return", async () => {
    const fetchImpl = fakeFetch({ url: "https://pay.example" });
    await expect(startTopUp("usd-10", "/research/market", { fetchImpl })).resolves.toEqual({ url: "https://pay.example" });
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]!.body))).toEqual({ topUp: "usd-10", returnTo: "/research/market" });
  });

  it("throws the server's error message", async () => {
    const fetchImpl = fakeFetch({ error: "Not enough balance." }, { status: 402 });
    await expect(purchaseListing("x", { fetchImpl })).rejects.toThrow("Not enough balance.");
  });

  it.each([
    ["an empty error", { error: "" }, undefined],
    ["a non-string error", { error: 5 }, undefined],
    ["a non-JSON body", null, "<html>"],
  ])("falls back to the call's message for %s", async (_label, body, raw) => {
    const fetchImpl = fakeFetch(body, { status: 500, raw });
    await expect(fetchMarketBoard({ fetchImpl })).rejects.toThrow("Could not load the market.");
    await expect(fetchListing("1", { fetchImpl })).rejects.toThrow("Could not load that file.");
    await expect(sellFile({ documentId: 1, priceCents: 1 }, { fetchImpl })).rejects.toThrow("Could not list that file for sale.");
    await expect(stopSelling("1", { fetchImpl })).rejects.toThrow("Could not stop selling that file.");
    await expect(copyListing("1", { fetchImpl })).rejects.toThrow("Could not save a copy of that file.");
    await expect(startTopUp("usd-10", undefined, { fetchImpl })).rejects.toThrow("Could not start the payment.");
  });
});

const f = fakeFetch({ ok: true });
