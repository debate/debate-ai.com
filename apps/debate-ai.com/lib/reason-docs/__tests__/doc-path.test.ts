/**
 * @fileoverview Pins the filename URLs the docs sidebar hands out: what a
 * title becomes, that two files never collide on one path, and what a pasted
 * link is still allowed to be sloppy about.
 */

import { describe, it, expect } from "vitest"
import {
  buildPathMap,
  findItemByRef,
  firstFileIn,
  itemPath,
  parseNumericRef,
  parsePathRef,
  slugifySegment,
  type PathItem,
} from "../doc-path"

/** `impacts/` holds two files; `warming-1ac` also exists at the root. */
const TREE: PathItem[] = [
  { id: 1, title: "Impacts", parentId: null, isFolder: true },
  { id: 2, title: "Warming 1AC.docx", parentId: 1, isFolder: false },
  { id: 3, title: "Economy 1AC.docx", parentId: 1, isFolder: false },
  { id: 4, title: "Scratch pad", parentId: null, isFolder: false },
]

describe("slugifySegment", () => {
  it("drops the extension so the .docx and the .cmir it becomes share a URL", () => {
    expect(slugifySegment("Warming 1AC.docx")).toBe("warming-1ac")
    expect(slugifySegment("Warming 1AC.cmir")).toBe("warming-1ac")
  })

  it("folds accents rather than dropping them", () => {
    expect(slugifySegment("Réchauffement")).toBe("rechauffement")
  })

  it("collapses punctuation and trims the dashes it leaves behind", () => {
    expect(slugifySegment("  Impacts — Warming (2025)!  ")).toBe("impacts-warming-2025")
  })

  it("returns nothing for a name with nothing sluggable in it", () => {
    // The caller falls back to the row id rather than minting `?doc=---`.
    expect(slugifySegment("???")).toBe("")
    expect(slugifySegment("🔥")).toBe("")
  })
})

describe("buildPathMap", () => {
  it("names a file by its folders", () => {
    expect(buildPathMap(TREE).get(2)).toBe("impacts/warming-1ac")
    expect(buildPathMap(TREE).get(4)).toBe("scratch-pad")
  })

  it("gives two files with the same name in the same folder different paths", () => {
    const clashing: PathItem[] = [
      ...TREE,
      { id: 9, title: "Warming 1AC.docx", parentId: 1, isFolder: false },
    ]
    const paths = buildPathMap(clashing)
    expect(paths.get(2)).toBe("impacts/warming-1ac")
    expect(paths.get(9)).toBe("impacts/warming-1ac-9")
    expect(paths.get(2)).not.toBe(paths.get(9))
  })

  it("keeps the lower id's path when a duplicate arrives, whatever the list order", () => {
    // A link already in someone's history must not start opening a different
    // file because the sidebar re-sorted or a newer file was uploaded.
    const clashing: PathItem[] = [
      { id: 9, title: "Warming 1AC.docx", parentId: 1, isFolder: false },
      ...TREE,
    ]
    expect(buildPathMap(clashing).get(2)).toBe("impacts/warming-1ac")
  })

  it("falls back to the row id for a title with no sluggable characters", () => {
    expect(buildPathMap([{ id: 5, title: "???", parentId: null, isFolder: false }]).get(5)).toBe("f5")
  })

  it("terminates on a folder cycle instead of hanging", () => {
    const cyclic: PathItem[] = [
      { id: 1, title: "A", parentId: 2, isFolder: true },
      { id: 2, title: "B", parentId: 1, isFolder: true },
    ]
    expect(buildPathMap(cyclic).size).toBe(2)
  })
})

describe("itemPath", () => {
  it("is the path buildPathMap assigns, and null for a row that isn't there", () => {
    expect(itemPath(TREE, 2)).toBe("impacts/warming-1ac")
    expect(itemPath(TREE, 404)).toBeNull()
  })
})

describe("parsePathRef", () => {
  it("reads a path, however it was written", () => {
    expect(parsePathRef("impacts/warming-1ac")).toEqual(["impacts", "warming-1ac"])
    expect(parsePathRef("/Impacts/Warming 1AC.docx/")).toEqual(["impacts", "warming-1ac"])
    expect(parsePathRef("impacts%2Fwarming-1ac")).toEqual(["impacts", "warming-1ac"])
  })

  it("reads a malformed escape as the literal text it is", () => {
    expect(parsePathRef("100%-warming")).toEqual(["100-warming"])
  })
})

describe("parseNumericRef", () => {
  it("reads a row id and nothing else", () => {
    expect(parseNumericRef("34")).toBe(34)
    for (const raw of ["", "abc", "3.5", "12px", "warming-1ac", "-4"]) {
      expect(parseNumericRef(raw)).toBeNull()
    }
  })
})

describe("findItemByRef", () => {
  it("opens the file a full path names", () => {
    expect(findItemByRef(TREE, "impacts/warming-1ac")?.id).toBe(2)
  })

  it("opens a file named without its folder, when only one file has that name", () => {
    expect(findItemByRef(TREE, "warming-1ac")?.id).toBe(2)
  })

  it("refuses a bare name two files share rather than guessing", () => {
    const ambiguous: PathItem[] = [
      { id: 1, title: "Impacts", parentId: null, isFolder: true },
      { id: 2, title: "Warming 1AC", parentId: 1, isFolder: false },
      { id: 3, title: "Cases", parentId: null, isFolder: true },
      { id: 4, title: "Warming 1AC", parentId: 3, isFolder: false },
    ]
    expect(findItemByRef(ambiguous, "warming-1ac")).toBeNull()
    // Naming the folder is what disambiguates it.
    expect(findItemByRef(ambiguous, "cases/warming-1ac")?.id).toBe(4)
  })

  it("still reads a row id, so links minted before paths keep working", () => {
    expect(findItemByRef(TREE, "4")?.id).toBe(4)
  })

  it("opens the first file inside a folder the URL names", () => {
    // A folder link should land on something readable, not an empty pane.
    expect(findItemByRef(TREE, "impacts")?.id).toBe(3) // "Economy 1AC" sorts first
  })

  it("descends into subfolders for a folder whose own files are all nested", () => {
    const nested: PathItem[] = [
      { id: 1, title: "Core", parentId: null, isFolder: true },
      { id: 2, title: "Impacts", parentId: 1, isFolder: true },
      { id: 3, title: "Warming 1AC", parentId: 2, isFolder: false },
    ]
    expect(findItemByRef(nested, "core")?.id).toBe(3)
  })

  it("finds nothing for an empty folder, a missing name, or an empty ref", () => {
    expect(findItemByRef([{ id: 1, title: "Empty", parentId: null, isFolder: true }], "empty")).toBeNull()
    expect(findItemByRef(TREE, "does-not-exist")).toBeNull()
    expect(findItemByRef(TREE, "   ")).toBeNull()
  })
})

describe("firstFileIn", () => {
  it("prefers a file in the folder over one in a subfolder", () => {
    const mixed: PathItem[] = [
      { id: 1, title: "Core", parentId: null, isFolder: true },
      { id: 2, title: "Aardvark", parentId: 1, isFolder: true },
      { id: 3, title: "Nested", parentId: 2, isFolder: false },
      { id: 4, title: "Zebra 1AC", parentId: 1, isFolder: false },
    ]
    expect(firstFileIn(mixed, 1)?.id).toBe(4)
  })
})
