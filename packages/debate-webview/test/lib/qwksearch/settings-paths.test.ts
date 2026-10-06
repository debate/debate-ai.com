/**
 * @fileoverview Pins where the research agent's settings live (tabs of
 * `/settings`) and which settings tab the dock's Settings entry opens from where.
 */
import { describe, expect, it } from "vitest"
import { settingsSections } from "research-agent-ui/settings"
import {
  legacyResearchSettingsRedirect,
  researchSectionOfTab,
  researchSettingsHref,
  researchSettingsPages,
  researchTabId,
  settingsHrefForPath,
} from "../../../src/lib/qwksearch/settings-paths"

const FIRST = settingsSections[0].key

describe("settingsHrefForPath", () => {
  it("opens the research agent's first settings tab from the research agent", () => {
    expect(settingsHrefForPath("/doc")).toBe(`/settings?category=research-${FIRST}`)
    expect(settingsHrefForPath("/doc/cp-answer-to-states")).toBe(`/settings?category=research-${FIRST}`)
  })

  it("opens the app's own settings everywhere else", () => {
    expect(settingsHrefForPath("/debate")).toBe("/settings")
    expect(settingsHrefForPath("/docs")).toBe("/settings")
    expect(settingsHrefForPath(null)).toBe("/settings")
  })
})

describe("researchSettingsPages", () => {
  it("exposes every section of the agent's settings as a tab of /settings", () => {
    const pages = researchSettingsPages()
    expect(pages.map((p) => p.key)).toEqual(settingsSections.map((s) => s.key))
    for (const page of pages) {
      expect(page.tabId).toBe(researchTabId(page.key))
      expect(page.href).toBe(researchSettingsHref(page.key))
    }
  })

  it("deep-links one section and defaults to the first tab", () => {
    expect(researchSettingsHref("models")).toBe("/settings?category=research-models")
    expect(researchSettingsHref()).toBe(`/settings?category=research-${FIRST}`)
    expect(researchSettingsHref("nope")).toBe(`/settings?category=research-${FIRST}`)
  })
})

describe("researchSectionOfTab", () => {
  it("names the research section of a research tab, and nothing else", () => {
    expect(researchSectionOfTab("research-models")).toBe("models")
    expect(researchSectionOfTab("research-nope")).toBeNull()
    expect(researchSectionOfTab("general")).toBeNull()
    expect(researchSectionOfTab(null)).toBeNull()
  })
})

describe("legacyResearchSettingsRedirect", () => {
  it("sends the old /settings/research pages to their /settings tab", () => {
    expect(legacyResearchSettingsRedirect()).toBe(`/settings?category=research-${FIRST}`)
    expect(legacyResearchSettingsRedirect("voice")).toBe("/settings?category=research-voice")
    expect(legacyResearchSettingsRedirect("editor-general")).toBe("/settings?category=general")
  })
})
