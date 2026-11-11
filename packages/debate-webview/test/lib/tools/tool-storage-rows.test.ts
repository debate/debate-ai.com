/**
 * @fileoverview `buildToolStorageRows` joins the tool catalog with
 * `resolveToolStorage` and the live sync snapshot for the Settings → General
 * "Where each tool saves" list: SQL tools say what they keep, synced tools
 * carry their sync state (including a parent route's collections), and tools
 * that store nothing of their own are left out.
 */

import { describe, expect, it } from "vitest"

import type { ToolRecordHydrationResult } from "@debate-ai/research-evidence/src/account-sync/tool-record-mirror"
import { buildToolStorageRows, toolStorageStatusLabel } from "../../../src/lib/tools/tool-storage-rows"
import { ALL_TOOLS } from "../../../src/routes/tools/tool-groups"

const signedIn = { enabled: true, reconciled: true, results: [] as ToolRecordHydrationResult[] }

const tools = [
  { href: "/practice/prep", label: "Prep Workspace" },
  { href: "/contacts", label: "Contacts" },
  { href: "/coaching/rankings", label: "Rankings" },
  { href: "/not-a-real-tool", label: "Ghost" },
  { href: "/research/cards/awards", label: "Contributor Awards" },
]

describe("buildToolStorageRows", () => {
  it("lists SQL and synced tools and drops derived or undeclared ones", () => {
    const rows = buildToolStorageRows({ tools, sync: signedIn })
    expect(rows.map((row) => row.href)).toEqual(["/practice/prep", "/contacts", "/research/cards/awards"])
    expect(rows[1]).toEqual({
      href: "/contacts",
      label: "Contacts",
      where: "sql",
      description: "Saved to your account: contacts and blocks.",
      status: { kind: "none" },
    })
    expect(rows[0]).toMatchObject({ where: "synced", status: { kind: "synced" } })
  })

  it("marks synced tools as on this device when signed out", () => {
    const rows = buildToolStorageRows({ tools, sync: { ...signedIn, enabled: false } })
    expect(rows.find((row) => row.href === "/practice/prep")?.status).toEqual({ kind: "local" })
    expect(rows.find((row) => row.href === "/contacts")?.status).toEqual({ kind: "none" })
  })

  it("reports a failure in a parent route's collection on the child tool", () => {
    const rows = buildToolStorageRows({
      tools,
      sync: {
        ...signedIn,
        results: [
          { collection: "evidenceLibraryEntries", adopted: 0, pushed: 0, synced: false, error: "quota" },
        ],
      },
    })
    expect(rows.find((row) => row.href === "/research/cards/awards")?.status).toEqual({
      kind: "failed",
      error: "quota",
    })
  })

  it("filters by label, ignoring case and surrounding space", () => {
    const rows = buildToolStorageRows({ tools, sync: signedIn, query: "  CONTACT " })
    expect(rows.map((row) => row.label)).toEqual(["Contacts"])
    expect(buildToolStorageRows({ tools, sync: signedIn, query: "zzz" })).toEqual([])
  })

  it("lists a tool that appears twice in the catalog once", () => {
    const rows = buildToolStorageRows({ tools: [tools[1], tools[1]], sync: signedIn })
    expect(rows).toHaveLength(1)
  })

  it("covers the real catalog without duplicate rows", () => {
    const rows = buildToolStorageRows({ tools: ALL_TOOLS, sync: signedIn })
    expect(rows.length).toBeGreaterThan(5)
    expect(new Set(rows.map((row) => row.href)).size).toBe(rows.length)
    expect(rows.every((row) => row.description.length > 0)).toBe(true)
  })
})

describe("toolStorageStatusLabel", () => {
  it("names each live state and stays silent for SQL-only tools", () => {
    expect(toolStorageStatusLabel({ kind: "none" })).toBeNull()
    expect(toolStorageStatusLabel({ kind: "local" })).toBe("On this device")
    expect(toolStorageStatusLabel({ kind: "syncing" })).toBe("Syncing…")
    expect(toolStorageStatusLabel({ kind: "synced" })).toBe("Synced")
    expect(toolStorageStatusLabel({ kind: "failed", error: "x" })).toBe("Couldn't sync")
  })
})
