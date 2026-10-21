import { describe, expect, it } from "vitest"
import { extractSpeechSignposts } from "../src/utils/speech-signposts"

const outline = (content: string) => extractSpeechSignposts(content).map((h) => [h.level, h.text])

describe("extractSpeechSignposts", () => {
  it("keeps H1–H3 of a markdown speech doc and drops H4 card tags", () => {
    const md = [
      "# Contention 1: Economy",
      "## Subpoint A — Jobs",
      "### Uniqueness",
      "#### Unemployment is falling now because the labor market stays tight",
      "Card text here.",
      "## Subpoint B — Growth",
    ].join("\n")
    expect(outline(md)).toEqual([
      [1, "Contention 1: Economy"],
      [2, "Subpoint A — Jobs"],
      [3, "Uniqueness"],
      [2, "Subpoint B — Growth"],
    ])
  })

  it("reads CardMirror HTML headings and pocket/hat/block classes", () => {
    const html = [
      '<h1 data-id="a">Off &amp; On</h1>',
      "<h2><span>Framework</span></h2>",
      "<h4>A long tag sentence that should not appear</h4>",
      '<p class="pmd-block">Impacts</p>',
      "<p>Body text</p>",
    ].join("")
    expect(outline(html)).toEqual([
      [1, "Off & On"],
      [2, "Framework"],
      [3, "Impacts"],
    ])
  })

  it("is empty for an empty or heading-less doc", () => {
    expect(extractSpeechSignposts("")).toEqual([])
    expect(extractSpeechSignposts(undefined)).toEqual([])
    expect(extractSpeechSignposts("Just analytics, no headings.")).toEqual([])
  })
})
