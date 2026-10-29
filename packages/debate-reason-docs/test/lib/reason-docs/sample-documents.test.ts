import { describe, expect, it } from "vitest"

import { getSampleReasonDocuments } from "../../../src/lib/reason-docs/sample-documents"

describe("getSampleReasonDocuments", () => {
  it("returns a small folder/file tree with negative ids", () => {
    const docs = getSampleReasonDocuments()
    expect(docs.length).toBeGreaterThan(0)
    for (const doc of docs) {
      expect(doc.id).toBeLessThan(0)
      expect(doc.title.trim().length).toBeGreaterThan(0)
    }
  })

  it("includes at least one folder and files filed under it", () => {
    const docs = getSampleReasonDocuments()
    const folders = docs.filter((doc) => doc.isFolder)
    expect(folders.length).toBeGreaterThan(0)

    const files = docs.filter((doc) => !doc.isFolder)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      expect(folders.some((folder) => folder.id === file.parentId)).toBe(true)
    }
  })

  it("returns a fresh array each call rather than a shared mutable reference", () => {
    const first = getSampleReasonDocuments()
    const second = getSampleReasonDocuments()
    expect(first).not.toBe(second)
    expect(first).toEqual(second)
  })
})
