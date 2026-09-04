/**
 * @fileoverview The ported Practice vs AI screens.
 *
 * @module ui
 */

export * from "./bots"
export { BotSelection, type BotSelectionProps, type StartedDebate } from "./BotSelection"
export { DebateRoom, type DebateRoomProps } from "./DebateRoom"
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
export { DebatePracticeVsAi, type DebatePracticeVsAiProps } from "./DebatePracticeVsAi"
