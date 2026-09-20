/**
 * @fileoverview Covers `summarizeToolSyncFailures`'s three real cases: a
 * genuine failure is surfaced with its tool's label and link, a collection
 * that's merely unsynced because nobody is signed in is not mistaken for a
 * failure, and a result for a collection the catalog no longer recognizes is
 * dropped instead of rendering a blank row.
 */

import { describe, expect, it } from "vitest"

import { summarizeToolSyncFailures } from "../tool-sync-status"
import type { ToolRecordHydrationResult } from "debate-data-sync/src/state/tool-record-mirror"

function result(overrides: Partial<ToolRecordHydrationResult>): ToolRecordHydrationResult {
  return { collection: "judgeProfiles", adopted: 0, pushed: 0, synced: true, ...overrides }
}

describe("summarizeToolSyncFailures", () => {
  it("surfaces a real failure with the tool's label and link", () => {
    const failures = summarizeToolSyncFailures([
      result({ collection: "judgeProfiles", synced: false, error: "network error" }),
    ])
    expect(failures).toEqual([
      { key: "judgeProfiles", label: "Judge Profiles", href: "/judges", error: "network error" },
    ])
  })

  it("does not treat an unsynced-because-signed-out result as a failure", () => {
    // Per ToolRecordHydrationResult's own doc comment, `synced: false` with no
    // `error` means "the account had nothing to say" (e.g. signed out), not a
    // failed merge.
    const failures = summarizeToolSyncFailures([result({ synced: false, error: undefined })])
    expect(failures).toEqual([])
  })

  it("ignores a synced result even if it somehow carried an error", () => {
    const failures = summarizeToolSyncFailures([result({ synced: true, error: "stale" })])
    expect(failures).toEqual([])
  })

  it("drops a result for a collection key the catalog no longer recognizes", () => {
    const failures = summarizeToolSyncFailures([
      result({ collection: "someRemovedCollection", synced: false, error: "gone" }),
    ])
    expect(failures).toEqual([])
  })

  it("sorts multiple failures by label", () => {
    const failures = summarizeToolSyncFailures([
      result({ collection: "opponentTeamProfiles", synced: false, error: "boom" }),
      result({ collection: "judgeProfiles", synced: false, error: "boom" }),
    ])
    expect(failures.map((f) => f.label)).toEqual(["Judge Profiles", "Opponent Team Profiles"])
  })

  it("returns an empty list for no results", () => {
    expect(summarizeToolSyncFailures([])).toEqual([])
  })
})
