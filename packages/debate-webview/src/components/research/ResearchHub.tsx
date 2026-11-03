"use client"

/**
 * @fileoverview Research hub — one tabbed app surface over every
 * crowdsourcing panel `debate-research-evidence`, `debate-community`, and
 * `debate-team-collaboration` ship.
 *
 * Each panel already reads (and writes) its own localStorage store, so this
 * is purely navigation: it groups the panels that describe the same stage of
 * a squad's research cycle and renders one group at a time. The individual
 * `/research/cards/*` routes still mount the same panels one at a time; this is the
 * view for working across them.
 *
 * Team Research (`/research/team`) used to be a second tabbed page beside
 * this one, with its own Topic Coverage, Prep Room, Review Queue, Task Inbox,
 * Contributions, Brainstorm and Debater Level tabs — the same panels this hub
 * already mounts. The two tab strips are now one: Debater Level is a tab
 * here, and `/research/team` plus the old `/research/cards/*` routes it
 * replaced redirect to the matching tab (`research-section-ids.ts`). Its
 * Practice Partners tab moved to the Prep Workspace (`/practice/prep`).
 *
 * Navigation chrome (the sticky tab strip, the per-section intro card with
 * a chip per panel and an "open as its own page" link, `?section=` URL
 * sync) comes from `components/hubs/HubSectionNav.tsx`; this file owns the
 * section list ({@link RESEARCH_SECTIONS}) and the workspace identity
 * fields.
 *
 * {@link TopicSprintPanel} used to be the one exception — it renders the
 * full `buildTopicSprint` composition rather than a single store, so this
 * hub used to hand-derive its inputs from the evidence library. The panel
 * now reads that composition itself from real persisted state
 * (`state/topicSprints.ts`'s `readPersistedTopicSprintInputs`), so this hub
 * only needs to give it a topic.
 *
 * The {@link SampleDataBar} on top fills the evidence library, tracked
 * arguments and contributions stores with sample data built from real corpus
 * cards (kept out of the account sync); the panels are remounted after a
 * load or clear so each one re-reads its store.
 */

import { useEffect, useMemo, useState } from "react"
import {
  Award,
  CheckSquare,
  FolderTree,
  Gauge,
  Inbox,
  Library,
  MessageSquareText,
  PieChart,
  Presentation,
  Star,
  Trophy,
  TrendingUp,
  UserRound,
} from "lucide-react"
import {
  ArgumentLibraryPanel,
  CardScoringPanel,
  EvidenceLibraryPanel,
  RevisionIncentivesPanel,
  TopicCoverageDashboardPanel,
  deriveContributorIdFromSessionIdentity,
} from "@debate-ai/research-evidence"
import { ContributorAwardsPanel, DebaterLevelPanel, QuestStreaksPanel } from "@debate-ai/community"
import { TopicSprintPanel } from "@debate-ai/team-collaboration"
import { useSession } from "../../lib/hooks/useSession"
import { TaskInboxWithIdentity } from "./identity/TaskInboxWithIdentity"
import { ContributionLeaderboardWithIdentity } from "./identity/ContributionLeaderboardWithIdentity"
import { ContributionsFeedWithIdentity } from "./identity/ContributionsFeedWithIdentity"
import { ProgressUnlocksWithIdentity } from "./identity/ProgressUnlocksWithIdentity"
import { ResearchProgressWithIdentity } from "./identity/ResearchProgressWithIdentity"
import { DailyQuestsWithIdentity } from "./identity/DailyQuestsWithIdentity"
import { ReviewQueueWithIdentity } from "./identity/ReviewQueueWithIdentity"
import { SprintNotesWithIdentity } from "./identity/SprintNotesWithIdentity"
import { BrainstormBoardWithIdentity } from "./identity/BrainstormBoardWithIdentity"
import { GroupChallengesWithIdentity } from "./identity/GroupChallengesWithIdentity"
import { PrepRoomWithIdentity } from "./identity/PrepRoomWithIdentity"
import { DailyBestCardWithIdentity } from "./identity/DailyBestCardWithIdentity"
import type { TrackedArgument } from "@debate-ai/research-evidence/src/lib/topic-coverage"
import type { EvidenceLibraryEntry } from "@debate-ai/research-evidence/src/lib/shared-evidence-library"
import { listEvidenceLibraryEntries } from "@debate-ai/research-evidence/src/state/evidenceLibraryEntries"
import type { ResearchSectionId } from "./research-section-ids"
import { useStoreSnapshot } from "../../ui/panels/use-store-snapshot"
import { Input } from "../../ui/primitives/input"
import { LabeledField } from "../../ui/panels/panel-shell"
import { panel, type HubSection } from "../hubs/hub-sections"
import { SampleDataBar } from "../hubs/SampleDataBar"
import {
  HubPanelAnchor,
  HubSectionIntro,
  HubSectionNav,
  HubSectionPanel,
  useHubSection,
} from "../hubs/HubSectionNav"

/** localStorage key holding whoever is using this browser. */
const CONTRIBUTOR_KEY = "researchHubContributorId"

/** localStorage key remembering the last open section. */
const SECTION_KEY = "researchHubSection"

/** The research cycle, one tab per stage — see the Research collaboration guide. */
export const RESEARCH_SECTIONS: readonly HubSection<ResearchSectionId>[] = [
  {
    id: "coverage",
    label: "Coverage",
    icon: PieChart,
    description: "Start here: which arguments are well-covered, thin, or missing, so the squad knows where to work.",
    guide: "research-collaboration",
    panels: [panel("Topic Coverage Dashboard")],
  },
  {
    id: "library",
    label: "Library",
    icon: FolderTree,
    description: "Browse shared research by topic folder, case area, and tag-based collection.",
    guide: "research-collaboration",
    panels: [panel("Argument Library", "/research/cards/argument-library")],
  },
  {
    id: "evidence",
    label: "Evidence",
    icon: Library,
    description: "Search every shared cut card and reusable analytic block by keyword, citation, or argument.",
    guide: "research-collaboration",
    panels: [panel("Evidence Library", "/research/cards/library")],
  },
  {
    id: "sprint",
    label: "Sprint",
    icon: Presentation,
    description: "Work a topic together: the prep room, the sprint composition, live prep notes, and the brainstorm board.",
    guide: "research-collaboration",
    panels: [
      panel("Collaboration Prep Room"),
      panel("Topic Sprint"),
      panel("Team Collaboration Mode", "/research/cards/collaboration"),
      panel("Team Brainstorm Assist"),
    ],
  },
  {
    id: "routing",
    label: "Routing",
    icon: Inbox,
    description: "Research tasks routed to contributors by skill level, grouped by topic, with peer verification.",
    guide: "research-collaboration",
    panels: [panel("Task Inbox")],
  },
  {
    id: "progress",
    label: "Progress",
    icon: Award,
    description: "Each contributor's history, task completion rate, and unlock tier.",
    guide: "research-collaboration",
    panels: [panel("Progress", "/research/cards/progress")],
  },
  {
    id: "research-progress",
    label: "Research Progress",
    icon: TrendingUp,
    description: "Each contributor's contribution history and per-topic task completion.",
    guide: "research-collaboration",
    panels: [panel("Research Progress", "/coaching/progress")],
  },
  {
    id: "quests",
    label: "Quests",
    icon: CheckSquare,
    description: "Daily team goals, quest streaks, and squad challenges that keep the sprint moving.",
    guide: "research-collaboration",
    panels: [
      panel("Daily Quests", "/research/cards/quests"),
      panel("Quest Streaks", "/research/cards/streaks"),
      panel("Group Challenges", "/research/cards/group-challenges"),
    ],
  },
  {
    id: "rewards",
    label: "Rewards",
    icon: Trophy,
    description: "Recognition for the work: the leaderboard, awards, the contributions feed, and revision rewards.",
    guide: "research-collaboration",
    panels: [
      panel("Contributor Awards", "/research/cards/awards"),
      panel("Contributions Feed"),
      panel("Daily Best Card", "/research/cards/best-card"),
      panel("Revision Incentives", "/research/cards/revisions"),
    ],
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    icon: Trophy,
    description: "Rank contributors by helpfulness score, tier, badges, and quest streak.",
    guide: "research-collaboration",
    panels: [panel("Leaderboard", "/coaching/leaderboard")],
  },
  {
    id: "review",
    label: "Review",
    icon: MessageSquareText,
    description: "Move submitted cards through peer review: comment, request changes, approve, publish.",
    guide: "research-collaboration",
    panels: [panel("Review Queue")],
  },
  {
    id: "scoring",
    label: "Scoring",
    icon: Gauge,
    description: "Score cards for relevance, clarity, uniqueness, evidence quality, and usability.",
    guide: "research-collaboration",
    panels: [panel("LLM Card Scoring", "/research/cards/scoring")],
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

/** Anchor ids by panel label, for wrapping each mounted panel. */
const ANCHORS = Object.fromEntries(
  RESEARCH_SECTIONS.flatMap((section) => section.panels.map((item) => [item.label, item.anchor])),
) as Record<string, string>

/** Props for {@link ResearchHub}. */
export interface ResearchHubProps {
  /** Tab to open when the URL names none (an old route's tab, outside Next). */
  initialSection?: ResearchSectionId
}

/**
 * Tabbed hub over every research/crowdsourcing panel.
 *
 * @param props - See {@link ResearchHubProps}.
 * @returns The research hub element.
 */
export function ResearchHub({ initialSection }: ResearchHubProps = {}) {
  const [section, setSection] = useHubSection(RESEARCH_SECTIONS, SECTION_KEY, initialSection)
  const [contributorId, setContributorId] = useState("me")
  const [hasSetContributorId, setHasSetContributorId] = useState(false)
  const [topic, setTopic] = useState("")
  const [sampleVersion, setSampleVersion] = useState(0)
  const { user } = useSession()

  useEffect(() => {
    const saved = typeof localStorage === "undefined" ? null : localStorage.getItem(CONTRIBUTOR_KEY)
    if (saved) {
      setContributorId(saved)
      setHasSetContributorId(true)
    }
  }, [])

  // Prefills from the real signed-in session (see TaskInboxWithIdentity.tsx
  // for the pattern this mirrors) — never overwrites a saved/typed value.
  useEffect(() => {
    if (hasSetContributorId) return
    const signedInContributorId = deriveContributorIdFromSessionIdentity(user)
    if (signedInContributorId) setContributorId(signedInContributorId)
  }, [user, hasSetContributorId])

  const updateContributorId = (value: string) => {
    setContributorId(value)
    setHasSetContributorId(true)
    if (typeof localStorage !== "undefined") localStorage.setItem(CONTRIBUTOR_KEY, value)
  }

  const { data: entries, refresh: refreshEntries } = useStoreSnapshot<EvidenceLibraryEntry[]>(listEvidenceLibraryEntries, [])

  // Only used to guess a sensible default topic below — the evidence
  // library's own argBlock/caseArea tagging, not a card corpus for scoring.
  const trackedArguments = useMemo<TrackedArgument[]>(() => {
    const seen = new Map<string, TrackedArgument>()
    for (const entry of entries) {
      if (!seen.has(entry.argBlock)) {
        seen.set(entry.argBlock, { argBlock: entry.argBlock, category: entry.caseArea })
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.argBlock.localeCompare(b.argBlock))
  }, [entries])

  const activeTopic = topic.trim() || trackedArguments[0]?.category || "Untagged"
  const active = RESEARCH_SECTIONS.find((entry) => entry.id === section) ?? RESEARCH_SECTIONS[0]

  return (
    <div className="flex flex-col gap-4">
      <SampleDataBar
        workspace="research"
        onChange={() => {
          setSampleVersion((v) => v + 1)
          refreshEntries()
        }}
      />
      <HubSectionNav sections={RESEARCH_SECTIONS} active={section} onChange={setSection} label="Research sections" />

      <section
        aria-label="Workspace identity"
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:flex-row sm:items-start"
      >
        <span
          aria-hidden="true"
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground sm:flex"
        >
          <UserRound className="h-5 w-5" />
        </span>
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <LabeledField
            label="Your contributor id"
            hint={
              hasSetContributorId
                ? "Every panel below attributes submissions, tasks, and quests to this id."
                : "Prefilled from your signed-in account, if any — edit it to use a different id."
            }
          >
            <Input value={contributorId} onChange={(e) => updateContributorId(e.target.value)} />
          </LabeledField>
          <LabeledField label="Topic" hint="Scopes the Sprint section's composition; defaults to the first tagged case area.">
            <Input value={topic} placeholder={activeTopic} onChange={(e) => setTopic(e.target.value)} />
          </LabeledField>
        </div>
      </section>

      <HubSectionIntro section={active} />

      <HubSectionPanel key={sampleVersion} id={section}>
        {section === "coverage" ? (
          <HubPanelAnchor anchor={ANCHORS["Topic Coverage Dashboard"]}>
            <TopicCoverageDashboardPanel />
          </HubPanelAnchor>
        ) : null}

        {section === "library" ? (
          <HubPanelAnchor anchor={ANCHORS["Argument Library"]}>
            <ArgumentLibraryPanel />
          </HubPanelAnchor>
        ) : null}

        {section === "evidence" ? (
          <HubPanelAnchor anchor={ANCHORS["Evidence Library"]}>
            <EvidenceLibraryPanel />
          </HubPanelAnchor>
        ) : null}

        {section === "sprint" ? (
          <>
            <HubPanelAnchor anchor={ANCHORS["Collaboration Prep Room"]}>
              <PrepRoomWithIdentity />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Topic Sprint"]}>
              <TopicSprintPanel topic={activeTopic} authorId={contributorId} />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Team Collaboration Mode"]}>
              <SprintNotesWithIdentity />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Team Brainstorm Assist"]}>
              <BrainstormBoardWithIdentity />
            </HubPanelAnchor>
          </>
        ) : null}

        {section === "routing" ? (
          <HubPanelAnchor anchor={ANCHORS["Task Inbox"]}>
            <TaskInboxWithIdentity />
          </HubPanelAnchor>
        ) : null}

        {section === "progress" ? (
          <>
            <HubPanelAnchor anchor={ANCHORS["Progress"]}>
              <ProgressUnlocksWithIdentity />
            </HubPanelAnchor>
          </>
        ) : null}

        {section === "research-progress" ? (
          <HubPanelAnchor anchor={ANCHORS["Research Progress"]}>
            <ResearchProgressWithIdentity />
          </HubPanelAnchor>
        ) : null}

        {section === "quests" ? (
          <>
            <HubPanelAnchor anchor={ANCHORS["Daily Quests"]}>
              <DailyQuestsWithIdentity />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Quest Streaks"]}>
              <QuestStreaksPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Group Challenges"]}>
              <GroupChallengesWithIdentity />
            </HubPanelAnchor>
          </>
        ) : null}

        {section === "rewards" ? (
          <>
            <HubPanelAnchor anchor={ANCHORS["Contributor Awards"]}>
              <ContributorAwardsPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Contributions Feed"]}>
              <ContributionsFeedWithIdentity />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Daily Best Card"]}>
              <DailyBestCardWithIdentity />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Revision Incentives"]}>
              <RevisionIncentivesPanel />
            </HubPanelAnchor>
          </>
        ) : null}

        {section === "leaderboard" ? (
          <HubPanelAnchor anchor={ANCHORS["Leaderboard"]}>
            <ContributionLeaderboardWithIdentity />
          </HubPanelAnchor>
        ) : null}

        {section === "review" ? (
          <HubPanelAnchor anchor={ANCHORS["Review Queue"]}>
            <ReviewQueueWithIdentity />
          </HubPanelAnchor>
        ) : null}

        {section === "scoring" ? (
          <HubPanelAnchor anchor={ANCHORS["LLM Card Scoring"]}>
            <CardScoringPanel />
          </HubPanelAnchor>
        ) : null}

        {section === "level" ? (
          <HubPanelAnchor anchor={ANCHORS["Debater Level"]}>
            <DebaterLevelPanel />
          </HubPanelAnchor>
        ) : null}
      </HubSectionPanel>
    </div>
  )
}
