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
 * for `JudgeParadigmPickerPanel`. `isVulnerabilityChartsPanelLiveUpdateStorageEvent`/
 * `isCounselPanelAssessmentsLiveUpdateStorageEvent` close the same gap for
 * `VulnerabilityChartsPanel` and its `useCounselPanelAssessments` hook.
 * `isArgumentTreePanelLiveUpdateStorageEvent` closes it for
 * `ArgumentTreePanel`. `isWordCountRoundsLiveUpdateStorageEvent` closes it
 * for `WordCountRoundsPanel`'s `useWordCountRounds` hook.
 * `isDrillSetsPanelLiveUpdateStorageEvent` closes it for
 * `DrillSetsPanel`'s `useDrillSets` hook.
 * `isAiVersusRoundPanelLiveUpdateStorageEvent` closes it for
 * `AiVersusRoundPanel`. `isCoachingSessionsPanelLiveUpdateStorageEvent`
 * closes it for `CoachingSessionsPanel`.
 * `isPracticeRoundSimulatorPanelLiveUpdateStorageEvent` closes it for
 * `PracticeRoundSimulatorPanel`. `isJudgeDecisionPanelLiveUpdateStorageEvent`
 * closes it for `JudgeDecisionPanel` (via `useJudgeDecisions`).
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

/**
 * The `localStorage` key `JudgeDecisionPanel` reads from (via
 * `hooks/useJudgeDecisions.ts`): `state/judgeDecisions.ts`'s own
 * `"judgeDecisions"` store (the per-round AI judge-decision history the
 * panel renders, newest first).
 */
export const JUDGE_DECISION_PANEL_LIVE_UPDATE_STORAGE_KEYS = ["judgeDecisions"] as const;

/**
 * Whether a `storage` event should trigger `JudgeDecisionPanel` (via
 * `useJudgeDecisions`) to refresh its rendered decision history. A `null`
 * key (e.g. from `localStorage.clear()`, per the `StorageEvent` spec) counts
 * too — the safest response to "everything changed" is refreshing. Any
 * other key (an unrelated store elsewhere in the app) is ignored so an
 * unrelated cross-tab write doesn't force a needless refresh.
 */
export function isJudgeDecisionPanelLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null || (JUDGE_DECISION_PANEL_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` key `VulnerabilityChartsPanel` reads directly (not
 * through a hook): `state/vulnerabilityReports.ts`'s own
 * `"vulnerabilityReports"` store (the per-round report list the panel
 * renders). The panel's other backing store, `counselPanelAssessments`, is
 * read through `useCounselPanelAssessments` instead — see
 * `COUNSEL_PANEL_ASSESSMENTS_LIVE_UPDATE_STORAGE_KEYS` below, which that
 * hook subscribes to itself.
 */
export const VULNERABILITY_CHARTS_PANEL_LIVE_UPDATE_STORAGE_KEYS = ["vulnerabilityReports"] as const;

/**
 * Whether a `storage` event should trigger `VulnerabilityChartsPanel` to
 * refresh its rendered report list. A `null` key (e.g. from
 * `localStorage.clear()`, per the `StorageEvent` spec) counts too — the
 * safest response to "everything changed" is refreshing. Any other key (an
 * unrelated store elsewhere in the app) is ignored so an unrelated cross-tab
 * write doesn't force a needless refresh.
 */
export function isVulnerabilityChartsPanelLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (VULNERABILITY_CHARTS_PANEL_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` key `useCounselPanelAssessments` reads/writes through:
 * `state/counselPanelAssessments.ts`'s own `"counselPanelAssessments"`
 * store (the per-round AI counsel-panel assessment history
 * `VulnerabilityChartsPanel`'s "AI Counsel Panel" section renders).
 */
export const COUNSEL_PANEL_ASSESSMENTS_LIVE_UPDATE_STORAGE_KEYS = ["counselPanelAssessments"] as const;

/**
 * Whether a `storage` event should trigger `useCounselPanelAssessments` to
 * refresh its rendered assessment history. A `null` key counts too, for the
 * same "everything changed" reason as above.
 */
export function isCounselPanelAssessmentsLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (COUNSEL_PANEL_ASSESSMENTS_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `ArgumentTreePanel` reads directly:
 * `debate-round`'s `state/argumentTrees.ts` `"argumentTrees"` store (the
 * per-round derived outline records the panel renders) and this package's
 * own `state/argumentTreeFilters.ts` `"argumentTreeFilters"` store (each
 * round's saved speech/side/kind/unanswered-only filter selection). The
 * panel's saved filter *presets* (`hooks/useOutlineFilterPresets.ts`,
 * `"outline-filter-presets"`) are deliberately excluded — that hook already
 * has its own same-tab `CHANGE_EVENT` sync but no cross-tab `storage`
 * listener yet, matching every other `use*Presets` hook in this repo (e.g.
 * `debate-round`'s `useWordLimitPresets`); closing that separate, wider gap
 * is left for a future run.
 */
export const ARGUMENT_TREE_PANEL_LIVE_UPDATE_STORAGE_KEYS = ["argumentTrees", "argumentTreeFilters"] as const;

/**
 * Whether a `storage` event should trigger `ArgumentTreePanel` to refresh
 * its rendered outlines and per-round filter selections. A `null` key (e.g.
 * from `localStorage.clear()`, per the `StorageEvent` spec) counts too — the
 * safest response to "everything changed" is refreshing. Any other key (an
 * unrelated store elsewhere in the app) is ignored so an unrelated cross-tab
 * write doesn't force a needless refresh.
 */
export function isArgumentTreePanelLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (ARGUMENT_TREE_PANEL_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` key `useWordCountRounds` reads/writes through:
 * `debate-round`'s `state/wordCountRounds.ts` own `"wordCountRounds"` store
 * (the persisted-round list `WordCountRoundsPanel`'s round history and
 * word-count trend view both derive from).
 */
export const WORD_COUNT_ROUNDS_LIVE_UPDATE_STORAGE_KEYS = ["wordCountRounds"] as const;

/**
 * Whether a `storage` event should trigger `useWordCountRounds` to refresh
 * its rendered round list. A `null` key (e.g. from `localStorage.clear()`,
 * per the `StorageEvent` spec) counts too — the safest response to
 * "everything changed" is refreshing. Any other key (an unrelated store
 * elsewhere in the app) is ignored so an unrelated cross-tab write doesn't
 * force a needless refresh.
 */
export function isWordCountRoundsLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (WORD_COUNT_ROUNDS_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` key `useDrillSets` reads/writes through:
 * `state/drillSets.ts`'s own `"drillSets"` store (the per-round drill-set
 * list `DrillSetsPanel` renders, including each drill's completion,
 * AI-script, and review-reminder state).
 */
export const DRILL_SETS_PANEL_LIVE_UPDATE_STORAGE_KEYS = ["drillSets"] as const;

/**
 * Whether a `storage` event should trigger `useDrillSets` to refresh its
 * rendered drill-set list. A `null` key (e.g. from `localStorage.clear()`,
 * per the `StorageEvent` spec) counts too — the safest response to
 * "everything changed" is refreshing. Any other key (an unrelated store
 * elsewhere in the app) is ignored so an unrelated cross-tab write doesn't
 * force a needless refresh.
 */
export function isDrillSetsPanelLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (DRILL_SETS_PANEL_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` key `AiVersusRoundPanel` reads directly:
 * `debate-round`'s `state/aiVersusRounds.ts` own `"aiVersusRounds"` store
 * (the persisted-round list the panel's active round, round history, and
 * "Compare transcripts" section all derive from).
 */
export const AI_VERSUS_ROUND_PANEL_LIVE_UPDATE_STORAGE_KEYS = ["aiVersusRounds"] as const;

/**
 * Whether a `storage` event should trigger `AiVersusRoundPanel` to refresh
 * its rendered round list. A `null` key (e.g. from `localStorage.clear()`,
 * per the `StorageEvent` spec) counts too — the safest response to
 * "everything changed" is refreshing. Any other key (an unrelated store
 * elsewhere in the app) is ignored so an unrelated cross-tab write doesn't
 * force a needless refresh.
 */
export function isAiVersusRoundPanelLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (AI_VERSUS_ROUND_PANEL_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` key `CoachingSessionsPanel` reads directly:
 * `state/coachingSessions.ts`'s own `"coachingSessions"` store (the
 * round+side coaching-session list the panel's rendered sessions, "Compare
 * two sessions" dropdowns, and comparison view all derive from).
 */
export const COACHING_SESSIONS_PANEL_LIVE_UPDATE_STORAGE_KEYS = ["coachingSessions"] as const;

/**
 * Whether a `storage` event should trigger `CoachingSessionsPanel` to
 * refresh its rendered session list. A `null` key (e.g. from
 * `localStorage.clear()`, per the `StorageEvent` spec) counts too — the
 * safest response to "everything changed" is refreshing. Any other key (an
 * unrelated store elsewhere in the app) is ignored so an unrelated
 * cross-tab write doesn't force a needless refresh.
 */
export function isCoachingSessionsPanelLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (COACHING_SESSIONS_PANEL_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}

/**
 * The `localStorage` keys `PracticeRoundSimulatorPanel` reads directly:
 * `debate-round`'s `state/practiceRounds.ts` own `"practiceRounds"` store
 * (the saved-round-setup list the panel's form, per-round sections, and
 * "Compare your past attempts" section all derive from) and `debate-round`'s
 * `state/aiVersusRounds.ts` own `"aiVersusRounds"` store (read directly via
 * `getAiVersusRound`/`getPracticeRoundSubmittedSpeeches` for each round's
 * submitted-speech progress and "Generate AI opponent speech" availability).
 * The account-synced custom opponent persona library
 * (`useCustomOpponentPersonaLibrary`, "My persona library"/"Shared by your
 * team") is deliberately excluded — it manages its own refresh through that
 * hook rather than a raw `localStorage` read, matching
 * `OpponentPersonaPickerPanel`'s own exclusion of the same hook.
 */
export const PRACTICE_ROUND_SIMULATOR_PANEL_LIVE_UPDATE_STORAGE_KEYS = [
  "practiceRounds",
  "aiVersusRounds",
] as const;

/**
 * Whether a `storage` event should trigger `PracticeRoundSimulatorPanel` to
 * refresh its rendered round list. A `null` key (e.g. from
 * `localStorage.clear()`, per the `StorageEvent` spec) counts too — the
 * safest response to "everything changed" is refreshing. Any other key (an
 * unrelated store elsewhere in the app) is ignored so an unrelated cross-tab
 * write doesn't force a needless refresh.
 */
export function isPracticeRoundSimulatorPanelLiveUpdateStorageEvent(event: { key: string | null }): boolean {
  return (
    event.key === null ||
    (PRACTICE_ROUND_SIMULATOR_PANEL_LIVE_UPDATE_STORAGE_KEYS as readonly string[]).includes(event.key)
  );
}
