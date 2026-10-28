"use client"

/**
 * @fileoverview Prep Workspace — the pre-round prep tools, Practice Partners
 * and Practice Drills on one tabbed page at `/practice/prep`.
 *
 * Pre-Round Briefings, Scout-to-Strategy, Opponent Team Profiles, Judge
 * Profiles and Prep Notes used to be five separate pages
 * (`/practice/briefings`, `/practice/strategy`, `/practice/opponents`,
 * `/practice/judges`, `/practice/prep-notes`). They read each other's data —
 * a briefing and the strategy ranking both pull from the opponent and judge
 * profiles — so they now sit side by side as one tab each. Those old
 * addresses redirect here with `?section=` set to the matching tab.
 *
 * Practice Partners (`/practice/partners`, with the Judge Pool below it) and
 * Practice Drills (`/practice/drills`) joined later as two more tabs, so
 * getting ready for a round and practising for it are one sidebar entry.
 * Their old addresses redirect the same way.
 *
 * Each panel still owns its store; this file is only navigation, built on
 * the same tab strip and `?section=` URL sync as the Coach and Research hubs
 * (`components/hubs/HubSectionNav.tsx`).
 *
 * @module components/practice/PrepWorkspace
 */

import { BarChart3, ClipboardList, Crosshair, Gavel, Handshake, NotebookPen, Repeat, Users } from "lucide-react"
import { DrillSetsPanel, JudgePoolPanel, PracticePartnersPanel, RoundToolsCrossLinks } from "@debate-ai/practice-rounds"
import { DebaterStatsPanel, OpponentTeamProfilesPanel, PreRoundBriefingsPanel, StrategyPanel } from "@debate-ai/round"
import { JudgeProfilesPanel } from "@debate-ai/speech-writer"
import { PrepNotesWithIdentity } from "../research/identity/PrepNotesWithIdentity"
import { panel, type HubSection } from "../hubs/hub-sections"
import { HubSectionIntro, HubSectionNav, HubSectionPanel, useHubSection } from "../hubs/HubSectionNav"

/** localStorage key remembering the last open tab. */
const SECTION_KEY = "prepWorkspaceSection"

/** One tab per tool. Also the `?section=` values the old routes redirect to. */
export type PrepWorkspaceSectionId = "briefings" | "strategy" | "opponents" | "judges" | "notes" | "stats" | "partners" | "drills"

/**
 * The Prep Workspace's tabs, in the order a team works through them before a
 * round, then the two practice tools.
 */
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
  {
    id: "stats",
    label: "Debater Stats",
    icon: BarChart3,
    description: "Win rate, Aff/Neg split, division and argument breakdowns and recent form from the rounds you've logged.",
    guide: "training-tools",
    panels: [panel("Debater Stats")],
  },
  {
    id: "partners",
    label: "Practice Partners",
    icon: Handshake,
    description: "Challenge other debaters to a virtual practice round, or volunteer to debate or judge. Judges list themselves for hire in the Judge Pool below.",
    guide: "practice-tools",
    panels: [panel("Practice Partners"), panel("Judge Pool")],
  },
  {
    id: "drills",
    label: "Practice Drills",
    icon: Repeat,
    description: "Overview, frontline, cross-ex and collapse drills generated from each round's flow.",
    guide: "training-tools",
    panels: [panel("Practice Drills")],
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
 * Tabbed page over the prep tools, Practice Partners and Practice Drills.
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
        {section === "stats" ? <DebaterStatsPanel /> : null}
        {section === "partners" ? (
          <>
            <PracticePartnersPanel />
            <JudgePoolPanel className="mt-4" />
          </>
        ) : null}
        {section === "drills" ? (
          <div className="flex flex-col gap-4">
            <RoundToolsCrossLinks currentHref={prepWorkspaceHref("drills")} />
            <DrillSetsPanel />
          </div>
        ) : null}
      </HubSectionPanel>
    </div>
  )
}

export default PrepWorkspace
