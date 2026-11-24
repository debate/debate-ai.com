import { describe, expect, it } from "vitest"
import {
  DEFAULT_PAGE_FLOW_CHART_INSTRUCTIONS,
  buildPageFlowChartPrompt,
  pageFlowChartSections,
  MAX_PAGE_FLOW_CHART_SECTIONS,
} from "../src/lib/page-flow-chart"
import { flowChartSpeechColumns, parseFlowChartResponse } from "../src/lib/debate-flow-chart"
import { headerText } from "../src/components/videos/watch/flow-chart/DebateFlowChartGraph"

describe("pageFlowChartSections", () => {
  it("splits at ## headings, keeps the intro, drops frontmatter and fenced headings", () => {
    const md = [
      "---",
      "title: Cap K",
      "---",
      "Opening words.",
      "",
      "## The **link**",
      "Capitalism causes it.",
      "```md",
      "## not a heading",
      "```",
      "## [Alt](/alt)",
      "Reject the aff.",
      "### Sub point",
      "Still the alt.",
      "## Empty",
      "",
    ].join("\n")
    const sections = pageFlowChartSections(md)
    expect(sections.map((s) => [s.label, s.heading])).toEqual([
      ["§1", "Introduction"],
      ["§2", "The link"],
      ["§3", "Alt"],
    ])
    expect(sections[1].text).toContain("## not a heading")
    expect(sections[2].text).toContain("### Sub point")
    expect(sections[0].text).not.toContain("title:")
  })

  it("falls back to ### headings when there are fewer than two ## headings", () => {
    const sections = pageFlowChartSections("# Title\n### One\nA\n### Two\nB")
    expect(sections.map((s) => s.heading)).toEqual(["One", "Two"])
  })

  it("folds extra sections into the last one", () => {
    const md = Array.from({ length: 30 }, (_, i) => `## H${i}\ntext ${i}`).join("\n")
    const sections = pageFlowChartSections(md)
    expect(sections).toHaveLength(MAX_PAGE_FLOW_CHART_SECTIONS)
    expect(sections.at(-1)?.text).toContain("### H29")
  })
})

describe("buildPageFlowChartPrompt", () => {
  it("uses the default instructions and tags each section", () => {
    const prompt = buildPageFlowChartPrompt({
      title: "Cap K",
      sections: [{ label: "§1", heading: "Link", text: "Capitalism causes it." }],
    })
    expect(prompt.startsWith(DEFAULT_PAGE_FLOW_CHART_INSTRUCTIONS)).toBe(true)
    expect(prompt).toContain("Page: Cap K")
    expect(prompt).toContain("## Link [§1]\nCapitalism causes it.")
  })

  it("puts the reader's own instructions first", () => {
    const prompt = buildPageFlowChartPrompt({ instructions: "Only the alt.", sections: [] })
    expect(prompt.startsWith("Only the alt.")).toBe(true)
  })
})

describe("page chart columns", () => {
  it("orders columns by section and matches § tags", () => {
    const chart = parseFlowChartResponse(
      JSON.stringify({
        nodes: [
          { id: "b", side: "neg", label: "Perm", text: "x", speech: "§2" },
          { id: "a", side: "aff", label: "Link", text: "y", speech: "§1" },
        ],
        links: [],
      }),
    )!
    const columns = flowChartSpeechColumns(chart, [
      { label: "§1", side: "neutral" },
      { label: "§2", side: "neutral" },
    ])
    expect(columns.map((c) => [c.label, c.side])).toEqual([
      ["§1", "aff"],
      ["§2", "neg"],
    ])
  })

  it("header text adds a clipped title", () => {
    expect(headerText({ label: "1AC" })).toBe("1AC")
    expect(headerText({ label: "§1", title: "Intro" })).toBe("§1 Intro")
    expect(headerText({ label: "§1", title: "A very long section heading indeed" })).toHaveLength(22)
  })
})
