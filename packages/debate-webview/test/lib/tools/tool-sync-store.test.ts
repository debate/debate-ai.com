/**
 * @fileoverview The shared sync store notifies subscribers on change, stays
 * quiet for an identical publish, and resets to the signed-out default.
 */

import { describe, expect, it, vi } from "vitest"

import {
  getToolSyncSnapshot,
  publishToolSyncSnapshot,
  resetToolSyncSnapshot,
  subscribeToolSyncSnapshot,
} from "../../../src/lib/tools/tool-sync-store"

describe("tool-sync-store", () => {
  it("notifies on change, not on an identical publish, and stops after unsubscribe", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToolSyncSnapshot(listener)
    const resync = () => {}
    const results: never[] = []

    publishToolSyncSnapshot({ enabled: true, reconciled: true, results, resync })
    publishToolSyncSnapshot({ enabled: true, reconciled: true, results, resync })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getToolSyncSnapshot().enabled).toBe(true)

    unsubscribe()
    resetToolSyncSnapshot()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getToolSyncSnapshot()).toMatchObject({ enabled: false, reconciled: false, results: [] })
  })
})
