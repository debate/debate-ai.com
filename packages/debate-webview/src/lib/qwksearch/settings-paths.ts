/**
 * @fileoverview Where the research agent's settings live in this app, and which
 * settings page the dock's Settings entry opens from where.
 *
 * The agent's settings are `research-agent-ui`'s sections (`settingsSections`,
 * from `research-agent-ui/settings`) mounted as full pages under
 * `/settings/research`, beside the app's own `/settings` (the CardMirror
 * editor's). One page per section, so each is linkable.
 *
 * @module lib/qwksearch/settings-paths
 */

import { settingsSections } from "research-agent-ui/settings"

export const SETTINGS_ROUTE = "/settings"
export const RESEARCH_SETTINGS_ROUTE = "/settings/research"

/** The research settings page for `section` (the first tab when omitted). */
export function researchSettingsHref(section?: string): string {
  return section ? `${RESEARCH_SETTINGS_ROUTE}/${encodeURIComponent(section)}` : RESEARCH_SETTINGS_ROUTE
}

/** True on the research agent's workspace routes: `/doc` and any document beneath it. */
function isResearchAgentPath(pathname: string | null | undefined): boolean {
  return !!pathname && (pathname === "/doc" || pathname.startsWith("/doc/"))
}

/**
 * The page the dock's Settings entry opens. From the research agent it is the
 * agent's settings, since those are the ones you came for; from anywhere else
 * it is the app's own, which links on to the agent's.
 */
export function settingsHrefForPath(pathname: string | null | undefined): string {
  return isResearchAgentPath(pathname) ? RESEARCH_SETTINGS_ROUTE : SETTINGS_ROUTE
}

/** One entry of the research settings, as a page the global settings can link to. */
export interface ResearchSettingsPage {
  key: string
  name: string
  description: string
  href: string
}

/** Every research-agent settings section as a page under {@link RESEARCH_SETTINGS_ROUTE}. */
export function researchSettingsPages(): ResearchSettingsPage[] {
  return settingsSections.map(({ key, name, description }) => ({
    key,
    name,
    description,
    href: researchSettingsHref(key),
  }))
}
