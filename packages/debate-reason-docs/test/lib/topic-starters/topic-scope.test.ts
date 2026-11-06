import { describe, expect, it } from "vitest"
import {
  effectiveTopicCodes,
  filterItemsByTopic,
  parseTopicStarterTopicCode,
} from "../../../src/lib/topic-starters/topic-scope"
import { DEFAULT_TOPIC_CODE } from "../../../src/lib/reason-docs/topic-doc-paths"

const rows = [
  // Imported before topics existed: no codes anywhere.
  { id: 1, parentId: null, topicCode: null },
  { id: 2, parentId: 1, topicCode: null },
  // An LD import: the root and its children all stamped.
  { id: 10, parentId: null, topicCode: "ld27a" },
  { id: 11, parentId: 10, topicCode: "ld27a" },
  // A folder made inside it from the sidebar: no code of its own.
  { id: 12, parentId: 10, topicCode: null },
  { id: 13, parentId: 12 },
  // A PF import.
  { id: 20, parentId: null, topicCode: "pf27b" },
]

describe("parseTopicStarterTopicCode", () => {
  it("accepts topic codes and nothing else", () => {
    expect(parseTopicStarterTopicCode("vcx27")).toBe("vcx27")
    expect(parseTopicStarterTopicCode(" LD27A ")).toBe("ld27a")
    expect(parseTopicStarterTopicCode("ld27")).toBeNull()
    expect(parseTopicStarterTopicCode("features")).toBeNull()
    expect(parseTopicStarterTopicCode(27)).toBeNull()
    expect(parseTopicStarterTopicCode(null)).toBeNull()
  })
})

describe("effectiveTopicCodes", () => {
  it("inherits the nearest coded ancestor and falls back to the default topic", () => {
    const codes = effectiveTopicCodes(rows)
    expect(codes.get(1)).toBe(DEFAULT_TOPIC_CODE)
    expect(codes.get(2)).toBe(DEFAULT_TOPIC_CODE)
    expect(codes.get(12)).toBe("ld27a")
    expect(codes.get(13)).toBe("ld27a")
    expect(codes.get(20)).toBe("pf27b")
  })

  it("stops on a parent cycle", () => {
    const codes = effectiveTopicCodes([
      { id: 1, parentId: 2 },
      { id: 2, parentId: 1 },
    ])
    expect(codes.get(1)).toBe(DEFAULT_TOPIC_CODE)
    expect(codes.get(2)).toBe(DEFAULT_TOPIC_CODE)
  })
})

describe("filterItemsByTopic", () => {
  it("gives each topic its own tree", () => {
    expect(filterItemsByTopic(rows, "ld27a").map((row) => row.id)).toEqual([10, 11, 12, 13])
    expect(filterItemsByTopic(rows, "pf27b").map((row) => row.id)).toEqual([20])
    expect(filterItemsByTopic(rows, "ndt27")).toEqual([])
  })

  it("shows the untagged library under the default topic", () => {
    expect(filterItemsByTopic(rows, null).map((row) => row.id)).toEqual([1, 2])
    expect(filterItemsByTopic(rows, DEFAULT_TOPIC_CODE).map((row) => row.id)).toEqual([1, 2])
  })
})
