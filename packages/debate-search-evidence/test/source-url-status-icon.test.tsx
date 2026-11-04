/**
 * @fileoverview The source-link status icon on a card search result and on
 * the reader's "Open page" button.
 */
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CardContentViewer } from "../src/components/card-viewer/CardContentViewer"
import { SearchResultCard } from "../src/components/search/SearchResultCard"
import type { SearchResult } from "../src/types"

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 1,
    category: "DA",
    researchField: "Economics",
    argBlock: "Affirmative",
    summary: "Summary.",
    cite_short: "Smith 24",
    cite: "Smith 24, Example Press",
    readCount: 7,
    highlightLength: 120,
    textLength: 400,
    word_count: 80,
    html: "<p>Card text.</p>",
    tag: "Free speech",
    year: "24",
    page: "",
    ...overrides,
  }
}

const card = (r: SearchResult) => renderToStaticMarkup(<SearchResultCard result={r} isSelected={false} onClick={() => {}} />)

describe("source link status", () => {
  it("shows on a result whether its source link works", () => {
    const html = card(result({ sourceUrl: "https://example.org/a", urlCheck: { status: "valid", statusCode: 200 } }))
    expect(html).toContain('data-status="valid"')
    expect(html).toContain("Link works")
  })

  it("marks a broken link and a link that has not been checked yet", () => {
    expect(card(result({ sourceUrl: "https://example.org/a", urlCheck: { status: "invalid", statusCode: 404 } }))).toContain(
      "Link broken",
    )
    expect(card(result({ sourceUrl: "https://example.org/a" }))).toContain('data-status="unchecked"')
  })

  it("shows nothing for a card that names no source link", () => {
    expect(card(result())).not.toContain("source-url-status")
  })

  it("puts the icon on the reader's Open page link", () => {
    const html = renderToStaticMarkup(
      <CardContentViewer
        selectedResult={result({ sourceUrl: "https://example.org/a", urlCheck: { status: "error", error: "Timeout after 8000ms" } })}
        viewMode="read"
        setViewMode={() => {}}
        wordCount={80}
      />,
    )
    expect(html).toMatch(/href="https:\/\/example.org\/a"[^>]*>.*data-status="error".*Open page/s)
  })
})
