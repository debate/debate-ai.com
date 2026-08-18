/**
 * @fileoverview Daily Quests panel — the "(b) a quest-board widget UI"
 * follow-up named under the "🎯 Daily Quests and Targets" bullet in
 * TODO.md ("Set team goals like 'find 5 solvency cards' or 'add 3 frontline
 * answers today'").
 *
 * Renders today's quest board via `state/dailyQuests.ts`'s
 * `buildPersistedDailyQuestBoard` (itself composed directly against the
 * real, persisted `state/contributions.ts` feed), lets a team add a custom
 * quest target, and lets a team seed quests straight from a topic's
 * under-covered arguments via `seedQuestTemplatesFromTopicCoverage` —
 * reusing the existing Topic Coverage Dashboard's coverage report rather
 * than introducing a separate under-coverage signal.
 *
 * @module panels/DailyQuestsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import {
  buildPersistedDailyQuestBoard,
  deleteQuestTemplate,
  listQuestTemplates,
  saveQuestTemplate,
  seedQuestTemplatesFromTopicCoverage,
} from "../state/dailyQuests"
import {
  buildPersistedContributorQuestStreak,
  computeAndSavePersistedDailyMissionResult,
} from "../state/dailyMissionResults"
import { buildQuestBoardSummaryText } from "../lib/daily-quests"
import type { QuestProgress, QuestTemplate } from "../lib/daily-quests"
import { buildStreakRewardText } from "../lib/gamified-quests"
import type { ContributorQuestStreak } from "../lib/gamified-quests"
import type { ContributionKind } from "../lib/community-rating"

const KIND_OPTIONS: { value: ContributionKind; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "summary", label: "Summary" },
  { value: "highlight", label: "Highlight" },
  { value: "annotation", label: "Annotation" },
]

type QuestDraft = { description: string; kind: ContributionKind; argBlock: string; targetCount: string }

const EMPTY_DRAFT: QuestDraft = { description: "", kind: "card", argBlock: "", targetCount: "3" }

/** Today's UTC calendar day, as epoch milliseconds — the `now` convention `daily-quests.ts` needs. */
function nowMs(): number {
  return Date.now()
}

/** Today's UTC calendar day as `YYYY-MM-DD`, the `dayKey` format used throughout `gamified-quests.ts`. */
function todayUtcDayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Renders the Daily Quests board: a form to add a custom quest, a
 * "seed from topic coverage" action, and today's live progress for every
 * saved quest.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function DailyQuestsPanel() {
  const [templates, setTemplates] = useState<QuestTemplate[] | null>(null)
  const [board, setBoard] = useState<QuestProgress[]>([])
  const [draft, setDraft] = useState<QuestDraft>(EMPTY_DRAFT)
  const [topic, setTopic] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [contributorId, setContributorId] = useState("")
  const [streak, setStreak] = useState<ContributorQuestStreak | null>(null)
  const [streakError, setStreakError] = useState<string | null>(null)

  const refresh = () => {
    setTemplates(listQuestTemplates())
    setBoard(buildPersistedDailyQuestBoard(nowMs()))
  }

  const refreshStreak = (id: string) => {
    setStreak(id ? buildPersistedContributorQuestStreak(id, todayUtcDayKey()) : null)
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleAdd = () => {
    const description = draft.description.trim()
    const targetCount = Number.parseInt(draft.targetCount, 10)
    if (!description) {
      setError("Description is required.")
      return
    }
    if (!Number.isFinite(targetCount) || targetCount < 1) {
      setError("Target count must be a positive number.")
      return
    }
    const argBlock = draft.argBlock.trim()
    saveQuestTemplate({
      id: `custom-${Date.now()}`,
      description,
      target: { kind: draft.kind, ...(argBlock ? { argBlock } : {}) },
      targetCount,
    })
    setError(null)
    setDraft(EMPTY_DRAFT)
    refresh()
  }

  const handleRemove = (id: string) => {
    deleteQuestTemplate(id)
    refresh()
  }

  const handleSeed = () => {
    const activeTopic = topic.trim()
    if (!activeTopic) {
      setError("Enter a topic to seed quests from its coverage gaps.")
      return
    }
    seedQuestTemplatesFromTopicCoverage(activeTopic)
    setError(null)
    refresh()
  }

  const handleRecordMission = () => {
    const id = contributorId.trim()
    if (!id) {
      setStreakError("Contributor id is required.")
      return
    }
    computeAndSavePersistedDailyMissionResult(id, listQuestTemplates(), nowMs())
    setStreakError(null)
    refreshStreak(id)
  }

  if (templates === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading daily quests…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Daily Quests</h1>
        <p className="text-sm text-muted-foreground">
          Team goals like "find 5 solvency cards" — progress tracks today's real submissions
          from the Contributions Feed.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="quest-description">Description</Label>
            <Input
              id="quest-description"
              value={draft.description}
              onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Find 5 solvency cards"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Kind</Label>
            <div className="flex flex-wrap gap-1">
              {KIND_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={draft.kind === option.value ? "default" : "outline"}
                  onClick={() => setDraft((prev) => ({ ...prev, kind: option.value }))}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quest-argblock">Argument block (optional)</Label>
            <Input
              id="quest-argblock"
              value={draft.argBlock}
              onChange={(e) => setDraft((prev) => ({ ...prev, argBlock: e.target.value }))}
              placeholder="Solvency"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quest-target-count">Target count</Label>
            <Input
              id="quest-target-count"
              type="number"
              min={1}
              value={draft.targetCount}
              onChange={(e) => setDraft((prev) => ({ ...prev, targetCount: e.target.value }))}
            />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleAdd}>Add quest</Button>
      </div>

      <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="quest-seed-topic">Seed from a topic's coverage gaps</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="quest-seed-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Energy Policy"
              className="max-w-sm"
            />
            <Button type="button" variant="outline" onClick={handleSeed}>
              Seed quests
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="quest-streak-contributor">Your streak</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="quest-streak-contributor"
              value={contributorId}
              onChange={(e) => {
                const id = e.target.value
                setContributorId(id)
                refreshStreak(id.trim())
              }}
              placeholder="Contributor id"
              className="max-w-sm"
            />
            <Button type="button" variant="outline" onClick={handleRecordMission}>
              Record today's mission
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Records this contributor's mission result for today against their real, persisted
            contributions, then shows their streak and any badge it just earned.
          </p>
          {streakError && <p className="text-sm text-destructive">{streakError}</p>}
        </div>
        {streak && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2">
            <span className="text-sm font-medium text-foreground">
              {buildStreakRewardText(streak, streak.streak.lastCompletedDayKey === todayUtcDayKey())}
            </span>
            {streak.earnedBadges.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {streak.earnedBadges.map((badge) => (
                  <Badge key={badge} variant="outline" className="whitespace-nowrap">
                    {badge}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {board.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No quests yet. Add one above, or seed a set from a topic's under-covered arguments.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{buildQuestBoardSummaryText(board)}</p>
          <div className="space-y-2">
            {board.map((quest) => (
              <div
                key={quest.questId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={quest.isComplete ? "default" : "secondary"}>
                    {quest.isComplete ? "Complete" : `${quest.completedCount}/${quest.targetCount}`}
                  </Badge>
                  <span className="text-sm font-medium text-foreground">{quest.description}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleRemove(quest.questId)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
