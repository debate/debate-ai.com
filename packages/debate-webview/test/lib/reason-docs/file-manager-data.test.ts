/**
 * @fileoverview The sidebar's rows as the SVAR file manager's path-keyed
 * entities, and the path → row map its actions are routed back through.
 */
import { describe, expect, it } from "vitest"

import {
  TOPIC_ROOT,
  buildFileManagerData,
  isTopicPath,
  ownedFolderIdOf,
} from "../../../src/lib/reason-docs/file-manager-data"

const row = (id: number, title: string, parentId: number | null, isFolder = false) => ({
  id,
  title,
  parentId,
  isFolder,
  content: isFolder ? "" : "body",
  updatedAt: "2026-10-01T00:00:00Z",
})

describe("buildFileManagerData", () => {
  it("turns rows into paths, folders first, and maps every path back to its row", () => {
    const { data, refs } = buildFileManagerData([
      row(1, "Case", null),
      row(2, "Impacts", null, true),
      row(3, "Warming", 2),
    ])
    expect(data.map((d) => [d.id, d.type])).toEqual([
      ["/Impacts", "folder"],
      ["/Impacts/Warming", "file"],
      ["/Case", "file"],
    ])
    expect(data[1]!.size).toBe(4)
    expect(data[1]!.date?.toISOString()).toBe("2026-10-01T00:00:00.000Z")
    expect(refs.get("/Impacts/Warming")).toEqual({ kind: "document", id: 3, isFolder: false })
  })

  it("keeps siblings with the same name apart and makes names path-safe", () => {
    const { data } = buildFileManagerData([row(1, "Case", null), row(2, "case", null), row(3, "A/B", null), row(4, "  ", null)])
    const ids = data.map((d) => d.id)
    expect(new Set(ids.map((id) => id.toLowerCase())).size).toBe(4)
    expect(ids.filter((id) => /^\/case( \(2\))?$/i.test(id))).toHaveLength(2)
    expect(ids).toContain("/A-B")
    expect(ids).toContain("/Untitled")
  })

  it("puts topic starters under a read-only folder that claims its name first", () => {
    const { data, refs } = buildFileManagerData(
      [row(1, "Topic Starters", null, true)],
      [row(10, "Energy", null, true), row(11, "Solar", 10), row(12, "Orphan", 99)],
    )
    expect(data[0]).toEqual({ id: TOPIC_ROOT, type: "folder" })
    expect(refs.get("/Topic Starters (2)")).toMatchObject({ kind: "document", id: 1 })
    expect(refs.get(`${TOPIC_ROOT}/Energy/Solar`)).toEqual({ kind: "topic", id: 11, isFolder: false })
    // A row whose folder the capped catalogue didn't include lands at the root.
    expect(refs.get(`${TOPIC_ROOT}/Orphan`)).toMatchObject({ id: 12 })
  })

  it("leaves the Topic Starters folder out when there are none, and reads epoch seconds", () => {
    const { data } = buildFileManagerData([{ ...row(1, "Case", null), updatedAt: 1_700_000_000 }])
    expect(data.map((d) => d.id)).toEqual(["/Case"])
    expect(data[0]!.date?.getUTCFullYear()).toBe(2023)
  })
})

describe("path helpers", () => {
  const { refs } = buildFileManagerData([row(1, "Folder", null, true), row(2, "File", 1)], [row(10, "Topic", null)])

  it("knows which paths are inside Topic Starters", () => {
    expect(isTopicPath(TOPIC_ROOT)).toBe(true)
    expect(isTopicPath(`${TOPIC_ROOT}/Topic`)).toBe(true)
    expect(isTopicPath("/Topic Starters (2)")).toBe(false)
    expect(isTopicPath("/Folder")).toBe(false)
  })

  it("resolves only the reader's own folders as a destination", () => {
    expect(ownedFolderIdOf("/", refs)).toBeNull()
    expect(ownedFolderIdOf("", refs)).toBeNull()
    expect(ownedFolderIdOf("/Folder", refs)).toBe(1)
    expect(ownedFolderIdOf("/Folder/File", refs)).toBeUndefined()
    expect(ownedFolderIdOf(`${TOPIC_ROOT}/Topic`, refs)).toBeUndefined()
    expect(ownedFolderIdOf("/missing", refs)).toBeUndefined()
  })
})
