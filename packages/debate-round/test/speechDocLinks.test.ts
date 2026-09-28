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
    store.set("speech-doc-links", "[1,2]")
    expect(getSpeechDocLink("round-1", "1AC")).toBeNull()
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
