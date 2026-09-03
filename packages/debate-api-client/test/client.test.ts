import { describe, expect, it, vi, beforeEach } from "vitest"

const grabMock = vi.fn()

vi.mock("grab-url", () => ({
  default: (...args: unknown[]) => grabMock(...args),
}))

const { createClient, DEFAULT_BASE_URL } = await import("../src/client")

describe("createClient", () => {
  beforeEach(() => {
    grabMock.mockReset()
  })

  it("defaults to the Debate AI API origin", () => {
    const client = createClient()
    expect(client.getConfig().baseUrl).toBe(DEFAULT_BASE_URL)
  })

  it("substitutes path params and appends a query string for GET", async () => {
    grabMock.mockResolvedValue({ data: { ok: true } })
    const client = createClient()

    await client.request({
      url: "/coach-materials/{materialId}",
      path: { materialId: "abc 123" },
      query: { include: "notes", tags: ["a", "b"] },
    })

    const [url, options] = grabMock.mock.calls[0]
    expect(url).toBe("/coach-materials/abc%20123?include=notes&tags=a&tags=b")
    expect(options.method).toBe("GET")
    expect(options.baseURL).toBe(DEFAULT_BASE_URL)
  })

  it("JSON-serializes the body for POST/PUT/PATCH and ignores query", async () => {
    grabMock.mockResolvedValue({ data: { created: true } })
    const client = createClient()

    await client.request({
      url: "/coach-materials",
      method: "POST",
      body: { title: "New material" },
    })

    const [url, options] = grabMock.mock.calls[0]
    expect(url).toBe("/coach-materials")
    expect(options.method).toBe("POST")
    expect(options.body).toBe(JSON.stringify({ title: "New material" }))
  })

  it("maps a grab error onto RequestResult.error instead of throwing", async () => {
    grabMock.mockResolvedValue({ error: "HTTP error: 404 Not Found" })
    const client = createClient()

    const result = await client.request({ url: "/missing" })

    expect(result.error).toBe("HTTP error: 404 Not Found")
    expect(result.data).toBeUndefined()
  })

  it("merges setConfig headers instead of replacing them", () => {
    const client = createClient({ headers: { "X-A": "1" } })
    const next = client.setConfig({ headers: { "X-B": "2" } })
    expect(next.headers).toEqual({ "X-A": "1", "X-B": "2" })
  })
})
