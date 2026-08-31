/**
 * @fileoverview Cross-tab live-update helpers for `FlowSpreadsheet`'s
 * annotation/edit/prep-note badges. `AnnotationCellRenderer` reads straight
 * from `localStorage` at cell-render time and only re-renders on an
 * explicit AG Grid action — see `FlowSpreadsheet`'s existing
 * `refreshCells({ force: true })` calls after a same-tab edit/note is
 * logged, whose own comments note "AG Grid cell renderers don't re-render
 * on their own when localStorage changes underneath them". The browser's
 * `storage` event never fires in the *same* tab that wrote the change —
 * only in other same-origin tabs — so it's exactly the missing trigger for
 * the cross-tab case: this closes the "badge doesn't live-update if another
 * tab drops a new annotation/edit while the grid is open" Known gap noted in
 * `flow-annotations.md` and `shared-flow-sync.md`.
 */

/** The `localStorage` keys a `FlowSpreadsheet` grid's badges read from (see `state/flowAnnotations.ts`, `state/flowEdits.ts`, `state/prepNotes.ts`). */
export const FLOW_LIVE_UPDATE_STORAGE_KEYS = ["flowAnnotations", "flowEdits", "prepNotes"] as const;

/**
 * Whether a `storage` event should trigger a full-grid `refreshCells` call.
 * A `null` key (e.g. from `localStorage.clear()`, per the `StorageEvent`
 * spec) counts too — the safest response to "everything changed" is
 * refreshing everything. Any other key (an unrelated store elsewhere in the
 * app) is ignored so an unrelated cross-tab write doesn't force a needless
 * grid refresh.
 */
export function isFlowLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return event.key === null || (FLOW_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key);
}

/**
 * The `localStorage` key the standalone Flow Annotations panel
 * (`panels/FlowAnnotationsPanel.tsx`, distinct from the `FlowSpreadsheet`
 * grid badge above) reads from — see `state/flowAnnotations.ts`.
 */
export const FLOW_ANNOTATIONS_PANEL_LIVE_UPDATE_STORAGE_KEYS = ["flowAnnotations"] as const;

/**
 * Whether a `storage` event should trigger `FlowAnnotationsPanel` to
 * re-read its persisted annotation list. A `null` key (e.g. from
 * `localStorage.clear()`) counts too, for the same reason as
 * `isFlowLiveUpdateStorageEvent` above.
 */
export function isFlowAnnotationsPanelLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (FLOW_ANNOTATIONS_PANEL_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` key `panels/PrepNoteNotificationsPanel.tsx` reads from
 * — see `state/prepNoteNotifications.ts`. Deliberately excludes that
 * module's separate `prepNoteNotifications:lastRecipientId` key: a change
 * to which recipient id another tab last looked up isn't this tab's
 * business, only new/updated notifications for the recipient this tab is
 * already showing are.
 */
export const PREP_NOTE_NOTIFICATIONS_LIVE_UPDATE_STORAGE_KEYS = ["prepNoteNotifications"] as const;

/**
 * Whether a `storage` event should trigger `PrepNoteNotificationsPanel` to
 * re-read its persisted notification list. A `null` key (e.g. from
 * `localStorage.clear()`) counts too, for the same reason as
 * `isFlowLiveUpdateStorageEvent` above.
 */
export function isPrepNoteNotificationsLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (PREP_NOTE_NOTIFICATIONS_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}
