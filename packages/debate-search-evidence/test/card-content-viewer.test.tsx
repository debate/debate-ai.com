import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CardContentViewer } from "../src/components/CardContentViewer"

/** A result shaped like the search API's mapping of a stored card. */
function result(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  }
}

/** Counts non-overlapping occurrences of `needle` in `haystack`. */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

function render(selectedResult: ReturnType<typeof result>) {
  return renderToStaticMarkup(
    <CardContentViewer selectedResult={selectedResult} viewMode="read" setViewMode={() => {}} wordCount={80} />,
  )
}

describe("CardContentViewer", () => {
  it("shows the tag and citation without repeating the full summary at the top", () => {
    const markup = render(result())

    expect(markup).toContain("Free speech")
    expect(markup).toContain("Smith")
    expect(markup).not.toContain("This is the full text of the card and it should not appear in the header.")
    expect(markup).toContain("Full card text")
  })

  it("shows the tag once when the card body opens with its own tag heading", () => {
    const tag = "Nuclear deterrence solves existential threats"
    const markup = render(
      result({
        tag,
        html: `<h4>${tag}</h4><p>Chilton 18—USAF, Retired. Deterrence underpins security.</p>`,
      }),
    )

    expect(occurrences(markup, tag)).toBe(1)
    expect(markup).toContain("Deterrence underpins security.")
  })

  it("shows the citation once when cite and cite_short are the same string", () => {
    const markup = render(
      result({
        cite: "Chilton 18",
        cite_short: "Chilton 18",
        year: "18",
        html: "<p>Deterrence underpins security.</p>",
      }),
    )

    expect(occurrences(markup, "Chilton")).toBe(1)
  })

  it("keeps the body's citation line when it qualifies the author further", () => {
    const markup = render(
      result({
        cite: "Chilton 18",
        cite_short: "Chilton 18",
        year: "18",
        html: "<p>Chilton 18—USAF, Retired Former commander, US Strategic Command</p><p>Body.</p>",
      }),
    )

    expect(markup).toContain("US Strategic Command")
    expect(markup).toContain("Body.")
  })

  it("renders the season year rather than the four-digit year in the badge", () => {
    const markup = render(result({ year: "2018", cite_short: "Chilton 18" }))

    expect(markup).toContain(">18<")
  })

  it("omits the year badge entirely for a card with no parseable year", () => {
    const markup = render(result({ year: "", cite_short: "Birhane and van Dijk", cite: "" }))

    expect(markup).toContain("Birhane and van Dijk")
    expect(markup).not.toContain("rounded text-xs font-medium")
  })
})
