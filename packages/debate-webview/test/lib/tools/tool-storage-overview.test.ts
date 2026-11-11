/**
 * @fileoverview Covers `buildToolStorageOverview` (Settings → General "Where
 * each tool saves"): SQL vs synced rows, derived tools dropped, parent-route
 * collections, sync states, duplicate hrefs, and the real catalog.
 */
import { describe, expect, it } from "vitest"

import type { ToolRecordHydrationResult } from "@debate-ai/research-evidence/src/account-sync/tool-record-mirror"
import { ALL_TOOLS, TOOL_GROUPS } from "../../../src/routes/tools/tool-groups"
import { resolveToolStorage } from "../../../src/lib/tools/tool-storage"
import {
  buildToolStorageOverview,
  toolStorageStatusLabel,
} from "../../../src/lib/tools/tool-storage-overview"

const synced = { enabled: true, reconciled: true, results: [] as ToolRecordHydrationResult[] }

const groups = [
  {
    heading: "Practice",
    tools: [
      { href: "/practice/prep", label: "Prep" },
      { href: "/word-count", label: "Word Count" },
      { href: "/coaching/rankings", label: "Rankings" },
    ],
  },
  { heading: "Research", tools: [{ href: "/research/cards/awards", label: "Card Awards" }] },
  { heading: "Again", tools: [{ href: "/word-count", label: "Word Count" }] },
  { heading: "Unknown", tools: [{ href: "/nope", label: "Nope" }] },
]

describe("buildToolStorageOverview", () => {
  it("lists SQL and synced tools, drops derived and unknown ones and empty groups", () => {
    const overview = buildToolStorageOverview(groups, synced)
    expect(overview.map((g) => g.heading)).toEqual(["Practice", "Research"])
    expect(overview[0].rows.map((r) => r.href)).toEqual(["/practice/prep", "/word-count"])
    expect(overview[0].rows[1]).toMatchObject({
      status: { kind: "account" },
      where: "Saved to your account: word-count rounds.",
    })
    expect(overview[0].rows[0].status).toEqual({ kind: "synced" })
  })

  it("follows the sync state for synced tools", () => {
    expect(buildToolStorageOverview(groups, { ...synced, reconciled: false })[0].rows[0].status).toEqual({
      kind: "syncing",
    })
    expect(buildToolStorageOverview(groups, { ...synced, enabled: false })[0].rows[0].status).toEqual({
      kind: "local",
    })
  })

  it("reports a failure in a collection filed under the tool's parent route", () => {
    const results: ToolRecordHydrationResult[] = [
      { collection: "evidenceLibraryEntries", adopted: 0, pushed: 0, synced: false, error: "Record too large" },
    ]
    const research = buildToolStorageOverview(groups, { ...synced, results })[1]
    expect(research.rows[0]).toMatchObject({
      href: "/research/cards/awards",
      status: { kind: "failed", error: "Record too large" },
    })
  })

  it("covers every catalog tool that stores something", () => {
    const listed = buildToolStorageOverview(TOOL_GROUPS, synced).flatMap((g) => g.rows.map((r) => r.href))
    const storing = [...new Set(ALL_TOOLS.map((t) => t.href))].filter((href) => {
      const storage = resolveToolStorage(href)
      return storage !== null && storage.kind !== "derived"
    })
    expect(new Set(listed)).toEqual(new Set(storing))
    expect(listed).toHaveLength(new Set(listed).size)
  })
})

describe("toolStorageStatusLabel", () => {
  it("has a label for each status", () => {
    expect(toolStorageStatusLabel({ kind: "account" })).toBe("Saved to account")
    expect(toolStorageStatusLabel({ kind: "local" })).toBe("This device only")
    expect(toolStorageStatusLabel({ kind: "syncing" })).toBe("Syncing…")
    expect(toolStorageStatusLabel({ kind: "synced" })).toBe("Synced")
    expect(toolStorageStatusLabel({ kind: "failed", error: "x" })).toBe("Couldn't sync")
  })
})
