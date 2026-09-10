/**
 * @fileoverview Pins the URL round trip behind "click a file in any sidebar,
 * get that file in CardMirror": the href the docs sidebar routes to, and the
 * selection the editor route resolves back out of it.
 *
 * The fallback rule is tested from the same function as the deep-link rule on
 * purpose — as two separate React effects they raced, and the first file was
 * opened over the top of the deep-linked one.
 */

import { describe, it, expect } from "vitest"
import type { PathItem } from "../doc-path"
import {
  REASON_EDITOR_ROUTE,
  editorHrefForSelection,
  parseSelectionParams,
  resolveSelection,
  selectionParamsKey,
} from "../route-selection"

/** The reader's own files (12, 34) under a folder, plus a public library. */
const DOCUMENTS: PathItem[] = [
  { id: 12, title: "Scratch pad", parentId: null, isFolder: false },
  { id: 5, title: "Impacts", parentId: null, isFolder: true },
  { id: 34, title: "Warming 1AC.docx", parentId: 5, isFolder: false },
]
const TOPICS: PathItem[] = [
  { id: 7, title: "Topic Starter", parentId: null, isFolder: false },
]

/** Defaults for a cold load with nothing open yet. */
function input(overrides: Partial<Parameters<typeof resolveSelection>[0]> = {}) {
  return {
    doc: null,
    topic: null,
    documents: DOCUMENTS,
    topics: TOPICS,
    applyParams: true,
    hasSelection: false,
    ...overrides,
  }
}

describe("editorHrefForSelection", () => {
  it("names the file rather than its row id", () => {
    expect(editorHrefForSelection({ kind: "document", id: 34 }, DOCUMENTS)).toBe(
      `${REASON_EDITOR_ROUTE}?doc=impacts/warming-1ac`,
    )
    expect(editorHrefForSelection({ kind: "topic", id: 7 }, TOPICS)).toBe(
      `${REASON_EDITOR_ROUTE}?topic=topic-starter`,
    )
  })

  it("falls back to the id when the file's tree isn't in hand", () => {
    // A just-uploaded row whose state update hasn't landed yet still gets a
    // working link, just not a readable one.
    expect(editorHrefForSelection({ kind: "document", id: 34 })).toBe(`${REASON_EDITOR_ROUTE}?doc=34`)
  })

  it("round-trips through the parser the editor route reads with", () => {
    const href = editorHrefForSelection({ kind: "document", id: 34 }, DOCUMENTS)
    const params = parseSelectionParams(new URL(href, "https://debate-ai.com").searchParams)
    expect(params).toEqual({ doc: "impacts/warming-1ac", topic: null })
    expect(resolveSelection(input(params))).toEqual({ kind: "document", id: 34 })
  })
})

describe("parseSelectionParams", () => {
  it("reads a name off either parameter and treats blank as absent", () => {
    const read = (query: string) =>
      parseSelectionParams(new URL(`https://x/?${query}`).searchParams)
    expect(read("doc=impacts/warming-1ac")).toEqual({ doc: "impacts/warming-1ac", topic: null })
    expect(read("topic=core")).toEqual({ doc: null, topic: "core" })
    expect(read("doc=%20%20")).toEqual({ doc: null, topic: null })
    expect(read("")).toEqual({ doc: null, topic: null })
  })
})

describe("resolveSelection", () => {
  it("opens the document the URL names", () => {
    expect(resolveSelection(input({ doc: "impacts/warming-1ac" }))).toEqual({ kind: "document", id: 34 })
  })

  it("opens the topic starter the URL names", () => {
    expect(resolveSelection(input({ topic: "topic-starter" }))).toEqual({ kind: "topic", id: 7 })
  })

  it("still opens a document a pre-path link addresses by id", () => {
    expect(resolveSelection(input({ doc: "34" }))).toEqual({ kind: "document", id: 34 })
  })

  it("prefers the URL's file over the first-file fallback", () => {
    // The bug this whole module exists for: 12 is first, 34 was clicked.
    expect(resolveSelection(input({ doc: "warming-1ac" }))).not.toEqual({ kind: "document", id: 12 })
  })

  it("prefers the URL's file even when something is already open", () => {
    expect(resolveSelection(input({ doc: "warming-1ac", hasSelection: true }))).toEqual({
      kind: "document",
      id: 34,
    })
  })

  it("reads a ?doc= name against the public library when the reader has no such file", () => {
    // A shared link names a file, not a table — the same URL has to work for
    // the person who owns it and the person who only has the public copy.
    expect(resolveSelection(input({ doc: "topic-starter" }))).toEqual({ kind: "topic", id: 7 })
  })

  it("falls back to the first file when the URL names nothing", () => {
    expect(resolveSelection(input())).toEqual({ kind: "document", id: 12 })
  })

  it("asks the server for a name nothing loaded here matches", () => {
    // The public catalogue is capped and a signed-out reader has no documents
    // at all, so an unknown name is a lookup, not a miss.
    expect(resolveSelection(input({ doc: "shared/deterrence-block" }))).toEqual({
      kind: "lookup",
      ref: "shared/deterrence-block",
    })
  })

  it("falls back to the first file once that lookup has come back empty", () => {
    expect(resolveSelection(input({ doc: "gone", allowLookup: false }))).toEqual({
      kind: "document",
      id: 12,
    })
  })

  it("never opens a folder as a document", () => {
    // Folders are in the list so nested paths resolve; the fallback skips them.
    const foldersFirst = [DOCUMENTS[1]!, DOCUMENTS[2]!]
    expect(resolveSelection(input({ documents: foldersFirst }))).toEqual({ kind: "document", id: 34 })
  })

  it("leaves an open document alone once the URL has been applied", () => {
    // The reader picked something else from the sidebar; the stale query in
    // the URL must not drag them back to it.
    expect(
      resolveSelection(input({ doc: "scratch-pad", applyParams: false, hasSelection: true })),
    ).toBeNull()
  })

  it("still opens something when the URL has been applied and nothing is open", () => {
    expect(resolveSelection(input({ applyParams: false }))).toEqual({ kind: "document", id: 12 })
  })

  it("opens nothing at all when the reader has no documents", () => {
    expect(resolveSelection(input({ documents: [], allowLookup: false }))).toBeNull()
  })

  it("reads a topic name ahead of a document name when a URL carries both", () => {
    expect(resolveSelection(input({ doc: "scratch-pad", topic: "topic-starter" }))).toEqual({
      kind: "topic",
      id: 7,
    })
  })
})

describe("selectionParamsKey", () => {
  it("matches URLs that name the same file and separates ones that don't", () => {
    expect(selectionParamsKey({ doc: "a", topic: null })).toBe(selectionParamsKey({ doc: "a", topic: null }))
    expect(selectionParamsKey({ doc: "a", topic: null })).not.toBe(selectionParamsKey({ doc: "b", topic: null }))
    // Separate namespaces: doc "a" is not topic "a".
    expect(selectionParamsKey({ doc: "a", topic: null })).not.toBe(selectionParamsKey({ doc: null, topic: "a" }))
    expect(selectionParamsKey({ doc: null, topic: null })).not.toBe(selectionParamsKey({ doc: "a", topic: null }))
  })
})
