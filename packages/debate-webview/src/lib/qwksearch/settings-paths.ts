/**
 * @fileoverview Where the research agent's settings live in this app, and which
 * settings tab the dock's Settings entry opens from where.
 *
 * The agent's settings are `research-agent-ui`'s sections (`settingsSections`,
 * from `research-agent-ui/settings`) shown as tabs of the app's own
 * `/settings`, under a "Research agent" heading in its sidebar. Each is
 * linkable as `/settings?category=research-<section>`; the old
 * `/settings/research/<section>` pages redirect there.
 *
 * @module lib/qwksearch/settings-paths
 */

import { settingsSections } from "research-agent-ui/settings"

export const SETTINGS_ROUTE = "/settings"
/** The legacy route of the research settings — now only a redirect into {@link SETTINGS_ROUTE}. */
export const RESEARCH_SETTINGS_ROUTE = "/settings/research"

/** Prefix of a research section's tab id on `/settings`, so it can never collide with an editor tab's. */
export const RESEARCH_TAB_PREFIX = "research-"

/** The `/settings` tab id of research section `section`. */
export function researchTabId(section: string): string {
  return `${RESEARCH_TAB_PREFIX}${section}`
}

/** The research section a `/settings` tab id names, or `null` for any other tab. */
export function researchSectionOfTab(tabId: string | null | undefined): string | null {
  if (!tabId?.startsWith(RESEARCH_TAB_PREFIX)) return null
  const section = tabId.slice(RESEARCH_TAB_PREFIX.length)
  return settingsSections.some((s) => s.key === section) ? section : null
}

/** The `/settings` tab for research section `section` (the first research tab when omitted or unknown). */
export function researchSettingsHref(section?: string): string {
  const known = settingsSections.find((s) => s.key === section) ?? settingsSections[0]
  return `${SETTINGS_ROUTE}?category=${encodeURIComponent(researchTabId(known.key))}`
}

/** True on the research agent's workspace routes: `/doc` and any document beneath it. */
function isResearchAgentPath(pathname: string | null | undefined): boolean {
  return !!pathname && (pathname === "/doc" || pathname.startsWith("/doc/"))
}

/**
 * The page the dock's Settings entry opens. From the research agent it is the
 * agent's first settings tab, since those are the ones you came for; from
 * anywhere else it is `/settings` on its first tab.
 */
export function settingsHrefForPath(pathname: string | null | undefined): string {
  return isResearchAgentPath(pathname) ? researchSettingsHref() : SETTINGS_ROUTE
}

/** One research-agent settings section, as a tab of `/settings`. */
export interface ResearchSettingsPage {
  /** The section's own key (`models`). */
  key: string
  /** Its tab id on `/settings` (`research-models`). */
  tabId: string
  name: string
  description: string
  href: string
}

/** Every research-agent settings section as a tab of {@link SETTINGS_ROUTE}. */
export function researchSettingsPages(): ResearchSettingsPage[] {
  return settingsSections.map(({ key, name, description }) => ({
    key,
    tabId: researchTabId(key),
    name,
    description,
    href: researchSettingsHref(key),
  }))
}

/**
 * Where a legacy `/settings/research[/<section>]` URL now lives. `editor-<tab>`
 * sections (the card editor's tabs, which that page also listed) map to the
 * editor's own tab; anything unknown opens the first research tab.
 */
export function legacyResearchSettingsRedirect(section?: string): string {
  if (section?.startsWith("editor-")) {
    return `${SETTINGS_ROUTE}?category=${encodeURIComponent(section.slice("editor-".length))}`
  }
  return researchSettingsHref(section)
}
