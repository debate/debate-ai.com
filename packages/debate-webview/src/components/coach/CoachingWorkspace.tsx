"use client"

/**
 * @fileoverview Coaching — the coach's tools on one tabbed page at
 * `/coaching`.
 *
 * The Coach Workspace, AI Coach Mode, Coaching Programs, the Team Calendar,
 * Coach Materials and the Laptop-less Debating guide used to be six separate
 * pages and sidebar entries (`/coaching`, `/coaching/ai-coach`,
 * `/coaching/programs`, `/coaching/calendar`, `/coaching/materials`,
 * `/coaching/laptopless`). They now sit side by side as
 * one tab each; the old addresses redirect here with `?section=` set to the
 * matching tab.
 *
 * The Coach Workspace tab is {@link CoachHub}, which keeps its own stage
 * strip (Flow, Coaching, Prep, Scouting, Practice) under `?stage=`. Links
 * from before this page had tabs put the stage in `?section=`
 * (`/coaching?section=practice`); those open the Coach Workspace tab on that
 * stage.
 *
 * Each panel still owns its store; this file is only navigation, built on
 * the same tab strip and `?section=` URL sync as Team Research
 * (`components/hubs/HubSectionNav.tsx`).
 *
 * @module components/coach/CoachingWorkspace
 */

import { useSearchParams } from "next/navigation"
import { Bot, CalendarCheck, CalendarDays, FolderOpen, Presentation, Smartphone, Trophy } from "lucide-react"
import { CoachingSessionsPanel } from "@debate-ai/practice-rounds"
import { CoachingProgramsPanel, TeamCalendarPanel } from "@debate-ai/team-collaboration"
import { CoachMaterialsPanel } from "@debate-ai/speech-writer"
import { TournamentsApp } from "@debate-ai/tournaments/ui"
import { panel, type HubSection } from "../hubs/hub-sections"
import { HubSectionIntro, HubSectionNav, HubSectionPanel, useHubSection } from "../hubs/HubSectionNav"
import { CoachingProgramRosterAnalyticsWithDrills } from "../../routes/coaching-programs/CoachingProgramRosterAnalyticsWithDrills"
import { CoachHub, isCoachStageId } from "./CoachHub"
import MobileSetupPage from "../../routes/coaching/laptopless/page"

/** localStorage key remembering the last open tab. */
const SECTION_KEY = "coachingSection"

/** One tab per tool. Also the `?section=` values the old routes redirect to. */
export type CoachingSectionId = "workspace" | "ai-coach" | "programs" | "calendar" | "materials" | "tournaments" | "laptopless"

/** Coaching's tabs, Coach Workspace first. */
export const COACHING_SECTIONS: readonly HubSection<CoachingSectionId>[] = [
  {
    id: "workspace",
    label: "Coach Workspace",
    icon: Presentation,
    description: "Every round and coaching panel, grouped by the stage of a round: flow, coaching, prep, scouting, and practice.",
    guide: "training-tools",
    panels: [panel("Coach Workspace")],
  },
  {
    id: "ai-coach",
    label: "AI Coach Mode",
    icon: Bot,
    description: "Extension, refutation, collapse, and weighing prompts generated from each round's flow.",
    guide: "training-tools",
    panels: [panel("AI Coach Mode")],
  },
  {
    id: "programs",
    label: "Coaching Programs",
    icon: CalendarCheck,
    description: "Group coaching spaces scoped to a squad roster, with roster analytics and drill reviews.",
    guide: "training-tools",
    panels: [panel("Coaching Programs")],
  },
  {
    id: "calendar",
    label: "Team Calendar",
    icon: CalendarDays,
    description: "Schedule research tasks, assignments, deadlines, and group-only virtual tournaments for each group you coach.",
    guide: "training-tools",
    panels: [panel("Team Calendar")],
  },
  {
    id: "materials",
    label: "Coach Materials",
    icon: FolderOpen,
    description: "Upload grounding materials for the team coach AI and preview which ones answer a question.",
    guide: "training-tools",
    panels: [panel("Coach Materials")],
  },
  {
    id: "laptopless",
    label: "Laptop-less Debating",
    icon: Smartphone,
    description: "Round-day setup for debating off just a phone: the recommended gear and a step-by-step prep, flow, and speaking guide.",
    guide: "training-tools",
    panels: [panel("Laptop-less Debating")],
  },
]

/**
 * The Coaching URL for one tab — where each old standalone route now points.
 *
 * @param section - The tab to open.
 */
export function coachingHref(section: CoachingSectionId): string {
  return section === "workspace" ? "/coaching" : `/coaching?section=${section}`
}

/** Props for {@link CoachingWorkspace}. */
export interface CoachingWorkspaceProps {
  /** Tab to open when the URL names none (the old route's tab, outside Next). */
  initialSection?: CoachingSectionId
}

/**
 * Tabbed page over the coaching tools.
 *
 * @param props - See {@link CoachingWorkspaceProps}.
 */
export function CoachingWorkspace({ initialSection }: CoachingWorkspaceProps) {
  const params = useSearchParams()
  // `/coaching?section=practice` and friends predate these tabs: they name a
  // Coach Workspace stage, so they open that tab.
  const legacyStage = isCoachStageId(params?.get("section"))
  const [section, setSection] = useHubSection(
    COACHING_SECTIONS,
    SECTION_KEY,
    legacyStage ? "workspace" : initialSection,
  )
  const active = COACHING_SECTIONS.find((entry) => entry.id === section) ?? COACHING_SECTIONS[0]

  return (
    <div className="flex flex-col gap-4">
      <HubSectionNav
        sections={COACHING_SECTIONS}
        active={section}
        onChange={setSection}
        label="Coaching sections"
        showPanelCounts={false}
      />
      {section === "workspace" ? null : <HubSectionIntro section={active} />}
      <HubSectionPanel id={section}>
        {section === "workspace" ? <CoachHub /> : null}
        {section === "ai-coach" ? <CoachingSessionsPanel /> : null}
        {section === "programs" ? (
          <>
            <CoachingProgramsPanel />
            <div className="border-t border-border pt-6">
              <CoachingProgramRosterAnalyticsWithDrills />
            </div>
          </>
        ) : null}
        {section === "calendar" ? <TeamCalendarPanel /> : null}
        {section === "materials" ? <CoachMaterialsPanel /> : null}
        {section === "laptopless" ? <MobileSetupPage embedded /> : null}
      </HubSectionPanel>
    </div>
  )
}

export default CoachingWorkspace
