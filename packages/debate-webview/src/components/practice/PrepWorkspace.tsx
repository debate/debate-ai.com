"use client"

/**
 * @fileoverview Prep Workspace — the five pre-round prep tools on one tabbed
 * page at `/practice/prep`.
 *
 * Pre-Round Briefings, Scout-to-Strategy, Opponent Team Profiles, Judge
 * Profiles and Prep Notes used to be five separate pages
 * (`/practice/briefings`, `/practice/strategy`, `/practice/opponents`,
 * `/practice/judges`, `/practice/prep-notes`). They read each other's data —
 * a briefing and the strategy ranking both pull from the opponent and judge
 * profiles — so they now sit side by side as one tab each. Those old
 * addresses redirect here with `?section=` set to the matching tab.
 *
 * Each panel still owns its store; this file is only navigation, built on
 * the same tab strip and `?section=` URL sync as the Coach and Research hubs
 * (`components/hubs/HubSectionNav.tsx`).
 *
 * @module components/practice/PrepWorkspace
 */

import { ClipboardList, Crosshair, Gavel, NotebookPen, Users } from "lucide-react"
import { OpponentTeamProfilesPanel, PreRoundBriefingsPanel, StrategyPanel } from "@debate/round"
import { JudgeProfilesPanel } from "@debate/speech-writer"
import { PrepNotesWithIdentity } from "../research/PrepNotesWithIdentity"
import { panel, type HubSection } from "../hubs/hub-sections"
import { HubSectionIntro, HubSectionNav, HubSectionPanel, useHubSection } from "../hubs/HubSectionNav"

/** localStorage key remembering the last open tab. */
const SECTION_KEY = "prepWorkspaceSection"

/** One tab per prep tool. Also the `?section=` values the old routes redirect to. */
export type PrepWorkspaceSectionId = "briefings" | "strategy" | "opponents" | "judges" | "notes"

/** The Prep Workspace's tabs, in the order a team works through them before a round. */
export const PREP_WORKSPACE_SECTIONS: readonly HubSection<PrepWorkspaceSectionId>[] = [
  {
    id: "briefings",
    label: "Pre-Round Briefings",
    icon: ClipboardList,
    description: "One briefing per upcoming round: opponent scouting, judge tendencies, head-to-head record, and team prep notes.",
    guide: "training-tools",
    panels: [panel("Pre-Round Briefings")],
  },
  {
    id: "strategy",
    label: "Scout-to-Strategy",
    icon: Crosshair,
    description: "Turn the saved opponent and judge profiles into a ranked list of case options and a matchup risk level.",
    guide: "training-tools",
    panels: [panel("Scout-to-Strategy")],
  },
  {
    id: "opponents",
    label: "Opponent Team Profiles",
    icon: Users,
    description: "Records, Aff/Neg side tendencies, and the arguments and cases each scouted team runs most.",
    guide: "training-tools",
    panels: [panel("Opponent Team Profiles")],
  },
  {
    id: "judges",
    label: "Judge Profiles",
    icon: Gavel,
    description: "Side-vote bias, average speaker points, speed tolerance, and theory receptiveness for every saved judge.",
    guide: "training-tools",
    panels: [panel("Judge Profiles")],
  },
  {
    id: "notes",
    label: "Prep Notes",
    icon: NotebookPen,
    description: "Live prep notes across every flow, needs-follow-up first, with handoff to a teammate.",
    guide: "training-tools",
    panels: [panel("Prep Notes")],
  },
]

/**
 * The Prep Workspace URL for one tab — where each old standalone route now
 * points.
 *
 * @param section - The tab to open.
 */
export function prepWorkspaceHref(section: PrepWorkspaceSectionId): string {
  return `/practice/prep?section=${section}`
}

/** Props for {@link PrepWorkspace}. */
export interface PrepWorkspaceProps {
  /** Tab to open when the URL names none (the old route's tab, outside Next). */
  initialSection?: PrepWorkspaceSectionId
}

/**
 * Tabbed page over the five prep tools.
 *
 * @param props - See {@link PrepWorkspaceProps}.
 */
export function PrepWorkspace({ initialSection }: PrepWorkspaceProps) {
  const [section, setSection] = useHubSection(PREP_WORKSPACE_SECTIONS, SECTION_KEY, initialSection)
  const active = PREP_WORKSPACE_SECTIONS.find((entry) => entry.id === section) ?? PREP_WORKSPACE_SECTIONS[0]

  return (
    <div className="flex flex-col gap-4">
      <HubSectionNav
        sections={PREP_WORKSPACE_SECTIONS}
        active={section}
        onChange={setSection}
        label="Prep sections"
        showPanelCounts={false}
      />
      <HubSectionIntro section={active} />
      <HubSectionPanel id={section}>
        {section === "briefings" ? <PreRoundBriefingsPanel /> : null}
        {section === "strategy" ? <StrategyPanel /> : null}
        {section === "opponents" ? <OpponentTeamProfilesPanel /> : null}
        {section === "judges" ? <JudgeProfilesPanel /> : null}
        {section === "notes" ? <PrepNotesWithIdentity /> : null}
      </HubSectionPanel>
    </div>
  )
}

export default PrepWorkspace
