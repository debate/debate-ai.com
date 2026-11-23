/** @fileoverview Where a REASON file may sit in the file tree — the checks the documents routes run on `parentId`. */
import { describe, expect, it } from "vitest"

import {
  MAX_FOLDER_DEPTH,
  PARENT_ERRORS,
  checkDocumentParent,
  isSelfOrDescendant,
  parseDocumentPatch,
  type DocumentTreeRow,
} from "../../../src/lib/reason-docs/doc-parent"

const row = (id: number, parentId: number | null, isFolder = true, userId: string | null = "u1"): DocumentTreeRow => ({
  id,
  parentId,
  isFolder,
  userId,
})

/** A `load` over a fixed set of rows that also records which ids it read. */
function loader(rows: DocumentTreeRow[]) {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const reads: number[] = []
  const load = async (id: number) => {
    reads.push(id)
    return byId.get(id) ?? null
  }
  return { load, reads }
}

// 1 (folder) ─┬─ 2 (folder) ── 3 (folder)
//             └─ 4 (file)
// 5 (folder, top level)   9 (folder, someone else's)
const tree = [row(1, null), row(2, 1), row(3, 2), row(4, 1, false), row(5, null), row(9, null, true, "u2")]

describe("checkDocumentParent", () => {
  it("allows the top level without reading anything", async () => {
    const { load, reads } = loader(tree)
    expect(await checkDocumentParent({ id: 3, parentId: null, ownerId: "u1" }, load)).toEqual({ ok: true })
    expect(reads).toEqual([])
  })

  it("allows a move into another of the owner's folders", async () => {
    const { load } = loader(tree)
    expect(await checkDocumentParent({ id: 2, parentId: 5, ownerId: "u1" }, load)).toEqual({ ok: true })
    expect(await checkDocumentParent({ id: 4, parentId: 3, ownerId: "u1" }, load)).toEqual({ ok: true })
  })

  it("refuses a folder moved into itself or one of its own sub-folders", async () => {
    const { load } = loader(tree)
    const ownSubtree = { ok: false, error: PARENT_ERRORS.ownSubtree }
    expect(await checkDocumentParent({ id: 1, parentId: 1, ownerId: "u1" }, load)).toEqual(ownSubtree)
    expect(await checkDocumentParent({ id: 1, parentId: 2, ownerId: "u1" }, load)).toEqual(ownSubtree)
    expect(await checkDocumentParent({ id: 1, parentId: 3, ownerId: "u1" }, load)).toEqual(ownSubtree)
  })

  it("refuses a parent that is a plain file", async () => {
    const { load } = loader(tree)
    expect(await checkDocumentParent({ id: 5, parentId: 4, ownerId: "u1" }, load)).toEqual({
      ok: false,
      error: PARENT_ERRORS.notFolder,
    })
  })

  it("reads someone else's folder as missing, so the answer doesn't confirm it exists", async () => {
    const { load } = loader(tree)
    const missing = { ok: false, error: PARENT_ERRORS.missing }
    expect(await checkDocumentParent({ id: 4, parentId: 9, ownerId: "u1" }, load)).toEqual(missing)
    expect(await checkDocumentParent({ id: 4, parentId: 404, ownerId: "u1" }, load)).toEqual(missing)
    // A signed-out (anonymous) file can't be put in a signed-in user's folder either.
    expect(await checkDocumentParent({ parentId: 1, ownerId: null }, load)).toEqual(missing)
  })

  it("matches anonymous files to anonymous folders", async () => {
    const { load } = loader([row(20, null, true, null)])
    expect(await checkDocumentParent({ parentId: 20, ownerId: null }, load)).toEqual({ ok: true })
  })

  it("checks only the parent for a new file, which has no subtree yet", async () => {
    const { load, reads } = loader(tree)
    expect(await checkDocumentParent({ parentId: 3, ownerId: "u1" }, load)).toEqual({ ok: true })
    expect(reads).toEqual([3])
  })

  it("refuses an id that isn't a whole number", async () => {
    const { load } = loader(tree)
    expect(await checkDocumentParent({ parentId: 1.5, ownerId: "u1" }, load)).toEqual({
      ok: false,
      error: PARENT_ERRORS.invalid,
    })
  })

  it("stops on a cycle already in the data instead of looping", async () => {
    // 30 → 31 → 30 is broken data; moving 40 under 31 must still answer.
    const { load } = loader([row(30, 31), row(31, 30), row(40, null)])
    expect(await checkDocumentParent({ id: 40, parentId: 31, ownerId: "u1" }, load)).toEqual({
      ok: false,
      error: PARENT_ERRORS.unreachable,
    })
  })

  it("gives up past the depth limit", async () => {
    const chain = Array.from({ length: MAX_FOLDER_DEPTH + 5 }, (_, i) => row(i + 1, i === 0 ? null : i))
    const { load } = loader([...chain, row(9999, null)])
    expect(await checkDocumentParent({ id: 9999, parentId: chain.length, ownerId: "u1" }, load)).toEqual({
      ok: false,
      error: PARENT_ERRORS.unreachable,
    })
  })

  it("treats a parent chain that ends at a missing row as reaching the top", async () => {
    const { load } = loader([row(50, 77), row(60, null)])
    expect(await checkDocumentParent({ id: 60, parentId: 50, ownerId: "u1" }, load)).toEqual({ ok: true })
  })
})

describe("parseDocumentPatch", () => {
  it("keeps the fields that are present and well-typed", () => {
    expect(parseDocumentPatch({ title: "Aff", content: "<p/>", parentId: 3 })).toEqual({
      ok: true,
      patch: { title: "Aff", content: "<p/>", parentId: 3 },
    })
    expect(parseDocumentPatch({ parentId: null })).toEqual({ ok: true, patch: { parentId: null } })
    expect(parseDocumentPatch({})).toEqual({ ok: true, patch: {} })
  })

  it("ignores fields it doesn't edit", () => {
    expect(parseDocumentPatch({ isFolder: true, format: "cmir" })).toEqual({ ok: true, patch: {} })
  })

  it("refuses a body that isn't an object", () => {
    for (const body of [null, "x", 3, [1]]) expect(parseDocumentPatch(body).ok).toBe(false)
  })

  it("refuses fields of the wrong type", () => {
    expect(parseDocumentPatch({ title: 5 })).toEqual({ ok: false, error: "\"title\" must be a string." })
    expect(parseDocumentPatch({ content: { html: "" } })).toEqual({ ok: false, error: "\"content\" must be a string." })
    expect(parseDocumentPatch({ parentId: "3" })).toEqual({ ok: false, error: PARENT_ERRORS.invalid })
    expect(parseDocumentPatch({ parentId: 2.5 })).toEqual({ ok: false, error: PARENT_ERRORS.invalid })
  })
})

describe("isSelfOrDescendant", () => {
  it("is true for the row itself and anything inside it", () => {
    expect(isSelfOrDescendant(tree, 1, 1)).toBe(true)
    expect(isSelfOrDescendant(tree, 1, 3)).toBe(true)
  })
  it("is false for a sibling, a parent or an unrelated folder", () => {
    expect(isSelfOrDescendant(tree, 2, 4)).toBe(false)
    expect(isSelfOrDescendant(tree, 3, 1)).toBe(false)
    expect(isSelfOrDescendant(tree, 1, 5)).toBe(false)
  })
  it("stops on a cycle", () => {
    expect(isSelfOrDescendant([row(30, 31), row(31, 30)], 99, 30)).toBe(false)
  })
})
