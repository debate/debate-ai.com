/**
 * @fileoverview Client wrapper around `FlowSummariesPanel` that resolves its
 * "Send to Prep Notes" action into an actual persisted, round-anchored
 * `PrepNote` — idea #6's ("Speech Transcript Summaries and Answers") "a
 * one-click 'send to Prep Notes' action for a summary" follow-up in
 * TODO.md. `debate-practice-rounds` (where `FlowSummariesPanel` lives) has
 * no dependency on `debate-team-collaboration` (where the actual `PrepNote`
 * store lives) and shouldn't gain one just for this, so the panel only
 * exposes an `onSendToPrepNotes` prop and this app/page layer — which
 * already depends on both packages — resolves the composition, mirroring
 * `../coaching-programs/CoachingProgramRosterAnalyticsWithDrills.tsx`'s own
 * cross-package split.
 *
 * @module app/summaries/FlowSummariesPanelWithPrepNotes
 */

"use client"

import { FlowSummariesPanel } from "debate-practice-rounds"
import { addRoundPrepNote } from "debate-team-collaboration/src/state/prepNotes"

export function FlowSummariesPanelWithPrepNotes() {
  return (
    <FlowSummariesPanel
      onSendToPrepNotes={(input) => {
        addRoundPrepNote(input)
      }}
    />
  )
}
