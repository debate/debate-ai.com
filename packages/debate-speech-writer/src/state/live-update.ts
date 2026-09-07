/**
 * @fileoverview Cross-tab live-update helpers for this package's panels,
 * mirroring `debate-round`'s `flow/live-update.ts` and
 * `debate-search-evidence`'s `state/live-update.ts`.
 *
 * The browser's `storage` event never fires in the *same* tab that wrote the
 * change — only in other same-origin tabs — so a panel that reads
 * `localStorage` on mount only never reflects another tab's write without a
 * manual reload. `isJudgeProfilesLiveUpdateStorageEvent` (for
 * `JudgeProfilesPanel`) and `isCoachMaterialsPanelLiveUpdateStorageEvent`
 * (for `CoachMaterialsPanel`) each close the "Every other localStorage-backed
 * panel in this repo still has no cross-tab live-update mechanism" Known gap
 * noted in `shared-flow-sync.md`, for their own panel.
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

/**
 * The `localStorage` keys `CoachMaterialsPanel` reads from:
 * `state/coachMaterials.ts`'s `"coachMaterials"` store (the material library
 * the main list, tag dropdown, and Pending review section all derive from),
 * `state/coachMaterialVersions.ts`'s `"coachMaterialVersions"` (a material's
 * "History" toggle), and `state/coachConversation.ts`'s `"coachConversation"`
 * (the "Ask the coach" panel's persisted conversation history).
 */
export const COACH_MATERIALS_PANEL_LIVE_UPDATE_STORAGE_KEYS = [
  "coachMaterials",
  "coachMaterialVersions",
  "coachConversation",
] as const;

/**
 * Whether a `storage` event should trigger `CoachMaterialsPanel` to refresh
 * its rendered material library, tag list, pending-review queue, open
 * material's version history, and conversation history. A `null` key (e.g.
 * from `localStorage.clear()`, per the `StorageEvent` spec) counts too — the
 * safest response to "everything changed" is refreshing. Any other key (an
 * unrelated store elsewhere in the app) is ignored so an unrelated cross-tab
 * write doesn't force a needless refresh.
 */
export function isCoachMaterialsPanelLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (COACH_MATERIALS_PANEL_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}
