
## Tracker Status

### In progress

_No task currently in progress._

### Completed

- **⚖️ Judge Profiles — cross-tab live update.** Another repeat of the
  standing autonomous-routine prompt ("integrate all the tools into the
  UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built (account settings,
  dozens of `saved_*` D1 tables/`/api/*` routes linking flows, docs, and
  rounds to signed-in users in SQL, and every tool already reachable from
  the Tools page, CardMirror's own Google-Docs-style `MenuBar`/`Ctrl`/`Cmd`-
  Shift-Space command palette (`packages/debate-editor/src/react/MenuBar.tsx`,
  populated from the same `RIBBON_GROUPS` registry as the palette), and the
  feature catalog, all reconfirmed this run), so this slice picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap and closed it
  for `JudgeProfilesPanel` — a genuinely still-open panel confirmed by
  scanning every panel named in that Known gap's own history for a
  `storage`-event listener before picking one.

  Added `packages/debate-speech-writer/src/state/live-update.ts` (mirroring
  `debate-round`'s `flow/live-update.ts` and `debate-search-evidence`'s
  `state/live-update.ts` exactly — the first `live-update.ts` in this
  package) with `JUDGE_PROFILES_LIVE_UPDATE_STORAGE_KEYS`/
  `isJudgeProfilesLiveUpdateStorageEvent`, covering all four of the panel's
  backing stores: `judgeProfiles` (the aggregated roster),
  `judgeRoundRecords` (the logged-ballot history), and
  `judgeRoundRecordEditHistory`/`judgeRoundRecordRedoHistory` (which decide
  whether a round shows an Undo/Redo action). `JudgeProfilesPanel.tsx` now
  subscribes to `window`'s `storage` event and calls its existing
  `refresh()` closure when the predicate matches — a teammate logging,
  editing, undoing/redoing, deleting, or bulk-importing a ballot for a judge
  in one tab now shows up in every other open tab without a manual reload.
  The in-progress "Log a judged round" form draft is left untouched, only
  the persisted roster/history re-reads, matching every other closed
  panel's "refresh the derived view, not the draft" convention (e.g.
  `PreRoundBriefingsPanel`).

  See `docs/features/judge-profiles.md`'s new "Cross-tab live update"
  section and `docs/features/shared-flow-sync.md`'s updated Known gaps
  bullet (added `JudgeProfilesPanel` to the closed list). Vitest-covered:
  `packages/debate-speech-writer/test/live-update.test.ts` (every backing-
  store key, the `null`-key clear-all case, and unrelated/substring-
  matching keys staying ignored). Every other panel named in
  `shared-flow-sync.md`'s Known gap history as still lacking the mechanism
  — `ArgumentLibraryPanel`, `EvidenceLibraryPanel`,
  `TopicCoverageDashboardPanel` (`debate-search-evidence`);
  `AiVersusRoundPanel`, `ArgumentTreePanel`, `CoachingSessionsPanel`,
  `DrillSetsPanel`, `FlowSummariesPanel`, `JudgeDecisionPanel`,
  `JudgeParadigmPickerPanel`, `OpponentPersonaPickerPanel`,
  `PracticeRoundSimulatorPanel`, `VulnerabilityChartsPanel`,
  `WordCountRoundsPanel` (`debate-practice-drills`);
  `CoachingProgramsPanel` (`debate-team-collaboration`);
  `OpponentTeamProfilesPanel`, `UserSettingsPanel` (`debate-round`, though
  note `UserSettingsPanel`'s `form` is a live, directly-editable settings
  form rather than a derived list/roster view, so a future run closing that
  one should refresh only the persisted values, not stomp an unsaved
  in-progress edit the way a naive `refresh()` call would);
  `CoachMaterialsPanel`, `JudgeProfilesPanel`'s own sibling panels in
  `debate-speech-writer` — remains open for a future run to pick up next.

  Ran the full verification gate: `bun run test` (5140 passing, up from
  5130 at HEAD before this change — the new suite above), `bunx turbo run
  typecheck` (16/16 typecheck-bearing packages green, `debate-ai-web` has
  no `typecheck` script), and confirmed `bun run build:web` fails
  identically on this branch and on master before this change
  (`UNLOADABLE_DEPENDENCY` on the native `canvas` binding during the RSC
  server-bundle scan — a pre-existing sandbox/toolchain limitation
  unrelated to this change, not something this run introduced or could fix
  without rebuilding that native dependency for this container). No
  `lint`/`format:check` script exists anywhere in this repo, so that step
  was skipped as not applicable.
