import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()

vi.stubGlobal("fetch", fetchMock)

const { fetchMarketBoard, fetchListing, sellFile, stopSelling, purchaseListing, copyListing, startTopUp } =
  await import("../src/client")

describe("market client", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("fetches the market board at the default base path", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ wallet: null, topUps: [], topUpsEnabled: false, listings: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const board = await fetchMarketBoard()
    expect(board.listings).toEqual([])
    expect(fetchMock).toHaveBeenCalledWith("/api/market", expect.any(Object))
  })

  it("fetches a listing by id with encoded path", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ listing: { id: "abc 123", title: "Test" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const listing = await fetchListing("abc 123")
    expect(listing.id).toBe("abc 123")
    expect(fetchMock).toHaveBeenCalledWith("/api/market/listings/abc%20123", expect.any(Object))
  })

  it("sells a file with a JSON body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ listing: { id: "1", title: "Test" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    await sellFile({ documentId: 1, priceCents: 500 })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/market/listings",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ documentId: 1, priceCents: 500 }),
      }),
    )
  })

  it("stops selling a listing", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const result = await stopSelling("xyz")
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/market/listings/xyz",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("purchases a listing", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ listing: { id: "1" }, wallet: { balanceCents: 0 }, documentId: 42 }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    )
    const result = await purchaseListing("1")
    expect(result.documentId).toBe(42)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/market/listings/1/purchase",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("copies a listing", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ documentId: 99 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const result = await copyListing("1")
    expect(result.documentId).toBe(99)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/market/listings/1/copy",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("starts a top-up with the selected option", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ url: "https://checkout.stripe.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const result = await startTopUp("usd-10", "/return")
    expect(result.url).toBe("https://checkout.stripe.com")
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/market/top-up",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ topUp: "usd-10", returnTo: "/return" }),
      }),
    )
  })

  it("throws an error from the response body on failure", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Insufficient balance" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    )
    await expect(purchaseListing("1")).rejects.toThrow("Insufficient balance")
  })

  it("throws a fallback error on non-JSON failure", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Server error", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      }),
    )
    await expect(fetchMarketBoard()).rejects.toThrow("Could not load the market.")
  })

  it("uses a custom base path and fetch implementation", async () => {
    const customFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ wallet: null, topUps: [], topUpsEnabled: false, listings: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    await fetchMarketBoard({ basePath: "/custom/api", fetchImpl: customFetch })
    expect(customFetch).toHaveBeenCalledWith("/custom/api", expect.any(Object))
  })

  it("sends Content-Type header when there is a body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    await sellFile({ documentId: 1, priceCents: 500 })
    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers["Content-Type"]).toBe("application/json")
  })

  it("does not send Content-Type header when there is no body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ wallet: null, topUps: [], topUpsEnabled: false, listings: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    await fetchMarketBoard()
    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers["Content-Type"]).toBeUndefined()
  })
})