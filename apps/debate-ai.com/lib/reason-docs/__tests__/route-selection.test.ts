/**
 * @fileoverview Pins the URL round trip behind "click a file in any sidebar,
 * get that file in CardMirror": the href the docs sidebar routes to, the
 * selection the editor route resolves back out of it, and the rewrite that
 * keeps the address bar naming whatever is open.
 *
 * The fallback rule is tested from the same function as the deep-link rule on
 * purpose — as two separate React effects they raced, and the first file was
 * opened over the top of the deep-linked one.
 */

import { describe, it, expect } from "vitest"
import {
  REASON_EDITOR_ROUTE,
  canonicalEditorUrl,
  editorHrefForSelection,
  editorSlugForSelection,
  editorSlugFromPathname,
  isEditorPathname,
  parseSelectionId,
  parseSelectionParams,
  resolveSelection,
  selectionParamsKey,
  urlWithoutParam,
} from "../route-selection"

/** The reader's own files (12, 34) and one public topic starter. Folders are
 *  never openable, so they never reach this module. */
const CATALOG = {
  documents: [
    { id: 12, title: "Neg Case" },
    { id: 34, title: "Impact Turns" },
  ],
  topics: [{ id: 7, title: "CP Answer to States" }],
}

/** Defaults for a cold load with nothing open yet. */
function input(overrides: Partial<Parameters<typeof resolveSelection>[0]> = {}) {
  return {
    slug: null,
    doc: null,
    topic: null,
    catalog: CATALOG,
    applyParams: true,
    hasSelection: false,
    ...overrides,
  }
}

/** Reads a href back the way the editor route does. */
function parseHref(href: string) {
  const url = new URL(href, "https://debate-ai.com")
  return parseSelectionParams(url.searchParams, url.pathname)
}

describe("editorHrefForSelection", () => {
  it("addresses a file by its own name", () => {
    expect(editorHrefForSelection({ kind: "topic", id: 7 }, CATALOG)).toBe(
      `${REASON_EDITOR_ROUTE}/cp-answer-to-states`,
    )
    expect(editorHrefForSelection({ kind: "document", id: 34 }, CATALOG)).toBe(
      `${REASON_EDITOR_ROUTE}/impact-turns`,
    )
  })

  it("keeps a document and a same-named topic starter apart", () => {
    const catalog = { documents: [{ id: 12, title: "Impact Turns" }], topics: [{ id: 7, title: "Impact turns" }] }
    expect(editorSlugForSelection({ kind: "document", id: 12 }, catalog)).toBe("impact-turns~d12")
    expect(editorSlugForSelection({ kind: "topic", id: 7 }, catalog)).toBe("impact-turns~t7")
  })

  it("falls back to the id form while the file's name is still unknown", () => {
    // The sidebar can route a click before the catalogue has loaded; the
    // editor route rewrites the address once it knows the name.
    expect(editorHrefForSelection({ kind: "document", id: 12 })).toBe(`${REASON_EDITOR_ROUTE}?doc=12`)
    expect(editorHrefForSelection({ kind: "topic", id: 7 })).toBe(`${REASON_EDITOR_ROUTE}?topic=7`)
  })

  it("round-trips through the parser the editor route reads with", () => {
    const href = editorHrefForSelection({ kind: "topic", id: 7 }, CATALOG)
    const params = parseHref(href)
    expect(params).toEqual({ slug: "cp-answer-to-states", doc: null, topic: null })
    expect(resolveSelection(input(params))).toEqual({ kind: "topic", id: 7 })
  })

  it("round-trips the id form the same way", () => {
    const params = parseHref(editorHrefForSelection({ kind: "document", id: 34 }))
    expect(resolveSelection(input(params))).toEqual({ kind: "document", id: 34 })
  })
})

describe("editorSlugFromPathname", () => {
  it("reads the name out of an editor path", () => {
    expect(editorSlugFromPathname("/reason-editor/cp-answer-to-states")).toBe("cp-answer-to-states")
    expect(editorSlugFromPathname("/reason-editor/cp-answer-to-states/")).toBe("cp-answer-to-states")
  })

  it("reads no name off the bare route or another page", () => {
    for (const path of ["/reason-editor", "/reason-editor/", "/cards", "/doc/x", "", null]) {
      expect(editorSlugFromPathname(path)).toBeNull()
    }
  })
})

describe("isEditorPathname", () => {
  it("covers the route and the named files under it, and nothing else", () => {
    expect(isEditorPathname("/reason-editor")).toBe(true)
    expect(isEditorPathname("/reason-editor/impact-turns")).toBe(true)
    expect(isEditorPathname("/reason-editor-other")).toBe(false)
    expect(isEditorPathname("/cards")).toBe(false)
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
  it("opens the file the URL names", () => {
    expect(resolveSelection(input({ slug: "impact-turns" }))).toEqual({ kind: "document", id: 34 })
    expect(resolveSelection(input({ slug: "cp-answer-to-states" }))).toEqual({ kind: "topic", id: 7 })
  })

  it("opens the document a legacy id names", () => {
    expect(resolveSelection(input({ doc: 34 }))).toEqual({ kind: "document", id: 34 })
  })

  it("opens the topic starter a legacy id names", () => {
    expect(resolveSelection(input({ topic: 7 }))).toEqual({ kind: "topic", id: 7 })
  })

  it("prefers the URL's file over the first-file fallback", () => {
    // The bug this whole module exists for: 12 is first, 34 was clicked.
    expect(resolveSelection(input({ slug: "impact-turns" }))).not.toEqual({ kind: "document", id: 12 })
  })

  it("prefers the URL's file even when something is already open", () => {
    expect(resolveSelection(input({ slug: "impact-turns", hasSelection: true }))).toEqual({
      kind: "document",
      id: 34,
    })
  })

  it("falls back to the first file when the URL names nothing", () => {
    expect(resolveSelection(input())).toEqual({ kind: "document", id: 12 })
  })

  it("falls back to the first file when the URL names a file that is gone", () => {
    // A deleted document or someone else's link is not an error state.
    expect(resolveSelection(input({ slug: "a-deleted-file" }))).toEqual({ kind: "document", id: 12 })
    expect(resolveSelection(input({ doc: 999 }))).toEqual({ kind: "document", id: 12 })
    expect(resolveSelection(input({ topic: 999 }))).toEqual({ kind: "document", id: 12 })
  })

  it("leaves an open document alone once the URL has been applied", () => {
    // The reader picked something else from the sidebar; the stale name in
    // the URL must not drag them back to it.
    expect(resolveSelection(input({ slug: "neg-case", applyParams: false, hasSelection: true }))).toBeNull()
  })

  it("still opens something when the URL has been applied and nothing is open", () => {
    expect(resolveSelection(input({ applyParams: false }))).toEqual({ kind: "document", id: 12 })
  })

  it("opens nothing at all when the reader has no documents", () => {
    expect(resolveSelection(input({ catalog: { documents: [], topics: CATALOG.topics } }))).toBeNull()
  })

  it("reads a name ahead of the ids a legacy URL carries", () => {
    expect(resolveSelection(input({ slug: "impact-turns", doc: 12, topic: 7 }))).toEqual({
      kind: "document",
      id: 34,
    })
  })

  it("reads a topic id ahead of a document id when a URL carries both", () => {
    expect(resolveSelection(input({ doc: 12, topic: 7 }))).toEqual({ kind: "topic", id: 7 })
  })
})

describe("selectionParamsKey", () => {
  it("matches URLs that name the same file and separates ones that don't", () => {
    const key = (params: Partial<ReturnType<typeof parseHref>>) =>
      selectionParamsKey({ slug: null, doc: null, topic: null, ...params })
    expect(key({ doc: 12 })).toBe(key({ doc: 12 }))
    expect(key({ doc: 12 })).not.toBe(key({ doc: 34 }))
    expect(key({ slug: "neg-case" })).not.toBe(key({ slug: "impact-turns" }))
    // Separate namespaces: doc 7 is not topic 7.
    expect(key({ doc: 7 })).not.toBe(key({ topic: 7 }))
    expect(key({})).not.toBe(key({ doc: 12 }))
  })
})

describe("canonicalEditorUrl", () => {
  const at = (pathname: string, search = "", hash = "") => ({ pathname, search, hash })

  it("renames an id link after the file it opened", () => {
    expect(canonicalEditorUrl({ kind: "topic", id: 7 }, CATALOG, at(REASON_EDITOR_ROUTE, "?topic=7"))).toBe(
      `${REASON_EDITOR_ROUTE}/cp-answer-to-states`,
    )
  })

  it("keeps every query parameter the page still reads", () => {
    // `?share=` and `?shareWith=` are the editor's own; only the ids the path
    // replaces are dropped.
    expect(
      canonicalEditorUrl({ kind: "document", id: 34 }, CATALOG, at(REASON_EDITOR_ROUTE, "?doc=34&share=abc", "#top")),
    ).toBe(`${REASON_EDITOR_ROUTE}/impact-turns?share=abc#top`)
  })

  it("follows the reader to the file they switched to", () => {
    expect(canonicalEditorUrl({ kind: "document", id: 12 }, CATALOG, at(`${REASON_EDITOR_ROUTE}/impact-turns`))).toBe(
      `${REASON_EDITOR_ROUTE}/neg-case`,
    )
  })

  it("leaves an address that already names the open file alone", () => {
    expect(canonicalEditorUrl({ kind: "document", id: 12 }, CATALOG, at(`${REASON_EDITOR_ROUTE}/neg-case`))).toBeNull()
  })

  it("writes nothing when there is no file open, or no name for it yet", () => {
    expect(canonicalEditorUrl(null, CATALOG, at(REASON_EDITOR_ROUTE))).toBeNull()
    expect(canonicalEditorUrl({ kind: "document", id: 404 }, CATALOG, at(REASON_EDITOR_ROUTE))).toBeNull()
  })

  it("never renames a page that isn't the editor", () => {
    expect(canonicalEditorUrl({ kind: "document", id: 12 }, CATALOG, at("/cards"))).toBeNull()
  })
})

describe("urlWithoutParam", () => {
  it("drops a one-shot parameter and keeps the file the path names", () => {
    expect(
      urlWithoutParam("share", {
        pathname: `${REASON_EDITOR_ROUTE}/impact-turns`,
        search: "?share=8&doc=34",
        hash: "#card",
      }),
    ).toBe(`${REASON_EDITOR_ROUTE}/impact-turns?doc=34#card`)
  })

  it("writes nothing when the parameter isn't there", () => {
    expect(urlWithoutParam("share", { pathname: `${REASON_EDITOR_ROUTE}/impact-turns`, search: "", hash: "" })).toBeNull()
  })
})
