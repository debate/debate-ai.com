/**
 * @fileoverview Which sidebars show the REASON docs panels.
 *
 * The regression this pins: the Files / Topics / Tabs panels used to render in
 * every sidebar, so `/videos` opened with a document tree stacked above the
 * video nav. They belong to the routes the documents are the subject of — the
 * dock's `/research/cards` destination and the editor, whose desktop file navigation is
 * this sidebar and nothing else.
 */

import { describe, it, expect } from "vitest"
import { isCardsWorkspacePath, showsReasonDocsPanels } from "../../../src/lib/reason-docs/sidebar-routes"

describe("showsReasonDocsPanels", () => {
  it("shows them on /cards, the dock destination they belong to", () => {
    expect(showsReasonDocsPanels("/research/cards")).toBe(true)
  })

  it("keeps them on a page below /cards", () => {
    // Nested routes are the same destination one level down, and the dock
    // leaves the top-level path at /cards while the frame navigates itself.
    expect(showsReasonDocsPanels("/research/cards/library")).toBe(true)
    expect(showsReasonDocsPanels("/research/cards/awards")).toBe(true)
  })

  it("keeps them on the editor, whose desktop file nav is this sidebar", () => {
    expect(showsReasonDocsPanels("/docs/vcx27/neg/cp/aca-expansion-cp-cndi-2026")).toBe(true)
    expect(showsReasonDocsPanels("/docs/features/drill-sets")).toBe(false)
    expect(showsReasonDocsPanels("/reason-editor")).toBe(true)
  })

  it("hides them on /videos, where the sidebar is the video library", () => {
    expect(showsReasonDocsPanels("/videos")).toBe(false)
    expect(showsReasonDocsPanels("/videos/college")).toBe(false)
  })

  it("hides them on the other tool routes the sidebar covers", () => {
    for (const path of ["/", "/coaching", "/practice", "/debate", "/doc", "/research"]) {
      expect(showsReasonDocsPanels(path)).toBe(false)
    }
  })

  it("does not match a route that merely starts with a shown one", () => {
    // `/cardsomething` is a different route, not a page under `/research/cards`.
    expect(showsReasonDocsPanels("/cardsomething")).toBe(false)
  })

  it("ignores a trailing slash and a query string", () => {
    // The dock hops by pushState, so this reads back whatever it wrote.
    expect(showsReasonDocsPanels("/research/cards/")).toBe(true)
    expect(showsReasonDocsPanels("/research/cards?q=nuclear")).toBe(true)
    expect(showsReasonDocsPanels("/reason-editor?doc=12")).toBe(true)
  })

  it("reads a missing pathname as no panels rather than throwing", () => {
    expect(showsReasonDocsPanels(null)).toBe(false)
    expect(showsReasonDocsPanels(undefined)).toBe(false)
    expect(showsReasonDocsPanels("")).toBe(false)
  })
})

describe("isCardsWorkspacePath", () => {
  it("matches the Research Workspace at /research/cards", () => {
    expect(isCardsWorkspacePath("/research/cards")).toBe(true)
  })

  it("matches a page below /research/cards", () => {
    expect(isCardsWorkspacePath("/research/cards/library")).toBe(true)
    expect(isCardsWorkspacePath("/research/cards/awards")).toBe(true)
  })

  it("does not match the editor", () => {
    expect(isCardsWorkspacePath("/reason-editor")).toBe(false)
  })

  it("leaves every other tool route its own nav", () => {
    for (const path of ["/", "/coaching", "/practice", "/videos", "/debate", "/doc"]) {
      expect(isCardsWorkspacePath(path)).toBe(false)
    }
  })

  it("does not match a route that merely starts with /cards", () => {
    expect(isCardsWorkspacePath("/cardsomething")).toBe(false)
  })

  it("ignores a trailing slash, a query string and a hash", () => {
    expect(isCardsWorkspacePath("/research/cards/")).toBe(true)
    expect(isCardsWorkspacePath("/research/cards?tab=library")).toBe(true)
    expect(isCardsWorkspacePath("/research/cards#top")).toBe(true)
  })

  it("reads a missing pathname as no match rather than throwing", () => {
    expect(isCardsWorkspacePath(null)).toBe(false)
    expect(isCardsWorkspacePath(undefined)).toBe(false)
    expect(isCardsWorkspacePath("")).toBe(false)
  })
})
