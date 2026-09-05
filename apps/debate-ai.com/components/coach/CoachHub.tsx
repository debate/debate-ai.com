"use client"

/**
 * @fileoverview Coach hub — one tabbed app surface over every round/coach
 * panel `debate-round`, `debate-practice-rounds`, `debate-team-collaboration`
 * and `debate-speech-writer` ship.
 *
 * Each panel already reads (and writes) its own store, so this is purely
 * navigation: it groups the panels that describe the same stage of a round —
 * flowing it, coaching off it, prepping for the next one — and renders one
 * group at a time. The individual routes still mount the same panels one at
 * a time; this is the view for working across them.
 *
 * Navigation chrome (the sticky tab strip, the per-section intro card with
 * a chip per panel and an "open as its own page" link, `?section=` URL
 * sync) comes from `components/hubs/HubSectionNav.tsx`; this file owns the
 * section list ({@link COACH_SECTIONS}) and the "current round" context bar,
 * which names the flow every "Generate … for current round" action in the
 * Flow and Coaching sections reads from.
 *
 * The one exception is {@link SharedFlowSyncPanel}, which previews a merge of
 * concurrent partner edits rather than reading a store, so this hub hands it
 * the flow currently selected in the round workspace plus whatever edits
 * {@link FlowEditLogPanel} has logged for it via `state/flowEdits.ts`, and
 * applies an accepted merge straight back into the round workspace's store.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, ClipboardList, Crosshair, GraduationCap, ListTree, PlayCircle, Workflow } from "lucide-react"
import {
  FlowEditLogPanel,
  OpponentTeamProfilesPanel,
  PreRoundBriefingsPanel,
  SharedFlowSyncPanel,
  StrategyPanel,
  useFlowStore,
  type Flow,
} from "debate-round"
import { clearFlowEditsForFlow, listFlowEdits } from "debate-round/src/state/flowEdits"
import {
  AiVersusRoundPanel,
  ArgumentTreePanel,
  CoachingSessionsPanel,
  DrillSetsPanel,
  FlowAnnotationsPanel,
  FlowSummariesPanel,
  JudgeDecisionPanel,
  JudgeParadigmPickerPanel,
  OpponentPersonaPickerPanel,
  PracticeRoundSimulatorPanel,
  VulnerabilityChartsPanel,
  WordCountRoundsPanel,
} from "debate-practice-rounds"
import { CoachingProgramsPanel, PrepNotesPanel } from "debate-team-collaboration"
import { CoachMaterialsPanel, JudgeProfilesPanel } from "debate-speech-writer"
import { useStoreSnapshot } from "../../lib/ui/panels/use-store-snapshot"
import type { FlowEdit } from "debate-round/src/flow/shared-flow-sync"
import { panel, type HubSection } from "../hubs/hub-sections"
import {
  HubPanelAnchor,
  HubSectionIntro,
  HubSectionNav,
  HubSectionPanel,
  useHubSection,
} from "../hubs/HubSectionNav"

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

/** localStorage key remembering the last open section. */
const SECTION_KEY = "coachHubSection"

type SectionId = "flow" | "coaching" | "prep" | "scouting" | "practice"

/** A round's life in the coach's hands, one tab per stage — see the Training and Practice guides. */
export const COACH_SECTIONS: readonly HubSection<SectionId>[] = [
  {
    id: "flow",
    label: "Flow",
    icon: ListTree,
    description: "Read the round you just flowed: the argument tree, per-argument summaries, exposure charts, and partner-edit sync.",
    guide: "training-tools",
    panels: [
      panel("Argument Tree Outline", "/outline"),
      panel("Speech Transcript Summaries", "/summaries"),
      panel("AI Response-Outcome Charts", "/outcomes"),
      panel("Shared Flow Sync"),
      panel("Flow Edit Log"),
    ],
  },
  {
    id: "coaching",
    label: "Coaching",
    icon: GraduationCap,
    description: "Turn that flow into training: AI coaching prompts, drills, squad programs, and the coach AI's grounding materials.",
    guide: "training-tools",
    panels: [
      panel("AI Coach Mode", "/coaching"),
      panel("Coaching Programs", "/coaching-programs"),
      panel("Practice Drills", "/drills"),
      panel("Coach Materials", "/coach-materials"),
    ],
  },
  {
    id: "prep",
    label: "Prep",
    icon: ClipboardList,
    description: "Get ready for the next round: briefings, prep notes handed off to teammates, and annotations on recorded rounds.",
    guide: "training-tools",
    panels: [
      panel("Pre-Round Briefings", "/briefings"),
      panel("Prep Notes", "/prep-notes"),
      panel("Flow Annotations", "/annotations"),
    ],
  },
  {
    id: "scouting",
    label: "Scouting",
    icon: Crosshair,
    description: "What you know about the other side: opponent profiles, judge profiles, and the case ranking they imply.",
    guide: "training-tools",
    panels: [
      panel("Opponent Team Profiles", "/opponents"),
      panel("Judge Profiles", "/judges"),
      panel("Scout-to-Strategy", "/strategy"),
    ],
  },
  {
    id: "practice",
    label: "Practice",
    icon: PlayCircle,
    description: "Run practice rounds between tournaments: simulated rounds, rounds against the AI, word-count speeches, paradigms, and personas.",
    guide: "practice-tools",
    panels: [
      panel("Practice Round Simulator", "/practice-round"),
      panel("Practice vs AI", "/versus-ai"),
      panel("Word-Count Speeches", "/word-count"),
      panel("Judge Paradigm Picker", "/paradigms"),
      panel("AI Judge Decision", "/judge-decision"),
      panel("Opponent Persona Picker", "/practice-opponent"),
    ],
  },
]

/** Anchor ids by panel label, for wrapping each mounted panel. */
const ANCHORS = Object.fromEntries(
  COACH_SECTIONS.flatMap((section) => section.panels.map((item) => [item.label, item.anchor])),
) as Record<string, string>

/** First line of a flow's root text, as the round's display name. */
function flowTitle(flow: Flow): string {
  return flow.content.split("\n")[0]?.trim() ?? ""
}

/**
 * Tabbed hub over every round/coach panel.
 *
 * @returns The coach hub element.
 */
export function CoachHub() {
  const [section, setSection] = useHubSection(COACH_SECTIONS, SECTION_KEY)
  const [mounted, setMounted] = useState(false)

  const flows = useFlowStore((state) => state.flows)
  const selected = useFlowStore((state) => state.selected)
  const setFlows = useFlowStore((state) => state.setFlows)

  // The zustand store is client-only; hold the empty flow for the server
  // render so the markup matches on hydration.
  useEffect(() => setMounted(true), [])

  const currentFlow = mounted ? flows[selected] : undefined
  const flow = currentFlow ?? EMPTY_FLOW

  const { data: allFlowEdits, refresh: refreshFlowEdits } = useStoreSnapshot<FlowEdit[]>(listFlowEdits, [])
  const flowEdits = useMemo(
    () => allFlowEdits.filter((edit) => edit.flowId === flow.id),
    [allFlowEdits, flow.id],
  )

  const active = COACH_SECTIONS.find((entry) => entry.id === section) ?? COACH_SECTIONS[0]
  const roundLabel = !mounted
    ? "Loading…"
    : !currentFlow
      ? "No round selected"
      : flowTitle(currentFlow) ||
        (flows.length > 1 ? `Untitled round (${selected + 1} of ${flows.length})` : "Untitled round")

  return (
    <div className="flex flex-col gap-4">
      <HubSectionNav sections={COACH_SECTIONS} active={section} onChange={setSection} label="Coach sections" />

      <section
        aria-label="Current round"
        className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
          >
            <Workflow className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Current round</p>
            <p className="truncate text-sm font-medium" aria-live="polite">
              {roundLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              Every &ldquo;Generate … for current round&rdquo; action in Flow and Coaching reads the round selected in the round workspace.
            </p>
          </div>
        </div>
        <Link
          href="/debate"
          className="inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent sm:self-auto"
        >
          {currentFlow ? "Change round" : "Flow a round"}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </section>

      <HubSectionIntro section={active} />

      <HubSectionPanel id={section}>
        {section === "flow" ? (
          <>
            <HubPanelAnchor anchor={ANCHORS["Argument Tree Outline"]}>
              <ArgumentTreePanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Speech Transcript Summaries"]}>
              <FlowSummariesPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["AI Response-Outcome Charts"]}>
              <VulnerabilityChartsPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Shared Flow Sync"]}>
              <SharedFlowSyncPanel
                flow={flow}
                edits={flowEdits}
                onApply={(merged) => {
                  const next = [...flows]
                  next[selected] = merged
                  setFlows(next)
                  clearFlowEditsForFlow(merged.id)
                  refreshFlowEdits()
                }}
                onSyncPulled={refreshFlowEdits}
              />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Flow Edit Log"]}>
              <FlowEditLogPanel onChange={refreshFlowEdits} />
            </HubPanelAnchor>
          </>
        ) : null}

        {section === "coaching" ? (
          <>
            <HubPanelAnchor anchor={ANCHORS["AI Coach Mode"]}>
              <CoachingSessionsPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Coaching Programs"]}>
              <CoachingProgramsPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Practice Drills"]}>
              <DrillSetsPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Coach Materials"]}>
              <CoachMaterialsPanel />
            </HubPanelAnchor>
          </>
        ) : null}

        {section === "prep" ? (
          <>
            <HubPanelAnchor anchor={ANCHORS["Pre-Round Briefings"]}>
              <PreRoundBriefingsPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Prep Notes"]}>
              <PrepNotesPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Flow Annotations"]}>
              <FlowAnnotationsPanel />
            </HubPanelAnchor>
          </>
        ) : null}

        {section === "scouting" ? (
          <>
            <HubPanelAnchor anchor={ANCHORS["Opponent Team Profiles"]}>
              <OpponentTeamProfilesPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Judge Profiles"]}>
              <JudgeProfilesPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Scout-to-Strategy"]}>
              <StrategyPanel />
            </HubPanelAnchor>
          </>
        ) : null}

        {section === "practice" ? (
          <>
            <HubPanelAnchor anchor={ANCHORS["Practice Round Simulator"]}>
              <PracticeRoundSimulatorPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Practice vs AI"]}>
              <AiVersusRoundPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Word-Count Speeches"]}>
              <WordCountRoundsPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Judge Paradigm Picker"]}>
              <JudgeParadigmPickerPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["AI Judge Decision"]}>
              <JudgeDecisionPanel />
            </HubPanelAnchor>
            <HubPanelAnchor anchor={ANCHORS["Opponent Persona Picker"]}>
              <OpponentPersonaPickerPanel />
            </HubPanelAnchor>
          </>
        ) : null}
      </HubSectionPanel>
    </div>
  )
}
