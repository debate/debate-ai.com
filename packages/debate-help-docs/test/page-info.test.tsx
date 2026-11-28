import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PageInfoPanel } from "../components/guides/page-info"
import { pageStats } from "../lib/fumadocs/page-stats"

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
    const labels = ["Words", "Reading time", "Characters", "Readability", "Sections", "Headings", "Paragraphs", "Figures", "Citations", "Highlights", "Last updated"]
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

  it("shows the Doc Metrics title", () => {
    expect(html).toMatch(/>Doc Metrics</)
    expect(html).not.toContain("Page stats")
  })

  it("shows readability as one compact row with only the percentage and its label", () => {
    const { score, band } = pageStats(MARKDOWN).readability
    expect(html).toMatch(new RegExp(`>Readability</dt><dd[^>]*>${score}% ${band}</dd>`))
    expect(html).not.toContain('role="progressbar"')
    expect(html).not.toContain("<details")
    expect(html).not.toContain("/100")
    for (const label of ["Flesch", "Gunning Fog", "SMOG", "Coleman-Liau", "Linsear Write", "Text standard", "Grade levels"]) {
      expect(html).not.toContain(label)
    }
    expect(html).not.toContain("NaN")
  })

  it("shows an em dash for readability of an empty document", () => {
    const empty = render("")
    expect(empty).toMatch(/>Readability<\/dt><dd[^>]*>\u2014</)
    expect(empty).not.toContain("NaN")
    expect(empty).toMatch(/>Words<\/dt><dd[^>]*>0</)
  })
})
