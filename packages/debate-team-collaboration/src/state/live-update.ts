/**
 * @fileoverview Cross-tab live-update helpers for this package's panels,
 * mirroring `debate-round`'s `flow/live-update.ts`, `debate-search-evidence`'s
 * `state/live-update.ts`, and `debate-practice-drills`' `state/live-update.ts`
 * — the first `live-update.ts` in this package.
 *
 * The browser's `storage` event never fires in the *same* tab that wrote the
 * change — only in other same-origin tabs — so a panel that reads
 * `localStorage` on mount only never reflects another tab's write without a
 * manual reload. `isCoachingProgramsPanelLiveUpdateStorageEvent` closes the
 * "Every other localStorage-backed panel in this repo still has no cross-tab
 * live-update mechanism" Known gap noted in `shared-flow-sync.md`, for
 * `CoachingProgramsPanel`.
 *
 * @module state/live-update
 */

/**
 * The `localStorage` keys `CoachingProgramsPanel` reads directly (not through
 * its expanded, per-topic board composition): `state/coachingPrograms.ts`'s
 * own `"coachingPrograms"` store (the persisted program-config list the
 * panel's form and roster badges render) and `state/roundContributorFlows.ts`'s
 * own `"roundContributorFlows"` store (each roster member's "Flow
 * recorded"/"Clear" badge, read both at the top level via
 * `listRoundContributorFlows` and inside an open board via
 * `buildCoachingProgramMemberFlows`/`buildCoachingProgramMemberPracticeRounds`).
 *
 * A program's expanded board also composes several other packages' stores
 * (topic-sprint inputs, the group-challenge roster, the contribution feed,
 * win events, and practice-round records) through
 * `state/persistedCoachingProgramBoard.ts` — those are left out of this
 * predicate, matching every other panel's "cover the store(s) this panel
 * reads directly, not everything a composed view transitively depends on"
 * convention (e.g. `JudgeDecisionPanel`'s hook-scoped predicate). Reopening a
 * board (toggle it closed, then open again) still picks up a change to one of
 * those deeper stores.
 */
export const COACHING_PROGRAMS_PANEL_LIVE_UPDATE_STORAGE_KEYS = [
  "coachingPrograms",
  "roundContributorFlows",
] as const;

/**
 * Whether a `storage` event should trigger `CoachingProgramsPanel` to refresh
 * its rendered program list, roster "Flow recorded" badges, and (if open) the
 * current program's board. A `null` key (e.g. from `localStorage.clear()`,
 * per the `StorageEvent` spec) counts too — the safest response to
 * "everything changed" is refreshing. Any other key (an unrelated store
 * elsewhere in the app) is ignored so an unrelated cross-tab write doesn't
 * force a needless refresh.
 */
export function isCoachingProgramsPanelLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (COACHING_PROGRAMS_PANEL_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}
