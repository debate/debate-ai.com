/**
 * @fileoverview Covers `summarizeToolSyncStatus`'s three states: still
 * reconciling, fully synced (with the count of tools that save, or without one
 * when the count is unknown), and one or more collections failing (singular vs.
 * plural wording).
 */

import { describe, expect, it } from "vitest"

import { summarizeToolSyncStatus } from "../../../src/lib/tools/tool-sync-summary"

describe("summarizeToolSyncStatus", () => {
  it("reports syncing while the tab's merge hasn't finished yet", () => {
    expect(summarizeToolSyncStatus({ reconciled: false, totalTools: 60, failureCount: 0 })).toBe(
      "Syncing your tools to your account…",
    )
    // Still "syncing" even if a stale failure count is passed in — reconciled
    // is the state that decides which sentence this is.
    expect(summarizeToolSyncStatus({ reconciled: false, totalTools: 60, failureCount: 2 })).toBe(
      "Syncing your tools to your account…",
    )
  })

  it("reports every tool synced once reconciled with no failures", () => {
    expect(summarizeToolSyncStatus({ reconciled: true, totalTools: 60, failureCount: 0 })).toBe(
      "All 60 tools that save data are synced to your account.",
    )
    expect(summarizeToolSyncStatus({ reconciled: true, totalTools: 1, failureCount: 0 })).toBe(
      "Your 1 tool that saves data is synced to your account.",
    )
  })

  it("drops the count when no tool count is known", () => {
    expect(summarizeToolSyncStatus({ reconciled: true, totalTools: 0, failureCount: 0 })).toBe(
      "Every tool's data is synced to your account.",
    )
    expect(summarizeToolSyncStatus({ reconciled: true, totalTools: -1, failureCount: 0 })).toBe(
      "Every tool's data is synced to your account.",
    )
  })

  it("uses singular wording for exactly one failure", () => {
    expect(summarizeToolSyncStatus({ reconciled: true, totalTools: 60, failureCount: 1 })).toBe(
      "1 tool couldn't sync just now.",
    )
  })

  it("uses plural wording for more than one failure", () => {
    expect(summarizeToolSyncStatus({ reconciled: true, totalTools: 60, failureCount: 3 })).toBe(
      "3 tools couldn't sync just now.",
    )
  })
})
