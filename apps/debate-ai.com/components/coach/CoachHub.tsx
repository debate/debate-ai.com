"use client"

/**
 * @fileoverview Coach hub — one tabbed app surface over every round/coach
 * panel `debate-round` and `debate-speech-writer` ship.
 *
 * Each panel already reads (and writes) its own store, so this is purely
 * navigation: it groups the panels that describe the same stage of a round —
 * flowing it, coaching off it, prepping for the next one — and renders one
 * group at a time. The individual routes still mount the same panels one at
 * a time; this is the view for working across them.
 *
 * The one exception is {@link SharedFlowSyncPanel}, which previews a merge of
 * concurrent partner edits rather than reading a store, so this hub hands it
 * the flow currently selected in the round workspace.
 */

import { useEffect, useState } from "react"
import {
  AiVersusRoundPanel,
  ArgumentTreePanel,
  CoachingProgramsPanel,
  CoachingSessionsPanel,
  DrillSetsPanel,
  FlowAnnotationsPanel,
  FlowSummariesPanel,
  JudgeDecisionPanel,
  OpponentTeamProfilesPanel,
  PracticeRoundSimulatorPanel,
  PreRoundBriefingsPanel,
  PrepNotesPanel,
  SharedFlowSyncPanel,
  StandingsPanel,
  StrategyPanel,
  VulnerabilityChartsPanel,
  WordCountRoundsPanel,
  useFlowStore,
} from "debate-round"
import {
  CoachMaterialsPanel,
  JudgeParadigmPickerPanel,
  JudgeProfilesPanel,
  OpponentPersonaPickerPanel,
} from "debate-speech-writer"
import type { Flow } from "debate-core/src/types/flow"

/** A flow to fall back on before the workspace has created one. */
const EMPTY_FLOW: Flow = {
  content: "",
  level: 0,
  columns: [],
  invert: false,
  focus: false,
  index: 0,
  lastFocus: [],
  children: [],
  id: 0,
}

const SECTIONS = [
  "Flow",
  "Coaching",
  "Prep",
  "Scouting",
  "Practice",
  "Standings",
] as const

type Section = (typeof SECTIONS)[number]

/**
 * Tabbed hub over every round/coach panel.
 *
 * @returns The coach hub element.
 */
export function CoachHub() {
  const [section, setSection] = useState<Section>("Flow")
  const [mounted, setMounted] = useState(false)

  const flows = useFlowStore((state) => state.flows)
  const selected = useFlowStore((state) => state.selected)

  // The zustand store is client-only; hold the empty flow for the server
  // render so the markup matches on hydration.
  useEffect(() => setMounted(true), [])

  const flow = (mounted ? flows[selected] : undefined) ?? EMPTY_FLOW

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap gap-1" aria-label="Coach sections">
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

      {section === "Flow" ? (
        <div className="flex flex-col gap-4">
          <ArgumentTreePanel />
          <FlowSummariesPanel />
          <VulnerabilityChartsPanel />
          <SharedFlowSyncPanel flow={flow} edits={[]} />
        </div>
      ) : null}

      {section === "Coaching" ? (
        <div className="flex flex-col gap-4">
          <CoachingSessionsPanel />
          <CoachingProgramsPanel />
          <DrillSetsPanel />
          <CoachMaterialsPanel />
        </div>
      ) : null}

      {section === "Prep" ? (
        <div className="flex flex-col gap-4">
          <PreRoundBriefingsPanel />
          <PrepNotesPanel />
          <FlowAnnotationsPanel />
        </div>
      ) : null}

      {section === "Scouting" ? (
        <div className="flex flex-col gap-4">
          <OpponentTeamProfilesPanel />
          <JudgeProfilesPanel />
          <StrategyPanel />
        </div>
      ) : null}

      {section === "Practice" ? (
        <div className="flex flex-col gap-4">
          <PracticeRoundSimulatorPanel />
          <AiVersusRoundPanel />
          <WordCountRoundsPanel />
          <JudgeParadigmPickerPanel />
          <JudgeDecisionPanel />
          <OpponentPersonaPickerPanel />
        </div>
      ) : null}

      {section === "Standings" ? <StandingsPanel /> : null}
    </div>
  )
}
