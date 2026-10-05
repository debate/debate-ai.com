import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { MobileCardView } from "../src/components/MobileCardView"
import { CardContentViewer } from "../src/components/CardContentViewer"

const card = {
  id: 1,
  category: "DA",
  researchField: "Security",
  argBlock: "1NC",
  summary: "Deterrence summary",
  cite_short: "Chilton 18",
  cite: "Chilton 18",
  readCount: 0,
  highlightLength: 10,
  textLength: 100,
  word_count: 417,
  html: "<p>Body of the quote.</p>",
  tag: "Nuclear deterrence solves",
  year: "18",
  page: "",
}

function render(result = card) {
  return renderToStaticMarkup(
    <MobileCardView
      result={result}
      onBack={() => {}}
      viewMode="read"
      setViewMode={() => {}}
      aiResult="AI says this card is strong."
      generating={false}
      handleGenerate={() => {}}
    />,
  )
}

describe("MobileCardView", () => {
  it("has a back button and Quote / AI summary / Full page tabs", () => {
    const markup = render()

    expect(markup).toContain('aria-label="Back to results"')
    expect(markup).toContain("Quote")
    expect(markup).toContain("AI summary")
    expect(markup).toContain("Full page")
  })

  it("opens on the quote itself", () => {
    const markup = render()

    expect(markup).toContain("Body of the quote.")
    expect(markup).not.toContain("AI says this card is strong.")
  })

  it("leaves the source buttons to the Full page tab", () => {
    const withSource = { ...card, cite: "Chilton 18, https://example.com/article" }
    const markup = render(withSource)

    expect(markup).not.toContain("Open page")
    expect(markup).not.toContain("Full article")
  })
})

describe("CardContentViewer with nothing selected", () => {
  it("shows a one-line prompt instead of the product intro", () => {
    const markup = renderToStaticMarkup(
      <CardContentViewer selectedResult={null} viewMode="read" setViewMode={() => {}} wordCount={0} />,
    )

    expect(markup).toContain("Select a card to read it here.")
    expect(markup).not.toContain("noecbaibfhbmpapofcdkgchfifmoinfj")
  })
})
