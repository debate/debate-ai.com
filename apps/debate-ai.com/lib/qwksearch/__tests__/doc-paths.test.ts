/**
 * @fileoverview Pins the research workspace's document URLs: the path an open
 * document is recorded at, and the document a path reopens.
 */

import { describe, expect, it } from "vitest"
import {
  QWKSEARCH_DOCS_ROUTE,
  addressableDocs,
  docIdFromSlug,
  docPathForId,
  docSlugFromPathname,
} from "../doc-paths"

const DOCS = [
  { id: "doc-a", title: "CP Answer to States" },
  { id: "doc-b", title: "Impact Turns" },
]

describe("addressableDocs", () => {
  it("keeps the files a URL can open", () => {
    expect(addressableDocs([{ id: "doc-a", title: "CP Answer to States" }])).toEqual(DOCS.slice(0, 1))
  })

  it("drops what opens no editor: folders, trashed files, and malformed rows", () => {
    expect(
      addressableDocs([
        { id: "folder-1", title: "Aff", isFolder: true },
        { id: "doc-x", title: "Old Case", isDeleted: true },
        { id: 7, title: "Not a string id" },
        { title: "No id at all" },
      ]),
    ).toEqual([])
  })

  it("reads a missing title as an empty one rather than dropping the file", () => {
    // It still has an id, so it is still openable — as `/doc/untitled`.
    expect(addressableDocs([{ id: "doc-c" }])).toEqual([{ id: "doc-c", title: "" }])
  })
})

describe("docSlugFromPathname", () => {
  it("reads the name out of a workspace path", () => {
    expect(docSlugFromPathname("/doc/cp-answer-to-states")).toBe("cp-answer-to-states")
    expect(docSlugFromPathname("/doc/cp-answer-to-states/")).toBe("cp-answer-to-states")
  })

  it("reads no name off the bare route or another page", () => {
    // `/docs` is the help site, not a document.
    for (const path of ["/doc", "/doc/", "/docs/getting-started", "/reason-editor/x", "", null]) {
      expect(docSlugFromPathname(path)).toBeNull()
    }
  })
})

describe("docPathForId", () => {
  it("records an open document under its own name", () => {
    expect(docPathForId("doc-b", DOCS)).toBe(`${QWKSEARCH_DOCS_ROUTE}/impact-turns`)
  })

  it("keeps two same-named documents apart", () => {
    const docs = [...DOCS, { id: "doc-c", title: "impact turns" }]
    expect(docPathForId("doc-b", docs)).toBe(`${QWKSEARCH_DOCS_ROUTE}/impact-turns~doc-b`)
    expect(docPathForId("doc-c", docs)).toBe(`${QWKSEARCH_DOCS_ROUTE}/impact-turns~doc-c`)
  })

  it("addresses a document the store doesn't know by its id", () => {
    // Just created, or its row has gone: a reload should still reopen the
    // tab, so the id stays in the URL rather than being dropped.
    expect(docPathForId("doc-new", DOCS)).toBe(`${QWKSEARCH_DOCS_ROUTE}/doc-new`)
  })

  it("round-trips every document back to itself", () => {
    for (const doc of DOCS) {
      const slug = docSlugFromPathname(docPathForId(doc.id, DOCS))
      expect(docIdFromSlug(slug, DOCS)).toBe(doc.id)
    }
  })
})

describe("docIdFromSlug", () => {
  it("reopens the document a name refers to", () => {
    expect(docIdFromSlug("cp-answer-to-states", DOCS)).toBe("doc-a")
  })

  it("reopens a document addressed by id", () => {
    // What a `?docs=<id>` link becomes once it is rewritten as a path.
    expect(docIdFromSlug("doc-b", DOCS)).toBe("doc-b")
  })

  it("opens nothing for a name that matches no document", () => {
    // Renamed, deleted, or someone else's link — the documents are per-browser.
    expect(docIdFromSlug("someone-elses-file", DOCS)).toBeNull()
    expect(docIdFromSlug(null, DOCS)).toBeNull()
  })
})
