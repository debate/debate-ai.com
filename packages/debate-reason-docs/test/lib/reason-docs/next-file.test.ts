/**
 * @fileoverview The file read-aloud moves on to when "Keep reading the next
 * files" is on: tree order, folders descended into, folders never returned.
 */

import { describe, it, expect } from "vitest"
import { filesInTreeOrder, nextFileAfter } from "../../../src/lib/reason-docs/next-file"

const row = (id: number, title: string, parentId: number | null = null, isFolder = false) => ({
  id,
  title,
  parentId,
  isFolder,
})

const tree = [
  row(1, "Neg", null, true),
  row(2, "1AC 10", null),
  row(3, "1AC 2", null),
  row(4, "DA", 1),
  row(5, "CP", 1),
  row(6, "Empty", null, true),
  row(7, "Zeta", null),
]

describe("filesInTreeOrder", () => {
  it("reads each folder's children by name, numbers as numbers, folders in place", () => {
    expect(filesInTreeOrder(tree).map((f) => f.title)).toEqual(["1AC 2", "1AC 10", "CP", "DA", "Zeta"])
  })

  it("puts rows whose folder is missing at the top level", () => {
    expect(filesInTreeOrder([row(1, "B", 99), row(2, "A")]).map((f) => f.id)).toEqual([2, 1])
  })
})

describe("nextFileAfter", () => {
  it("steps into the next folder's first file", () => {
    expect(nextFileAfter(tree, 2)?.title).toBe("CP")
  })

  it("steps out of a folder to the next file after it", () => {
    expect(nextFileAfter(tree, 4)?.title).toBe("Zeta")
  })

  it("is null after the last file, for a folder, and with nothing open", () => {
    expect(nextFileAfter(tree, 7)).toBeNull()
    expect(nextFileAfter(tree, 1)).toBeNull()
    expect(nextFileAfter(tree, null)).toBeNull()
  })
})
