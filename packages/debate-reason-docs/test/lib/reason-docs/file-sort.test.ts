/** @fileoverview The Files tree's sort orders — folders always first. */
import { describe, expect, it } from "vitest"

import { FILE_SORTS, compareRows, isFileSort, updatedAtMs } from "../../../src/lib/reason-docs/file-sort"

const rows = [
  { title: "b file 10", isFolder: false, updatedAt: "2026-01-04T00:00:00Z" },
  { title: "B folder", isFolder: true, updatedAt: 0 },
  { title: "a file", isFolder: false, updatedAt: 1_767_225_600 },
  { title: "b file 9", isFolder: false, updatedAt: 1_767_398_400_000 },
]
const order = (sort: (typeof FILE_SORTS)[number]) => [...rows].sort(compareRows(sort)).map((r) => r.title)

describe("compareRows", () => {
  it("sorts by name with numbers in order, folders first", () => {
    expect(order("name")).toEqual(["B folder", "a file", "b file 9", "b file 10"])
  })
  it("reverses the name order without moving folders", () => {
    expect(order("name-desc")).toEqual(["B folder", "b file 10", "b file 9", "a file"])
  })
  it("puts the most recently changed first", () => {
    expect(order("updated")).toEqual(["B folder", "b file 10", "b file 9", "a file"])
  })
})

describe("helpers", () => {
  it("validates stored sort choices", () => {
    expect(isFileSort("updated")).toBe(true)
    expect(isFileSort("size")).toBe(false)
    expect(isFileSort(null)).toBe(false)
  })
  it("reads seconds, milliseconds and ISO strings", () => {
    expect(updatedAtMs(1_000)).toBe(1_000_000)
    expect(updatedAtMs(1_767_398_400_000)).toBe(1_767_398_400_000)
    expect(updatedAtMs("2026-01-03T00:00:00Z")).toBe(Date.parse("2026-01-03T00:00:00Z"))
    expect(updatedAtMs("not a date")).toBe(0)
    expect(updatedAtMs(undefined)).toBe(0)
  })
})
