/**
 * @fileoverview Barrel for the Community & Contributor Progress feature panels.
 *
 * Each panel is the UI over one of the pure slices in `src/lib` (and, where
 * one exists, its localStorage store in `src/state`).
 */

export {
  CoachingProgramRosterAnalyticsPanel,
  type MemberDrillPracticeStatus,
} from "./CoachingProgramRosterAnalyticsPanel";
export { ContributionLeaderboardPanel, TIER_VARIANT } from "./ContributionLeaderboardPanel";
export { ContributorAwardsPanel } from "./ContributorAwardsPanel";
export { ContributorProfilePanel } from "./ContributorProfilePanel";
export { DailyBestCardPanel } from "./DailyBestCardPanel";
export { DailyQuestsPanel } from "./DailyQuestsPanel";
export { DebaterLevelPanel } from "./DebaterLevelPanel";
export {
  DebaterLevelUpOverlay,
  LEVEL_UP_AUTO_DISMISS_MS,
  type DebaterLevelUpOverlayProps,
} from "./DebaterLevelUpOverlay";
export { JudgeAwardsSection, JudgeAwardShowcase } from "./JudgeAwardsSection";
export { NewsStreamPanel, type NewsStreamSyncAdapter } from "./NewsStreamPanel";
export { ProgressUnlocksPanel } from "./ProgressUnlocksPanel";
export { QuestStreaksPanel } from "./QuestStreaksPanel";
