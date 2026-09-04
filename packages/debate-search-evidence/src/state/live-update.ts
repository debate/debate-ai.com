/**
 * @fileoverview Cross-tab live-update helpers for `DailyBestCardPanel`,
 * `ContributionLeaderboardPanel`, `TaskInboxPanel`, `ProgressUnlocksPanel`,
 * `ResearchProgressPanel`, `QuestStreaksPanel`, `NewsStreamPanel`,
 * `ContributorAwardsPanel`, `DailyQuestsPanel`, `RevisionIncentivesPanel`,
 * `CardScoringPanel`, `BrainstormBoardPanel`, `GroupChallengesPanel`,
 * `ContributionsFeedPanel`, `TopicSprintPanel`, and
 * `CoachingProgramRosterAnalyticsPanel`, mirroring `debate-round`'s
 * `flow/live-update.ts`.
 * The browser's `storage` event never fires in the *same* tab that wrote the
 * change — only in other same-origin tabs — so a panel that reads
 * `localStorage` on mount only never reflects another tab's write without a
 * manual reload. `isDailyBestCardLiveUpdateStorageEvent` closes the "No
 * real-time updates across browser tabs/sessions" Known gap noted in
 * `daily-best-card.md`; `isContributionLeaderboardLiveUpdateStorageEvent`,
 * `isTaskInboxLiveUpdateStorageEvent`, `isProgressUnlocksLiveUpdateStorageEvent`,
 * `isResearchProgressLiveUpdateStorageEvent`, `isQuestStreaksLiveUpdateStorageEvent`,
 * `isNewsStreamLiveUpdateStorageEvent`, `isContributorAwardsLiveUpdateStorageEvent`,
 * `isDailyQuestsLiveUpdateStorageEvent`, `isRevisionIncentivesLiveUpdateStorageEvent`,
 * `isCardScoringLiveUpdateStorageEvent`, `isBrainstormBoardLiveUpdateStorageEvent`,
 * `isGroupChallengesLiveUpdateStorageEvent`, `isContributionsFeedLiveUpdateStorageEvent`,
 * and `isTopicSprintLiveUpdateStorageEvent` close the equivalent gap for
 * their own panels — the news-stream one noted directly in `news-stream.md`'s
 * "No real-time updates across browser tabs" Known gap, the rest in
 * `shared-flow-sync.md`'s "Every other localStorage-backed panel in this
 * repo still has no cross-tab live-update mechanism." (a gap that still
 * applies to the rest of this repo's localStorage-backed panels beyond
 * these fifteen).
 *
 * @module state/live-update
 */

/** The `localStorage` keys `DailyBestCardPanel` reads from (see `state/contributions.ts`, `state/dailyBestCardAnnouncements.ts`, `state/dailyBestCardComments.ts`). */
export const DAILY_BEST_CARD_LIVE_UPDATE_STORAGE_KEYS = [
  "contributions",
  "dailyBestCardAnnouncements",
  "dailyBestCardComments",
] as const;

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
 * The `localStorage` keys `QuestStreaksPanel` reads from, via
 * `state/streakFreezes.ts#buildQuestStreakRosterWithFreezes`
 * (`dailyMissionResults`, plus `streakFreezes` for the streak-freeze/
 * grace-day mechanic, plus `streakLapseReminders` for the opt-in
 * streak-lapse reminder banner).
 */
export const QUEST_STREAKS_LIVE_UPDATE_STORAGE_KEYS = [
  "dailyMissionResults",
  "streakFreezes",
  "streakLapseReminders",
] as const;

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
 * store), plus `state/contributorAwardNominations.ts`'s
 * `contributorAwardNominations` key for the "nominate a peer" action.
 */
export const CONTRIBUTOR_AWARDS_LIVE_UPDATE_STORAGE_KEYS = [
  "contributions",
  "contributorAwardAnnouncements",
  "contributorAwardNominations",
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
 * The `localStorage` keys `RevisionIncentivesPanel` reads from:
 * `state/revisionHistory.ts`'s own `"revisionHistory"` store (the source
 * `buildPersistedRevisionIncentiveLeaderboard` ranks contributors from) and
 * `state/evidenceLibraryEntries.ts`'s `"evidenceLibraryEntries"` (the source
 * `buildPersistedStaleEvidenceDigest` derives the stale-evidence digest
 * from).
 */
export const REVISION_INCENTIVES_LIVE_UPDATE_STORAGE_KEYS = [
  "revisionHistory",
  "evidenceLibraryEntries",
] as const;

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
 * The `localStorage` keys `BrainstormBoardPanel` reads from:
 * `state/brainstormIdeas.ts`'s own `"brainstormIdeas"` store (every
 * submitted/AI-generated/merged idea the boards are built from),
 * `state/trackedArguments.ts`'s `"trackedArguments"` (the topic switcher's
 * coverage-gap board seeding), and `state/brainstormSessionTimer.ts`'s
 * `"brainstormSessionTimer"` (the optional squad-wide session countdown) so
 * a timer another tab starts, pauses, or resets is reflected here too.
 */
export const BRAINSTORM_BOARD_LIVE_UPDATE_STORAGE_KEYS = [
  "brainstormIdeas",
  "trackedArguments",
  "brainstormSessionTimer",
] as const;

/**
 * Whether a `storage` event should trigger `BrainstormBoardPanel` to refresh
 * its rendered boards and tracked-topic list — closes the "Every other
 * localStorage-backed panel in this repo still has no cross-tab live-update
 * mechanism" Known gap noted in `shared-flow-sync.md`, for this panel.
 * Mirrors `isCardScoringLiveUpdateStorageEvent`'s null-key/exact-key-match
 * rules.
 */
export function isBrainstormBoardLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (BRAINSTORM_BOARD_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `GroupChallengesPanel` reads from:
 * `state/groupChallenges.ts`'s own `"groupChallenges"` store (the persisted
 * challenge roster) and `state/challengeWinEvents.ts`'s `"challengeWinEvents"`
 * (recorded wins) and `"contributions"` (the real, persisted contribution
 * feed `buildPersistedGroupChallengeBoard` matches contribution-target
 * challenges against).
 */
export const GROUP_CHALLENGES_LIVE_UPDATE_STORAGE_KEYS = [
  "groupChallenges",
  "challengeWinEvents",
  "contributions",
] as const;

/**
 * Whether a `storage` event should trigger `GroupChallengesPanel` to refresh
 * its rendered challenge roster and live standings — closes the "Every
 * other localStorage-backed panel in this repo still has no cross-tab
 * live-update mechanism" Known gap noted in `shared-flow-sync.md`, for this
 * panel. Mirrors `isDailyBestCardLiveUpdateStorageEvent`'s
 * null-key/exact-key-match rules.
 */
export function isGroupChallengesLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (GROUP_CHALLENGES_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `ContributionsFeedPanel` reads from:
 * `state/contributions.ts`'s own `"contributions"` store (every submitted
 * contribution the ranked feed is built from, via
 * `buildPersistedContributionFeed`) and `state/evidenceLibraryEntries.ts`'s
 * `"evidenceLibraryEntries"` (the Evidence Library's own tag store, combined
 * with contribution tags via `listCombinedPersistedTags` to drive the
 * submission form's tag-autocomplete suggestions).
 */
export const CONTRIBUTIONS_FEED_LIVE_UPDATE_STORAGE_KEYS = [
  "contributions",
  "evidenceLibraryEntries",
] as const;

/**
 * Whether a `storage` event should trigger `ContributionsFeedPanel` to
 * refresh its rendered feed and tag suggestions — closes the "Every other
 * localStorage-backed panel in this repo still has no cross-tab live-update
 * mechanism" Known gap noted in `shared-flow-sync.md`, for this panel.
 * Mirrors `isDailyBestCardLiveUpdateStorageEvent`'s null-key/exact-key-match
 * rules.
 */
export function isContributionsFeedLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (CONTRIBUTIONS_FEED_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `TopicSprintPanel` reads from, via
 * `state/topicSprints.ts`'s `readPersistedTopicSprintInputs`:
 * `state/dailyQuests.ts`'s `"dailyQuestTemplates"` (the quest board),
 * `state/contributions.ts`'s `"contributions"` (contribution-derived quest
 * progress), `state/trackedArguments.ts`'s `"trackedArguments"` and
 * `state/evidenceLibraryEntries.ts`'s `"evidenceLibraryEntries"` (the topic
 * coverage report), `state/contributorAvailability.ts`'s
 * `"contributorAvailability"` (the roster), `state/researchProgress.ts`'s
 * `"completedResearchTasks"` and `state/routedTaskQueues.ts`'s
 * `"routedTaskQueues"` (tracked assignments), and `state/sprintNotes.ts`'s
 * `"sprintNotes"` (the note wall).
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
 * quest board, task routing, progress board, and note wall — closes the
 * "Every other localStorage-backed panel in this repo still has no
 * cross-tab live-update mechanism" Known gap noted in `shared-flow-sync.md`,
 * for this panel. Mirrors `isDailyBestCardLiveUpdateStorageEvent`'s
 * null-key/exact-key-match rules.
 */
export function isTopicSprintLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (TOPIC_SPRINT_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `CoachingProgramRosterAnalyticsPanel` reads from:
 * `state/coachingPrograms.ts`'s `"coachingPrograms"` (the program picker's
 * roster list), `state/groupChallenges.ts`'s `"groupChallenges"` and
 * `state/challengeWinEvents.ts`'s `"challengeWinEvents"`/`"contributions"`
 * (the persisted group-challenge board each member's standing is summarized
 * from), and `state/dailyMissionResults.ts`'s `"dailyMissionResults"` (each
 * member's quest streak).
 */
export const COACHING_PROGRAM_ROSTER_ANALYTICS_LIVE_UPDATE_STORAGE_KEYS = [
  "coachingPrograms",
  "groupChallenges",
  "challengeWinEvents",
  "contributions",
  "dailyMissionResults",
] as const;

/**
 * Whether a `storage` event should trigger `CoachingProgramRosterAnalyticsPanel`
 * to refresh its rendered roster analytics — closes the "Every other
 * localStorage-backed panel in this repo still has no cross-tab live-update
 * mechanism" Known gap noted in `shared-flow-sync.md`, for this panel.
 * Mirrors `isDailyBestCardLiveUpdateStorageEvent`'s null-key/exact-key-match
 * rules.
 */
export function isCoachingProgramRosterAnalyticsLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (COACHING_PROGRAM_ROSTER_ANALYTICS_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}
