/**
 * @fileoverview Cross-tab live-update helpers for this package's panels,
 * mirroring `debate-round`'s `flow/live-update.ts`,
 * `debate-search-evidence`'s `state/live-update.ts`, and
 * `debate-speech-writer`'s `state/live-update.ts` — the first
 * `live-update.ts` in this package.
 *
 * The browser's `storage` event never fires in the *same* tab that wrote the
 * change — only in other same-origin tabs — so a panel that reads
 * `localStorage` on mount only never reflects another tab's write without a
 * manual reload. `isJudgeParadigmPickerPanelLiveUpdateStorageEvent` closes
 * the "Every other localStorage-backed panel in this repo still has no
 * cross-tab live-update mechanism" Known gap noted in `shared-flow-sync.md`,
 * for `JudgeParadigmPickerPanel`.
 *
 * @module state/live-update
 */

/**
 * The `localStorage` key `JudgeParadigmPickerPanel` reads from:
 * `state/judgeParadigmSelections.ts`'s own `"judgeParadigmSelections"` store
 * (the round-by-round saved-selection list the panel renders).
 */
export const JUDGE_PARADIGM_PICKER_PANEL_LIVE_UPDATE_STORAGE_KEYS = [
  "judgeParadigmSelections",
] as const;

/**
 * Whether a `storage` event should trigger `JudgeParadigmPickerPanel` to
 * refresh its rendered selection list. A `null` key (e.g. from
 * `localStorage.clear()`, per the `StorageEvent` spec) counts too — the
 * safest response to "everything changed" is refreshing. Any other key (an
 * unrelated store elsewhere in the app) is ignored so an unrelated cross-tab
 * write doesn't force a needless refresh.
 */
export function isJudgeParadigmPickerPanelLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (JUDGE_PARADIGM_PICKER_PANEL_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}
