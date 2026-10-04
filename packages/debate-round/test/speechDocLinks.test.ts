import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearSpeechDocLink,
  getSpeechDocLink,
  recentEditorDocuments,
  setSpeechDocLink,
  SPEECH_DOC_LINKS_EVENT,
  speechDocLinkScope,
} from "../src/state/speechDocLinks"

describe("speechDocLinkScope", () => {
  it("scopes to the round when the flow has one, else the flow", () => {
    expect(speechDocLinkScope({ id: 7, roundId: 3 })).toBe("round-3")
    expect(speechDocLinkScope({ id: 7 })).toBe("flow-7")
    expect(speechDocLinkScope(null)).toBeNull()
  })
})

describe("speech doc links", () => {
  let store: Map<string, string>
  let events: string[]
  beforeEach(() => {
    store = new Map()
    events = []
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
    vi.stubGlobal("window", { dispatchEvent: (e: Event) => void events.push(e.type) })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("links, reads (case-insensitively by speech) and unlinks", () => {
    setSpeechDocLink("round-1", "1ac", { id: 12, title: "Aff case.docx" })
    expect(getSpeechDocLink("round-1", "1AC")).toMatchObject({ docId: 12, title: "Aff case.docx" })
    expect(getSpeechDocLink("round-2", "1AC")).toBeNull()
    expect(getSpeechDocLink(null, "1AC")).toBeNull()

    clearSpeechDocLink("round-1", "1AC")
    expect(getSpeechDocLink("round-1", "1AC")).toBeNull()
    expect(events).toEqual([SPEECH_DOC_LINKS_EVENT, SPEECH_DOC_LINKS_EVENT])
  })

  it("tolerates corrupt storage", () => {
    store.set("speechDocLinks", "[1,2]")
    store.set("speech-doc-links", "[1,2]")
    expect(getSpeechDocLink("round-1", "1AC")).toBeNull()
    store.set("speech-doc-links", "not json")
    expect(getSpeechDocLink("round-1", "1AC")).toBeNull()
  })

  it("stores id-keyed records, the shape the account sync collection requires", () => {
    setSpeechDocLink("round-1", "1ac", { id: 12, title: "Aff case.docx" })
    setSpeechDocLink("round-1", "1AC", { id: 13, title: "Aff v2.docx" })
    const stored = JSON.parse(store.get("speechDocLinks")!)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ id: "round-1:1AC", docId: 13, title: "Aff v2.docx" })
  })

  it("still reads the legacy map shape and rewrites it as records", () => {
    store.set(
      "speech-doc-links",
      JSON.stringify({ "round-1:1AC": { docId: 5, title: "Old", linkedAt: 1 }, "round-1:2AC": { title: "bad" } }),
    )
    expect(getSpeechDocLink("round-1", "1AC")).toMatchObject({ docId: 5, title: "Old" })
    expect(getSpeechDocLink("round-1", "2AC")).toBeNull()
    setSpeechDocLink("round-1", "1NC", { id: 6, title: "Neg" })
    const stored = JSON.parse(store.get("speechDocLinks")!)
    expect(store.has("speech-doc-links")).toBe(false)
    expect(Array.isArray(stored)).toBe(true)
    expect(stored.map((r: { id: string }) => r.id).sort()).toEqual(["round-1:1AC", "round-1:1NC"])
  })

  it("stores links as id-carrying records so they can sync to the account", () => {
    setSpeechDocLink("round-1", "1ac", { id: 12, title: "Aff case.docx" })
    expect(JSON.parse(store.get("speechDocLinks")!)).toEqual([
      expect.objectContaining({ id: "round-1:1AC", docId: 12, title: "Aff case.docx" }),
    ])
  })

  it("replaces an existing link for the same speech instead of duplicating it", () => {
    setSpeechDocLink("round-1", "1AC", { id: 12, title: "Old" })
    setSpeechDocLink("round-1", "1AC", { id: 13, title: "New" })
    expect(JSON.parse(store.get("speechDocLinks")!)).toHaveLength(1)
    expect(getSpeechDocLink("round-1", "1AC")).toMatchObject({ docId: 13 })
  })

  it("reads links from the legacy map and retires it on the next write", () => {
    store.set("speech-doc-links", JSON.stringify({ "round-1:1AC": { docId: 5, title: "Legacy", linkedAt: 1 } }))
    expect(getSpeechDocLink("round-1", "1AC")).toMatchObject({ docId: 5, title: "Legacy" })

    setSpeechDocLink("round-1", "2AC", { id: 6, title: "Fresh" })
    expect(store.has("speech-doc-links")).toBe(false)
    expect(getSpeechDocLink("round-1", "1AC")).toMatchObject({ docId: 5 })
    expect(getSpeechDocLink("round-1", "2AC")).toMatchObject({ docId: 6 })
  })
})

describe("recentEditorDocuments", () => {
  it("lists files newest first, skipping folders and malformed rows", () => {
    const rows = [
      { id: 1, title: "Old", updatedAt: "2026-01-01T00:00:00Z" },
      { id: 2, title: "Folder", updatedAt: "2026-09-01T00:00:00Z", isFolder: true },
      { id: 3, title: "", updatedAt: 1_780_000_000 },
      { title: "no id" },
      null,
      { id: 4, title: "Newest", updatedAt: "2026-09-20T00:00:00Z" },
    ]
    expect(recentEditorDocuments(rows).map((d) => [d.id, d.title])).toEqual([
      [4, "Newest"],
      [3, "Untitled"],
      [1, "Old"],
    ])
    expect(recentEditorDocuments(rows, 1)).toHaveLength(1)
    expect(recentEditorDocuments({ error: "nope" })).toEqual([])
  })
})
