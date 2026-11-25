import { describe, expect, it } from "vitest"
import { TOOL_RECORD_COLLECTIONS } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections"

import { ALL_TOOLS } from "../../src/routes/tools/tool-groups"
import {
  STORAGE_PAGES_OUTSIDE_CATALOG,
  TOOL_SQL_ALONGSIDE,
  TOOL_STORAGE_OVERRIDES,
  describeToolStorage,
  resolveToolStorage,
  type ToolStorage,
} from "../../src/lib/tools/tool-storage"

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

  it("adds the SQL items of a tool that also owns collections", () => {
    const storage = resolveToolStorage("/practice/versus-ai?history=1")
    expect(storage).toMatchObject({ kind: "synced", sql: "practice debates vs AI" })
    expect(storage?.kind === "synced" && storage.collections).toContain("aiVersusRounds")
    expect(resolveToolStorage("/practice/prep")).not.toHaveProperty("sql")
  })

  it("only lists SQL-alongside tools that are real, synced and not overridden", () => {
    const hrefs = new Set([
      ...ALL_TOOLS.map((t) => t.href),
      ...STORAGE_PAGES_OUTSIDE_CATALOG.flatMap((g) => g.tools.map((t) => t.href)),
    ])
    for (const [href, what] of Object.entries(TOOL_SQL_ALONGSIDE)) {
      expect(hrefs.has(href), `${href} is not in ALL_TOOLS`).toBe(true)
      expect(TOOL_STORAGE_OVERRIDES[href], `${href} has an override; put the table there instead`).toBeUndefined()
      expect(resolveToolStorage(href)).toMatchObject({ kind: "synced", sql: what })
    }
  })

  it("says flows and rounds on /debate are saved to the account", () => {
    const storage = resolveToolStorage("/debate?flowId=abc")
    expect(storage).toMatchObject({ kind: "synced", sql: "flows and rounds" })
    expect(describeToolStorage(storage)).toMatch(/^Saved to your account: flows and rounds\. /)
  })

  it("lists only pages outside the catalog that store something, once each", () => {
    const catalog = new Set(ALL_TOOLS.map((t) => t.href))
    const pages = STORAGE_PAGES_OUTSIDE_CATALOG.flatMap((g) => g.tools.map((t) => t.href))
    expect(pages).toContain("/debate")
    expect(pages).toHaveLength(new Set(pages).size)
    for (const href of pages) {
      expect(catalog.has(href), `${href} is in ALL_TOOLS; it doesn't need listing here`).toBe(false)
      const storage = resolveToolStorage(href)
      expect(storage === null || storage.kind === "derived", `${href} stores nothing`).toBe(false)
    }
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
    expect(describeToolStorage({ kind: "synced", collections: ["x"], sql: "documents" })).toBe(
      "Saved to your account: documents. Its other settings are saved to your account when you're signed in, and kept on this device otherwise.",
    )
    expect(describeToolStorage(null)).toBeNull()
  })

  it("follows the sign-in state when it is given", () => {
    const sql = { kind: "sql", what: "contacts" } as const
    const synced: ToolStorage = { kind: "synced", collections: ["x"] }
    const both: ToolStorage = { kind: "synced", collections: ["x"], sql: "documents" }
    expect(describeToolStorage(sql, { signedIn: false })).toBe("Saved to your account once you sign in: contacts.")
    expect(describeToolStorage(sql, { signedIn: true })).toBe("Saved to your account: contacts.")
    expect(describeToolStorage(synced, { signedIn: false })).toBe(
      "Kept on this device until you sign in, then saved to your account.",
    )
    expect(describeToolStorage(synced, { signedIn: true })).toBe("Saved to your account.")
    expect(describeToolStorage(both, { signedIn: false })).toBe(
      "Saved to your account once you sign in: documents. Its other settings are kept on this device until then.",
    )
    expect(describeToolStorage(both, { signedIn: true })).toBe("Saved to your account: documents, plus its other settings.")
    expect(describeToolStorage({ kind: "derived", reason: "r" }, { signedIn: false })).toBeNull()
    // Unknown sign-in state keeps the line that holds either way.
    expect(describeToolStorage(synced, {})).toBe(describeToolStorage(synced))
  })
})
