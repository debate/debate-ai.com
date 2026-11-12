import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const originalFetch = globalThis.fetch

const fetchMock = vi.fn()

globalThis.fetch = fetchMock as unknown as typeof fetch

const { fetchMarketBoard, fetchListing, sellFile, stopSelling, purchaseListing, copyListing, startTopUp } =
  await import("../src/client")

function mockResponse(body: unknown, status = 200, headers: Record<string, string> = { "Content-Type": "application/json" }) {
  return new Response(JSON.stringify(body), { status, headers })
}

describe("market client", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("fetches the market board at the default base path", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ wallet: null, topUps: [], topUpsEnabled: false, listings: [] }))
    const board = await fetchMarketBoard()
    expect(board.listings).toEqual([])
    expect(fetchMock).toHaveBeenCalledWith("/api/market", expect.any(Object))
  })

  it("fetches a listing by id with encoded path", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ listing: { id: "abc 123", title: "Test" } }))
    const listing = await fetchListing("abc 123")
    expect(listing.id).toBe("abc 123")
    expect(fetchMock).toHaveBeenCalledWith("/api/market/listings/abc%20123", expect.any(Object))
  })

  it("sells a file with a JSON body", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ listing: { id: "1", title: "Test" } }))
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
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true }))
    const result = await stopSelling("xyz")
    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/market/listings/xyz",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("purchases a listing", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ listing: { id: "1" }, wallet: { balanceCents: 0 }, documentId: 42 }),
    )
    const result = await purchaseListing("1")
    expect(result.documentId).toBe(42)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/market/listings/1/purchase",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("copies a listing", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ documentId: 99 }))
    const result = await copyListing("1")
    expect(result.documentId).toBe(99)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/market/listings/1/copy",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("starts a top-up with the selected option", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ url: "https://checkout.stripe.com" }))
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
    fetchMock.mockResolvedValueOnce(mockResponse({ error: "Insufficient balance" }, 400))
    await expect(purchaseListing("1")).rejects.toThrow("Insufficient balance")
  })

  it("throws a fallback error on non-JSON failure", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Server error", { status: 500, headers: { "Content-Type": "text/plain" } }))
    await expect(fetchMarketBoard()).rejects.toThrow("Could not load the market.")
  })

  it("uses a custom base path and fetch implementation", async () => {
    const customFetch = vi.fn().mockResolvedValueOnce(
      mockResponse({ wallet: null, topUps: [], topUpsEnabled: false, listings: [] }),
    )
    await fetchMarketBoard({ basePath: "/custom/api", fetchImpl: customFetch })
    expect(customFetch).toHaveBeenCalledWith("/custom/api", expect.any(Object))
  })

  it("sends Content-Type header when there is a body", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true }))
    await sellFile({ documentId: 1, priceCents: 500 })
    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers["Content-Type"]).toBe("application/json")
  })

  it("does not send Content-Type header when there is no body", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse({ wallet: null, topUps: [], topUpsEnabled: false, listings: [] }),
    )
    await fetchMarketBoard()
    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers["Content-Type"]).toBeUndefined()
  })
})