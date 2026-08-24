/**
 * @fileoverview Cross-tab live-update helper for `DailyBestCardPanel`,
 * mirroring `debate-round`'s `flow/live-update.ts`. The browser's `storage`
 * event never fires in the *same* tab that wrote the change — only in other
 * same-origin tabs — so a panel that reads `localStorage` on mount only
 * (like `DailyBestCardPanel`) never reflects another tab's submission or
 * announcement without a manual reload. This closes the "No real-time
 * updates across browser tabs/sessions" Known gap noted in
 * `daily-best-card.md`.
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
