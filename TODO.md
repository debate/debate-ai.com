
## Tracker Status

### In progress

_No task currently in progress._

### Completed

- **📋 Evidence Library / 📚 Argument Library / 📊 Topic Coverage Dashboard —
  cross-tab live update.** Another repeat of the standing autonomous-routine
  prompt ("integrate all the tools into the UI... create user settings and
  link user db SQL with the ability to save flows/docs/debates in SQL and
  link to users... add tools into where needed in the UI... develop better
  tool UI") — as with every recent repeat, that prompt's own asks are
  already fully built (account settings synced to a `user_settings` D1 row,
  `documents`/`saved_flows`/`saved_rounds` D1 tables linked to `user.id`,
  and every tool already reachable from the Tools page, CardMirror's own
  Google-Docs-style `MenuBar`/`Ctrl`/`Cmd`-Shift-Space command palette, and
  the feature catalog, all reconfirmed this run), so this slice again picked
  up `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap — explicitly
  named as still open for `ArgumentLibraryPanel`, `EvidenceLibraryPanel`, and
  `TopicCoverageDashboardPanel` (`debate-search-evidence`) by the previous
  two runs' own completed-task notes — and closed it for all three.

  `debate-search-evidence` already had a `state/live-update.ts` (covering 18
  other panels, several living in sibling packages that depend on this one)
  but had never been extended for its own `ArgumentLibraryPanel`,
  `EvidenceLibraryPanel`, or `TopicCoverageDashboardPanel`. Added three new
  key sets/predicates to that file:
  `ARGUMENT_LIBRARY_LIVE_UPDATE_STORAGE_KEYS`/`isArgumentLibraryLiveUpdateStorageEvent`
  (`evidenceLibraryEntries`, `contributions` — both sources
  `buildCombinedPersistedArgumentLibrary` folds together),
  `EVIDENCE_LIBRARY_LIVE_UPDATE_STORAGE_KEYS`/`isEvidenceLibraryLiveUpdateStorageEvent`
  (`evidenceLibraryEntries`, `cardScores`, `peerReviews`,
  `reuseCheckHistory`), and
  `TOPIC_COVERAGE_DASHBOARD_LIVE_UPDATE_STORAGE_KEYS`/`isTopicCoverageDashboardLiveUpdateStorageEvent`
  (`trackedArguments`, `evidenceLibraryEntries`, `contributions`,
  `topicCoverageSnapshots`). Each panel now subscribes to `window`'s
  `storage` event and refreshes its derived view when the predicate matches
  — a card submitted, edited, scored, reviewed, reuse-checked, tagged, or
  retagged, a tracked argument added/removed, or a coverage snapshot
  recorded/cleared in one tab now shows up in every other open tab without a
  manual reload. `TopicCoverageDashboardPanel`'s `refresh` helper also
  gained a guard for an empty active topic (matching its own initial-mount
  effect's existing ternary), since the new subscription can fire before a
  topic is chosen.

  See `docs/features/evidence-library.md`'s new "Cross-tab live update"
  section (covering both `EvidenceLibraryPanel` and `ArgumentLibraryPanel`),
  `docs/features/topic-coverage-dashboard.md`'s new "Cross-tab live update"
  section, and `docs/features/shared-flow-sync.md`'s updated Known gaps
  bullet (added all three panels to the closed list). Vitest-covered:
  `packages/debate-search-evidence/test/live-update.test.ts` (every backing-
  store key, the `null`-key clear-all case, and unrelated/substring-matching
  keys staying ignored, mirroring every other panel's cases in that file).
  `UserSettingsPanel` (`debate-round` — its `form` is a live, directly-
  editable settings form rather than a derived list/roster view, so closing
  it needs refreshing only the persisted values, not stomping an unsaved
  in-progress edit), `OpponentTeamProfilesPanel` (`debate-round`),
  `CoachingProgramsPanel` (`debate-team-collaboration`), and every panel in
  `debate-practice-drills` (`AiVersusRoundPanel`, `ArgumentTreePanel`,
  `CoachingSessionsPanel`, `DrillSetsPanel`, `FlowSummariesPanel`,
  `JudgeDecisionPanel`, `JudgeParadigmPickerPanel`,
  `OpponentPersonaPickerPanel`, `PracticeRoundSimulatorPanel`,
  `VulnerabilityChartsPanel`, `WordCountRoundsPanel` — none of which has a
  `live-update.ts` yet, so a future run picking one up starts by creating
  the first one in that package) remain open for a future run to pick up
  next.

  Ran the full verification gate: `bun run test` (5157 tests passing, up
  from 5144 at HEAD before this change — the 13 new cases above),
  `bunx turbo run typecheck` (16/16 typecheck-bearing packages green,
  `debate-ai-web` has no `typecheck` script), and confirmed `bun run
  build:web` fails identically on this branch and on the branch's own HEAD
  before this change (`UNLOADABLE_DEPENDENCY` on the native `canvas`
  binding during the RSC server-bundle scan — a pre-existing
  sandbox/toolchain limitation unrelated to this change, not something this
  run introduced or could fix without rebuilding that native dependency for
  this container). No `lint`/`format:check` script exists anywhere in this
  repo, so that step was skipped as not applicable.

- **🎓 Coach Materials — cross-tab live update.** Another repeat of the
  standing autonomous-routine prompt ("integrate all the tools into the
  UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built (account settings,
  dozens of `saved_*` D1 tables/`/api/*` routes linking flows, docs, and
  rounds to signed-in users in SQL, and every tool already reachable from
  the Tools page, CardMirror's own `MenuBar`/command palette, and the
  feature catalog, all reconfirmed this run), so this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap and closed it
  for `CoachMaterialsPanel` — explicitly named as the next open item by the
  previous run's own completed-task note ("`CoachMaterialsPanel`,
  `JudgeProfilesPanel`'s own sibling panels in `debate-speech-writer`...
  remains open for a future run to pick up next"), confirmed still missing
  a `storage`-event listener by grepping every panel in the repo.

  Extended `packages/debate-speech-writer/src/state/live-update.ts` (which
  already held `JudgeProfilesPanel`'s own predicate) with
  `COACH_MATERIALS_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isCoachMaterialsPanelLiveUpdateStorageEvent`, covering all three of the
  panel's backing stores: `coachMaterials` (the material library the main
  list, tag dropdown, and Pending review section all derive from),
  `coachMaterialVersions` (a material's "History" toggle), and
  `coachConversation` (the "Ask the coach" conversation history).
  `CoachMaterialsPanel.tsx` now subscribes to `window`'s `storage` event and
  refreshes the material library, tag list, pending-review queue, an open
  material's version list, and the conversation history when the predicate
  matches — a teammate saving, editing, deleting, reviewing, or restoring a
  material (or clearing the conversation) in one tab now shows up in every
  other open tab without a manual reload. The in-progress upload/edit form
  draft, "Reviewer name" field, per-material reject-reason inputs, and the
  "Ask the coach" question/answer fields are left untouched, matching
  `JudgeProfilesPanel`'s "refresh the derived view, not the draft"
  convention.

  See `docs/features/coach-materials.md`'s new "Cross-tab live update"
  section (plus its Known gaps closure bullet) and
  `docs/features/shared-flow-sync.md`'s updated Known gaps bullet (added
  `CoachMaterialsPanel` to the closed list). Vitest-covered:
  `packages/debate-speech-writer/test/live-update.test.ts` (every backing-
  store key, the `null`-key clear-all case, and unrelated/substring-matching
  keys staying ignored, mirroring the existing `JudgeProfilesPanel` cases).
  `UserSettingsPanel` (`debate-round` — its `form` is a live, directly-
  editable settings form rather than a derived list/roster view, so closing
  it needs refreshing only the persisted values, not stomping an unsaved
  in-progress edit), `OpponentTeamProfilesPanel` (`debate-round`),
  `CoachingProgramsPanel` (`debate-team-collaboration`), and every panel
  named in `shared-flow-sync.md`'s Known gap history as still lacking the
  mechanism (`ArgumentLibraryPanel`, `EvidenceLibraryPanel`,
  `TopicCoverageDashboardPanel`, `AiVersusRoundPanel`, `ArgumentTreePanel`,
  `CoachingSessionsPanel`, `DrillSetsPanel`, `FlowSummariesPanel`,
  `JudgeDecisionPanel`, `JudgeParadigmPickerPanel`,
  `OpponentPersonaPickerPanel`, `PracticeRoundSimulatorPanel`,
  `VulnerabilityChartsPanel`, `WordCountRoundsPanel`) remain open for a
  future run to pick up next.

  Ran the full verification gate: `bun run test` (5144 passing, up from
  5140 at HEAD before this change — the 4 new cases above), `bunx turbo run
  typecheck` (16/16 typecheck-bearing packages green, `debate-ai-web` has
  no `typecheck` script), and confirmed `bun run build:web` fails
  identically on this branch and on the branch's own HEAD before this
  change (`UNLOADABLE_DEPENDENCY` on the native `canvas` binding during the
  RSC server-bundle scan — a pre-existing sandbox/toolchain limitation
  unrelated to this change, not something this run introduced or could fix
  without rebuilding that native dependency for this container). No
  `lint`/`format:check` script exists anywhere in this repo, so that step
  was skipped as not applicable.

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
- **🧩 Standing tool-panel/nav UI-polish audit (idea #17, follow-up (4)) — empty-state migration, repo-wide pass.**
  The recurring autonomous-routine prompt ("integrate all the tools into the
  UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where needed
  in the UI... develop better tool UI") has its core asks already fully
  built and reconfirmed again this run: account settings synced to a
  `user_settings` D1 row (debate style/font size/color theme/light-dark
  mode/favorite tools), `documents`/`saved_flows`/`saved_rounds` D1 tables
  each linked to `user.id` and surfaced together on `/tools`' "My Saved
  Items" widget, and all 40+ tools reachable from the `/tools` catalog, the
  dock's Settings→Tools submenu, and the Features page. With nothing new
  needed there, this slice continued idea #17's still-open follow-up (4)
  ("bring weaker panel UIs up to the shared `debate-ui` primitive
  conventions"): prior slices had migrated hand-rolled "no data yet"
  placeholders to the shared `EmptyState` primitive but only searched
  `debate-round`/`debate-practice-drills`. Re-running that same search
  across every package found the identical hand-rolled shape duplicated in
  21 more panels across `debate-ui`, `debate-practice-drills`,
  `debate-team-collaboration`, `debate-contributor-progress`, and
  `debate-research-evidence`, and migrated all of them to `EmptyState`. See
  `docs/features/user-settings.md`'s Known gaps section for the full
  breakdown, including the two packages (`debate-speech-writer`,
  `debate-videos`) deliberately left alone because neither depends on a
  package that exports `EmptyState`.
  Verification: `bun run test` (5137 tests, 268 files, all passing),
  `bun run typecheck` (16/16 packages), `bun run build:web` confirmed
  failing identically before this change (pre-existing sandbox-only
  `canvas` native-binding load failure, unrelated to this diff).

### Follow-ups

- Close the remaining two `debate-speech-writer` (`JudgeProfilesPanel`,
  `CoachMaterialsPanel`) and `debate-videos` (`StandingsPanel`) hand-rolled
  empty states once/if either package takes on a dependency that exports
  the shared `EmptyState` primitive (`debate-round`'s or
  `debate-research-evidence`'s `src/ui/panels/panel-shell`) — currently out
  of scope since neither package depends on either.
- The broader "`PanelShell`/`PanelSection`/`StatTile`/`Pill` adoption is
  still unaudited" half of idea #17's follow-up (4) remains open — see
  `docs/features/user-settings.md`'s Known gaps for the full history of
  what's been swept so far (undiscoverable routes, duplicated empty states,
  duplicated progress bars, duplicated list rows) and what hasn't.
