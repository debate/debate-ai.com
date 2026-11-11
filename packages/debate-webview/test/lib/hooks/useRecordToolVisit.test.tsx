/** @vitest-environment jsdom */
/**
 * @fileoverview `recordToolVisit` / `useRecordToolVisit` / `RecordToolVisit`:
 * a tool page records itself in the "Recent" store on mount — after the
 * once-per-page-load account read, pushing to the account only when signed
 * in, and announcing the change to every mounted `useRecentTools`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { flush, renderHook, type RenderedHook } from "../../helpers/render-hook"

const client = vi.hoisted(() => ({
  fetchUserSettings: vi.fn<() => Promise<Record<string, unknown> | null>>(),
  saveRecentToolOp: vi.fn<(op: { recordRecentTool: string }) => Promise<void>>(),
}))
vi.mock("@debate-ai/round", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@debate-ai/round")>()),
  fetchUserSettings: client.fetchUserSettings,
  saveRecentToolOp: client.saveRecentToolOp,
}))

type HookModule = typeof import("../../../src/lib/hooks/useRecentTools")
let hooks: HookModule
const mounted: Array<RenderedHook<unknown, unknown>> = []

function stored(): unknown {
  const raw = localStorage.getItem("recent-tools")
  return raw === null ? null : JSON.parse(raw)
}

beforeEach(async () => {
  vi.clearAllMocks()
  localStorage.clear()
  client.fetchUserSettings.mockResolvedValue(null)
  client.saveRecentToolOp.mockResolvedValue(undefined)
  // `remoteAvailable` / `remoteLoadPromise` are module-level.
  vi.resetModules()
  hooks = await import("../../../src/lib/hooks/useRecentTools")
})

afterEach(async () => {
  while (mounted.length > 0) await mounted.pop()!.unmount()
})

async function settle() {
  for (let i = 0; i < 4; i++) await flush()
}

describe("recordToolVisit", () => {
  it("promotes the tool to the front locally and skips the account when signed out", async () => {
    localStorage.setItem("recent-tools", JSON.stringify(["/practice/prep"]))

    await hooks.recordToolVisit("/practice/drills")

    expect(stored()).toEqual(["/practice/drills", "/practice/prep"])
    expect(client.saveRecentToolOp).not.toHaveBeenCalled()
  })

  it("waits for the account list, then records on top of it and saves the op when signed in", async () => {
    localStorage.setItem("recent-tools", JSON.stringify(["/practice/prep"]))
    client.fetchUserSettings.mockResolvedValue({ recentTools: ["/contacts"] })

    await hooks.recordToolVisit("/practice/drills")

    // The remote hydrate replaced the local list before the visit landed,
    // so the visit isn't lost to it.
    expect(stored()).toEqual(["/practice/drills", "/contacts"])
    expect(client.saveRecentToolOp).toHaveBeenCalledWith({ recordRecentTool: "/practice/drills" })
  })

  it("does nothing when the tool is already the most recent", async () => {
    localStorage.setItem("recent-tools", JSON.stringify(["/practice/drills", "/practice/prep"]))
    client.fetchUserSettings.mockResolvedValue({})
    const changed = vi.fn()
    window.addEventListener("recent-tools-changed", changed)

    await hooks.recordToolVisit("/practice/drills")

    window.removeEventListener("recent-tools-changed", changed)
    expect(changed).not.toHaveBeenCalled()
    expect(client.saveRecentToolOp).not.toHaveBeenCalled()
  })

  it("ignores an invalid href", async () => {
    await hooks.recordToolVisit("https://example.com/not-in-app")
    expect(stored()).toBeNull()
  })

  it("never rejects when the account load or save fails", async () => {
    client.fetchUserSettings.mockRejectedValueOnce(new Error("offline"))
    await expect(hooks.recordToolVisit("/practice/drills")).resolves.toBeUndefined()
    expect(stored()).toEqual(["/practice/drills"])
  })

  it("swallows a failed account save", async () => {
    client.fetchUserSettings.mockResolvedValue({})
    client.saveRecentToolOp.mockRejectedValue(new Error("500"))
    await expect(hooks.recordToolVisit("/practice/drills")).resolves.toBeUndefined()
    expect(stored()).toEqual(["/practice/drills"])
  })
})

describe("useRecordToolVisit", () => {
  it("records on mount and a mounted useRecentTools sees it", async () => {
    const recent = await renderHook(() => hooks.useRecentTools())
    mounted.push(recent as RenderedHook<unknown, unknown>)
    mounted.push(
      (await renderHook(() => hooks.useRecordToolVisit("/practice/drills"))) as RenderedHook<unknown, unknown>,
    )
    await settle()

    expect(recent.result.current.recent).toEqual(["/practice/drills"])
  })

  it("records again when the href changes, and nothing for undefined", async () => {
    const visit = await renderHook((href: string | undefined) => hooks.useRecordToolVisit(href), undefined)
    mounted.push(visit as RenderedHook<unknown, unknown>)
    await settle()
    expect(stored()).toBeNull()

    await visit.rerender("/practice/prep")
    await settle()
    await visit.rerender("/practice/drills")
    await settle()

    expect(stored()).toEqual(["/practice/drills", "/practice/prep"])
  })
})

describe("RecordToolVisit", () => {
  it("renders nothing and records its href", async () => {
    const { RecordToolVisit } = await import("../../../src/components/tools/favorites/RecordToolVisit")
    const { renderToStaticMarkup } = await import("react-dom/server")
    expect(renderToStaticMarkup(<RecordToolVisit href="/contacts" />)).toBe("")

    mounted.push(
      (await renderHook(() => RecordToolVisit({ href: "/contacts" }))) as RenderedHook<unknown, unknown>,
    )
    await settle()
    expect(stored()).toEqual(["/contacts"])
  })
})
