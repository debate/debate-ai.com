/** @vitest-environment jsdom */
/**
 * @fileoverview `useToolRecordSync`: mirroring follows the session, the
 * account merge runs once per tab (and again on `resync`), every collection
 * is baselined as it is merged, the background watcher's flushes fold into
 * the status list, and signing out tears all of it down.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { flush, renderHook, type RenderedHook } from "../../helpers/render-hook"

const session = vi.hoisted(() => ({ current: { isAuthenticated: false, isLoading: false } }))
vi.mock("../../../src/lib/hooks/useSession", () => ({ useSession: () => session.current }))

vi.mock("@debate/data-sync/src/state/toolRecordCollections", () => ({
  TOOL_RECORD_COLLECTIONS: [{ key: "drillSets" }, { key: "judgeDecisions" }],
}))

const mirror = vi.hoisted(() => ({
  beginToolRecordPrefetch: vi.fn(),
  endToolRecordPrefetch: vi.fn(),
  hydrateToolRecords: vi.fn(),
  setToolRecordSyncEnabled: vi.fn(),
}))
vi.mock("@debate/data-sync/src/state/tool-record-mirror", () => mirror)

type Flushed = { collection: string; pushed: number; error?: string }
const autoSync = vi.hoisted(() => ({
  markToolRecordsSynced: vi.fn(),
  resetToolRecordAutoSync: vi.fn(),
  startToolRecordAutoSync: vi.fn<(onFlush: (results: Flushed[]) => void) => () => void>(),
  stopToolRecordAutoSync: vi.fn(),
}))
vi.mock("@debate/data-sync/src/state/tool-record-auto-sync", () => autoSync)

const signIn = vi.hoisted(() => ({ setSignedIn: vi.fn() }))
vi.mock("@debate/data-sync/src/state/sign-in-prompt", () => signIn)

import { useToolRecordSync } from "../../../src/lib/hooks/useToolRecordSync"
import { getToolSyncSnapshot } from "../../../src/lib/tools/tool-sync-store"

let rendered: RenderedHook<ReturnType<typeof useToolRecordSync>, undefined> | null = null
let onFlush: ((results: Flushed[]) => void) | null = null
const stopWatcher = vi.fn()

beforeEach(() => {
  sessionStorage.clear()
  vi.clearAllMocks()
  session.current = { isAuthenticated: false, isLoading: false }
  mirror.hydrateToolRecords.mockImplementation(async (collection: string) => ({
    collection,
    adopted: 1,
    pushed: 0,
    synced: true,
  }))
  autoSync.startToolRecordAutoSync.mockImplementation((callback) => {
    onFlush = callback
    return stopWatcher
  })
})

afterEach(async () => {
  await rendered?.unmount()
  rendered = null
  onFlush = null
})

async function render() {
  rendered = await renderHook(() => useToolRecordSync())
  await flush()
  return rendered
}

describe("useToolRecordSync", () => {
  it("stays off and unreconciled while signed out", async () => {
    const { result } = await render()
    expect(result.current).toMatchObject({ enabled: false, reconciled: false, results: [] })
    expect(mirror.setToolRecordSyncEnabled).toHaveBeenLastCalledWith(false)
    expect(signIn.setSignedIn).toHaveBeenLastCalledWith(false)
    expect(autoSync.resetToolRecordAutoSync).toHaveBeenCalled()
    expect(mirror.hydrateToolRecords).not.toHaveBeenCalled()
  })

  it("waits for the session to finish loading before merging", async () => {
    session.current = { isAuthenticated: true, isLoading: true }
    const { result } = await render()
    expect(mirror.hydrateToolRecords).not.toHaveBeenCalled()
    expect(result.current.reconciled).toBe(false)
  })

  it("merges every collection once, baselining each, then starts the watcher", async () => {
    session.current = { isAuthenticated: true, isLoading: false }
    const { result } = await render()

    expect(mirror.setToolRecordSyncEnabled).toHaveBeenCalledWith(true)
    expect(mirror.beginToolRecordPrefetch).toHaveBeenCalledTimes(1)
    expect(mirror.hydrateToolRecords.mock.calls.map(([key]) => key)).toEqual(["drillSets", "judgeDecisions"])
    expect(autoSync.markToolRecordsSynced.mock.calls.map(([key]) => key)).toEqual(["drillSets", "judgeDecisions"])
    expect(result.current.reconciled).toBe(true)
    expect(result.current.results.map((entry) => entry.collection)).toEqual(["drillSets", "judgeDecisions"])
    expect(autoSync.startToolRecordAutoSync).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem("toolRecordSyncHydratedAt")).not.toBeNull()
    expect(getToolSyncSnapshot()).toMatchObject({ enabled: true, reconciled: true })
  })

  it("skips the merge when this tab reconciled recently", async () => {
    sessionStorage.setItem("toolRecordSyncHydratedAt", String(Date.now()))
    session.current = { isAuthenticated: true, isLoading: false }
    const { result } = await render()
    expect(mirror.hydrateToolRecords).not.toHaveBeenCalled()
    expect(result.current.reconciled).toBe(true)
  })

  it("merges again after the tab's reconcile has gone stale", async () => {
    sessionStorage.setItem("toolRecordSyncHydratedAt", String(Date.now() - 11 * 60 * 1000))
    session.current = { isAuthenticated: true, isLoading: false }
    await render()
    expect(mirror.hydrateToolRecords).toHaveBeenCalledTimes(2)
  })

  it("re-runs the merge on resync, ignoring the tab's TTL", async () => {
    session.current = { isAuthenticated: true, isLoading: false }
    const { result } = await render()
    await flush(() => result.current.resync())
    await flush()
    expect(mirror.hydrateToolRecords).toHaveBeenCalledTimes(4)
    expect(result.current.reconciled).toBe(true)
  })

  it("folds the watcher's flushes into the results, error or not", async () => {
    session.current = { isAuthenticated: true, isLoading: false }
    const { result } = await render()
    await flush(() =>
      onFlush?.([
        { collection: "drillSets", pushed: 2 },
        { collection: "flowSummaries", pushed: 0, error: "too large" },
      ]),
    )
    const byCollection = Object.fromEntries(result.current.results.map((entry) => [entry.collection, entry]))
    expect(byCollection.drillSets).toEqual({ collection: "drillSets", adopted: 0, pushed: 2, synced: true })
    expect(byCollection.flowSummaries).toMatchObject({ synced: false, error: "too large" })
    expect(byCollection.judgeDecisions).toMatchObject({ adopted: 1 })
  })

  it("still reports reconciled when the merge throws", async () => {
    mirror.hydrateToolRecords.mockImplementation(() => {
      const failure = Promise.reject(new Error("boom"))
      failure.catch(() => {})
      return failure
    })
    session.current = { isAuthenticated: true, isLoading: false }
    const { result } = await render()
    expect(result.current.reconciled).toBe(true)
    expect(mirror.endToolRecordPrefetch).toHaveBeenCalled()
  })

  it("tears everything down on sign-out", async () => {
    session.current = { isAuthenticated: true, isLoading: false }
    const hook = await render()
    session.current = { isAuthenticated: false, isLoading: false }
    await hook.rerender(undefined)
    await flush()

    expect(hook.result.current).toMatchObject({ enabled: false, reconciled: false, results: [] })
    expect(stopWatcher).toHaveBeenCalled()
    expect(autoSync.stopToolRecordAutoSync).toHaveBeenCalled()
    expect(sessionStorage.getItem("toolRecordSyncHydratedAt")).toBeNull()
  })
})
