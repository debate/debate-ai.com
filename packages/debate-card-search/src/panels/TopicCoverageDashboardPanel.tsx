/**
 * @fileoverview Topic Coverage Dashboard — the "(c) a coverage dashboard UI"
 * follow-up named under the "📊 Topic Coverage Dashboard" bullet in TODO.md
 * ("Show which arguments are well-covered, which are missing, and where the
 * team needs more work").
 *
 * Lets a teammate maintain a topic's tracked-argument checklist (the "(b) a
 * team-editable tracked-argument checklist per topic" follow-up, via
 * `state/trackedArguments.ts`), then renders that topic's coverage report —
 * computed entirely from persisted stores by
 * `buildPersistedTopicCoverageReport`, which composes the checklist against
 * the shared evidence library's entries for that topic (every
 * `EvidenceLibraryEntry` is already a `CoverageCardSummary`) through the pure
 * `lib/topic-coverage.ts` scoring rule. No new coverage logic is introduced
 * here — this is a read/write composition and rendering layer, mirroring the
 * existing `ArgumentLibraryPanel`/`SprintNotesPanel` panel convention.
 *
 * @module panels/TopicCoverageDashboardPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { Label } from "../ui/primitives/label"
import {
  buildPersistedTopicCoverageReport,
  deleteTrackedArgument,
  listTrackedArguments,
  listTrackedTopics,
  saveTrackedArgument,
  type TrackedArgumentRecord,
} from "../state/trackedArguments"
import { buildTopicCoverageSummaryText, getUnderCoveredArguments } from "../lib/topic-coverage"
import type { ArgumentCoverage, CoverageLevel, TopicCoverageReport } from "../lib/topic-coverage"

const LEVEL_LABEL: Record<CoverageLevel, string> = {
  missing: "Missing",
  thin: "Thin",
  covered: "Covered",
}

const LEVEL_VARIANT: Record<CoverageLevel, "destructive" | "secondary" | "default"> = {
  missing: "destructive",
  thin: "secondary",
  covered: "default",
}

type ArgumentDraft = { argBlock: string; category: string }

const EMPTY_DRAFT: ArgumentDraft = { argBlock: "", category: "" }

/**
 * Renders the Topic Coverage Dashboard: a topic switcher, a form to add a
 * tracked argument to that topic's checklist, and the resulting coverage
 * report — every tracked argument's missing/thin/covered status plus any
 * cards filed under an untracked argument block.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function TopicCoverageDashboardPanel() {
  const [topics, setTopics] = useState<string[] | null>(null)
  const [topic, setTopic] = useState("")
  const [report, setReport] = useState<TopicCoverageReport | null>(null)
  const [records, setRecords] = useState<TrackedArgumentRecord[]>([])
  const [draft, setDraft] = useState<ArgumentDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTopics(listTrackedTopics())
  }, [])

  useEffect(() => {
    const activeTopic = topic.trim()
    setReport(activeTopic ? buildPersistedTopicCoverageReport(activeTopic) : null)
    setRecords(activeTopic ? listTrackedArguments(activeTopic) : [])
  }, [topic])

  const refresh = (activeTopic: string) => {
    setTopics(listTrackedTopics())
    setReport(buildPersistedTopicCoverageReport(activeTopic))
    setRecords(listTrackedArguments(activeTopic))
  }

  const handleAdd = () => {
    const activeTopic = topic.trim()
    const argBlock = draft.argBlock.trim()
    if (!activeTopic) {
      setError("Choose or enter a topic first.")
      return
    }
    if (!argBlock) {
      setError("Argument block name is required.")
      return
    }
    const category = draft.category.trim()
    saveTrackedArgument({
      id: `${activeTopic}-${argBlock}-${Date.now()}`,
      topic: activeTopic,
      argBlock,
      ...(category ? { category } : {}),
    })
    setError(null)
    setDraft(EMPTY_DRAFT)
    refresh(activeTopic)
  }

  const handleRemove = (id: string) => {
    deleteTrackedArgument(id)
    refresh(topic.trim())
  }

  if (topics === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading topic coverage…</div>
  }

  const underCovered = report ? getUnderCoveredArguments(report) : []

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Topic Coverage Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Track which arguments a topic's checklist calls for, and see which are missing, thin, or
          covered based on the shared evidence library's submitted cards.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="coverage-topic">Topic</Label>
        <Input
          id="coverage-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Energy Policy"
          className="max-w-sm"
        />
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topics.map((existing) => (
              <Button
                key={existing}
                size="sm"
                variant={existing === topic.trim() ? "default" : "outline"}
                onClick={() => setTopic(existing)}
              >
                {existing}
              </Button>
            ))}
          </div>
        )}
      </div>

      {topic.trim() === "" ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Enter a topic above to view or build its coverage checklist.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="coverage-argblock">Argument block</Label>
                <Input
                  id="coverage-argblock"
                  value={draft.argBlock}
                  onChange={(e) => setDraft((prev) => ({ ...prev, argBlock: e.target.value }))}
                  placeholder="Warming DA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coverage-category">Category (optional)</Label>
                <Input
                  id="coverage-category"
                  value={draft.category}
                  onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="DA"
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleAdd}>Add to checklist</Button>
          </div>

          {report && report.tracked.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{buildTopicCoverageSummaryText(report)}</p>

              <div className="space-y-2">
                {report.tracked.map((argument) => {
                  const record = records.find((r) => r.argBlock === argument.argBlock)
                  return (
                    <CoverageRow
                      key={argument.argBlock}
                      argument={argument}
                      onRemove={record ? () => handleRemove(record.id) : undefined}
                    />
                  )
                })}
              </div>

              {underCovered.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Needs the most work: {underCovered.map((argument) => argument.argBlock).join(", ")}
                </p>
              )}

              {report.untracked.length > 0 && (
                <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Untracked (cards filed here, but not on the checklist)
                  </p>
                  <div className="space-y-2">
                    {report.untracked.map((argument) => (
                      <CoverageRow key={argument.argBlock} argument={argument} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No tracked arguments yet for {topic.trim()}. Add one above to start the checklist.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function CoverageRow({ argument, onRemove }: { argument: ArgumentCoverage; onRemove?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={LEVEL_VARIANT[argument.level]}>{LEVEL_LABEL[argument.level]}</Badge>
        <span className="text-sm font-medium text-foreground">{argument.argBlock}</span>
        {argument.category && <Badge variant="outline">{argument.category}</Badge>}
        <span className="text-xs text-muted-foreground">
          {argument.cardCount} card{argument.cardCount === 1 ? "" : "s"} · {argument.totalWordCount} words
        </span>
      </div>
      {onRemove && (
        <Button size="sm" variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      )}
    </div>
  )
}
