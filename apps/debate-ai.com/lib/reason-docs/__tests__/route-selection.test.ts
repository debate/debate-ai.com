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
import {
  REASON_EDITOR_ROUTE,
  editorHrefForSelection,
  parseSelectionId,
  parseSelectionParams,
  resolveSelection,
  selectionParamsKey,
} from "../route-selection"

/** The reader's own files (12, 34) plus a folder, which is never openable. */
const DOCUMENT_IDS = [12, 34]
const TOPIC_IDS = [7]

/** Defaults for a cold load with nothing open yet. */
function input(overrides: Partial<Parameters<typeof resolveSelection>[0]> = {}) {
  return {
    doc: null,
    topic: null,
    documentIds: DOCUMENT_IDS,
    topicIds: TOPIC_IDS,
    applyParams: true,
    hasSelection: false,
    ...overrides,
  }
}

describe("editorHrefForSelection", () => {
  it("addresses an owned document as ?doc and a topic starter as ?topic", () => {
    expect(editorHrefForSelection({ kind: "document", id: 12 })).toBe(`${REASON_EDITOR_ROUTE}?doc=12`)
    expect(editorHrefForSelection({ kind: "topic", id: 7 })).toBe(`${REASON_EDITOR_ROUTE}?topic=7`)
  })

  it("round-trips through the parser the editor route reads with", () => {
    const href = editorHrefForSelection({ kind: "topic", id: 7 })
    const params = parseSelectionParams(new URL(href, "https://debate-ai.com").searchParams)
    expect(params).toEqual({ doc: null, topic: 7 })
    expect(resolveSelection(input(params))).toEqual({ kind: "topic", id: 7 })
  })
})

describe("parseSelectionId", () => {
  it("reads a whole number", () => {
    expect(parseSelectionId("12")).toBe(12)
  })

  it("reads anything else as absent rather than throwing", () => {
    // A malformed link should land on the editor's normal fallback.
    for (const raw of [null, undefined, "", "abc", "3.5", "12px", "NaN"]) {
      expect(parseSelectionId(raw)).toBeNull()
    }
  })
})

describe("resolveSelection", () => {
  it("opens the document the URL names", () => {
    expect(resolveSelection(input({ doc: 34 }))).toEqual({ kind: "document", id: 34 })
  })

  it("opens the topic starter the URL names", () => {
    expect(resolveSelection(input({ topic: 7 }))).toEqual({ kind: "topic", id: 7 })
  })

  it("prefers the URL's file over the first-file fallback", () => {
    // The bug this whole module exists for: 12 is first, 34 was clicked.
    expect(resolveSelection(input({ doc: 34 }))).not.toEqual({ kind: "document", id: 12 })
  })

  it("prefers the URL's file even when something is already open", () => {
    expect(resolveSelection(input({ doc: 34, hasSelection: true }))).toEqual({ kind: "document", id: 34 })
  })

  it("falls back to the first file when the URL names nothing", () => {
    expect(resolveSelection(input())).toEqual({ kind: "document", id: 12 })
  })

  it("falls back to the first file when the URL names a file that is gone", () => {
    // A deleted document or someone else's link is not an error state.
    expect(resolveSelection(input({ doc: 999 }))).toEqual({ kind: "document", id: 12 })
    expect(resolveSelection(input({ topic: 999 }))).toEqual({ kind: "document", id: 12 })
  })

  it("leaves an open document alone once the URL has been applied", () => {
    // The reader picked something else from the sidebar; the stale query in
    // the URL must not drag them back to it.
    expect(resolveSelection(input({ doc: 12, applyParams: false, hasSelection: true }))).toBeNull()
  })

  it("still opens something when the URL has been applied and nothing is open", () => {
    expect(resolveSelection(input({ applyParams: false }))).toEqual({ kind: "document", id: 12 })
  })

  it("opens nothing at all when the reader has no documents", () => {
    expect(resolveSelection(input({ documentIds: [] }))).toBeNull()
  })

  it("reads a topic id ahead of a document id when a URL carries both", () => {
    expect(resolveSelection(input({ doc: 12, topic: 7 }))).toEqual({ kind: "topic", id: 7 })
  })
})

describe("selectionParamsKey", () => {
  it("matches URLs that name the same file and separates ones that don't", () => {
    expect(selectionParamsKey({ doc: 12, topic: null })).toBe(selectionParamsKey({ doc: 12, topic: null }))
    expect(selectionParamsKey({ doc: 12, topic: null })).not.toBe(selectionParamsKey({ doc: 34, topic: null }))
    // Separate namespaces: doc 7 is not topic 7.
    expect(selectionParamsKey({ doc: 7, topic: null })).not.toBe(selectionParamsKey({ doc: null, topic: 7 }))
    expect(selectionParamsKey({ doc: null, topic: null })).not.toBe(selectionParamsKey({ doc: 12, topic: null }))
  })
})
