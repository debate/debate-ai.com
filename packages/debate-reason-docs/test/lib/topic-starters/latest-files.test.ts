import { describe, expect, it } from "vitest"
import { latestOutlineFiles, topicFormatOf } from "../../../src/lib/topic-starters/latest-files"
import type { TopicStarterIndexEntry } from "../../../src/lib/topic-starters/file-index"

function folder(id: number, title: string, topicCode: string | null, parentId: number | null = null): TopicStarterIndexEntry {
  return { id, title, parentId, isFolder: true, tags: "[]", year: null, topicCode }
}

function file(id: number, title: string, parentId: number, updatedAt: string, extra: Partial<TopicStarterIndexEntry> = {}): TopicStarterIndexEntry {
  return { id, title, parentId, isFolder: false, tags: "[]", year: null, topicCode: null, updatedAt, ...extra }
}

const items: TopicStarterIndexEntry[] = [
  folder(1, "Aff", "vcx27"),
  folder(2, "Neg", "lda27"),
  folder(3, "PF Pro", "pfb27"),
  folder(4, "Uncoded", null),
  file(10, "Policy one.docx", 1, "2026-11-10T00:00:00Z", { quoteCount: 12 }),
  file(11, "Policy two", 1, "2026-11-12T00:00:00Z"),
  file(12, "Policy three", 1, "2026-11-11T00:00:00Z"),
  file(13, "LD case", 2, "2026-11-01T00:00:00Z"),
  file(14, "PF case", 3, "2026-11-05T00:00:00Z"),
  file(15, "Old default", 4, "2026-01-01T00:00:00Z"),
]

describe("topicFormatOf", () => {
  it("reads the format off a topic code's prefix", () => {
    expect(topicFormatOf("vcx27")).toBe("vcx")
    expect(topicFormatOf("ndt27")).toBe("ndt")
    expect(topicFormatOf("lda27")).toBe("ld")
    expect(topicFormatOf("pfb27")).toBe("pf")
    expect(topicFormatOf("bq27")).toBe("bq")
  })
})

describe("latestOutlineFiles", () => {
  it("takes turns across formats, newest first within each", () => {
    const ids = latestOutlineFiles(items, 10).map((entry) => entry.id)
    // Policy's newest is newest overall, then PF, then LD; uncoded rows fall
    // in the default (policy) topic.
    expect(ids).toEqual([11, 14, 13, 12, 10, 15])
  })

  it("caps at the limit", () => {
    expect(latestOutlineFiles(items, 2).map((entry) => entry.id)).toEqual([11, 14])
    expect(latestOutlineFiles(items, 0)).toEqual([])
  })

  it("links each file at its /docs/<code>/<path> address with its format", () => {
    const byId = new Map(latestOutlineFiles(items).map((entry) => [entry.id, entry]))
    expect(byId.get(10)).toMatchObject({
      title: "Policy one",
      topicCode: "vcx27",
      format: "vcx",
      formatLabel: "Policy",
      href: "/docs/vcx27/aff/policy-one",
      quoteCount: 12,
    })
    expect(byId.get(13)).toMatchObject({ topicCode: "lda27", formatLabel: "LD", href: "/docs/lda27/neg/ld-case" })
    expect(byId.get(14)).toMatchObject({ formatLabel: "PF", href: "/docs/pfb27/pf-pro/pf-case" })
  })

  it("never lists folders", () => {
    expect(latestOutlineFiles(items, 50).every((entry) => entry.id >= 10)).toBe(true)
  })
})
