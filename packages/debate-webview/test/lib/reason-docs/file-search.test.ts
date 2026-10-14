/**
 * @fileoverview Ctrl/Cmd-K's file search: names and contents of the sidebar's
 * files, ranked name-first, with a snippet for a contents hit.
 */
import { describe, expect, it } from "vitest"

import { folderPathOf, htmlHeadings, htmlToPlainText, searchFiles, type FileSearchEntry } from "../../../src/lib/reason-docs/file-search"

const entry = (overrides: Partial<FileSearchEntry>): FileSearchEntry => ({
  kind: "document",
  id: 1,
  title: "File",
  folder: "",
  text: "",
  ...overrides,
})

describe("htmlToPlainText", () => {
  it("strips tags, scripts and entities, and keeps block boundaries as spaces", () => {
    expect(htmlToPlainText("<h4>Tag</h4><p>Warming&nbsp;causes <b>extinction</b> &amp; war</p><script>x()</script>")).toBe(
      "Tag Warming causes extinction & war",
    )
    expect(htmlToPlainText("")).toBe("")
    expect(htmlToPlainText("a&bogus;b")).toBe("a&bogus;b")
  })
})

describe("htmlHeadings", () => {
  it("lists the file's headings in order, as plain text, skipping empty ones", () => {
    expect(htmlHeadings('<h1>Pocket</h1><p>x</p><h3 class="hat">Block &amp; <b>Hat</b></h3><h4> </h4><h4>Tag</h4>')).toEqual([
      "Pocket",
      "Block & Hat",
      "Tag",
    ])
    expect(htmlHeadings("")).toEqual([])
  })
})

describe("searchFiles", () => {
  const files = [
    entry({ id: 1, title: "Warming Aff", text: "Emissions cause tipping points." }),
    entry({ id: 2, title: "Econ DA", text: "A recession follows when warming policy raises costs for everyone involved." }),
    entry({ id: 3, kind: "topic", title: "Warming", folder: "Energy", text: "" }),
    entry({ id: 4, title: "Notes", folder: "Energy", text: "nothing relevant" }),
  ]

  it("matches nothing for an empty query", () => {
    expect(searchFiles(files, "  ")).toEqual([])
  })

  it("ranks name matches first, shortest name first, then contents matches with a snippet", () => {
    const results = searchFiles(files, "warming")
    expect(results.map((r) => r.entry.id)).toEqual([3, 1, 2])
    expect(results[0]!.nameMatch).toBe(true)
    expect(results[2]!.snippet).toContain("warming policy")
    expect(results[2]!.nameMatch).toBe(false)
  })

  it("needs every word, from the name, folder or contents", () => {
    expect(searchFiles(files, "energy notes").map((r) => r.entry.id)).toEqual([4])
    expect(searchFiles(files, "econ recession").map((r) => r.entry.id)).toEqual([2])
    expect(searchFiles(files, "econ tipping")).toEqual([])
  })

  it("ranks an outline heading match between name and contents matches, naming the heading", () => {
    const outlined = [
      entry({ id: 1, title: "Notes", text: "the courts clog when the plan passes" }),
      entry({ id: 2, title: "Aff", headings: ["Advantage One", "Court Clog Impacts"], text: "court clog impacts" }),
      entry({ id: 3, title: "Court Clog", text: "" }),
    ]
    const results = searchFiles(outlined, "court clog")
    expect(results.map((r) => r.entry.id)).toEqual([3, 2, 1])
    expect(results[1]!.heading).toBe("Court Clog Impacts")
    expect(results[1]!.snippet).toBeNull()
  })

  it("trims a long body to the words around the match", () => {
    const long = `${"lead ".repeat(40)}the needle is here ${"tail ".repeat(40)}`
    const [hit] = searchFiles([entry({ text: long })], "needle")
    expect(hit!.snippet!.startsWith("…")).toBe(true)
    expect(hit!.snippet!.endsWith("…")).toBe(true)
    expect(hit!.snippet!.length).toBeLessThan(long.length)
  })

  it("caps the list", () => {
    const many = Array.from({ length: 20 }, (_, i) => entry({ id: i, title: `Card ${i}` }))
    expect(searchFiles(many, "card")).toHaveLength(8)
    expect(searchFiles(many, "card", 3)).toHaveLength(3)
  })
})

describe("folderPathOf", () => {
  it("names the folders above a row, and survives a parent cycle", () => {
    const items = [
      { id: 1, title: "Energy", parentId: null },
      { id: 2, title: "Solar", parentId: 1 },
      { id: 3, title: "Aff", parentId: 2 },
      { id: 4, title: "Loop", parentId: 5 },
      { id: 5, title: "Back", parentId: 4 },
    ]
    expect(folderPathOf(items, items[2]!)).toBe("Energy / Solar")
    expect(folderPathOf(items, items[0]!)).toBe("")
    expect(folderPathOf(items, items[3]!)).toBe("Loop / Back")
  })
})
