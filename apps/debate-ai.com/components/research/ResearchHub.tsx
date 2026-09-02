"use client"

/**
 * @fileoverview Research hub — one tabbed app surface over every
 * crowdsourcing panel `debate-card-search` ships.
 *
 * Each panel already reads (and writes) its own localStorage store, so this
 * is purely navigation: it groups the panels that describe the same stage of
 * a squad's research cycle and renders one group at a time. The individual
 * `/cards/*` routes still mount the same panels one at a time; this is the
 * view for working across them.
 *
 * {@link TopicSprintPanel} used to be the one exception — it renders the
 * full `buildTopicSprint` composition rather than a single store, so this
 * hub used to hand-derive its inputs from the evidence library. The panel
 * now reads that composition itself from real persisted state
 * (`state/topicSprints.ts`'s `readPersistedTopicSprintInputs`), so this hub
 * only needs to give it a topic.
 */

import { useEffect, useMemo, useState } from "react"
import {
  ArgumentLibraryPanel,
  CardScoringPanel,
  ContributionsFeedPanel,
  ContributorAwardsPanel,
  EvidenceLibraryPanel,
  QuestStreaksPanel,
  RevisionIncentivesPanel,
  TopicCoverageDashboardPanel,
  TopicSprintPanel,
  deriveContributorIdFromSessionIdentity,
} from "debate-card-search"
import { useSession } from "@/lib/hooks/useSession"
import { TaskInboxWithIdentity } from "./TaskInboxWithIdentity"
import { ContributionLeaderboardWithIdentity } from "./ContributionLeaderboardWithIdentity"
import { ProgressUnlocksWithIdentity } from "./ProgressUnlocksWithIdentity"
import { ResearchProgressWithIdentity } from "./ResearchProgressWithIdentity"
import { DailyQuestsWithIdentity } from "./DailyQuestsWithIdentity"
import { ReviewQueueWithIdentity } from "./ReviewQueueWithIdentity"
import { SprintNotesWithIdentity } from "./SprintNotesWithIdentity"
import { BrainstormBoardWithIdentity } from "./BrainstormBoardWithIdentity"
import { GroupChallengesWithIdentity } from "./GroupChallengesWithIdentity"
import { PrepRoomWithIdentity } from "./PrepRoomWithIdentity"
import { DailyBestCardWithIdentity } from "./DailyBestCardWithIdentity"
import type { TrackedArgument } from "debate-card-search/src/lib/topic-coverage"
import type { EvidenceLibraryEntry } from "debate-card-search/src/lib/shared-evidence-library"
import { listEvidenceLibraryEntries } from "debate-card-search/src/state/evidenceLibraryEntries"
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot"
import { Input } from "debate-ui/src/primitives/input"
import { LabeledField } from "debate-ui/src/panels/panel-shell"

/** localStorage key holding whoever is using this browser. */
const CONTRIBUTOR_KEY = "researchHubContributorId"

const SECTIONS = [
  "Coverage",
  "Library",
  "Evidence",
  "Sprint",
  "Routing",
  "Progress",
  "Quests",
  "Rewards",
  "Review",
  "Scoring",
] as const

type Section = (typeof SECTIONS)[number]

/**
 * Tabbed hub over every research/crowdsourcing panel.
 *
 * @returns The research hub element.
 */
export function ResearchHub() {
  const [section, setSection] = useState<Section>("Coverage")
  const [contributorId, setContributorId] = useState("me")
  const [hasSetContributorId, setHasSetContributorId] = useState(false)
  const [topic, setTopic] = useState("")
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

  const { data: entries } = useStoreSnapshot<EvidenceLibraryEntry[]>(
    listEvidenceLibraryEntries,
    [],
  )

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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <LabeledField
          label="Your contributor id"
          hint={
            hasSetContributorId
              ? undefined
              : "Prefilled from your signed-in account, if any — edit it to use a different id."
          }
        >
          <Input value={contributorId} onChange={(e) => updateContributorId(e.target.value)} />
        </LabeledField>
        <LabeledField label="Topic" hint="Scopes the sprint composition.">
          <Input
            value={topic}
            placeholder={activeTopic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </LabeledField>
      </div>

      <nav className="flex flex-wrap gap-1" aria-label="Research sections">
        {SECTIONS.map((name) => (
          <button
            key={name}
            type="button"
            aria-current={section === name}
            onClick={() => setSection(name)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              section === name
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted"
            }`}
          >
            {name}
          </button>
        ))}
      </nav>

      {section === "Coverage" ? <TopicCoverageDashboardPanel /> : null}

      {section === "Library" ? <ArgumentLibraryPanel /> : null}

      {section === "Evidence" ? <EvidenceLibraryPanel /> : null}

      {section === "Sprint" ? (
        <div className="flex flex-col gap-4">
          <PrepRoomWithIdentity />
          <TopicSprintPanel topic={activeTopic} authorId={contributorId} />
          <SprintNotesWithIdentity />
          <BrainstormBoardWithIdentity />
        </div>
      ) : null}

      {section === "Routing" ? <TaskInboxWithIdentity /> : null}

      {section === "Progress" ? (
        <div className="flex flex-col gap-4">
          <ResearchProgressWithIdentity />
          <ProgressUnlocksWithIdentity />
        </div>
      ) : null}

      {section === "Quests" ? (
        <div className="flex flex-col gap-4">
          <DailyQuestsWithIdentity />
          <QuestStreaksPanel />
          <GroupChallengesWithIdentity />
        </div>
      ) : null}

      {section === "Rewards" ? (
        <div className="flex flex-col gap-4">
          <ContributionLeaderboardWithIdentity />
          <ContributorAwardsPanel />
          <ContributionsFeedPanel />
          <DailyBestCardWithIdentity />
          <RevisionIncentivesPanel />
        </div>
      ) : null}

      {section === "Review" ? <ReviewQueueWithIdentity /> : null}

      {section === "Scoring" ? <CardScoringPanel /> : null}
    </div>
  )
}
