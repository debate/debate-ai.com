import { describe, expect, it } from "vitest"
import { TOOL_RECORD_COLLECTIONS } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections"

import { ALL_TOOLS } from "../../src/routes/tools/tool-groups"
import { TOOL_STORAGE_OVERRIDES, describeToolStorage, resolveToolStorage } from "../../src/lib/tools/tool-storage"

describe("resolveToolStorage", () => {
  it("gives every /tools entry a storage story", () => {
    const missing = ALL_TOOLS.map((t) => t.href).filter((href) => resolveToolStorage(href) === null)
    expect(missing, "add these to TOOL_STORAGE_OVERRIDES with a reason, or register a tool-record collection").toEqual(
      [],
    )
  })

  it("only declares overrides for real tools that no collection already owns", () => {
    const hrefs = new Set(ALL_TOOLS.map((t) => t.href))
    const collectionHrefs = new Set(TOOL_RECORD_COLLECTIONS.map((c) => c.href))
    for (const href of Object.keys(TOOL_STORAGE_OVERRIDES)) {
      expect(hrefs.has(href), `${href} is not in ALL_TOOLS`).toBe(true)
      expect(collectionHrefs.has(href), `${href} owns a collection; drop the override`).toBe(false)
    }
  })

  it("resolves an exact-route tool to its collections", () => {
    const storage = resolveToolStorage("/practice/prep")
    expect(storage?.kind).toBe("synced")
    expect(storage?.kind === "synced" && storage.collections.length).toBeGreaterThan(1)
  })

  it("falls back to the nearest parent route and ignores a query string", () => {
    expect(resolveToolStorage("/research/cards/awards")).toEqual(resolveToolStorage("/research/cards"))
    expect(resolveToolStorage("/debate?section=x")).toEqual(resolveToolStorage("/debate"))
  })

  it("prefers an override over a parent route's collections", () => {
    expect(resolveToolStorage("/coaching/rankings")?.kind).toBe("derived")
  })

  it("returns null for an unknown route", () => {
    expect(resolveToolStorage("/nope")).toBeNull()
  })
})

describe("describeToolStorage", () => {
  it("describes each kind, and stays silent for derived or unknown tools", () => {
    expect(describeToolStorage({ kind: "synced", collections: ["x"] })).toMatch(/signed in/)
    expect(describeToolStorage({ kind: "sql", what: "contacts" })).toBe("Saved to your account: contacts.")
    expect(describeToolStorage({ kind: "derived", reason: "r" })).toBeNull()
    expect(describeToolStorage(null)).toBeNull()
  })
})
