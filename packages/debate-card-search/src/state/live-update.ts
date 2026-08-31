/**
 * @fileoverview Cross-tab live-update helpers for `DailyBestCardPanel`,
 * `ContributionLeaderboardPanel`, `TaskInboxPanel`, `ProgressUnlocksPanel`,
 * `ResearchProgressPanel`, `QuestStreaksPanel`, `NewsStreamPanel`,
 * `ContributorAwardsPanel`, `DailyQuestsPanel`, `RevisionIncentivesPanel`,
 * `CardScoringPanel`, and `TopicSprintPanel`, mirroring `debate-round`'s
 * `flow/live-update.ts`. The browser's `storage` event never fires in the
 * *same* tab that wrote the change — only in other same-origin tabs — so a
 * panel that reads `localStorage` on mount only never reflects another tab's
 * write without a manual reload. `isDailyBestCardLiveUpdateStorageEvent`
 * closes the "No real-time updates across browser tabs/sessions" Known gap
 * noted in `daily-best-card.md`; `isContributionLeaderboardLiveUpdateStorageEvent`,
 * `isTaskInboxLiveUpdateStorageEvent`, `isProgressUnlocksLiveUpdateStorageEvent`,
 * `isResearchProgressLiveUpdateStorageEvent`, `isQuestStreaksLiveUpdateStorageEvent`,
 * `isNewsStreamLiveUpdateStorageEvent`, `isContributorAwardsLiveUpdateStorageEvent`,
 * `isDailyQuestsLiveUpdateStorageEvent`, `isRevisionIncentivesLiveUpdateStorageEvent`,
 * `isCardScoringLiveUpdateStorageEvent`, and `isTopicSprintLiveUpdateStorageEvent`
 * close the equivalent gap for their own panels — the news-stream one noted
 * directly in `news-stream.md`'s "No real-time updates across browser tabs"
 * Known gap, the rest in `shared-flow-sync.md`'s "Every other
 * localStorage-backed panel in this repo still has no cross-tab live-update
 * mechanism." (a gap that still applies to the rest of this repo's
 * localStorage-backed panels beyond these twelve).
 *
 * @module state/live-update
 */

/** The `localStorage` keys `DailyBestCardPanel` reads from (see `state/contributions.ts`, `state/dailyBestCardAnnouncements.ts`). */
export const DAILY_BEST_CARD_LIVE_UPDATE_STORAGE_KEYS = ["contributions", "dailyBestCardAnnouncements"] as const;

/**
 * Whether a `storage` event should trigger `DailyBestCardPanel` to refresh
 * its displayed leader/history. A `null` key (e.g. from
 * `localStorage.clear()`, per the `StorageEvent` spec) counts too — the
 * safest response to "everything changed" is refreshing. Any other key (an
 * unrelated store elsewhere in the app) is ignored so an unrelated
 * cross-tab write doesn't force a needless refresh.
 */
export function isDailyBestCardLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (DAILY_BEST_CARD_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `ContributionLeaderboardPanel` reads from, via
 * `state/researchProgress.ts#buildPersistedLeaderboardWithCompletedTasks`
 * (`contributions`, `completedResearchTasks`) and
 * `lib/unlock-streak-status.ts#buildContributorUnlockStatusWithStreakFromStore`
 * (`dailyMissionResults`, the streak/streak-badge source).
 */
export const CONTRIBUTION_LEADERBOARD_LIVE_UPDATE_STORAGE_KEYS = [
  "contributions",
  "completedResearchTasks",
  "dailyMissionResults",
] as const;

/**
 * Whether a `storage` event should trigger `ContributionLeaderboardPanel` to
 * refresh its rendered roster — closes the "Every other localStorage-backed
 * panel in this repo still has no cross-tab live-update mechanism" Known gap
 * noted in `shared-flow-sync.md`, for this panel. Mirrors
 * `isDailyBestCardLiveUpdateStorageEvent`'s null-key/exact-key-match rules.
 */
export function isContributionLeaderboardLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (CONTRIBUTION_LEADERBOARD_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `TaskInboxPanel` reads from, via
 * `state/routedTaskQueues.ts#buildTaskInboxView` (`routedTaskQueues`),
 * `state/pendingTaskVerifications.ts#listPendingTaskVerifications`
 * (`pendingTaskVerifications`), and `state/trackedArguments.ts#listTrackedTopics`
 * (`trackedArguments`, the "Route tasks" quick-pick list).
 */
export const TASK_INBOX_LIVE_UPDATE_STORAGE_KEYS = [
  "routedTaskQueues",
  "pendingTaskVerifications",
  "trackedArguments",
] as const;

/**
 * Whether a `storage` event should trigger `TaskInboxPanel` to refresh its
 * rendered topics/pending-verifications/tracked-topics view — closes the
 * "Every other localStorage-backed panel in this repo still has no
 * cross-tab live-update mechanism" Known gap noted in `shared-flow-sync.md`,
 * for this panel. Mirrors `isDailyBestCardLiveUpdateStorageEvent`'s
 * null-key/exact-key-match rules.
 */
export function isTaskInboxLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (TASK_INBOX_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `ProgressUnlocksPanel` reads from, via
 * `lib/unlock-streak-status.ts#buildUnlockStatusRoster`, which composes
 * `state/researchProgress.ts#buildPersistedLeaderboardWithCompletedTasks`
 * (`contributions`, `completedResearchTasks`) with
 * `state/dailyMissionResults.ts#listDailyMissionResultsForContributor`
 * (`dailyMissionResults`, the streak/streak-badge source).
 */
export const PROGRESS_UNLOCKS_LIVE_UPDATE_STORAGE_KEYS = [
  "contributions",
  "completedResearchTasks",
  "dailyMissionResults",
] as const;

/**
 * Whether a `storage` event should trigger `ProgressUnlocksPanel` to
 * refresh its rendered roster — closes the "Every other localStorage-backed
 * panel in this repo still has no cross-tab live-update mechanism" Known gap
 * noted in `shared-flow-sync.md`, for this panel. Mirrors
 * `isDailyBestCardLiveUpdateStorageEvent`'s null-key/exact-key-match rules.
 */
export function isProgressUnlocksLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (PROGRESS_UNLOCKS_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `ResearchProgressPanel` reads from, via
 * `state/researchProgress.ts#buildPersistedResearchProgressBoard`
 * (`contributions`, `completedResearchTasks`, and `routedTaskQueues` via
 * `state/routedTaskQueues.ts#listRoutedTaskQueues`).
 */
export const RESEARCH_PROGRESS_LIVE_UPDATE_STORAGE_KEYS = [
  "contributions",
  "completedResearchTasks",
  "routedTaskQueues",
] as const;

/**
 * Whether a `storage` event should trigger `ResearchProgressPanel` to
 * refresh its rendered roster — closes the "Every other localStorage-backed
 * panel in this repo still has no cross-tab live-update mechanism" Known gap
 * noted in `shared-flow-sync.md`, for this panel. Mirrors
 * `isDailyBestCardLiveUpdateStorageEvent`'s null-key/exact-key-match rules.
 */
export function isResearchProgressLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (RESEARCH_PROGRESS_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` key `QuestStreaksPanel` reads from, via
 * `state/dailyMissionResults.ts#buildPersistedQuestStreakRoster`
 * (`dailyMissionResults`).
 */
export const QUEST_STREAKS_LIVE_UPDATE_STORAGE_KEYS = ["dailyMissionResults"] as const;

/**
 * Whether a `storage` event should trigger `QuestStreaksPanel` to refresh
 * its rendered roster — closes the "Every other localStorage-backed panel
 * in this repo still has no cross-tab live-update mechanism" Known gap
 * noted in `shared-flow-sync.md`, for this panel. Mirrors
 * `isDailyBestCardLiveUpdateStorageEvent`'s null-key/exact-key-match rules.
 */
export function isQuestStreaksLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (QUEST_STREAKS_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `NewsStreamPanel` reads from: the two announcement
 * stores it composes into feed items
 * (`dailyBestCardAnnouncements.ts`/`contributorAwardAnnouncements.ts`, both
 * `"dailyBestCardAnnouncements"`/`"contributorAwardAnnouncements"`); the
 * four stores its "Community" category derives its events from directly
 * (`dailyMissionResults.ts`'s `"dailyMissionResults"` for streak milestones,
 * `groupChallenges.ts`/`contributions.ts`/`challengeWinEvents.ts`'s
 * `"groupChallenges"`/`"contributions"`/`"challengeWinEvents"` for completed
 * challenges, `revisionHistory.ts`'s `"revisionHistory"` for Revision
 * Incentives standings, and `sprintNotes.ts`'s `"sprintNotes"` for logged
 * Team Collaboration Mode prep notes); plus its own per-viewer read/like
 * store (`state/newsStream.ts`'s `"newsStreamViewerState"`) — so an
 * announcement, a newly completed challenge or milestone, a logged sprint
 * note, or a like/read-state change made in another tab is reflected here
 * too.
 */
export const NEWS_STREAM_LIVE_UPDATE_STORAGE_KEYS = [
  "dailyBestCardAnnouncements",
  "contributorAwardAnnouncements",
  "dailyMissionResults",
  "groupChallenges",
  "contributions",
  "challengeWinEvents",
  "revisionHistory",
  "sprintNotes",
  "newsStreamViewerState",
] as const;

/**
 * Whether a `storage` event should trigger `NewsStreamPanel` to rebuild its
 * feed and re-derive read/liked state — closes the "No real-time updates
 * across browser tabs" Known gap noted in `news-stream.md`. Mirrors
 * `isDailyBestCardLiveUpdateStorageEvent`'s null-key/exact-key-match rules.
 */
export function isNewsStreamLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (NEWS_STREAM_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `ContributorAwardsPanel` reads from, via
 * `state/contributorAwardAnnouncements.ts#buildPersistedTopContributorAwards`
 * (`contributions`, the same submission store `DailyBestCardPanel` and
 * `ContributionLeaderboardPanel` read) and that same module's
 * `getAnnouncedContributorAwards`/`listAnnouncedContributorAwards`
 * (`contributorAwardAnnouncements`, this panel's own frozen-day-announcement
 * store).
 */
export const CONTRIBUTOR_AWARDS_LIVE_UPDATE_STORAGE_KEYS = [
  "contributions",
  "contributorAwardAnnouncements",
] as const;

/**
 * Whether a `storage` event should trigger `ContributorAwardsPanel` to
 * refresh its rendered category winners/announcement history — closes the
 * "Every other localStorage-backed panel in this repo still has no
 * cross-tab live-update mechanism" Known gap noted in `shared-flow-sync.md`,
 * for this panel. Mirrors `isDailyBestCardLiveUpdateStorageEvent`'s
 * null-key/exact-key-match rules.
 */
export function isContributorAwardsLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (CONTRIBUTOR_AWARDS_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `DailyQuestsPanel` reads from: `state/dailyQuests.ts`'s
 * own `"dailyQuestTemplates"` roster, `state/contributions.ts`'s
 * `"contributions"` (each quest's live progress is derived from real
 * submissions via `buildPersistedDailyQuestBoard`), and
 * `state/dailyMissionResults.ts`'s `"dailyMissionResults"` (the "Your
 * streak" section).
 */
export const DAILY_QUESTS_LIVE_UPDATE_STORAGE_KEYS = [
  "dailyQuestTemplates",
  "contributions",
  "dailyMissionResults",
] as const;

/**
 * Whether a `storage` event should trigger `DailyQuestsPanel` to refresh its
 * rendered quest board and streak — closes the "Every other
 * localStorage-backed panel in this repo still has no cross-tab live-update
 * mechanism" Known gap noted in `shared-flow-sync.md`, for this panel.
 * Mirrors `isDailyBestCardLiveUpdateStorageEvent`'s null-key/exact-key-match
 * rules.
 */
export function isDailyQuestsLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (DAILY_QUESTS_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` key `RevisionIncentivesPanel` reads from:
 * `state/revisionHistory.ts`'s own `"revisionHistory"` store, the sole
 * source `buildPersistedRevisionIncentiveLeaderboard` ranks contributors
 * from.
 */
export const REVISION_INCENTIVES_LIVE_UPDATE_STORAGE_KEYS = ["revisionHistory"] as const;

/**
 * Whether a `storage` event should trigger `RevisionIncentivesPanel` to
 * refresh its rendered leaderboard — closes the "Every other
 * localStorage-backed panel in this repo still has no cross-tab live-update
 * mechanism" Known gap noted in `shared-flow-sync.md`, for this panel.
 * Mirrors `isDailyBestCardLiveUpdateStorageEvent`'s null-key/exact-key-match
 * rules.
 */
export function isRevisionIncentivesLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (REVISION_INCENTIVES_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `CardScoringPanel` reads from:
 * `state/cardScores.ts`'s own `"cardScores"` store (every submitted card the
 * ranking is built from), `state/aiCardAssessments.ts`'s `"aiCardAssessments"`
 * (each card's persisted AI verdict, keyed by card id), and
 * `state/trackedArguments.ts`'s `"trackedArguments"` (the topic switcher's
 * "Use tracked keywords" quick-pick list).
 */
export const CARD_SCORING_LIVE_UPDATE_STORAGE_KEYS = [
  "cardScores",
  "aiCardAssessments",
  "trackedArguments",
] as const;

/**
 * Whether a `storage` event should trigger `CardScoringPanel` to refresh its
 * rendered ranking, AI assessments, and tracked-topic list — closes the
 * "Every other localStorage-backed panel in this repo still has no
 * cross-tab live-update mechanism" Known gap noted in `shared-flow-sync.md`,
 * for this panel. Mirrors `isDailyBestCardLiveUpdateStorageEvent`'s
 * null-key/exact-key-match rules.
 */
export function isCardScoringLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (CARD_SCORING_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `TopicSprintPanel` reads from, via
 * `state/topicSprints.ts`'s `readPersistedTopicSprintInputs`:
 * `state/dailyQuests.ts`'s `"dailyQuestTemplates"`, `state/contributions.ts`'s
 * `"contributions"`, `state/trackedArguments.ts`'s `"trackedArguments"` (plus,
 * through its `buildPersistedTopicCoverageReport`,
 * `state/evidenceLibraryEntries.ts`'s `"evidenceLibraryEntries"`),
 * `state/contributorAvailability.ts`'s `"contributorAvailability"`, and
 * `state/researchProgress.ts`'s `"completedResearchTasks"` (plus, through its
 * `listTrackedAssignmentsForTopic`, `state/routedTaskQueues.ts`'s
 * `"routedTaskQueues"`) and `state/sprintNotes.ts`'s `"sprintNotes"`.
 */
export const TOPIC_SPRINT_LIVE_UPDATE_STORAGE_KEYS = [
  "dailyQuestTemplates",
  "contributions",
  "trackedArguments",
  "evidenceLibraryEntries",
  "contributorAvailability",
  "completedResearchTasks",
  "routedTaskQueues",
  "sprintNotes",
] as const;

/**
 * Whether a `storage` event should trigger `TopicSprintPanel` to refresh its
 * quest board, routing, progress board, and notes — closes the "Every other
 * localStorage-backed panel in this repo still has no cross-tab live-update
 * mechanism" Known gap noted in `shared-flow-sync.md`, for this panel.
 * Mirrors `isDailyBestCardLiveUpdateStorageEvent`'s null-key/exact-key-match
 * rules.
 */
export function isTopicSprintLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (TOPIC_SPRINT_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}
