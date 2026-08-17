/**
 * @fileoverview Barrel for the round/coach feature panels.
 *
 * Each panel is the UI over one of the pure slices in `src/flow` or
 * `src/round` (and, where one exists, its localStorage store in `src/state`).
 * Panels over slices that live in the React-free `debate-speech-writer` and
 * `debate-data-sync` packages live here too, since this is the lowest package
 * that depends on both and already ships React.
 */

export { AiVersusRoundPanel, type AiVersusRoundPanelProps } from "./AiVersusRoundPanel";
export { ArgumentTreePanel, type ArgumentTreePanelProps } from "./ArgumentTreePanel";
export { CoachMaterialsPanel, type CoachMaterialsPanelProps } from "./CoachMaterialsPanel";
export { CoachModePanel, type CoachModePanelProps } from "./CoachModePanel";
export { CoachingProgramPanel, type CoachingProgramPanelProps } from "./CoachingProgramPanel";
export { DebateFlowPage } from "./DebateRoundPanel";
export { DrillGeneratorPanel, type DrillGeneratorPanelProps } from "./DrillGeneratorPanel";
export { FlowAnnotationsPanel, type FlowAnnotationsPanelProps } from "./FlowAnnotationsPanel";
export { FlowSummaryPanel, type FlowSummaryPanelProps } from "./FlowSummaryPanel";
export { JudgeParadigmPanel, type JudgeParadigmPanelProps } from "./JudgeParadigmPanel";
export { JudgeProfilePanel, type JudgeProfilePanelProps } from "./JudgeProfilePanel";
export { NdcaStandingsPanel, type NdcaStandingsPanelProps } from "./NdcaStandingsPanel";
export { OpponentPersonaPanel, type OpponentPersonaPanelProps } from "./OpponentPersonaPanel";
export { OpponentScoutingPanel, type OpponentScoutingPanelProps } from "./OpponentScoutingPanel";
export { PracticeRoundPanel, type PracticeRoundPanelProps } from "./PracticeRoundPanel";
export { PreRoundBriefingPanel, type PreRoundBriefingPanelProps } from "./PreRoundBriefingPanel";
export { ResponseOutcomePanel, type ResponseOutcomePanelProps } from "./ResponseOutcomePanel";
export { ScoutToStrategyPanel, type ScoutToStrategyPanelProps } from "./ScoutToStrategyPanel";
export { SharedFlowSyncPanel, type SharedFlowSyncPanelProps } from "./SharedFlowSyncPanel";
export {
  StrategySyncNotesPanel,
  type StrategySyncNotesPanelProps,
} from "./StrategySyncNotesPanel";
export { WordCountRoundPanel, type WordCountRoundPanelProps } from "./WordCountRoundPanel";
