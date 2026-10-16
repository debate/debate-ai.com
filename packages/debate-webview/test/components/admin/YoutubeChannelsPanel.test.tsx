/** @vitest-environment jsdom */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { YoutubeChannelsPanel } from "../../../src/components/admin/YoutubeChannelsPanel"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const row = (id: number, name: string, videoCount = 0) => ({
  id,
  channelId: null,
  name,
  enabled: true,
  addedBy: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  videoCount,
  latestVideo: videoCount
    ? { videoId: `v${id}`, title: `${name} latest round`, publishedAt: "2026-09-30" }
    : null,
})

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response

let root: Root
let host: HTMLDivElement
let fetchMock: ReturnType<typeof vi.fn>

const getCalls = () =>
  fetchMock.mock.calls.filter(([, init]) => !init || !(init as RequestInit).method)

const names = () =>
  [...host.querySelectorAll("tbody span.font-medium")].map((node) => node.textContent)

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

describe("YoutubeChannelsPanel", () => {
  it("loads the list once, most videos first, and never refetches it", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ channels: [row(1, "Alpha", 3), row(2, "Beta", 40), row(3, "Gamma", 0)], nextCursor: null }),
    )

    await act(async () => root.render(<YoutubeChannelsPanel />))
    await act(async () => {})

    expect(getCalls()).toHaveLength(1)
    expect(names()).toEqual(["Beta", "Alpha", "Gamma"])
    const firstRow = host.querySelector("tbody tr")!
    expect(firstRow.textContent).toContain("40")
    expect(firstRow.querySelector("a")!.getAttribute("href")).toBe("https://www.youtube.com/watch?v=v2")
    expect(firstRow.textContent).toContain("Beta latest round")
    expect(host.textContent).not.toContain("Refresh")
    expect(host.textContent).not.toContain("Load more")
  })

  it("keeps a channel's video count when a toggle returns the bare row", async () => {
    fetchMock.mockResolvedValueOnce(json({ channels: [row(1, "Alpha", 7)], nextCursor: null }))
    await act(async () => root.render(<YoutubeChannelsPanel />))
    await act(async () => {})

    const { videoCount: _count, latestVideo: _latest, ...bare } = row(1, "Alpha Renamed")
    fetchMock.mockResolvedValueOnce(json({ channel: bare }))
    await act(async () => {
      ;[...host.querySelectorAll("button")].find((b) => b.textContent === "Edit")!.click()
    })
    const input = host.querySelector<HTMLInputElement>('input[aria-label="Channel name"]')!
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setValue.call(input, "Alpha Renamed")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => {
      ;[...host.querySelectorAll("button")].find((b) => b.textContent === "Save")!.click()
    })

    expect(names()).toEqual(["Alpha Renamed"])
    expect(host.textContent).toContain("Alpha latest round")
  })

  it("updates the row in place after a toggle, without reloading", async () => {
    fetchMock.mockResolvedValueOnce(json({ channels: [row(1, "Alpha")], nextCursor: null }))
    await act(async () => root.render(<YoutubeChannelsPanel />))
    await act(async () => {})

    fetchMock.mockResolvedValueOnce(json({ channel: { ...row(1, "Alpha"), enabled: false } }))
    const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    await act(async () => checkbox.click())

    expect(getCalls()).toHaveLength(1)
    expect(host.textContent).toContain("paused")
  })

  it("adds a channel from the POST response, without reloading", async () => {
    fetchMock.mockResolvedValueOnce(json({ channels: [row(1, "Alpha", 5)], nextCursor: null }))
    await act(async () => root.render(<YoutubeChannelsPanel />))
    await act(async () => {})

    const input = host.querySelector<HTMLInputElement>("#channel-name")!
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setValue.call(input, "Gamma")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    fetchMock.mockResolvedValueOnce(json({ channel: row(3, "Gamma") }, 201))
    await act(async () => host.querySelector("form")!.requestSubmit())

    expect(getCalls()).toHaveLength(1)
    // A new channel has no videos yet, so it sorts below Alpha.
    expect(names()).toEqual(["Alpha", "Gamma"])
  })
})
