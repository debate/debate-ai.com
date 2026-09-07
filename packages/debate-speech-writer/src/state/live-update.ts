/**
 * @fileoverview Cross-tab live-update helpers for `JudgeProfilesPanel`,
 * mirroring `debate-round`'s `flow/live-update.ts` and
 * `debate-search-evidence`'s `state/live-update.ts`.
 *
 * The browser's `storage` event never fires in the *same* tab that wrote the
 * change — only in other same-origin tabs — so a panel that reads
 * `localStorage` on mount only never reflects another tab's write without a
 * manual reload. `isJudgeProfilesLiveUpdateStorageEvent` closes the "Every
 * other localStorage-backed panel in this repo still has no cross-tab
 * live-update mechanism" Known gap noted in `shared-flow-sync.md`, for this
 * panel.
 *
 * @module state/live-update
 */

/**
 * The `localStorage` keys `JudgeProfilesPanel` reads from:
 * `state/judgeProfiles.ts`'s own `"judgeProfiles"` store (the aggregated
 * roster `buildJudgeProfilesRoster` renders) and `state/judgeRoundRecords.ts`'s
 * `"judgeRoundRecords"` (the logged-ballot history feeding the "Logged
 * rounds" list), plus that same module's `"judgeRoundRecordEditHistory"`/
 * `"judgeRoundRecordRedoHistory"` (which rounds show an Undo/Redo action).
 */
export const JUDGE_PROFILES_LIVE_UPDATE_STORAGE_KEYS = [
  "judgeProfiles",
  "judgeRoundRecords",
  "judgeRoundRecordEditHistory",
  "judgeRoundRecordRedoHistory",
] as const;

/**
 * Whether a `storage` event should trigger `JudgeProfilesPanel` to refresh
 * its rendered roster and logged-round history. A `null` key (e.g. from
 * `localStorage.clear()`, per the `StorageEvent` spec) counts too — the
 * safest response to "everything changed" is refreshing. Any other key (an
 * unrelated store elsewhere in the app) is ignored so an unrelated cross-tab
 * write doesn't force a needless refresh.
 */
export function isJudgeProfilesLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (JUDGE_PROFILES_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}
