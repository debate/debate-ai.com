import { describe, expect, it } from "vitest"
import {
  TOPIC_FILE_TYPES,
  TOPIC_FILE_TYPE_STYLES,
  classifyTopicFile,
  topicFileTypes,
} from "../../../src/lib/topic-starters/file-type"

describe("classifyTopicFile", () => {
  it("reads the type from the folder a file sits in", () => {
    expect(classifyTopicFile("Politics", ["DA", "Neg"])).toBe("da")
    expect(classifyTopicFile("States", ["CP", "Neg"])).toBe("cp")
    expect(classifyTopicFile("Neoliberalism", ["K", "Neg"])).toBe("k")
    expect(classifyTopicFile("Substantial", ["T", "Neg"])).toBe("t")
    expect(classifyTopicFile("Condo bad", ["Theory"])).toBe("theory")
    expect(classifyTopicFile("Charter Schools", ["Case", "Aff"])).toBe("aff")
  })

  it("reads the type from the file's own name first", () => {
    expect(classifyTopicFile("Federalism CP", ["Neg"])).toBe("cp")
    expect(classifyTopicFile("Spending DA.docx")).toBe("da")
    expect(classifyTopicFile("T - Substantial")).toBe("t")
    expect(classifyTopicFile("Capitalism Kritik")).toBe("k")
    expect(classifyTopicFile("Critique of Testing")).toBe("k")
    expect(classifyTopicFile("Warming Impacts")).toBe("impact")
    expect(classifyTopicFile("Vouchers 1AC")).toBe("aff")
    expect(classifyTopicFile("Economy Advantage", ["Aff"])).toBe("adv")
  })

  it("does not read K-12 as a kritik", () => {
    expect(classifyTopicFile("K-12 Funding", ["Aff"])).toBe("aff")
    expect(classifyTopicFile("K12 Funding")).toBe("doc")
  })

  it("splits answers and case files by side", () => {
    expect(classifyTopicFile("AT Politics DA", ["Aff"])).toBe("aff-answers")
    expect(classifyTopicFile("Politics", ["A2 DAs", "Aff"])).toBe("aff-answers")
    expect(classifyTopicFile("Answers to Charters", ["Neg"])).toBe("neg-case")
    expect(classifyTopicFile("Charter Schools", ["Case", "Neg"])).toBe("neg-case")
    expect(classifyTopicFile("Vouchers Aff", ["Neg"])).toBe("neg-case")
  })

  it("keeps a neg answer under an off-case folder as that position", () => {
    expect(classifyTopicFile("A2 Perm", ["CP", "Neg"])).toBe("cp")
  })

  it("falls back to the side, then to a plain document", () => {
    expect(classifyTopicFile("Core files", ["Aff"])).toBe("aff")
    expect(classifyTopicFile("Core files", ["Neg"])).toBe("neg-case")
    expect(classifyTopicFile("Notes")).toBe("doc")
  })

  it("only counts 'at' as an answer when the name leads with it", () => {
    expect(classifyTopicFile("Look at Schools", ["Aff"])).toBe("aff")
  })
})

describe("topicFileTypes", () => {
  it("walks each file's folders and skips folders", () => {
    const rows = [
      { id: 1, title: "Neg", parentId: null, isFolder: true },
      { id: 2, title: "DA", parentId: 1, isFolder: true },
      { id: 3, title: "Politics", parentId: 2, isFolder: false },
      { id: 4, title: "Aff", parentId: null, isFolder: true },
      { id: 5, title: "Charters 1AC", parentId: 4, isFolder: false },
      // A folder cycle must not hang the walk.
      { id: 6, title: "Loop", parentId: 7, isFolder: true },
      { id: 7, title: "Loop2", parentId: 6, isFolder: true },
      { id: 8, title: "Stuck", parentId: 6, isFolder: false },
    ]
    const types = topicFileTypes(rows)
    expect(types.get(3)).toBe("da")
    expect(types.get(5)).toBe("aff")
    expect(types.get(8)).toBe("doc")
    expect(types.has(1)).toBe(false)
  })
})

describe("TOPIC_FILE_TYPE_STYLES", () => {
  it("gives every type a distinct label and color", () => {
    const labels = TOPIC_FILE_TYPES.map((type) => TOPIC_FILE_TYPE_STYLES[type].label)
    const colors = TOPIC_FILE_TYPES.map((type) => TOPIC_FILE_TYPE_STYLES[type].className.split(" ")[0])
    expect(new Set(labels).size).toBe(labels.length)
    expect(new Set(colors).size).toBe(colors.length)
  })

  it("colors every aff type a shade of blue", () => {
    for (const type of TOPIC_FILE_TYPES.filter((t) => TOPIC_FILE_TYPE_STYLES[t].side === "aff")) {
      expect(TOPIC_FILE_TYPE_STYLES[type].className).toMatch(/^bg-(blue|sky|indigo)-/)
    }
  })
})
