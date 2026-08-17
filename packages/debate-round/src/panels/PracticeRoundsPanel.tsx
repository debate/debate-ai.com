/**
 * @fileoverview Practice Round Simulator panel — the UI follow-up named
 * "(b) a round-simulator UI that reads/writes through the persistence
 * store" under the "🧪 Practice Round Simulator" bullet in TODO.md.
 *
 * Reads every persisted practice round via `state/practiceRounds.ts`'s
 * `buildPracticeRoundsPanelView` (a stable-order sort of
 * `listPracticeRounds`) and renders each round's setup sections (speech
 * order, judge paradigm, AI opponent) and feedback sections (once
 * generated), with a "Clear" action that calls the already-persisted
 * `deletePracticeRound` — no new setup/feedback composition logic is
 * introduced here.
 *
 * @module panels/PracticeRoundsPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Button } from "debate-ui/src/primitives/button"
import {
  buildPracticeRoundsPanelView,
  deletePracticeRound,
  type PracticeRoundRecord,
} from "../state/practiceRounds"
import type { PracticeRoundSection } from "../round/practice-round-simulator"

function SectionList({ sections }: { sections: PracticeRoundSection[] }) {
  return (
    <div className="space-y-2">
      {sections.map((section, index) => (
        <div key={index} className="rounded-md border border-border px-3 py-2 text-sm">
          <p className="font-medium text-foreground">{section.title}</p>
          <p className="whitespace-pre-wrap text-muted-foreground">{section.body}</p>
        </div>
      ))}
    </div>
  )
}

/**
 * Renders the Practice Round Simulator panel: every persisted
 * `PracticeRoundRecord`, with its setup and (once generated) feedback
 * sections, and a "Clear" action per round.
 *
 * Reads localStorage on mount only (client-side), so it renders an empty
 * state during SSR/hydration rather than throwing.
 */
export function PracticeRoundsPanel() {
  const [rounds, setRounds] = useState<PracticeRoundRecord[] | null>(null)

  useEffect(() => {
    setRounds(buildPracticeRoundsPanelView())
  }, [])

  const refresh = () => setRounds(buildPracticeRoundsPanelView())

  const handleClear = (roundId: string) => {
    deletePracticeRound(roundId)
    refresh()
  }

  if (rounds === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading practice rounds…</div>
  }

  if (rounds.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No practice rounds yet. Rounds fill in once a practice round's setup is generated and saved.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Practice Round Simulator</h1>
        <p className="text-sm text-muted-foreground">
          Recreated tournament rounds — speech order, judge paradigm, and AI opponent persona, plus
          post-round coaching feedback once a round finishes.
        </p>
      </div>
      {rounds.map((round) => (
        <div key={round.roundId} className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Round {round.roundId}</h2>
            <Button size="sm" variant="ghost" onClick={() => handleClear(round.roundId)}>
              Clear
            </Button>
          </div>
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Setup
              </p>
              <SectionList sections={round.setup.sections} />
            </div>
            {round.feedback && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Feedback
                </p>
                <SectionList sections={round.feedback.sections} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
