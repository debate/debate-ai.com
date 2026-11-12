import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const originalFetch = globalThis.fetch

const fetchMock = vi.fn()

const { fetchPredictionBoard, fetchPredictionSources, createMarket, placeBet, resolveMarket } =
  await import("../src/client")

describe("predictions client", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("fetches the prediction board at the default base path", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ wallet: null, markets: [], leaders: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    const board = await fetchPredictionBoard()
    expect(board.markets).toEqual([])
    expect(fetchMock).toHaveBeenCalledWith("/api/predictions", expect.any(Object))
  })

  it("fetches prediction sources without an event id", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ events: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    await fetchPredictionSources(null)
    expect(fetchMock).toHaveBeenCalledWith("/api/predictions/sources", expect.any(Object))
  })

  it("fetches prediction sources with an event id", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ events: [], panels: [], entries: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    await fetchPredictionSources(42)
    expect(fetchMock).toHaveBeenCalledWith("/api/predictions/sources?eventId=42", expect.any(Object))
  })

  it("creates a market with a JSON body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "m1", title: "Test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    await createMarket({ kind: "debate", title: "Test", outcomes: ["Aff", "Neg"], closesAt: 1 })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/predictions/markets",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ kind: "debate", title: "Test", outcomes: ["Aff", "Neg"], closesAt: 1 }),
      }),
    )
  })

  it("places a bet with encoded market id", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ market: {}, wallet: { balance: 100 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    await placeBet("abc 123", { outcomeId: "o1", stake: 50 })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/predictions/markets/abc%20123/bets",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ outcomeId: "o1", stake: 50 }),
      }),
    )
  })

  it("resolves a market", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "m1", status: "settled" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    await resolveMarket("m1", { outcomeId: "o1" })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/predictions/markets/m1/resolve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ outcomeId: "o1" }),
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
    await expect(placeBet("m1", { outcomeId: "o1", stake: 50 })).rejects.toThrow("Insufficient balance")
  })

  it("throws a fallback error on non-JSON failure", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Server error", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      }),
    )
    await expect(fetchPredictionBoard()).rejects.toThrow("Could not load the markets.")
  })

  it("uses a custom base path and fetch implementation", async () => {
    const customFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ wallet: null, markets: [], leaders: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    await fetchPredictionBoard({ basePath: "/custom/api", fetchImpl: customFetch })
    expect(customFetch).toHaveBeenCalledWith("/custom/api", expect.any(Object))
  })
})