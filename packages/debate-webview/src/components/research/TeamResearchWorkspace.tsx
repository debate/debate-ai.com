"use client"

/**
 * @fileoverview Team Research — six squad research tools on one tabbed page
 * at `/research/team`, part of the Research Workspace.
 *
 * Topic Coverage, the Collaboration Prep Room, the Review Queue, the Task
 * Inbox, the Contributions Feed and Team Brainstorm Assist used to be six
 * separate pages (`/research/cards/coverage`, `/research/cards/prep-room`,
 * `/research/cards/reviews`, `/research/cards/inbox`,
 * `/research/cards/contributions`, `/research/cards/brainstorm`). They are
 * the day-to-day loop of a squad's research sprint — find the gaps, work the
 * topic, route the tasks, review and recognize the cards — so they now sit
 * side by side as one tab each. Those old addresses redirect here with
 * `?section=` set to the matching tab. Debater Level (once `/practice/level`
 * under Insights) is the last tab, so a squad sees its XP beside its work.
 *
 * Each panel still owns its store; this file is only navigation, built on
 * the same tab strip and `?section=` URL sync as the Research, Coach and Prep
 * workspaces (`components/hubs/HubSectionNav.tsx`).
 *
 * @module components/research/TeamResearchWorkspace
 */

import { Inbox, Lightbulb, MessageSquareText, PieChart, Presentation, Star, ThumbsUp } from "lucide-react"
import { DebaterLevelPanel } from "@debate-ai/community"
import { TopicCoverageDashboardPanel } from "@debate-ai/research-evidence"
import { panel, type HubSection } from "../hubs/hub-sections"
import { HubSectionIntro, HubSectionNav, HubSectionPanel, useHubSection } from "../hubs/HubSectionNav"
import { BrainstormBoardWithIdentity } from "./identity/BrainstormBoardWithIdentity"
import { ContributionsFeedWithIdentity } from "./identity/ContributionsFeedWithIdentity"
import { PrepRoomWithIdentity } from "./identity/PrepRoomWithIdentity"
import { ReviewQueueWithIdentity } from "./identity/ReviewQueueWithIdentity"
import { TaskInboxWithIdentity } from "./identity/TaskInboxWithIdentity"

/** localStorage key remembering the last open tab. */
const SECTION_KEY = "teamResearchSection"

/** One tab per tool. Also the `?section=` values the old routes redirect to. */
export type TeamResearchSectionId = "coverage" | "prep-room" | "reviews" | "inbox" | "contributions" | "brainstorm" | "level"

/** Team Research's tabs, in the order a squad works a topic. */
export const TEAM_RESEARCH_SECTIONS: readonly HubSection<TeamResearchSectionId>[] = [
  {
    id: "coverage",
    label: "Topic Coverage",
    icon: PieChart,
    description: "Which arguments are well-covered, thin, or missing, so the squad knows where to work.",
    guide: "research-collaboration",
    panels: [panel("Topic Coverage Dashboard")],
  },
  {
    id: "prep-room",
    label: "Prep Room",
    icon: Presentation,
    description: "A topic's shared prep space: its evidence, draft blocks, and routed research tasks.",
    guide: "research-collaboration",
    panels: [panel("Collaboration Prep Room")],
  },
  {
    id: "reviews",
    label: "Review Queue",
    icon: MessageSquareText,
    description: "Move a submitted card through peer review: comment, request changes, approve, and publish.",
    guide: "research-collaboration",
    panels: [panel("Review Queue")],
  },
  {
    id: "inbox",
    label: "Task Inbox",
    icon: Inbox,
    description: "Research tasks routed to contributors by skill level, grouped by topic, with peer verification.",
    guide: "research-collaboration",
    panels: [panel("Task Inbox")],
  },
  {
    id: "contributions",
    label: "Contributions",
    icon: ThumbsUp,
    description: "Submit, like, save, and endorse the community's cards, summaries, highlights, and annotations.",
    guide: "research-collaboration",
    panels: [panel("Contributions Feed")],
  },
  {
    id: "brainstorm",
    label: "Brainstorm",
    icon: Lightbulb,
    description: "Submit and upvote squad ideas for an argument block, grouped into boards by category.",
    guide: "research-collaboration",
    panels: [panel("Team Brainstorm Assist")],
  },
  {
    id: "level",
    label: "Debater Level",
    icon: Star,
    description: "Level up like a video game: earn XP for cutting cards, redoing rebuttals, and practice rounds.",
    guide: "research-collaboration",
    panels: [panel("Debater Level")],
  },
]

/**
 * The Team Research URL for one tab — where each old standalone route now
 * points.
 *
 * @param section - The tab to open.
 */
export function teamResearchHref(section: TeamResearchSectionId): string {
  return `/research/team?section=${section}`
}

/** Props for {@link TeamResearchWorkspace}. */
export interface TeamResearchWorkspaceProps {
  /** Tab to open when the URL names none (the old route's tab, outside Next). */
  initialSection?: TeamResearchSectionId
}

/**
 * Tabbed page over the squad research tools.
 *
 * @param props - See {@link TeamResearchWorkspaceProps}.
 */
export function TeamResearchWorkspace({ initialSection }: TeamResearchWorkspaceProps) {
  const [section, setSection] = useHubSection(TEAM_RESEARCH_SECTIONS, SECTION_KEY, initialSection)
  const active = TEAM_RESEARCH_SECTIONS.find((entry) => entry.id === section) ?? TEAM_RESEARCH_SECTIONS[0]

  return (
    <div className="flex flex-col gap-4">
      <HubSectionNav
        sections={TEAM_RESEARCH_SECTIONS}
        active={section}
        onChange={setSection}
        label="Team research sections"
        showPanelCounts={false}
      />
      <HubSectionIntro section={active} />
      <HubSectionPanel id={section}>
        {section === "coverage" ? <TopicCoverageDashboardPanel /> : null}
        {section === "prep-room" ? <PrepRoomWithIdentity /> : null}
        {section === "reviews" ? <ReviewQueueWithIdentity /> : null}
        {section === "inbox" ? <TaskInboxWithIdentity /> : null}
        {section === "contributions" ? <ContributionsFeedWithIdentity /> : null}
        {section === "brainstorm" ? <BrainstormBoardWithIdentity /> : null}
        {section === "level" ? <DebaterLevelPanel /> : null}
      </HubSectionPanel>
    </div>
  )
}

export default TeamResearchWorkspace
