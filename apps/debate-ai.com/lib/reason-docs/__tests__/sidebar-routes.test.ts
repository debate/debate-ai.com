/**
 * @fileoverview Which sidebars show the REASON docs panels.
 *
 * The regression this pins: the Files / Topics / Tabs panels used to render in
 * every sidebar, so `/videos` opened with a document tree stacked above the
 * video nav. They belong to the routes the documents are the subject of — the
 * dock's `/cards` destination and the editor, whose desktop file navigation is
 * this sidebar and nothing else.
 */

import { describe, it, expect } from "vitest"
import { showsCardsOnlySidebar, showsReasonDocsPanels } from "../sidebar-routes"

describe("showsReasonDocsPanels", () => {
  it("shows them on /cards, the dock destination they belong to", () => {
    expect(showsReasonDocsPanels("/cards")).toBe(true)
  })

  it("keeps them on a page below /cards", () => {
    // Nested routes are the same destination one level down, and the dock
    // leaves the top-level path at /cards while the frame navigates itself.
    expect(showsReasonDocsPanels("/cards/library")).toBe(true)
    expect(showsReasonDocsPanels("/cards/leaderboard/42")).toBe(true)
  })

  it("keeps them on the editor, whose desktop file nav is this sidebar", () => {
    expect(showsReasonDocsPanels("/reason-editor")).toBe(true)
  })

  it("hides them on /videos, where the sidebar is the video library", () => {
    expect(showsReasonDocsPanels("/videos")).toBe(false)
    expect(showsReasonDocsPanels("/videos/college")).toBe(false)
  })

  it("hides them on the other tool routes the sidebar covers", () => {
    for (const path of ["/", "/coach", "/practice-round", "/debate", "/doc", "/research"]) {
      expect(showsReasonDocsPanels(path)).toBe(false)
    }
  })

  it("does not match a route that merely starts with a shown one", () => {
    // `/cardsomething` is a different route, not a page under `/cards`.
    expect(showsReasonDocsPanels("/cardsomething")).toBe(false)
  })

  it("ignores a trailing slash and a query string", () => {
    // The dock hops by pushState, so this reads back whatever it wrote.
    expect(showsReasonDocsPanels("/cards/")).toBe(true)
    expect(showsReasonDocsPanels("/cards?q=nuclear")).toBe(true)
    expect(showsReasonDocsPanels("/reason-editor?doc=12")).toBe(true)
  })

  it("reads a missing pathname as no panels rather than throwing", () => {
    expect(showsReasonDocsPanels(null)).toBe(false)
    expect(showsReasonDocsPanels(undefined)).toBe(false)
    expect(showsReasonDocsPanels("")).toBe(false)
  })
})

/**
 * The second half of the same question: `/cards` gets the docs panels *and*
 * nothing else — no Apps/Coaching/Practice sections, no glossary/rankings
 * pair, no site footer. Before this the column carried four navigations at
 * once on the page about one of them.
 */
describe("showsCardsOnlySidebar", () => {
  it("trims the sidebar on /cards and the pages under it", () => {
    expect(showsCardsOnlySidebar("/cards")).toBe(true)
    expect(showsCardsOnlySidebar("/cards/library")).toBe(true)
    expect(showsCardsOnlySidebar("/cards/leaderboard/42")).toBe(true)
  })

  it("leaves the editor's sidebar whole", () => {
    // /reason-editor is reached *from* the other tool sections rather than
    // being one of them, so it keeps the full tree under its docs panels.
    expect(showsCardsOnlySidebar("/reason-editor")).toBe(false)
  })

  it("leaves every other tool route alone", () => {
    for (const path of ["/", "/videos", "/coach", "/research", "/doc", "/practice-round"]) {
      expect(showsCardsOnlySidebar(path)).toBe(false)
    }
  })

  it("does not match a route that merely starts with /cards", () => {
    expect(showsCardsOnlySidebar("/cardsomething")).toBe(false)
  })

  it("ignores a trailing slash and a query string, as the dock writes them", () => {
    expect(showsCardsOnlySidebar("/cards/")).toBe(true)
    expect(showsCardsOnlySidebar("/cards?tab=library")).toBe(true)
    expect(showsCardsOnlySidebar("/cards#top")).toBe(true)
  })

  it("reads a missing pathname as the full sidebar rather than throwing", () => {
    expect(showsCardsOnlySidebar(null)).toBe(false)
    expect(showsCardsOnlySidebar(undefined)).toBe(false)
    expect(showsCardsOnlySidebar("")).toBe(false)
  })
})
