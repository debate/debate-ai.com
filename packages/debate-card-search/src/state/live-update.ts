/**
 * @fileoverview Cross-tab live-update helpers for `DailyBestCardPanel` and
 * `ContributionLeaderboardPanel`, mirroring `debate-round`'s
 * `flow/live-update.ts`. The browser's `storage` event never fires in the
 * *same* tab that wrote the change — only in other same-origin tabs — so a
 * panel that reads `localStorage` on mount only never reflects another
 * tab's write without a manual reload. `isDailyBestCardLiveUpdateStorageEvent`
 * closes the "No real-time updates across browser tabs/sessions" Known gap
 * noted in `daily-best-card.md`; `isContributionLeaderboardLiveUpdateStorageEvent`
 * closes the equivalent gap for the leaderboard, noted in
 * `shared-flow-sync.md`'s "Every other localStorage-backed panel in this
 * repo still has no cross-tab live-update mechanism."
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
