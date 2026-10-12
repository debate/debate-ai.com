/** @vitest-environment jsdom */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { YoutubeChannelsPanel } from "../../../src/components/admin/YoutubeChannelsPanel"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const row = (id: number, name: string) => ({
  id,
  channelId: null,
  name,
  enabled: true,
  addedBy: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
})

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response

let root: Root
let host: HTMLDivElement
let fetchMock: ReturnType<typeof vi.fn>

const getCalls = () =>
  fetchMock.mock.calls.filter(([, init]) => !init || !(init as RequestInit).method)

const names = () =>
  [...host.querySelectorAll("li span.font-medium")].map((node) => node.textContent)

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
  it("follows the cursor once on mount and never refetches the list", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ channels: [row(2, "Beta")], nextCursor: "c1" }))
      .mockResolvedValueOnce(json({ channels: [row(1, "Alpha")], nextCursor: null }))

    await act(async () => root.render(<YoutubeChannelsPanel />))
    await act(async () => {})

    expect(getCalls()).toHaveLength(2)
    expect(String(getCalls()[1][0])).toContain("cursor=c1")
    expect(names()).toEqual(["Beta", "Alpha"])
    expect(host.textContent).not.toContain("Refresh")
    expect(host.textContent).not.toContain("Load more")
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

  it("prepends an added channel from the POST response, without reloading", async () => {
    fetchMock.mockResolvedValueOnce(json({ channels: [row(1, "Alpha")], nextCursor: null }))
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
    expect(names()).toEqual(["Gamma", "Alpha"])
  })
})
