/**
 * @fileoverview Covers `summarizeToolSyncFailures`'s three real cases: a
 * genuine failure is surfaced with its tool's label and link, a collection
 * that's merely unsynced because nobody is signed in is not mistaken for a
 * failure, and a result for a collection the catalog no longer recognizes is
 * dropped instead of rendering a blank row.
 */

import { describe, expect, it } from "vitest"

import { resolveToolSyncKeys, summarizeToolSyncFailures, toolSyncBadgeState } from "../../../src/lib/tools/tool-sync-status"
import type { ToolRecordHydrationResult } from "@debate/data-sync/src/state/tool-record-mirror"

function result(overrides: Partial<ToolRecordHydrationResult>): ToolRecordHydrationResult {
  return { collection: "judgeProfiles", adopted: 0, pushed: 0, synced: true, ...overrides }
}

describe("summarizeToolSyncFailures", () => {
  it("surfaces a real failure with the tool's label and link", () => {
    const failures = summarizeToolSyncFailures([
      result({ collection: "judgeProfiles", synced: false, error: "network error" }),
    ])
    expect(failures).toEqual([
      { key: "judgeProfiles", label: "Judge Profiles", href: "/practice/prep", error: "network error" },
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

describe("toolSyncBadgeState", () => {
  const base = { enabled: true, reconciled: true, results: [] as ToolRecordHydrationResult[] }

  it("shows nothing for a tool with no synced collection", () => {
    expect(toolSyncBadgeState("/not-a-synced-tool", base)).toEqual({ kind: "none" })
  })

  it("says the data is local when signed out", () => {
    expect(toolSyncBadgeState("/practice/prep", { ...base, enabled: false })).toEqual({ kind: "local" })
  })

  it("says syncing until the tab's merge finishes", () => {
    expect(toolSyncBadgeState("/practice/prep", { ...base, reconciled: false })).toEqual({ kind: "syncing" })
  })

  it("reports synced when no owned collection failed", () => {
    expect(
      toolSyncBadgeState("/practice/prep", {
        ...base,
        results: [result({ collection: "judgeProfiles" }), result({ collection: "flowSummaries", synced: false, error: "x" })],
      }),
    ).toEqual({ kind: "synced" })
  })

  it("fails if any collection owned by the tool failed", () => {
    expect(
      toolSyncBadgeState("/practice/prep", {
        ...base,
        results: [result({ collection: "judgeRoundRecords", synced: false, error: "too large" })],
      }),
    ).toEqual({ kind: "failed", error: "too large" })
  })
})

describe("resolveToolSyncKeys", () => {
  it("defaults to every collection registered under the page's own href", () => {
    expect(resolveToolSyncKeys("/practice/prep")).toContain("judgeProfiles")
  })

  it("returns nothing for a route with no synced collection and no explicit keys", () => {
    expect(resolveToolSyncKeys("/not-a-tool")).toEqual([])
  })

  it("uses explicit keys for a sub-page whose data is filed under its hub", () => {
    // `/research/cards/library` has no collections of its own; its data is
    // registered under `/research/cards`.
    expect(resolveToolSyncKeys("/research/cards/library")).toEqual([])
    expect(
      resolveToolSyncKeys("/research/cards/library", ["evidenceLibraryEntries", "reuseCheckHistory"]),
    ).toEqual(["evidenceLibraryEntries", "reuseCheckHistory"])
  })

  it("drops explicit keys the catalog doesn't recognize", () => {
    expect(resolveToolSyncKeys("/x", ["trackedArguments", "someRemovedCollection"])).toEqual(["trackedArguments"])
  })

  it("keeps the shared-cards sub-pages' keys in the catalog", () => {
    expect(resolveToolSyncKeys("/x", ["evidenceLibraryEntries", "reuseCheckHistory", "trackedArguments", "revisionHistory"])).toHaveLength(4)
  })
})
