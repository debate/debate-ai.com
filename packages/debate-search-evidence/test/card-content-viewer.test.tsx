import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CardContentViewer } from "../src/components/CardContentViewer"

describe("CardContentViewer", () => {
  it("shows the tag and citation without repeating the full summary at the top", () => {
    const selectedResult = {
      id: 1,
      category: "DA",
      researchField: "Economics",
      argBlock: "Affirmative",
      summary: "This is the full text of the card and it should not appear in the header.",
      cite_short: "Smith 2024",
      cite: "Smith, John. 2024. Example Title. Example Press.",
      readCount: 7,
      highlightLength: 120,
      textLength: 400,
      word_count: 80,
      html: "<p><strong>Full card text</strong> appears once in the main body.</p>",
      tag: "Free speech",
      year: "24",
      page: "12",
    }

    const markup = renderToStaticMarkup(
      <CardContentViewer selectedResult={selectedResult} viewMode="read" setViewMode={() => {}} wordCount={80} />,
    )

    expect(markup).toContain("Free speech")
    expect(markup).toContain("Smith")
    expect(markup).not.toContain("This is the full text of the card and it should not appear in the header.")
    expect(markup).toContain("Full card text")
  })
})
