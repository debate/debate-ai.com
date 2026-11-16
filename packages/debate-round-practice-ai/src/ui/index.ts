/**
 * @fileoverview The ported Practice vs AI screens.
 *
 * @module ui
 */

export * from "./bots"
export { BotSelection, type BotSelectionProps, type StartedDebate } from "./BotSelection"
export { DebateRoom, type DebateRoomProps } from "./DebateRoom"
export { DebateHistory, type DebateHistoryProps } from "./DebateHistory"
export { practiceDebateUserSpeeches } from "./history-fallacy-speeches"
export {
  JudgmentPopup,
  DEFAULT_COACH_SKILLS,
  type CoachSkill,
  type AnyJudgmentData,
  type JudgmentDataForAgainst,
  type JudgmentDataUserBot,
  type JudgmentPopupProps,
  type RatingSummary,
} from "./JudgmentPopup"
export { RoundCoachDebrief, type RoundCoachDebriefProps, type RequestRoundDebrief } from "./RoundCoachDebrief"
export { buildRoundDebriefInput, type BuildRoundDebriefInputOptions } from "./round-debrief"
export {
  PracticeSetupWizard,
  CaseBriefView,
  DIFFICULTY_BLURBS,
  SETUP_STEPS,
  buildArgumentOptions,
  buildRoundPlan,
  defaultArgumentSelection,
  type ArgumentOption,
  type PracticeSetupWizardProps,
} from "./PracticeSetupWizard"
export { DebatePracticeVsAi, type DebatePracticeVsAiProps } from "./DebatePracticeVsAi"
