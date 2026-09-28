/**
 * @fileoverview The three columns of the search screen scroll on their own.
 *
 * The regression this pins: nothing gave the columns a bounded height, so each
 * grew to fit its content and the page became one long scroll — moving the
 * result list and the open card together, and pushing the card out of view
 * while you scrolled the results. Two things make a flex column scroll
 * internally instead: the scrolling child has to be allowed to shrink below
 * its content (`min-h-0` on a `flex-1` child), and nothing above it may push
 * the column past its own height.
 *
 * Asserted on the rendered class lists rather than by measuring a layout,
 * since `renderToStaticMarkup` has no layout engine. Crude, but it is the
 * difference between a column that scrolls and a page that does.
 */

import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ResearchSearchSidebar } from "../src/components/ResearchSearchSidebar"
import { CardContentViewer } from "../src/components/CardContentViewer"
import { EMPTY_FILTERS } from "../src/lib/search-query"

/** The classes on the element carrying `attr`, e.g. `role="listbox"`. */
function classesOf(markup: string, attr: string): string {
  // The element's own tag, from its attribute back to the opening angle.
  const index = markup.indexOf(attr)
  expect(index).toBeGreaterThan(-1)
  const start = markup.lastIndexOf("<", index)
  const tag = markup.slice(start, markup.indexOf(">", index) + 1)
  return /class="([^"]*)"/.exec(tag)?.[1] ?? ""
}

function renderSidebar() {
  return renderToStaticMarkup(
    <ResearchSearchSidebar
      searchTerm=""
      setSearchTerm={() => {}}
      sortBy="_text_match:desc"
      setSortBy={() => {}}
      filters={EMPTY_FILTERS}
      setFilters={() => {}}
      searchResults={[]}
      totalResults={0}
      selectedIndex={-1}
      selectResult={() => {}}
      isLoading={false}
    />,
  )
}

describe("the result list", () => {
  it("scrolls itself and may shrink below its content", () => {
    const classes = classesOf(renderSidebar(), 'role="listbox"')

    expect(classes).toContain("overflow-y-auto")
    expect(classes).toContain("flex-1")
    // Without this a flex child refuses to shrink under its content, so 200
    // cards stretch the column instead of scrolling inside it.
    expect(classes).toContain("min-h-0")
  })

  it("does not push its own column down past its height", () => {
    // `mt-[50px]` on a `h-full` column made it 50px taller than the panel it
    // sits in, so the bottom of the list was clipped away.
    expect(renderSidebar()).not.toContain("mt-[50px]")
  })
})

describe("the open card", () => {
  it("fills its column and scrolls separately from the results", () => {
    const markup = renderToStaticMarkup(
      <CardContentViewer
        selectedResult={{
          id: 1,
          category: "DA",
          researchField: "Security",
          argBlock: "1NC",
          summary: "",
          cite_short: "Chilton 18",
          cite: "Chilton 18",
          readCount: 0,
          highlightLength: 10,
          textLength: 100,
          word_count: 417,
          html: "<p>Body.</p>",
          tag: "Nuclear deterrence solves",
          year: "18",
          page: "",
        }}
        viewMode="read"
        setViewMode={() => {}}
        wordCount={417}
      />,
    )

    const classes = classesOf(markup, "h-full")
    expect(classes).toContain("h-full")
    expect(classes).toContain("overflow-y-auto")
  })
})
