"use client"

/**
 * @fileoverview Coach hub — the app surface for the round/coach panels.
 *
 * The flow-derived panels read the flow currently selected in the round
 * workspace's store, so the argument tree, summary, coach prompts, drills and
 * vulnerability chart all describe the round the user is actually flowing.
 * The scouting, judge and standings panels read their own persisted stores.
 */

import { useEffect, useMemo, useState } from "react"
import {
  AiVersusRoundPanel,
  ArgumentTreePanel,
  CoachMaterialsPanel,
  CoachModePanel,
  DrillGeneratorPanel,
  FlowAnnotationsPanel,
  FlowSummaryPanel,
  JudgeParadigmPanel,
  JudgeProfilePanel,
  NdcaStandingsPanel,
  OpponentPersonaPanel,
  OpponentScoutingPanel,
  PracticeRoundPanel,
  PreRoundBriefingPanel,
  ResponseOutcomePanel,
  ScoutToStrategyPanel,
  SharedFlowSyncPanel,
  StrategySyncNotesPanel,
  WordCountRoundPanel,
  useFlowStore,
} from "debate-round"
import type { CaseOption } from "debate-round/src/round/scout-to-strategy"
import type { RoundEventInfo } from "debate-round/src/round/pre-round-briefing"
import type { Flow } from "debate-core/src/types/flow"
import { Input } from "debate-ui/src/primitives/input"
import { LabeledField } from "debate-ui/src/panels/panel-shell"

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
  const [tournamentName, setTournamentName] = useState("")
  const [opponentTeamId, setOpponentTeamId] = useState("")
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([])
  const [mounted, setMounted] = useState(false)

  const flows = useFlowStore((state) => state.flows)
  const selected = useFlowStore((state) => state.selected)

  // The zustand store is client-only; hold the empty flow for the server
  // render so the markup matches on hydration.
  useEffect(() => setMounted(true), [])

  const flow = (mounted ? flows[selected] : undefined) ?? EMPTY_FLOW
  const roundId = String(flow.roundId ?? flow.id)

  const event = useMemo<RoundEventInfo>(
    () => ({
      tournamentName: tournamentName.trim() || "Practice",
      division: "Open",
      roundLabel: `Round ${flow.speechNumber ?? 1}`,
      side: flow.invert ? "neg" : "aff",
      ...(opponentTeamId.trim() ? { opponentLabel: opponentTeamId.trim() } : {}),
    }),
    [tournamentName, opponentTeamId, flow.invert, flow.speechNumber],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <LabeledField label="Tournament">
          <Input
            value={tournamentName}
            placeholder="Practice"
            onChange={(e) => setTournamentName(e.target.value)}
          />
        </LabeledField>
        <LabeledField label="Opponent team id">
          <Input value={opponentTeamId} onChange={(e) => setOpponentTeamId(e.target.value)} />
        </LabeledField>
      </div>

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
          <ArgumentTreePanel flow={flow} roundId={roundId} />
          <FlowSummaryPanel flow={flow} roundId={roundId} />
          <ResponseOutcomePanel flow={flow} />
          <SharedFlowSyncPanel flow={flow} edits={[]} />
        </div>
      ) : null}

      {section === "Coaching" ? (
        <div className="flex flex-col gap-4">
          <CoachModePanel flow={flow} roundId={roundId} />
          <DrillGeneratorPanel flow={flow} roundId={roundId} />
          <CoachMaterialsPanel />
        </div>
      ) : null}

      {section === "Prep" ? (
        <div className="flex flex-col gap-4">
          <PreRoundBriefingPanel
            event={event}
            roundId={roundId}
            {...(opponentTeamId.trim() ? { opponentTeamId: opponentTeamId.trim() } : {})}
          />
          <StrategySyncNotesPanel flow={flow} />
          <FlowAnnotationsPanel flow={flow} speechId={flow.columns[0] ?? "1AC"} />
        </div>
      ) : null}

      {section === "Scouting" ? (
        <div className="flex flex-col gap-4">
          <OpponentScoutingPanel
            {...(opponentTeamId.trim() ? { highlightTeamId: opponentTeamId.trim() } : {})}
          />
          <JudgeProfilePanel />
          <ScoutToStrategyPanel
            caseOptions={caseOptions}
            onAddCaseOption={(option) => setCaseOptions((current) => [...current, option])}
          />
        </div>
      ) : null}

      {section === "Practice" ? (
        <div className="flex flex-col gap-4">
          <PracticeRoundPanel roundId={roundId} flow={flow} />
          <AiVersusRoundPanel roundId={roundId} />
          <WordCountRoundPanel roundId={roundId} />
          <JudgeParadigmPanel roundId={roundId} />
          <OpponentPersonaPanel sessionId={roundId} />
        </div>
      ) : null}

      {section === "Standings" ? <NdcaStandingsPanel results={[]} /> : null}
    </div>
  )
}
