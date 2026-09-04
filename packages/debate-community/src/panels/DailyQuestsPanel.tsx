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
 * A custom quest can carry an optional expiry day; expired quests drop off
 * the board on their own (`buildDailyQuestBoard` excludes them), and a
 * "Clean up expired quests" action calls `pruneExpiredQuestTemplates` to
 * remove them from the stored roster entirely — closing the "a quest
 * template has no expiry" Known gap.
 *
 * A quest with an expiry can also carry a "Recurs" cadence (daily/weekly);
 * an expired recurring quest rolls its expiry forward to its next cycle
 * instead of disappearing — `buildPersistedDailyQuestBoard` applies that
 * rollover automatically on every load, so it just reappears with fresh
 * progress — closing the "no recurring-quest concept" Known gap.
 *
 * An optional `signedInContributorId` prop (built from
 * `lib/session-identity.ts`'s `deriveContributorIdFromSessionIdentity`
 * against a real signed-in session) prefills the "Your streak" contributor
 * id field's *initial* value only, mirroring `TaskInboxPanel`'s "My tasks"
 * prefill exactly — a visitor who edits the field keeps whatever they
 * typed, so this is a prefill, not a login.
 *
 * Also subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isDailyQuestsLiveUpdateStorageEvent`, so a quest added/removed, a
 * contribution submitted, or a mission result recorded in another tab
 * refreshes this panel's board/streak without a manual reload — closing the
 * "Every other localStorage-backed panel in this repo still has no
 * cross-tab live-update mechanism" Known gap noted in `shared-flow-sync.md`,
 * for this panel.
 *
 * @module panels/DailyQuestsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-research-evidence/src/ui/primitives/badge"
import { Button } from "debate-research-evidence/src/ui/primitives/button"
import { Input } from "debate-research-evidence/src/ui/primitives/input"
import { Label } from "debate-research-evidence/src/ui/primitives/label"
import {
  buildPersistedDailyQuestBoard,
  deleteQuestTemplate,
  listQuestTemplates,
  pruneExpiredQuestTemplates,
  saveQuestTemplate,
  seedQuestTemplatesFromTopicCoverage,
} from "debate-team-collaboration/src/state/dailyQuests"
import {
  buildPersistedContributorQuestStreak,
  computeAndSavePersistedDailyMissionResult,
} from "../state/dailyMissionResults"
import { isDailyQuestsLiveUpdateStorageEvent } from "debate-research-evidence/src/state/live-update"
import { buildQuestBoardSummaryText } from "debate-team-collaboration/src/lib/daily-quests"
import type { QuestProgress, QuestRecurrence, QuestTemplate } from "debate-team-collaboration/src/lib/daily-quests"
import { buildStreakRewardText } from "../lib/gamified-quests"
import type { ContributorQuestStreak } from "../lib/gamified-quests"
import type { ContributionKind } from "debate-research-evidence/src/lib/community-rating"

const KIND_OPTIONS: { value: ContributionKind; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "summary", label: "Summary" },
  { value: "highlight", label: "Highlight" },
  { value: "annotation", label: "Annotation" },
  { value: "original-argument", label: "Original Argument" },
  { value: "refutation", label: "Refutation" },
]

type QuestDraft = {
  description: string
  kind: ContributionKind
  argBlock: string
  targetCount: string
  expiresOn: string
  recurrence: QuestRecurrence | ""
}

const EMPTY_DRAFT: QuestDraft = {
  description: "",
  kind: "card",
  argBlock: "",
  targetCount: "3",
  expiresOn: "",
  recurrence: "",
}

const RECURRENCE_OPTIONS: { value: QuestRecurrence | ""; label: string }[] = [
  { value: "", label: "Doesn't recur" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
]

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
export interface DailyQuestsPanelProps {
  /**
   * A contributor id to prefill the "Your streak" field with, typically
   * derived from a real signed-in session via
   * `deriveContributorIdFromSessionIdentity`. Only seeds the field's
   * initial value — once a visitor edits it by hand, this prop is ignored
   * for the rest of the panel's life so it never overwrites what they typed.
   */
  signedInContributorId?: string
}

export function DailyQuestsPanel({ signedInContributorId }: DailyQuestsPanelProps = {}) {
  const [templates, setTemplates] = useState<QuestTemplate[] | null>(null)
  const [board, setBoard] = useState<QuestProgress[]>([])
  const [draft, setDraft] = useState<QuestDraft>(EMPTY_DRAFT)
  const [topic, setTopic] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [contributorId, setContributorId] = useState("")
  const [hasEditedContributorId, setHasEditedContributorId] = useState(false)
  const [streak, setStreak] = useState<ContributorQuestStreak | null>(null)
  const [streakError, setStreakError] = useState<string | null>(null)
  const [pruneMessage, setPruneMessage] = useState<string | null>(null)

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

  useEffect(() => {
    if (!hasEditedContributorId && signedInContributorId) {
      setContributorId(signedInContributorId)
      refreshStreak(signedInContributorId.trim())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedInContributorId, hasEditedContributorId])

  /**
   * Live-update the board and streak when another browser tab adds/removes
   * a quest, submits a contribution, or records a mission result. A
   * `storage` event never fires in the tab that made the write, only in
   * other tabs. Depends on `contributorId` so a change to it re-registers
   * the listener with a fresh closure rather than refreshing a stale streak.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isDailyQuestsLiveUpdateStorageEvent(event)) return
      refresh()
      if (contributorId.trim()) refreshStreak(contributorId.trim())
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [contributorId])

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
    const expiresOn = draft.expiresOn.trim()
    saveQuestTemplate({
      id: `custom-${Date.now()}`,
      description,
      target: { kind: draft.kind, ...(argBlock ? { argBlock } : {}) },
      targetCount,
      ...(expiresOn ? { expiresOn } : {}),
      ...(expiresOn && draft.recurrence ? { recurrence: draft.recurrence } : {}),
    })
    setError(null)
    setDraft(EMPTY_DRAFT)
    refresh()
  }

  const handleRemove = (id: string) => {
    deleteQuestTemplate(id)
    refresh()
  }

  const handlePruneExpired = () => {
    const removedCount = pruneExpiredQuestTemplates(nowMs())
    setPruneMessage(
      removedCount === 0
        ? "No expired quests to clean up."
        : `Removed ${removedCount} expired quest${removedCount === 1 ? "" : "s"}.`,
    )
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

  const expiresOnByQuestId = new Map(templates.map((template) => [template.id, template.expiresOn]))
  const recurrenceByQuestId = new Map(templates.map((template) => [template.id, template.recurrence]))

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
          <div className="space-y-1.5">
            <Label htmlFor="quest-expires-on">Expires on (optional)</Label>
            <Input
              id="quest-expires-on"
              type="date"
              value={draft.expiresOn}
              onChange={(e) => setDraft((prev) => ({ ...prev, expiresOn: e.target.value }))}
            />
          </div>
          {draft.expiresOn && (
            <div className="space-y-1.5">
              <Label>Recurs</Label>
              <div className="flex flex-wrap gap-1">
                {RECURRENCE_OPTIONS.map((option) => (
                  <Button
                    key={option.value || "none"}
                    type="button"
                    size="sm"
                    variant={draft.recurrence === option.value ? "default" : "outline"}
                    onClick={() => setDraft((prev) => ({ ...prev, recurrence: option.value }))}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
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
                setHasEditedContributorId(true)
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
            {signedInContributorId
              ? "Prefilled from your signed-in account — edit it if your streak was recorded under a different contributor id. "
              : ""}
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

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={handlePruneExpired}>
          Clean up expired quests
        </Button>
        {pruneMessage && <p className="text-sm text-muted-foreground">{pruneMessage}</p>}
      </div>

      {board.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No quests yet. Add one above, or seed a set from a topic's under-covered arguments.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{buildQuestBoardSummaryText(board)}</p>
          <div className="space-y-2">
            {board.map((quest) => {
              const expiresOn = expiresOnByQuestId.get(quest.questId)
              const recurrence = recurrenceByQuestId.get(quest.questId)
              return (
                <div
                  key={quest.questId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={quest.isComplete ? "default" : "secondary"}>
                      {quest.isComplete ? "Complete" : `${quest.completedCount}/${quest.targetCount}`}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">{quest.description}</span>
                    {expiresOn && (
                      <Badge variant="outline" className="whitespace-nowrap">
                        Expires {expiresOn}
                      </Badge>
                    )}
                    {recurrence && (
                      <Badge variant="outline" className="whitespace-nowrap">
                        Recurs {recurrence}
                      </Badge>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleRemove(quest.questId)}>
                    Remove
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
