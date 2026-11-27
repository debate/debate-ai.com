import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PageInfoPanel, readabilityRows } from "../components/guides/page-info"
import { pageStats } from "../lib/fumadocs/page-stats"
import { readability } from "../lib/fumadocs/readability"

const SAMPLE =
  "Playing games has always been thought to be important to the development of well-balanced and creative children; however, what part, if any, they should play in the lives of adults has never been researched that deeply. I believe that playing games is every bit as important for adults as for children. Not only is taking time out to play games with our children and other adults valuable to building interpersonal relationships but is also a wonderful way to release built up tension."

const MARKDOWN = `## First

${SAMPLE} Debaters ==read the marked words== (Shanahan 1993).

## Second

![A figure](https://example.com/a.png)

A short closing paragraph.
`

const render = (markdown: string, extra: object = {}) =>
  renderToStaticMarkup(<PageInfoPanel stats={pageStats(markdown, [{ depth: 2 }, { depth: 2 }])} {...extra} />)

describe("PageInfoPanel", () => {
  const html = render(MARKDOWN, { lastUpdated: "2026-11-23T12:00:00.000Z", showHighlights: true })

  it("puts a decorative icon beside every stat", () => {
    const labels = ["Words", "Reading time", "Characters", "Sections", "Headings", "Paragraphs", "Figures", "Citations", "Highlights", "Last updated"]
    const icons = new Set<string>()
    for (const label of labels) {
      const row = html.match(new RegExp(`<dt[^>]*>(?:(?!</dt>).)*${label}</dt>`))?.[0]
      expect(row, label).toBeDefined()
      const icon = row!.match(/<svg[^>]*class="[^"]*lucide-([a-z-]+)[^"]*"[^>]*aria-hidden="true"/)?.[1]
      expect(icon, label).toBeDefined()
      icons.add(icon!)
    }
    expect(icons.size).toBe(labels.length)
  })

  it("shows the readability score as an accessible progress bar", () => {
    const bar = html.match(/<div role="progressbar"[^>]*>/)?.[0] ?? ""
    expect(bar).toContain('aria-valuemin="0"')
    expect(bar).toContain('aria-valuemax="100"')
    expect(bar).toMatch(/aria-valuenow="\d+"/)
    expect(bar).toMatch(/aria-labelledby="[^"]+"/)
    const score = pageStats(MARKDOWN).readability.score!
    expect(html).toContain(`${score}/100 `)
    expect(html).toContain(`width:${score}%`)
    expect(html).toMatch(/>Readability</)
  })

  it("lists the other formulas in a collapsed details element", () => {
    expect(html).toMatch(/<details(?![^>]*\bopen\b)/)
    for (const label of ["Flesch-Kincaid Grade", "Gunning Fog", "SMOG Index", "Automated Readability Index", "Coleman-Liau Index", "Linsear Write", "Text standard (grade)"]) {
      expect(html).toContain(label)
    }
    expect(html).not.toContain("NaN")
  })

  it("shows em dashes and no progress bar for an empty document", () => {
    const empty = render("")
    expect(empty).not.toContain('role="progressbar"')
    expect(empty).toContain("Not enough text to score.")
    expect(empty).toContain("\u2014")
    expect(empty).not.toContain("NaN")
    expect(empty).toMatch(/>Words<\/dt><dd[^>]*>0</)
  })

  it("notes that SMOG needs three sentences", () => {
    const html = render("Playing games has always been thought to be important to the development of creative children. I believe playing games is important for adults.")
    expect(html).toContain("SMOG needs at least 3 sentences.")
  })
})

describe("readabilityRows", () => {
  it("formats scores to one decimal and uses an em dash where a score is missing", () => {
    const rows = Object.fromEntries(readabilityRows(readability("The cat sat. The dog ran to the park today. We like to play outside now.")))
    expect(rows["SMOG Index"]).toMatch(/^\d+\.\d$/)
    const missing = Object.fromEntries(readabilityRows(readability("")))
    expect(Object.values(missing).every((value) => value === "\u2014")).toBe(true)
  })
})
