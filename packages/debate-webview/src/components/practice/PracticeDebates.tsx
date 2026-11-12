"use client"

/**
 * @fileoverview Practice Debates — Online Challenges, Practice Drills and
 * Practice Partners on one tabbed page at `/practice/debates`, behind one
 * sidebar row in the Practice Debates section (formerly Coaching).
 *
 * The three used to be separate pages in a Practice section of their own.
 * They are all "practice against someone", so they now sit side by side as
 * one tab each. The old `/practice/challenges`, `/practice/drills` and
 * `/practice/partners` addresses redirect to their tab
 * (`?section=challenges|drills|partners`); a `#judge` fragment on the old
 * partners link survives the redirect.
 *
 * Navigation only, on the same tab strip and `?section=` URL sync as News &
 * Forums (`components/news/NewsAndForums.tsx`).
 *
 * @module components/practice/PracticeDebates
 */

import { Award, Dumbbell, Handshake } from "lucide-react"
import {
  ChallengesPanel,
  DrillSetsPanel,
  JudgePoolPanel,
  PracticePartnersPanel,
  RoundToolsCrossLinks,
} from "@debate-ai/practice-rounds"
import { panel, type HubSection } from "../hubs/hub-sections"
import { HubSectionIntro, HubSectionNav, HubSectionPanel, useHubSection } from "../hubs/HubSectionNav"
import { PRACTICE_DEBATES_HREF, type PracticeDebatesSectionId } from "./practice-debates-sections"

/** localStorage key remembering the last open tab. */
const SECTION_KEY = "practiceDebatesSection"

/** The page's tabs, in sidebar order. Also the `?section=` values. */
export const PRACTICE_DEBATES_SECTIONS: readonly HubSection<PracticeDebatesSectionId>[] = [
  {
    id: "challenges",
    label: "Online Challenges",
    icon: Award,
    description:
      "Challenge another player or the AI to a written debate on any resolution, in any format, and earn XP, win-streak boosts and trophies.",
    guide: "practice-tools",
    panels: [panel("Online Challenges")],
  },
  {
    id: "drills",
    label: "Practice Drills",
    icon: Dumbbell,
    description: "Overview, frontline, cross-ex and collapse drills generated from each round's flow.",
    guide: "training-tools",
    panels: [panel("Practice Drills")],
  },
  {
    id: "partners",
    label: "Practice Partners",
    icon: Handshake,
    description:
      "Challenge other debaters to a virtual practice round, volunteer to debate, judge or coach, and hire judges from the Judge Pool.",
    guide: "practice-tools",
    panels: [panel("Practice Partners"), panel("Judge Pool")],
  },
]

/** Props for {@link PracticeDebates}. */
export interface PracticeDebatesProps {
  /** Tab to open when the URL names none (an old route's tab, outside Next). */
  initialSection?: PracticeDebatesSectionId
}

/**
 * Tabbed page over Online Challenges, Practice Drills and Practice Partners.
 *
 * @param props - See {@link PracticeDebatesProps}.
 */
export function PracticeDebates({ initialSection }: PracticeDebatesProps) {
  const [section, setSection] = useHubSection(PRACTICE_DEBATES_SECTIONS, SECTION_KEY, initialSection)
  const active = PRACTICE_DEBATES_SECTIONS.find((entry) => entry.id === section) ?? PRACTICE_DEBATES_SECTIONS[0]

  return (
    <div className="flex flex-col gap-4">
      <HubSectionNav
        sections={PRACTICE_DEBATES_SECTIONS}
        active={section}
        onChange={setSection}
        label="Practice debates"
        showPanelCounts={false}
      />
      <HubSectionIntro section={active} />
      <HubSectionPanel id={section}>
        {section === "challenges" ? <ChallengesPanel /> : null}
        {section === "drills" ? (
          <div className="flex flex-col gap-4">
            <RoundToolsCrossLinks currentHref="/practice/drills" />
            <DrillSetsPanel />
          </div>
        ) : null}
        {section === "partners" ? (
          <div>
            <PracticePartnersPanel />
            <JudgePoolPanel className="mt-4" />
          </div>
        ) : null}
      </HubSectionPanel>
    </div>
  )
}

export { PRACTICE_DEBATES_HREF }
export default PracticeDebates
