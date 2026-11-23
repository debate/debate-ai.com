/**
 * Every docs page's toolbar sits in the header after the search box and ends
 * with an Info button showing the page's stats (lib/fumadocs/page-stats.ts).
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { pageStats } from "../../../../packages/debate-help-docs/lib/fumadocs/page-stats"
import { pageInfoRows } from "../../../../packages/debate-help-docs/components/guides/page-info"

const helpDocs = (path: string) =>
  readFileSync(resolve(__dirname, "../../../../packages/debate-help-docs", path), "utf8")

const SAMPLE = `---
title: Sample
---

import { Accordion } from 'fumadocs-ui/components/accordion';

## First section

Debaters ==read the marked words== of a card, as Shanahan (1993) argues.

![A figure](https://example.com/a.png)

See [the guide](/docs/learn) and the evidence (Alinsky 1971, 66; Hitchens 1999).

\`\`\`ts
const notCounted = "these words are code"
\`\`\`

| a | b |
| --- | --- |
| 1 | 2 |

## Second section

### A subsection

Last paragraph.
`

describe("pageStats", () => {
  const toc = [{ depth: 2 }, { depth: 2 }, { depth: 3 }]
  const stats = pageStats(SAMPLE, toc)

  it("counts the prose words, not code, frontmatter, imports or URLs", () => {
    expect(stats.words).toBe(35)
    expect(stats.readingMinutes).toBe(1)
  })

  it("counts sections, headings, links, figures, tables and code", () => {
    expect(stats.sections).toBe(2)
    expect(stats.headings).toBe(3)
    expect(stats.links).toBe(1)
    expect(stats.images).toBe(1)
    expect(stats.tables).toBe(1)
    expect(stats.codeBlocks).toBe(1)
    expect(stats.paragraphs).toBe(3)
  })

  it("counts author-date citations and highlights", () => {
    expect(stats.citations).toBe(3)
    expect(stats.highlights).toBe(1)
  })

  it("is all zeros for an empty page", () => {
    expect(pageStats("")).toMatchObject({ words: 0, readingMinutes: 0, paragraphs: 0, links: 0 })
  })
})

describe("pageInfoRows", () => {
  const stats = pageStats(SAMPLE, [{ depth: 2 }])

  it("always shows words and reading time, skips zero counts, and shows highlights only when asked", () => {
    const rows = Object.fromEntries(pageInfoRows({ stats }))
    expect(rows.Words).toBe("35")
    expect(rows["Reading time"]).toBe("1 min")
    expect(rows.Headings).toBe("1")
    expect(rows.Highlights).toBeUndefined()
    expect(Object.fromEntries(pageInfoRows({ stats, showHighlights: true })).Highlights).toBe("1")
    expect(Object.fromEntries(pageInfoRows({ stats: pageStats("One word") }))).not.toHaveProperty("Links")
  })

  it("adds the last-updated date when known", () => {
    const rows = Object.fromEntries(pageInfoRows({ stats, lastUpdated: "2026-11-23T12:00:00.000Z" }))
    expect(rows["Last updated"]).toBe("Nov 23, 2026")
  })
})

describe("docs page toolbar", () => {
  const page = helpDocs("routes/docs-page.tsx")
  const layout = helpDocs("routes/docs-layout.tsx")

  it("portals the toolbar into the header slot after the search box", () => {
    expect(layout).toContain("full: SearchWithToolbarSlot")
    expect(page).toContain("<HeaderToolbar>")
  })

  it("ends with the Info button", () => {
    const info = page.indexOf('<ToolbarItem label="Info">')
    expect(info).toBeGreaterThan(-1)
    expect(page.indexOf("<PageInfoButton", info)).toBeGreaterThan(info)
    expect(page.indexOf("</HeaderToolbar>")).toBeGreaterThan(info)
    expect(page.slice(info, page.indexOf("</HeaderToolbar>"))).not.toContain("<ToolbarItem label=\"Export\"")
  })
})
