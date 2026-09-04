/**
 * @fileoverview Public entry point for the debate speech-writer package.
 *
 * Exposes the prompt library used by the AI speech/flow features, the batch
 * quote-analysis helper that scores cards for warrants and flaws, the
 * configurable judge-paradigm registry for AI judge decisions, the
 * judge-profile aggregation helpers for summarizing a judge's ballot history,
 * the opponent-persona registry for AI practice-opponent styles, the
 * team coach-material library/grounded-prompt helpers plus the real AI Q&A
 * call for the private team coach AI idea, and localStorage-backed
 * persistence stores for a team's
 * coach materials, for judge profiles, for a round's selected judge
 * paradigm, and for a practice session's selected opponent persona.
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
  buildJudgeProfilesRoster,
  deleteJudgeProfile,
  getJudgeProfile,
  listJudgeProfiles,
  saveJudgeProfile,
} from "./state/judgeProfiles";

export {
  deleteJudgeRoundRecord,
  listJudgeRoundRecords,
  listJudgeRoundRecordsForJudge,
  rebuildJudgeProfileFromRecords,
  recordJudgeRound,
} from "./state/judgeRoundRecords";
export type { JudgeRoundRecordEntry } from "./state/judgeRoundRecords";

export { JudgeProfilesPanel } from "./panels/JudgeProfilesPanel";

export {
  opponentPersonas,
  opponentPersonaIds,
  isBuiltinOpponentPersonaId,
  getOpponentPersona,
  listOpponentPersonas,
  buildOpponentPersonaPrompt,
  buildCustomOpponentPersona,
  opponentDifficulties,
  opponentDifficultyIds,
  DEFAULT_OPPONENT_DIFFICULTY,
  isOpponentDifficulty,
  getOpponentDifficulty,
  listOpponentDifficulties,
} from "./opponent/opponent-personas";
export type {
  BuiltinOpponentPersonaId,
  OpponentPersonaId,
  OpponentPersonaPace,
  OpponentPersona,
  CustomOpponentPersonaInput,
  OpponentDifficulty,
  OpponentDifficultyLevel,
} from "./opponent/opponent-personas";

export {
  buildCoachConversationMessages,
  buildCoachMaterialLibrary,
  buildCoachMaterialLibrarySummaryText,
  buildGroundedCoachPrompt,
  excerptMaterialText,
  findRelevantMaterials,
  scoreMaterialRelevance,
} from "./coach/team-coach-materials";
export type {
  AnthropicChatTurn,
  BuildCoachConversationMessagesOptions,
  CoachConversationTurn,
  CoachMaterial,
  CoachMaterialGroup,
  CoachMaterialKind,
  CoachMaterialLibrary,
  CoachMaterialMatch,
  FindRelevantMaterialsOptions,
  GroundedCoachPromptOptions,
} from "./coach/team-coach-materials";

export { TEAM_COACH_AI_SYSTEM_PROMPT, parseTeamCoachAiResponse } from "./coach/team-coach-ai";
export { requestTeamCoachAnswer } from "./coach/team-coach-client";
export type { RequestTeamCoachAnswerOptions } from "./coach/team-coach-client";

export {
  adoptCoachMaterial,
  buildCoachMaterialLibraryFromStore,
  deleteCoachMaterial,
  findRelevantMaterialsFromStore,
  getCoachMaterial,
  listCoachMaterials,
  saveCoachMaterial,
} from "./state/coachMaterials";
export type { SaveCoachMaterialResult } from "./state/coachMaterials";

export {
  appendMaterialVersion,
  adoptMaterialVersion,
  deleteVersionsForMaterial,
  listAllCoachMaterialVersions,
  listVersionsForMaterial,
  materialFromVersion,
  MAX_VERSIONS_PER_MATERIAL,
} from "./state/coachMaterialVersions";
export type { CoachMaterialVersion } from "./state/coachMaterialVersions";

export { isValidCoachMaterialRecord, MAX_SAVED_COACH_MATERIAL_BYTES } from "./state/savedCoachMaterials";
export {
  isValidCoachMaterialVersionRecord,
  MAX_SAVED_COACH_MATERIAL_VERSION_BYTES,
} from "./state/savedCoachMaterialVersions";

export {
  listSavedCoachMaterials,
  saveCoachMaterialToAccount,
  deleteSavedCoachMaterialFromAccount,
} from "./coach/coach-materials-client";
export {
  listSavedCoachMaterialVersions,
  saveCoachMaterialVersionToAccount,
  deleteSavedCoachMaterialVersionFromAccount,
} from "./coach/coach-material-versions-client";

export { useCoachMaterialsSync } from "./hooks/useCoachMaterialsSync";
export type { UseCoachMaterialsSyncResult } from "./hooks/useCoachMaterialsSync";

export {
  appendCoachConversationTurn,
  clearCoachConversationHistory,
  listCoachConversationTurns,
} from "./state/coachConversation";

export { CoachMaterialsPanel } from "./panels/CoachMaterialsPanel";

export { findFlawsPrompt } from "./prompts/quote-to-find-flaws";
export { judgeDecisionPrompt } from "./prompts/judge-decision-options";
export { speechToFlowPrompt } from "./prompts/speech-to-flow";
export { speechToResponsePrompt } from "./prompts/speech-to-response";
export { textToHighlightedPrompt } from "./prompts/text-to-highlighted";
export { topicToResearchOutlinePrompt } from "./prompts/topic-to-research-outline";
