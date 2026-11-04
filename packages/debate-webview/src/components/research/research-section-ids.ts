/**
 * @fileoverview The Research Workspace's tab ids and where the old Team
 * Research tabs now live.
 *
 * Team Research (`/research/team`) was a second tabbed page beside the
 * Research Workspace; its tabs merged into `/research` and its Practice
 * Partners tab moved to the Prep Workspace. Kept free of React (and of
 * `"use client"`) so the Next app's server redirects can call these.
 *
 * @module components/research/research-section-ids
 */

/** One Research Workspace tab per research stage. Also the `?section=` URL values. */
export type ResearchSectionId =
  | "coverage"
  | "library"
  | "evidence"
  | "sprint"
  | "routing"
  | "progress"
  | "research-progress"
  | "quests"
  | "rewards"
  | "leaderboard"
  | "review"
  | "scoring"
  | "level"

/**
 * The old Team Research tab ids (`/research/team?section=…`), still found in
 * bookmarks, stored notifications and the old `/research/cards/*` redirects.
 */
export type TeamResearchSectionId =
  | "coverage"
  | "prep-room"
  | "reviews"
  | "inbox"
  | "contributions"
  | "brainstorm"
  | "level"

/** Where each old Team Research tab now lives on this hub. */
const TEAM_RESEARCH_TO_RESEARCH: Record<TeamResearchSectionId, ResearchSectionId> = {
  coverage: "coverage",
  "prep-room": "sprint",
  reviews: "review",
  inbox: "routing",
  contributions: "rewards",
  brainstorm: "sprint",
  level: "level",
}

/**
 * Maps an old Team Research `?section=` value to this hub's tab, or `null`
 * when it names none (unknown or missing).
 *
 * @param section - The old tab id.
 */
export function researchSectionForTeamSection(section: string | null | undefined): ResearchSectionId | null {
  if (!section || !Object.prototype.hasOwnProperty.call(TEAM_RESEARCH_TO_RESEARCH, section)) return null
  return TEAM_RESEARCH_TO_RESEARCH[section as TeamResearchSectionId]
}

/**
 * The Research Workspace URL for one tab.
 *
 * @param section - The tab to open.
 */
export function researchHref(section: ResearchSectionId): string {
  return `/research?section=${section}`
}

/**
 * Where an old Team Research tab now opens — the matching Research
 * Workspace tab. Every route Team Research replaced redirects here.
 *
 * @param section - The old Team Research tab.
 */
export function teamResearchHref(section: TeamResearchSectionId): string {
  return researchHref(TEAM_RESEARCH_TO_RESEARCH[section])
}
