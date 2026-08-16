/**
 * @fileoverview Public entry point for the debate speech-writer package.
 *
 * Exposes the prompt library used by the AI speech/flow features, the batch
 * quote-analysis helper that scores cards for warrants and flaws, the
 * configurable judge-paradigm registry for AI judge decisions, the
 * judge-profile aggregation helpers for summarizing a judge's ballot history,
 * the opponent-persona registry for AI practice-opponent styles, and the
 * team coach-material library/grounded-prompt helpers for the private team
 * coach AI idea.
 *
 * @module debate-speech-writer
 */

export { analyzeQuotes } from "./analysis/analyze-quotes";

export {
  judgeParadigms,
  judgeParadigmIds,
  isBuiltinJudgeParadigmId,
  getJudgeParadigm,
  listJudgeParadigms,
  buildCustomJudgeParadigm,
  buildJudgeParadigmPrompt,
} from "./judge/judge-paradigms";
export type {
  BuiltinJudgeParadigmId,
  JudgeParadigmId,
  JudgeParadigm,
  CustomJudgeParadigmInput,
} from "./judge/judge-paradigms";

export {
  DEFAULT_SPEED_THRESHOLDS_WPM,
  classifySpeedTolerance,
  classifyTheoryReceptiveness,
  buildJudgeProfile,
  buildJudgeProfiles,
  groupRecordsByJudge,
  buildJudgeTendencySummary,
} from "./judge/judge-profile";
export type {
  DebateSide,
  JudgeRoundRecord,
  SpeedTolerance,
  TheoryReceptiveness,
  JudgeProfile,
} from "./judge/judge-profile";

export {
  opponentPersonas,
  opponentPersonaIds,
  isBuiltinOpponentPersonaId,
  getOpponentPersona,
  listOpponentPersonas,
  buildOpponentPersonaPrompt,
} from "./opponent/opponent-personas";
export type {
  BuiltinOpponentPersonaId,
  OpponentPersonaPace,
  OpponentPersona,
} from "./opponent/opponent-personas";

export {
  buildCoachMaterialLibrary,
  buildCoachMaterialLibrarySummaryText,
  buildGroundedCoachPrompt,
  excerptMaterialText,
  findRelevantMaterials,
  scoreMaterialRelevance,
} from "./coach/team-coach-materials";
export type {
  CoachMaterial,
  CoachMaterialGroup,
  CoachMaterialKind,
  CoachMaterialLibrary,
  CoachMaterialMatch,
  FindRelevantMaterialsOptions,
  GroundedCoachPromptOptions,
} from "./coach/team-coach-materials";

export { findFlawsPrompt } from "./prompts/quote-to-find-flaws";
export { judgeDecisionPrompt } from "./prompts/judge-decision-options";
export { speechToFlowPrompt } from "./prompts/speech-to-flow";
export { speechToResponsePrompt } from "./prompts/speech-to-response";
export { textToHighlightedPrompt } from "./prompts/text-to-highlighted";
export { topicToResearchOutlinePrompt } from "./prompts/topic-to-research-outline";
