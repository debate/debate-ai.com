/**
 * @fileoverview Pins where the research agent's settings live and which
 * settings page the dock's Settings entry opens from where.
 */
import { describe, expect, it } from "vitest"
import { settingsSections } from "research-agent-ui/settings"
import {
  RESEARCH_SETTINGS_ROUTE,
  researchSettingsHref,
  researchSettingsPages,
  settingsHrefForPath,
} from "../../../src/lib/qwksearch/settings-paths"

describe("settingsHrefForPath", () => {
  it("opens the research agent's settings from the research agent", () => {
    expect(settingsHrefForPath("/doc")).toBe(RESEARCH_SETTINGS_ROUTE)
    expect(settingsHrefForPath("/doc/cp-answer-to-states")).toBe(RESEARCH_SETTINGS_ROUTE)
  })

  it("opens the app's own settings everywhere else", () => {
    expect(settingsHrefForPath("/debate")).toBe("/settings")
    expect(settingsHrefForPath("/docs")).toBe("/settings")
    expect(settingsHrefForPath(null)).toBe("/settings")
  })
})

describe("researchSettingsPages", () => {
  it("exposes every section of the agent's settings as its own page", () => {
    const pages = researchSettingsPages()
    expect(pages.map((p) => p.key)).toEqual(settingsSections.map((s) => s.key))
    for (const page of pages) expect(page.href).toBe(researchSettingsHref(page.key))
  })

  it("deep-links one section and defaults to the first tab", () => {
    expect(researchSettingsHref("models")).toBe("/settings/research/models")
    expect(researchSettingsHref()).toBe("/settings/research")
  })
})
