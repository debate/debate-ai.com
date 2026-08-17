"use client"

/**
 * @fileoverview Research hub — the app surface for the crowdsourcing panels.
 *
 * Every panel here reads the same locally persisted squad data: the shared
 * evidence library supplies the cards a coverage report is computed from, the
 * contribution store supplies the leaderboard/awards/rating inputs, and the
 * availability profiles supply the routing. Sections that need data nothing
 * has produced yet render their own empty states rather than sample data.
 */

import { useEffect, useMemo, useState } from "react"
import {
  ArgumentLibraryPanel,
  BrainstormBoardPanel,
  CardScoringPanel,
  CommunityRatingPanel,
  ContributionLeaderboardPanel,
  DailyBestCardPanel,
  DailyQuestBoardPanel,
  EvidenceLibraryPanel,
  GroupChallengePanel,
  PeerReviewPanel,
  PrepRoomPanel,
  ProgressUnlocksPanel,
  QuestStreakPanel,
  ResearchProgressPanel,
  RevisionIncentivesPanel,
  TaskRoutingPanel,
  TopContributorAwardsPanel,
  TopicCoverageDashboard,
  TopicSprintPanel,
} from "debate-card-search"
import { buildUnderCoveredArgumentQuests } from "debate-card-search/src/lib/daily-quests"
import { buildRoutingResult } from "debate-card-search/src/lib/research-task-routing"
import {
  buildTopicCoverageReport,
  type CoverageCardSummary,
  type TrackedArgument,
} from "debate-card-search/src/lib/topic-coverage"
import type { ContributorAvailability } from "debate-card-search/src/lib/research-task-routing"
import type { EvidenceLibraryEntry } from "debate-card-search/src/lib/shared-evidence-library"
import type { TrackedTopicAssignment } from "debate-card-search/src/lib/research-progress"
import type { ScoredCard } from "debate-card-search/src/lib/llm-card-scoring"
import { listEvidenceLibraryEntries } from "debate-card-search/src/state/evidenceLibraryEntries"
import { listContributorAvailability } from "debate-card-search/src/state/contributorAvailability"
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
  const [topic, setTopic] = useState("")

  useEffect(() => {
    const saved = typeof localStorage === "undefined" ? null : localStorage.getItem(CONTRIBUTOR_KEY)
    if (saved) setContributorId(saved)
  }, [])

  const updateContributorId = (value: string) => {
    setContributorId(value)
    if (typeof localStorage !== "undefined") localStorage.setItem(CONTRIBUTOR_KEY, value)
  }

  const { data: entries } = useStoreSnapshot<EvidenceLibraryEntry[]>(
    listEvidenceLibraryEntries,
    [],
  )
  const { data: contributors } = useStoreSnapshot<ContributorAvailability[]>(
    listContributorAvailability,
    [],
  )

  // The evidence library doubles as the card corpus every research slice
  // reasons over: each entry already carries an argBlock and a word count.
  const cards = useMemo<CoverageCardSummary[]>(
    () => entries.map((entry) => ({ id: entry.id, argBlock: entry.argBlock, wordCount: entry.wordCount })),
    [entries],
  )

  const trackedArguments = useMemo<TrackedArgument[]>(() => {
    const seen = new Map<string, TrackedArgument>()
    for (const entry of entries) {
      if (!seen.has(entry.argBlock)) {
        seen.set(entry.argBlock, { argBlock: entry.argBlock, category: entry.caseArea })
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.argBlock.localeCompare(b.argBlock))
  }, [entries])

  const coverageReport = useMemo(
    () => buildTopicCoverageReport(trackedArguments, cards),
    [trackedArguments, cards],
  )

  const coverageQuests = useMemo(
    () => buildUnderCoveredArgumentQuests(coverageReport),
    [coverageReport],
  )

  // Routing turns the coverage gaps into per-contributor assignments, which is
  // exactly the shape the progress board tracks completion against.
  const assignments = useMemo<TrackedTopicAssignment[]>(() => {
    const routing = buildRoutingResult(coverageReport, contributors)
    return routing.assignments.map((assignment) => ({
      topic: topic.trim() || assignment.task.category || assignment.task.argBlock,
      assignment,
    }))
  }, [coverageReport, contributors, topic])

  const scoredCards = useMemo<ScoredCard[]>(
    () =>
      entries.map((entry) => ({
        id: entry.id,
        text: entry.text,
        argBlockKeywords: entry.argBlock.split(/\s+/).filter(Boolean),
        qualitySignals: [],
      })),
    [entries],
  )

  const activeTopic = topic.trim() || trackedArguments[0]?.category || "Untagged"

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <LabeledField label="Your contributor id">
          <Input value={contributorId} onChange={(e) => updateContributorId(e.target.value)} />
        </LabeledField>
        <LabeledField label="Topic" hint="Scopes the prep room and sprint.">
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

      {section === "Coverage" ? (
        <TopicCoverageDashboard trackedArguments={trackedArguments} cards={cards} />
      ) : null}

      {section === "Library" ? (
        <ArgumentLibraryPanel cards={entries} />
      ) : null}

      {section === "Evidence" ? <EvidenceLibraryPanel /> : null}

      {section === "Sprint" ? (
        <div className="flex flex-col gap-4">
          <PrepRoomPanel topic={activeTopic} coverageReport={coverageReport} />
          <TopicSprintPanel
            topic={activeTopic}
            quests={coverageQuests}
            contributions={[]}
            coverageReport={coverageReport}
            assignments={assignments}
            authorId={contributorId}
          />
          <BrainstormBoardPanel coverageReport={coverageReport} contributorId={contributorId} />
        </div>
      ) : null}

      {section === "Routing" ? <TaskRoutingPanel coverageReport={coverageReport} /> : null}

      {section === "Progress" ? (
        <div className="flex flex-col gap-4">
          <ResearchProgressPanel assignments={assignments} />
          <ProgressUnlocksPanel contributorId={contributorId} />
        </div>
      ) : null}

      {section === "Quests" ? (
        <div className="flex flex-col gap-4">
          <DailyQuestBoardPanel
            quests={coverageQuests}
            contributions={[]}
            coverageReport={coverageReport}
          />
          <QuestStreakPanel contributorId={contributorId} missionResults={[]} />
          <GroupChallengePanel contributions={[]} />
        </div>
      ) : null}

      {section === "Rewards" ? (
        <div className="flex flex-col gap-4">
          <ContributionLeaderboardPanel highlightContributorId={contributorId} />
          <TopContributorAwardsPanel />
          <CommunityRatingPanel />
          <DailyBestCardPanel contributions={[]} />
          <RevisionIncentivesPanel />
        </div>
      ) : null}

      {section === "Review" ? <PeerReviewPanel reviewerId={contributorId} /> : null}

      {section === "Scoring" ? <CardScoringPanel cards={scoredCards} /> : null}
    </div>
  )
}
