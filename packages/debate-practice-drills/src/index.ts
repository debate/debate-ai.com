export * from "./panels";
export { RoundToolsCrossLinks } from "./layout/RoundToolsCrossLinks";
export {
  buildOpponentPersonaSelectionsPanelView,
  deleteOpponentPersonaSelection,
  getOpponentPersonaSelection,
  listOpponentPersonaSelections,
  saveOpponentPersonaSelection,
  type OpponentPersonaSelection,
} from "./state/opponentPersonaSelections";
export {
  buildJudgeDecisionDeepLink,
  buildJudgeParadigmSelectionsPanelView,
  deleteJudgeParadigmSelection,
  getJudgeParadigmSelection,
  listJudgeParadigmSelections,
  saveJudgeParadigmSelection,
  type JudgeParadigmSelection,
} from "./state/judgeParadigmSelections";
export * from "./state/savedWordCountRounds";
export * from "./round/word-count-rounds-client";
export * from "./hooks/useWordCountRounds";
export * from "./state/savedJudgeDecisions";
export * from "./round/judge-decisions-client";
export * from "./hooks/useJudgeDecisions";
export * from "./state/savedCounselPanelAssessments";
export * from "./flow/counsel-panel-assessments-client";
export * from "./hooks/useCounselPanelAssessments";
export * from "./state/savedDrillSets";
export * from "./round/drill-sets-client";
export * from "./hooks/useDrillSets";
export * from "./state/customOpponentPersonaLibrary";
export * from "./round/custom-opponent-persona-library-client";
export * from "./hooks/useCustomOpponentPersonaLibrary";

// Practice partners (challenges, match finder) and the judge pool. Their
// framework-free halves — types, validation, match rules — are imported by the
// app's API routes by path (`src/practice-partners/*`, `src/judge-pool/*`).
export { PracticePartnersPanel } from "./practice-partners/ui/PracticePartnersPanel";
export { JudgePoolPanel } from "./judge-pool/ui/JudgePoolPanel";

// Online Challenges: asynchronous written debates against players or the AI,
// with XP, win-streak boosts and trophies. The API routes import the
// framework-free halves (types, rules, rewards, validation, prompts) by path.
export { ChallengesPanel } from "./debate-challenges/ui/ChallengesPanel";
