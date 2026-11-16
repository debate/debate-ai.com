/** @vitest-environment jsdom */
/**
 * @fileoverview `readLastToolSyncAt` reads the tab's last complete merge mark
 * (and treats a missing, malformed or unreadable one as "none"), and
 * `formatLastToolSync` words its age for the Account sync panel.
 */

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  TOOL_SYNC_HYDRATED_KEY,
  formatLastToolSync,
  readLastToolSyncAt,
} from "../../../src/lib/tools/tool-sync-last-merge"

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe("readLastToolSyncAt", () => {
  it("returns the stored merge time", () => {
    sessionStorage.setItem(TOOL_SYNC_HYDRATED_KEY, "1763251200000")
    expect(readLastToolSyncAt()).toBe(1763251200000)
  })

  it("shares its key with the merge's 10-minute reconcile mark", () => {
    expect(TOOL_SYNC_HYDRATED_KEY).toBe("toolRecordSyncHydratedAt")
  })

  it("returns null with no mark, a malformed one, or a non-positive one", () => {
    expect(readLastToolSyncAt()).toBeNull()
    sessionStorage.setItem(TOOL_SYNC_HYDRATED_KEY, "not a number")
    expect(readLastToolSyncAt()).toBeNull()
    sessionStorage.setItem(TOOL_SYNC_HYDRATED_KEY, "0")
    expect(readLastToolSyncAt()).toBeNull()
    sessionStorage.setItem(TOOL_SYNC_HYDRATED_KEY, "-5")
    expect(readLastToolSyncAt()).toBeNull()
  })

  it("returns null when session storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    expect(readLastToolSyncAt()).toBeNull()
  })
})

describe("formatLastToolSync", () => {
  const at = 1_000_000_000_000
  const minute = 60_000

  it("says just now under a minute, and for a time slightly in the future", () => {
    expect(formatLastToolSync(at, at)).toBe("Last synced just now")
    expect(formatLastToolSync(at, at + 59_999)).toBe("Last synced just now")
    expect(formatLastToolSync(at, at - 5_000)).toBe("Last synced just now")
  })

  it("counts minutes, hours and days with singular and plural wording", () => {
    expect(formatLastToolSync(at, at + minute)).toBe("Last synced 1 minute ago")
    expect(formatLastToolSync(at, at + 7 * minute + 30_000)).toBe("Last synced 7 minutes ago")
    expect(formatLastToolSync(at, at + 59 * minute)).toBe("Last synced 59 minutes ago")
    expect(formatLastToolSync(at, at + 60 * minute)).toBe("Last synced 1 hour ago")
    expect(formatLastToolSync(at, at + 5 * 60 * minute)).toBe("Last synced 5 hours ago")
    expect(formatLastToolSync(at, at + 24 * 60 * minute)).toBe("Last synced 1 day ago")
    expect(formatLastToolSync(at, at + 3 * 24 * 60 * minute)).toBe("Last synced 3 days ago")
  })
})
