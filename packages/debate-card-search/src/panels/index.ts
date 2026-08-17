/**
 * @fileoverview Barrel for the research/crowdsourcing feature panels.
 *
 * Each panel is the UI over one of the pure slices in `src/lib` (and, where
 * one exists, its localStorage store in `src/state`).
 */

export { ArgumentLibraryPanel, type ArgumentLibraryPanelProps } from "./ArgumentLibraryPanel";
export { BrainstormBoardPanel, type BrainstormBoardPanelProps } from "./BrainstormBoardPanel";
export { CardScoringPanel, type CardScoringPanelProps } from "./CardScoringPanel";
export { CommunityRatingPanel, type CommunityRatingPanelProps } from "./CommunityRatingPanel";
export {
  ContributionLeaderboardPanel,
  type ContributionLeaderboardPanelProps,
} from "./ContributionLeaderboardPanel";
export { DailyBestCardPanel, type DailyBestCardPanelProps } from "./DailyBestCardPanel";
export { DailyQuestBoardPanel, type DailyQuestBoardPanelProps } from "./DailyQuestBoardPanel";
export { EvidenceLibraryPanel, type EvidenceLibraryPanelProps } from "./EvidenceLibraryPanel";
export { GroupChallengePanel, type GroupChallengePanelProps } from "./GroupChallengePanel";
export { PeerReviewPanel, type PeerReviewPanelProps } from "./PeerReviewPanel";
export { PrepRoomPanel, type PrepRoomPanelProps } from "./PrepRoomPanel";
export { ProgressUnlocksPanel, type ProgressUnlocksPanelProps } from "./ProgressUnlocksPanel";
export { QuestStreakPanel, type QuestStreakPanelProps } from "./QuestStreakPanel";
export { ResearchProgressPanel, type ResearchProgressPanelProps } from "./ResearchProgressPanel";
export {
  RevisionIncentivesPanel,
  type RevisionIncentivesPanelProps,
} from "./RevisionIncentivesPanel";
export { TaskRoutingPanel, type TaskRoutingPanelProps } from "./TaskRoutingPanel";
export {
  TopContributorAwardsPanel,
  type TopContributorAwardsPanelProps,
} from "./TopContributorAwardsPanel";
export { TopicCoverageDashboard, type TopicCoverageDashboardProps } from "./TopicCoverageDashboard";
export { TopicSprintPanel, type TopicSprintPanelProps } from "./TopicSprintPanel";
