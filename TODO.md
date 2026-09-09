
## Tracker Status

### In progress

_No task currently in progress._

### Completed

- **🩹 `moveDocument` now writes through the CardMirror save queue.** Another
  repeat of the standing autonomous-routine prompt ("integrate all the tools
  into the UI... create user settings and link user db SQL with the ability to
  save flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent repeat,
  that prompt's own asks are already fully built and reconfirmed again this
  run: `user_settings`/`documents`/`saved_flows`/`saved_rounds` and 25+ other
  `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command palette
  (`Mod-Shift-Space`), and the feature catalog; `bun install` + `bunx turbo run
  typecheck` (17/17 green) also reconfirmed the `write-language`/
  `@ai-sdk/provider` version-conflict flakiness a much earlier entry in this
  tracker flagged as a follow-up isn't currently reproducing, so that wasn't a
  safe target this run either. So this slice picked up the one small,
  concretely-scoped, still-open item `docs/features/cardmirror-embed-persistence.md`'s
  Known gaps named: `moveDocument` (re-parenting a document by dragging it to
  a new folder in the REASON docs sidebar tree) wrote through its own bare
  `fetch(PUT /api/doc/documents/:id)` instead of
  `lib/reason-docs/save-queue.ts`'s `DocumentSaveQueue` — the same queue every
  title/content edit already goes through for per-document debounce,
  retry-with-backoff, and a `pagehide`/tab-hide flush. A re-parent that hit a
  network blip or a 5xx just silently failed instead of retrying.

  `DocumentPatch` now carries an optional `parentId?: number | null` field
  (the API route already accepted it in the PUT body, so no server change was
  needed) and `ReasonDocsProvider.tsx`'s `moveDocument` calls
  `saveQueue.queue(id, { parentId })` instead of its own fetch. No change to
  the queue's merge/retry/flush semantics — `parentId` is just a third patch
  field alongside `title`/`content`, and the existing per-field-acknowledgment
  logic in `write()` already handles a `null` value like any other value. The
  one caller (`ReasonDocsSidebarPanels.tsx`'s drag-to-move handler) already
  calls `moveDocument` fire-and-forget (`void moveDocument(...)`), so sending
  through the queue's background debounce instead of awaiting the PUT inline
  isn't a behavior change from the caller's side.

  See `docs/features/cardmirror-embed-persistence.md`'s updated Known gaps
  (the `moveDocument` bullet is now a description of the fix, not a gap).
  Vitest-covered: `apps/debate-ai.com/lib/reason-docs/__tests__/save-queue.test.ts`'s
  new "retries a re-parent (parentId patch) the same way as a title or body
  edit" case (a failed `parentId: 5` write retries with the newer `parentId:
  null`, mirroring the file's existing title/content retry test).

  Ran the full verification gate: the new test file (10 passing, up from 9),
  `bun run test` (341 files, 7085 tests passing), `bunx turbo run typecheck`
  (17/17 packages green), and `bun run build:web` (production build
  succeeded). No `lint`/`format:check` script exists anywhere in this repo, so
  that step was skipped as not applicable. PR: #713.

- **🧩 `SummaryText` adoption for `FlowSummariesPanel`/`CoachMaterialsPanel`.**
  Another repeat of the standing autonomous-routine prompt ("integrate all the tools
  into the UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where needed in the UI...
  develop better tool UI") — as with every recent repeat, that prompt's own asks are
  already fully built and reconfirmed again this run: `user_settings`/`documents`/
  `saved_flows`/`saved_rounds` and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already reachable from the
  Tools page, CardMirror's own `MenuBar`/command palette (`Mod-Shift-Space`), and the
  feature catalog. Open PR #709 already covers the last concretely-scoped item left open
  under idea #17's follow-up (4) (`JudgeProfilesPanel`/`CoachMaterialsPanel`/
  `StandingsPanel` `PanelShell`/`PanelSection` adoption), and `debate-team-collaboration`'s
  `SharedCardsPanel` toggle-button chips were already found not to be a clean fit for
  `Pill`. So this slice picked a fresh angle on the same standing audit: `debate-ui`'s
  `panel-shell.tsx` (and its `debate-round`/`debate-research-evidence` copies) exports a
  `SummaryText` primitive — a labeled `<pre>` block styled for a slice's
  `build*SummaryText`-shaped plain-text output — that had never been imported anywhere in
  the app (`import.*SummaryText` repo-wide search: zero hits outside the three
  `panel-shell.tsx` files and their own `panel-shell.test.tsx` cases).

  Two panels hand-rolled the exact shape `SummaryText` was built for:
  `debate-practice-drills`' `FlowSummariesPanel` (`buildFlowSummaryTextFromRows(rows)`,
  literally the "build\*SummaryText output" case named in `SummaryTextProps`'s own doc
  comment) and `debate-speech-writer`'s `CoachMaterialsPanel` (the grounded-prompt preview
  and the coach's answer, the latter already paired with a `<Label>Coach's answer</Label>`
  heading that maps directly onto `SummaryText`'s own `label` prop). All three call sites
  used the identical hand-rolled `whitespace-pre-wrap rounded-md border border-border
  bg-muted/30 px-3 py-2 text-sm text-foreground` `<pre>`/`<p>` styling; both files already
  imported `EmptyState` from a `panel-shell` module that also exports `SummaryText`, so no
  new cross-package dependency was needed. Swapped all three for `<SummaryText text={...}
  />` (`CoachMaterialsPanel`'s answer block also passing `label="Coach's answer"`, replacing
  its standalone `<Label>`).

  This is a small, deliberate visual change, called out up front like every other
  primitive-adoption slice in this audit: `SummaryText` has no `className`/tone override
  (unlike `Pill`), so its `text-xs text-muted-foreground`/`bg-muted/50`/`rounded-lg`/
  `overflow-x-auto` styling replaces the panels' previous `text-sm text-foreground`/
  `bg-muted/30`/`rounded-md` look — smaller, more muted text, matching every other panel
  in this repo that already renders a slice's summary output through the shared primitive
  instead of duplicating its markup.

  No new tests added — markup-only change; neither panel has a component-render test in
  this repo (matching every prior markup-only primitive-adoption slice), and `SummaryText`
  itself already has render-test coverage in `packages/debate-ui/test/panel-shell.test.tsx`.
  Ran the full verification gate: `bun install`, `debate-practice-drills`'s own `bunx
  vitest run` (46 files, 698 tests) and `bunx tsc --noEmit`, `debate-speech-writer`'s own
  `bunx vitest run` (20 files, 401 tests) and `bunx tsc --noEmit`, `bun run test` (341
  files, 7084 tests passing), `bun run typecheck` (16/17 packages green; the sole failure,
  `debate-ai-web`, is the pre-existing `write-language`/`@ai-sdk/provider` version-conflict
  issue tracked elsewhere in this file and confirmed unrelated by reproducing it unchanged
  on this branch's HEAD before this slice's edits), and `bun run build:web` (production
  build, succeeded).

- **🧩 `Pill` adoption for `debate-videos`'s `LeaderboardDataRow` tournament chips.**
  Another repeat of the standing autonomous-routine prompt ("integrate all the tools
  into the UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where needed in the UI...
  develop better tool UI") — as with every recent repeat, that prompt's own asks are
  already fully built and reconfirmed again this run: `user_settings`/`documents`/
  `saved_flows`/`saved_rounds` and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already reachable from the
  Tools page, CardMirror's own `MenuBar`/command palette (`Mod-Shift-Space`), and the
  feature catalog. Two open PRs (#709 `PanelShell`/`PanelSection` for the last three
  `debate-speech-writer`/`debate-videos` panels, #695 D1-migration/account-sync error
  handling) already cover the other concretely-scoped items left open under idea #17's
  follow-up (4), so this slice closed the one remaining named-but-unclaimed item: the
  `Pill` adoption spot-check's `debate-videos` half (see this file's Follow-ups section).

  `LeaderboardDataRow`'s mobile tournament chips (`entry.details.map(...)`) hand-rolled
  `<span className="inline-flex items-center gap-1 text-xs bg-muted text-muted-foreground
  rounded-full px-2 py-0.5">` — the same shape the shared `Pill` primitive
  (`debate-research-evidence/src/ui/panels/panel-shell`) already covers, and now
  reachable from `debate-videos` since #708 added the `debate-research-evidence`
  dependency edge for the `EmptyState` migration (the earlier `Pill` spot-check had found
  this exact chip but left it open only because that edge didn't exist yet at the time).
  Swapped the `<span>` for `<Pill className="gap-1 font-normal">`, keeping the icon +
  `"{tournament} · {placement}"` children unchanged; `font-normal` overrides `Pill`'s
  default `font-medium` (via `cn`'s `tailwind-merge`) to match the original chip's
  unweighted text, since nothing else about the original styling called for emphasis.
  `Pill`'s own `neutral`-tone background/border reads close enough to the original
  `bg-muted`/no-border look to not need a `tone` override either.

  No new tests added — markup-only change; no component-rendering test in
  `debate-videos` touches this panel's markup, matching every prior `Pill`/`EmptyState`/
  `PanelShell` migration slice in this repo. Ran the full verification gate: `bun install`,
  `debate-videos`'s own `bunx vitest run` (12 files, 139 tests) and `bunx tsc --noEmit`,
  `bun run test` (341 files, 7084 tests passing), `bun run typecheck` (17/17 packages
  green), and `bun run build:web` (production build, succeeded).

  This closes the last item named in the "`Pill` adoption" follow-up under idea #17's
  follow-up (4) — see this file's Follow-ups section for the full history.

- **🧩 Close the `debate-speech-writer`/`debate-videos` `EmptyState` cross-package-dependency
  gap.** Another repeat of the standing autonomous-routine prompt ("integrate all the tools
  into the UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where needed in the UI...
  develop better tool UI") — as with every recent repeat, that prompt's own asks are already
  fully built and reconfirmed again this run: `user_settings`/`documents`/`saved_flows`/
  `saved_rounds` and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already reachable from the
  Tools page, CardMirror's own `MenuBar`/command palette (`Mod-Shift-Space`), and the feature
  catalog. So this slice picked the one concretely-scoped item left open under idea #17's
  follow-up (4): the repo-wide duplicated-`EmptyState` sweep (see this file's Follow-ups
  section) had left `debate-speech-writer`'s `JudgeProfilesPanel`/`CoachMaterialsPanel` and
  `debate-videos`'s `StandingsPanel` unmigrated because neither package depended on
  `debate-round` or `debate-research-evidence` — the two packages whose `panel-shell.tsx`
  exports the shared `EmptyState` primitive — and adding a new cross-package dependency edge
  was out of scope for a markup-only pass.

  Checked for a cycle before adding the edge: `debate-round` already depends on both
  `debate-speech-writer` and `debate-videos`, so pointing either of *those* back at
  `debate-round` would be circular — but `debate-research-evidence`'s own dependency tree
  (`debate-card-parser` plus a handful of UI/parsing libraries) has no edge back to either
  package, so `debate-research-evidence: "workspace:*"` was added to both
  `debate-speech-writer/package.json` and `debate-videos/package.json` instead (`bun install`
  to refresh `bun.lock`), matching how `debate-contributor-progress` and other already-migrated
  packages resolve the same import
  (`import { EmptyState } from "debate-research-evidence/src/ui/panels/panel-shell"`).

  All three panels' hand-rolled `<div className="p-6 text-center text-sm
  text-muted-foreground">…</div>` (or, for `StandingsPanel`, an already-near-identical
  hand-copied `rounded-lg border border-dashed border-border p-6 text-center text-sm
  text-muted-foreground` `<p>`) now render `<EmptyState>`, each message split on its first
  "…yet." sentence into `title`/`message` the same way every prior `EmptyState` migration
  slice in this repo did: `JudgeProfilesPanel`'s "No judge profiles yet." / "Log a judged round
  above to build one.", `StandingsPanel`'s "No tournament results logged yet." / "Log one
  above, or bulk-import a CSV.", and `CoachMaterialsPanel`'s "No coach materials uploaded yet."
  / "Add one above to see it here." — its second, dynamic no-search-match message ("No
  materials match this search/tag filter.") has no "…yet." to split on, so it's passed as
  `title` alone, matching `FeaturesPanel`'s empty-search-state precedent.

  This closes the last two packages named in the "duplicated empty states" half of idea #17's
  follow-up (4) — see this file's Follow-ups section and `docs/features/user-settings.md`'s
  Known gaps for the full history of what's been swept.

  No new tests added — markup-only change; the one existing test that touches this string
  (`debate-speech-writer/test/team-coach-materials.test.ts`'s
  `buildCoachMaterialLibrarySummaryText` case) exercises a separate pure-logic summary builder,
  not this panel's markup, and still passes unchanged. Ran the full verification gate: `bun
  install` (refreshed `bun.lock` for the two new workspace edges), `bun run test` (341 files,
  7084 tests passing), `bun run typecheck` (17/17 packages green), `debate-speech-writer`'s own
  `bunx vitest run` (20 test files, 401 tests) and `bunx tsc --noEmit`, `debate-videos`'s own
  `bunx vitest run` (12 test files, 139 tests) and `bunx tsc --noEmit`, and `bun run build:web`
  (production build, succeeded).

- **🧩 `PanelShell`/`PanelSection` adoption across `debate-practice-drills`
  panels.** Another repeat of the standing autonomous-routine prompt
  ("integrate all the tools into the UI... create user settings and link
  user db SQL with the ability to save flows/docs/debates in SQL and link to
  users... add tools into where needed in the UI... develop better tool
  UI") — as with every recent repeat, that prompt's own asks are already
  fully built and reconfirmed again this run: `user_settings`/`documents`/
  `saved_flows`/`saved_rounds` and 25+ other `saved_*` D1 tables all linked
  to `user.id` (`apps/debate-ai.com/lib/database/schema.ts`), and every tool
  already reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette (`Mod-Shift-Space`), and the feature catalog. So this slice closed
  idea #17's still-open follow-up (4) — the "`PanelShell`/`PanelSection`
  adoption is still unaudited" half named in
  `docs/features/user-settings.md`'s Known gaps — picking
  `debate-practice-drills` (npm package name `debate-practice-rounds`), the
  last of the packages that half's original repo-wide survey left open (the
  open PRs at the start of this run — #695 D1-migration/account-sync error
  handling, #694 video search-suggestion chips, #693
  `debate-team-collaboration`'s `PanelShell` pass — don't touch this
  package).

  `debate-practice-drills` already depends on `debate-round` and every one
  of its 12 panels already imported `EmptyState` (several also `MeterBar`/
  `PanelRow`) from its `./ui/panels/panel-shell` module, so no new
  cross-package dependency was needed. All 12 panels hand-rolled the same
  top-level `<h1 className="mb-1 text-xl font-semibold text-foreground">`
  header and were migrated onto `PanelShell`: `AiVersusRoundPanel`,
  `ArgumentTreePanel`, `CoachingSessionsPanel`, `DrillSetsPanel`,
  `FlowAnnotationsPanel`, `FlowSummariesPanel`, `JudgeDecisionPanel`,
  `JudgeParadigmPickerPanel`, `OpponentPersonaPickerPanel`,
  `PracticeRoundSimulatorPanel`, `VulnerabilityChartsPanel`, and
  `WordCountRoundsPanel`. Each panel's genuinely singular, non-repeated
  `<h2>`-titled sub-section was also migrated onto `PanelSection`:
  `AiVersusRoundPanel`'s "Compare transcripts", `DrillSetsPanel`'s "Practice
  tier" (its tier `Badge` moved into `PanelSection`'s `actions` slot),
  `FlowSummariesPanel`'s "Generate from raw speech text",
  `JudgeDecisionPanel`'s "Multi-judge panel", `OpponentPersonaPickerPanel`'s
  "My persona library" and "Shared by your team", `PracticeRoundSimulatorPanel`'s
  "Compare your past attempts" (its "Download comparison" button moved into
  `actions`), and `WordCountRoundsPanel`'s "Round history" (its "Delete all
  synced history" button moved into `actions`) and "Word-count trend" (its
  conditional speech-filter `Select` moved into `actions`). A header or
  section carrying a second paragraph with embedded markup or dynamic
  sign-in-status copy (`DrillSetsPanel`'s and `JudgeDecisionPanel`'s
  sync-status line, `WordCountRoundsPanel`'s custom-word-limit/sync-status
  lines, `OpponentPersonaPickerPanel`'s sync-status sentence) was kept as a
  plain child element rather than forced through the string-only
  `description` prop, matching every prior slice's judgment call.
  `CoachingSessionsPanel`, `FlowAnnotationsPanel`, and
  `JudgeParadigmPickerPanel` had no singular `<h2>` sub-section to migrate
  (their only `<h2>`s are per-item loop headings, or they have none), so
  only their top-level header moved; `ArgumentTreePanel`'s and
  `VulnerabilityChartsPanel`'s sole `<h2>` (a per-item "Round {id}" loop
  heading) was likewise left alone, matching the historical `PanelRow`
  audit's judgment call for the same shape.

  This closes the last package left open by the repo-wide `PanelShell`/
  `PanelSection` survey — see `docs/features/user-settings.md`'s Known gaps
  and this file's Follow-ups section for the full history of what's been
  swept.

  No new tests added — markup-only change, each panel's own pure-logic
  functions stay covered by `debate-practice-drills`'s existing state/lib
  test suite, matching every prior `PanelShell`/`PanelSection` migration
  slice in this repo. Ran the full verification gate: `bun run test` (340
  files, 7064 tests passing), `bun run typecheck` (16/17 packages green;
  the sole failure, `debate-ai-web`, is a pre-existing `write-language`/
  `@ai-sdk` provider version-mismatch type error reproduced identically on
  master before this change, unrelated to this diff), `debate-practice-drills`'s
  own `bunx vitest run` (46 test files, 698 tests passing), and `bun run
  build:web` (production build, succeeded). No `lint`/`format:check` script
  exists anywhere in this repo, so that step was skipped as not applicable.

- **🧩 `PanelShell`/`PanelSection` adoption across `debate-contributor-progress`
  panels.** Another repeat of the standing autonomous-routine prompt
  ("integrate all the tools into the UI... create user settings and link
  user db SQL with the ability to save flows/docs/debates in SQL and link to
  users... add tools into where needed in the UI... develop better tool
  UI") — as with every recent repeat, that prompt's own asks are already
  fully built and reconfirmed again this run: `user_settings`/`documents`/
  `saved_flows`/`saved_rounds` and 25+ other `saved_*` D1 tables all linked
  to `user.id` (`apps/debate-ai.com/lib/database/schema.ts`), and every tool
  already reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette (`Mod-Shift-Space`), and the feature catalog. So this slice
  continued idea #17's still-open follow-up (4) — the "`PanelShell`/
  `PanelSection` adoption is still unaudited" half named in
  `docs/features/user-settings.md`'s Known gaps — picking
  `debate-contributor-progress` (npm package name `debate-community`) next,
  the first of the two packages the prior `debate-round` slice left open (the
  other, `debate-practice-drills`, remains unaudited). The open PRs at the
  start of this run (#693 `debate-team-collaboration` `PanelShell` pass, #694
  video search-suggestion chips, #695 D1-migration/account-sync error
  handling) don't touch this package.

  `debate-contributor-progress` already depends on `debate-research-evidence`
  (the same `./ui/panels/panel-shell` module every one of its panels already
  imported `EmptyState`/`StatGrid`/`StatTile`/`MeterBar` from), so no new
  cross-package dependency was needed. Migrated all 9 panels that hand-rolled
  a top-level `<h1>`-title-plus-description header onto `PanelShell`:
  `ContributionLeaderboardPanel`, `CoachingProgramRosterAnalyticsPanel`,
  `ContributorAwardsPanel`, `DailyBestCardPanel`, `ProgressUnlocksPanel`,
  `QuestStreaksPanel`, `ContributorProfilePanel`, `CommunityResearchHubPanel`,
  and `DailyQuestsPanel` (`NewsStreamPanel`, the package's 10th panel, has no
  matching header shape, so it was left alone). Each panel's genuinely
  singular, non-repeated `<h2>`-titled sub-section also moved onto
  `PanelSection`: `CoachingProgramRosterAnalyticsPanel`'s "Recent challenge
  results"/"Program calendar", `ContributorProfilePanel`'s "Badges"/"Top
  Contributor Awards"/"Endorsements received"/"Endorsements given",
  `CommunityResearchHubPanel`'s conditional "For You" strip, and
  `DailyQuestsPanel`'s "Team competition" (kept its own `border-dashed`
  styling via `PanelSection`'s `className` prop). A description containing
  embedded markup (`ContributionLeaderboardPanel`'s tooltip-carrying
  paragraph, `CommunityResearchHubPanel`'s second machine-generated summary
  line) was kept as a plain child element rather than forced through
  `PanelShell`'s string-only `description` prop. `ContributorAwardsPanel` and
  `DailyBestCardPanel` had no `<h2>`-titled sub-section to migrate (their
  labeled blocks use a plain `<div>` label, not a heading), so only their
  top-level header moved. `ContributorProfilePanel`'s header carried a
  "You"/tier `Badge` pair inline next to its per-contributor-id `<h1>` rather
  than a plain description — moved into `PanelShell`'s `actions` slot
  (right-aligned) instead of leaving that header unmigrated, the one
  deliberate layout adjustment in this slice. Per-category/per-day loop
  `<h2>`s in `CommunityResearchHubPanel`/`CoachingProgramRosterAnalyticsPanel`
  were left alone as repeated row headings, not panel/section headers.

  Only `debate-practice-drills` remains open for a future run to pick up
  next — see `docs/features/user-settings.md`'s updated Known gaps section
  for the full breakdown.

  No new tests added — markup-only change, each panel's pure-logic functions
  stay covered by the package's existing state/lib test suite, matching
  every prior `PanelShell`/`PanelSection` migration slice in this repo. Ran
  the full verification gate: `bun run test` (340 files, 7064 tests
  passing), `bun run typecheck` (16/17 packages green; the sole failure,
  `debate-ai-web`, is a pre-existing `write-language`/`@ai-sdk` provider
  version-mismatch type error reproduced identically on master before this
  change, unrelated to this diff), `debate-community`'s own `bunx vitest
  run` (21 test files, 420 tests passing), and `bun run build:web`
  (production build, succeeded). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable.

- **🧩 `PanelShell`/`PanelSection` adoption across `debate-round` panels.**
  Another repeat of the standing autonomous-routine prompt ("integrate all
  the tools into the UI... create user settings and link user db SQL with
  the ability to save flows/docs/debates in SQL and link to users... add
  tools into where needed in the UI... develop better tool UI") — as with
  every recent repeat, that prompt's own asks are already fully built and
  reconfirmed again this run: `user_settings`/`documents`/`saved_flows`/
  `saved_rounds` and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command palette,
  and the feature catalog. So this slice continued idea #17's still-open
  follow-up (4) — the "`PanelShell`/`PanelSection` adoption is still
  unaudited" half named in `docs/features/user-settings.md`'s Known gaps —
  picking `debate-round` next (of the three packages that bullet left
  unaudited: `debate-round`, `debate-contributor-progress`,
  `debate-practice-drills`; the open PRs at the start of this run were #695
  (D1-migration/account-sync error handling), #694 (video search-suggestion
  chips), and #693 (`debate-team-collaboration`'s `PanelShell` pass), none
  of which touch this package).

  `debate-round` already ships its own `ui/panels/panel-shell.tsx` (used by
  `FlowEditLogPanel`/`SharedFlowSyncPanel`), so no new cross-package
  dependency was needed. Migrated the three panels that hand-rolled a
  top-level `<h1>`-title-plus-description header and already imported
  `EmptyState` from that same module: `OpponentTeamProfilesPanel`,
  `PreRoundBriefingsPanel`, and `StrategyPanel` — all onto `PanelShell`,
  moving `OpponentTeamProfilesPanel`'s "Download report" button into its
  `actions` prop. Each panel's genuinely singular, non-repeated `<h2>`-titled
  sub-section was also migrated onto `PanelSection` where one existed:
  `OpponentTeamProfilesPanel`'s "Bulk import (CSV)" (kept as a plain child
  paragraph rather than the `description` prop, since it embeds `<code>`
  tags) and "Logged rounds"; `PreRoundBriefingsPanel`'s "Pairing schedule"
  and "Log a round" (both `className="rounded-lg border border-border p-4"`
  on `PanelSection` to keep their existing bordered-card look, matching the
  prior `debate-search-evidence` slice's convention for a section that used
  to carry its own border). Left alone, matching that same slice's judgment
  calls: `OpponentTeamProfilesPanel`'s "Log a scouted round"/"Edit logged
  round" form and "Compare vs. opponent" block (a `<Label>`, not an `<h2>`,
  heading the latter) stayed plain `<div>`s; `StrategyPanel`'s and
  `PreRoundBriefingsPanel`'s per-item loop `<h2>`s (one per matchup/briefing
  record) stayed as-is — a repeated per-row heading, not a panel/section
  header; `WordLimitPresetsPanel` (a `/settings`-page section, not a
  standalone panel card) and `UserSettingsPanel` (a live, directly-editable
  settings form, not a derived list/roster view — and already flagged
  elsewhere as needing careful handling) were left out of scope entirely.
  `DebateRoundPanel`, `FlowEditLogPanel`, and `SharedFlowSyncPanel` needed no
  change: the first has no matching header shape, the latter two already
  use `PanelShell`/`PanelSection`.

  Of the three packages the prior slice left unaudited, `debate-round` is
  now closed; `debate-contributor-progress` and `debate-practice-drills`
  remain open for a future run.

  No new tests added — this is a markup-only change, and each panel's own
  pure-logic functions stay covered by `debate-round`'s existing state/lib
  test suite, matching how every prior `PanelShell`/`EmptyState`/`PanelRow`
  migration slice in this repo was also verified via typecheck/tests rather
  than new render tests. Ran the full verification gate: `bun run test`
  (340 files, 7064 tests passing), `bun run typecheck` (17/17 packages
  green), `debate-round`'s own `bunx vitest run` inside
  `packages/debate-round` (54 test files, 1136 tests passing) and `bunx
  turbo run typecheck --filter=debate-round` individually, and `bun run
  build:web` (production build). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable.

- **🩹 CardMirror embed: a loaded file can no longer go blank — or save itself
  blank.** Reported from the field: "after a file is loaded sometimes it
  disappears and goes blank." It was never only a display bug. The web hosts
  (`/reason-editor`, Flow's speech-doc panels) persist whatever the embed's
  `onChange` reports, and the reporter fired on ANY doc change — including
  the ones the engine makes on its own initiative, which in an embed means
  its blank starter doc. The blank was written to `documents` and the file
  was gone.

  Four failures, each proven and each now covered by a test:

  1. **Every doc change counted as a user edit.** `change-reporter.ts` now
     tells a transaction (a real edit) apart from a whole-state replacement
     (the engine's `mountView` — boot, New/Open, crash recovery, a joined
     session) using plugin state, which `apply`s for transactions only. Only
     the first is reported. A blank replacement the user didn't ask for is
     restored from the loaded document instead of left on screen, and the
     engine is told which doc is mounted (`adoptEmbeddedDoc`) so its own
     `currentDoc` — the fallback content for any remount it does itself —
     stops pointing at the blank starter from boot.
  2. **Unreadable stored content mounted as blank.** `htmlToDoc` answered
     "this didn't parse" and "this document is empty" with the same blank
     doc. `parseHtml` now reports which; a failed load keeps what's on
     screen, files a durable notice, and blocks all reporting for that
     document so the intact copy on the server survives.
  3. **Footnotes were dropped by every HTML round trip.** A footnote ref
     serializes to an empty `<sup>`; ProseMirror collects mark rules before
     node rules, so the generic `superscript` mark rule matched first and the
     footnote came back as a mark on no text. The node rule now carries
     `priority: 60`.
  4. **Edits went to the wrong document, or nowhere.** The change debounce is
     flushed before the live binding changes and on page hide; the provider's
     single shared save timer — which cancelled a *different* document's
     pending write, so renaming a file and then typing in another silently
     dropped the rename — is replaced by `lib/reason-docs/save-queue.ts`: one
     debounce per document, merged patches, `keepalive` flush on `pagehide`
     and tab-hide, retry with backoff, queued writes cancelled on delete, and
     a real `Saving…`/`Unsaved changes`/`Couldn't save — retrying…` indicator
     instead of a `Saving…` that never resolved.

  See `docs/features/cardmirror-embed-persistence.md`. Tests:
  `packages/debate-editor/test/change-reporter.test.ts`,
  `packages/debate-editor/test/html-bridge.test.ts`,
  `apps/debate-ai.com/lib/reason-docs/__tests__/save-queue.test.ts`.

- **🧩 `PanelShell`/`PanelSection` adoption — `debate-search-evidence` package
  pass.** Another repeat of the standing autonomous-routine prompt
  ("integrate all the tools into the UI... create user settings and link
  user db SQL with the ability to save flows/docs/debates in SQL and link to
  users... add tools into where needed in the UI... develop better tool
  UI") — as with every recent repeat, that prompt's own asks are already
  fully built and reconfirmed again this run: `user_settings`/`documents`/
  `saved_flows`/`saved_rounds` and 25+ other `saved_*` D1 tables all linked
  to `user.id` (`apps/debate-ai.com/lib/database/schema.ts`), and every tool
  already reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette, and the feature catalog. So this slice again picked up idea #17's
  still-open follow-up (4): the "`PanelShell`/`PanelSection`/`StatTile`/
  `Pill` adoption is still unaudited" half named in
  `docs/features/user-settings.md`'s Known gaps. An open PR (#693) already
  covered `debate-team-collaboration` — the only other open PR at the start
  of this run was an unrelated Parquet card-import feature (#687) and an
  unrelated DB-error-diagnostics fix (#663) — so this slice scoped to a
  different package per that Known gap's own "package by package" guidance:
  `debate-search-evidence` (npm package name `debate-research-evidence`),
  whose 7 panels were all one import away from the primitive (the same
  `./ui/panels/panel-shell` module each already imported `EmptyState`/
  `MeterBar` from) with no new cross-package dependency needed.

  Migrated all 7 panels (`ArgumentLibraryPanel`, `CardScoringPanel`,
  `ContributionsFeedPanel`, `EvidenceLibraryPanel`, `ReviewQueuePanel`,
  `RevisionIncentivesPanel`, `TopicCoverageDashboardPanel`) off their
  hand-rolled top-level `<h1>`-title-plus-description header onto
  `PanelShell`. Also migrated each panel's genuinely singular, non-repeated
  `<h2>`-titled sub-section onto `PanelSection` where one existed:
  `CardScoringPanel`'s "Bulk import"/"My score trend" (the latter's
  contributor `Select` moved into `actions`), `ContributionsFeedPanel`'s
  dynamic "Flagged for review (N)"/"All contributions (N)" list header (its
  toggle `Button` moved into `actions`), `EvidenceLibraryPanel`'s "Check this
  page"/"Team reuse dashboard"/"Pending review (N)", `ReviewQueuePanel`'s
  "Reviewer workload", and `RevisionIncentivesPanel`'s "Stale evidence
  digest"/"Leaderboard"/"Recent revisions" (dropping each `<section>`'s own
  `mb-6` in favor of `PanelShell`'s `gap-4`). A description containing
  embedded markup (a `<code>` tag, or `ContributionsFeedPanel`'s
  tooltip-carrying paragraph) was kept as a plain child element instead of
  forced through the `description` prop, which only accepts a plain string.
  `ArgumentLibraryPanel` and `TopicCoverageDashboardPanel` had no `<h2>`-
  titled sub-section to migrate (their bordered blocks use a plain `<div>`
  label, not a heading) — only their top-level header moved onto
  `PanelShell`. `debate-speech-writer`'s two panels remain blocked the same
  way they are for the `EmptyState` gap (neither `debate-round` nor
  `debate-research-evidence` is one of its dependencies); `debate-round`,
  `debate-contributor-progress`, and `debate-practice-drills` are still
  unaudited.

  See `docs/features/user-settings.md`'s updated Known gaps bullet for the
  full per-panel breakdown. No new tests added — this is a markup-only
  change, and each panel's own pure-logic functions stay covered by the
  package's existing state/lib test suite, matching how prior `PanelShell`/
  `EmptyState`/`PanelRow` migration slices in this repo were also verified
  via typecheck/tests rather than new render tests. Ran the full
  verification gate: `npx vitest run --config
  apps/debate-ai.com/vitest.config.ts` (334 test files, 7017 tests
  passing), `bun run typecheck` (17/17 packages green), the package's own
  `npx vitest run` inside `packages/debate-search-evidence` (38 test files,
  1154 tests passing) and `bunx turbo typecheck --filter=debate-research-evidence`
  individually, and `bun run build:web` (production build completes
  successfully, including the service-worker asset-list generation step).
  No `lint`/`format:check` script exists anywhere in this repo, so that step
  was skipped as not applicable.

- **🗑️ Remove dead `debate-videos` `panels/rankings/` duplicate tree
  (Follow-up item).** Another repeat of the standing autonomous-routine
  prompt ("integrate all the tools into the UI... create user settings and
  link user db SQL with the ability to save flows/docs/debates in SQL and
  link to users... add tools into where needed in the UI... develop better
  tool UI") — as with every recent repeat, that prompt's own asks are
  already fully built and reconfirmed again this run: `user_settings`/
  `documents`/`saved_flows`/`saved_rounds` and 25+ other `saved_*` D1
  tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette, and the feature catalog. So this slice picked up the open
  Follow-up: "`debate-videos`' leaderboard panels appear to exist as a
  duplicated tree... not yet investigated for which tree (if either) is
  dead code versus which is actually wired up to a route. Needs its own
  slice to confirm before deleting anything."

  Confirmed via a repo-wide grep of every `RankingsLeaderboardPanel`/
  `DebateRankingsPanel`/`StandingsPanel`/`panels/rankings` reference that
  `packages/debate-videos/src/panels/leaderboard/RankingsLeaderboardPanel`
  is the tree `debate-videos`' `index.ts` exports as `LeaderboardPanel` and
  that `apps/debate-ai.com/app/rank/page.tsx` (the live `/rank` route)
  renders. `packages/debate-videos/src/panels/rankings/DebateRankingsPanel`
  and its five sibling files (`LeaderboardChampionBanner.tsx`,
  `LeaderboardDataRow.tsx`, `LeaderboardFilterBar.tsx`,
  `LeaderboardTable.tsx`, `LeaderboardTableHeader.tsx`,
  `leaderboardTypes.ts`, `leaderboardUtils.ts`) had zero references anywhere
  outside their own directory — not `index.ts`, not any route, not any doc,
  not any test. A file-by-file diff against the `leaderboard/` tree showed
  5 of 7 shared filenames were byte-identical duplicates, and the main
  panel (`DebateRankingsPanel` vs. `RankingsLeaderboardPanel`) was a strict
  subset missing the later-added "Standings" tab (`StandingsPanel`) — i.e.
  `rankings/` was `leaderboard/`'s predecessor, left behind as dead code
  after the rename/rebuild rather than deleted. Deleted the entire
  `packages/debate-videos/src/panels/rankings/` directory (8 files, ~1,090
  lines). No doc referenced the dead directory, so no doc updates were
  needed; no new tests were needed since this removes unreferenced code
  rather than changing behavior — the existing `leaderboard-utils.test.ts`
  (which already imports only from `leaderboard/`) continues to cover the
  live tree.

  Ran the full verification gate against a clean `bun install` (removed and
  reinstalled all `node_modules`): `bun run test` (331 test files, 6,989
  tests passing), `bunx turbo run typecheck` (16/17 tasks green —
  `debate-ai-web#typecheck` fails identically with this change reverted, in
  a git worktree of `origin/master`, and in a fresh `bun install` of this
  same branch, all with an unrelated `@ai-sdk/provider` v2-vs-v3 type
  conflict pulled in transitively through `write-language`; the resolution
  bun's flat-node_modules hoisting picks for that conflicting transitive
  dependency appears to vary between separate `bun install` runs — same
  `bun.lock`, same `package.json` in every case checked — independent of
  this change), and `bun run build:web` (production build completes
  successfully, including the service-worker asset-list generation step and
  the `/rank` route). No `lint`/`format:check` script exists anywhere in
  this repo, so that step was skipped as not applicable.

  **Follow-up:** the `debate-ai-web#typecheck` / `write-language` /
  `@ai-sdk/provider` version-conflict flakiness above is pre-existing and
  unrelated to this change, but is newly documented here (not previously
  called out in this tracker) — worth a dedicated slice to either pin
  `write-language`'s `@ai-sdk/provider` peer to the same major version the
  rest of the app uses, or otherwise make the hoisted resolution
  deterministic, so `typecheck` stops being install-order-dependent.

- **📋 Speech Transcript Summaries — cross-tab live update.** Another repeat
  of the standing autonomous-routine prompt ("integrate all the tools into
  the UI... create user settings and link user db SQL with the ability to
  save flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built and reconfirmed
  again this run: `user_settings`/`documents`/`saved_flows`/`saved_rounds`
  and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette, and the feature catalog. So this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap. The prior
  run's list of still-open panels (`AiVersusRoundPanel`, `ArgumentTreePanel`,
  `CoachingSessionsPanel`, `DrillSetsPanel`, `FlowSummariesPanel`,
  `PracticeRoundSimulatorPanel`, `VulnerabilityChartsPanel`,
  `WordCountRoundsPanel`) turned out to be stale — a fresh grep of every
  `panels/*.tsx` file (and the hooks they read through) for an existing
  `storage`-event listener, cross-checked against the open PR list (none
  open against this Known gap at the start of this run), showed all but
  `FlowSummariesPanel` had already been closed by intervening runs, so this
  slice picked `FlowSummariesPanel` as the one genuinely still-unclaimed
  panel.

  Extended `packages/debate-practice-drills/src/state/live-update.ts` with
  `FLOW_SUMMARIES_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isFlowSummariesPanelLiveUpdateStorageEvent`, covering the panel's one
  direct backing store: `flowSummaries` (the per-round flow-summary list).
  `FlowSummariesPanel.tsx` now subscribes to `window`'s `storage` event and
  calls its existing `refresh()` closure when the predicate matches — a
  summary generated (manually or via AI transcript extraction), or cleared,
  in one tab now shows up in every other open tab without a manual reload.

  See `docs/features/flow-summaries.md`'s new "Cross-tab live update"
  section and `docs/features/shared-flow-sync.md`'s updated Known gaps
  bullet (added `FlowSummariesPanel` to the closed list). Vitest-covered:
  `packages/debate-practice-drills/test/live-update.test.ts` (the one
  backing-store key, the `null`-key clear-all case, and
  unrelated/substring-matching keys staying ignored).

  Ran the full verification gate: `npx vitest run --config
  apps/debate-ai.com/vitest.config.ts` (331 test files, 6980 tests passing),
  `bunx turbo typecheck --filter=debate-practice-rounds` (12/12 tasks
  green), and `bun run build:web` (production build completes
  successfully, including the service-worker asset-list generation step).
  No `lint`/`format:check` script exists anywhere in this repo, so that
  step was skipped as not applicable.
- **🎭 Opponent Persona Picker — cross-tab live update.** Another repeat of
  the standing autonomous-routine prompt ("integrate all the tools into the
  UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built and reconfirmed
  again this run: `user_settings`/`documents`/`saved_flows`/`saved_rounds`
  and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette, and the feature catalog. So this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap. Two other
  sessions had open PRs against the same Known gap for `JudgeDecisionPanel`
  (#658) and `ResponseOutcomeChartsPanel` (#657) at the start of this run,
  so this slice cross-checked the open-PR list first and picked
  `debate-practice-drills`'s `OpponentPersonaPickerPanel` instead — a
  genuinely still-unclaimed panel confirmed via a direct grep of every
  `panels/*.tsx` file in the repo for an existing `storage`-event listener.

  Extended `packages/debate-practice-drills/src/state/live-update.ts` (which
  already held `JudgeParadigmPickerPanel`'s own predicate) with
  `OPPONENT_PERSONA_PICKER_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isOpponentPersonaPickerPanelLiveUpdateStorageEvent`, covering the panel's
  one direct backing store: `opponentPersonaSelections` (the per-session
  saved-persona list). `OpponentPersonaPickerPanel.tsx` now subscribes to
  `window`'s `storage` event and calls its existing `refresh()` closure when
  the predicate matches — a teammate saving or clearing a session's opponent
  persona in one tab now shows up in every other open tab without a manual
  reload. The account-synced custom-persona library ("My persona library"/
  "Shared by your team", via `useCustomOpponentPersonaLibrary`) is
  deliberately excluded — it manages its own refresh through that hook
  rather than a raw `localStorage` read — and the in-progress session-
  selection form draft is left untouched, matching every other closed
  panel's "refresh the derived view, not the draft" convention.

  See `docs/features/practice-opponent.md`'s new "Cross-tab live update"
  section and `docs/features/shared-flow-sync.md`'s updated Known gaps
  bullet (added `OpponentPersonaPickerPanel` to the closed list).
  Vitest-covered: `packages/debate-practice-drills/test/live-update.test.ts`
  (the one backing-store key, the `null`-key clear-all case, and
  unrelated/substring-matching keys staying ignored). `UserSettingsPanel`
  (`debate-round` — its `form` is a live, directly-editable settings form
  rather than a derived list/roster view, so closing it needs refreshing
  only the persisted values, not stomping an unsaved in-progress edit),
  `CoachingProgramsPanel` (`debate-team-collaboration`), and the remaining
  panels in `debate-practice-drills` not already covered by this run or the
  two open PRs above (`AiVersusRoundPanel`, `ArgumentTreePanel`,
  `CoachingSessionsPanel`, `DrillSetsPanel`, `FlowSummariesPanel`,
  `PracticeRoundSimulatorPanel`, `VulnerabilityChartsPanel`,
  `WordCountRoundsPanel`) remain open for a future run to pick up next —
  each of those can now extend this same `live-update.ts` file rather than
  creating another one.

  Ran the full verification gate: `bun run test` (5169 passing, up from
  5165 at HEAD before this change — the 4 new cases above), `bunx turbo run
  typecheck` (16/16 typecheck-bearing packages green, `debate-ai-web` has
  no `typecheck` script), and confirmed `bun run build:web` fails
  identically on this branch and on the branch's own HEAD before this
  change (`UNLOADABLE_DEPENDENCY` on the native `canvas` binding during the
  RSC server-bundle scan — a pre-existing sandbox/toolchain limitation
  unrelated to this change, not something this run introduced or could fix
  without rebuilding that native dependency for this container). No
  `lint`/`format:check` script exists anywhere in this repo, so that step
  was skipped as not applicable.
- **🧩 Standing tool-panel/nav UI-polish audit (idea #17, follow-up (4)) — StatTile/StatGrid adoption pass.**
  Another repeat of the standing autonomous-routine prompt ("integrate all
  the tools into the UI... create user settings and link user db SQL with
  the ability to save flows/docs/debates in SQL and link to users... add
  tools into where needed in the UI... develop better tool UI") — as with
  every recent repeat, that prompt's own asks are already fully built and
  reconfirmed again this run: `user_settings`/`documents`/`saved_flows`/
  `saved_rounds` and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette, and the feature catalog. This run's shared-flow-sync.md-tracked
  "every other localStorage-backed panel... still has no cross-tab
  live-update mechanism" Known gap is also now fully closed (confirmed via
  a fresh read of that bullet's closed-panel list, which now names every
  panel this repo has). So this slice instead picked up
  `user-settings.md`'s still-open half of idea #17's follow-up (4):
  "`PanelShell`/`PanelSection`/`StatTile`/`Pill` adoption is still
  unaudited" — the one shared-primitive pattern none of the prior
  `EmptyState`/`MeterBar`/`PanelRow` audit passes had searched for yet.

  A repo-wide search for `StatTile`/`StatGrid`-shaped markup (a small
  bordered box with a label + large metric value, usually gridded) found
  exactly one hand-rolled duplicate:
  `packages/debate-contributor-progress/src/panels/ContributorProfilePanel.tsx`'s
  local `StatTile` function, rendering its six-tile stat row (Contributions,
  Total score, Avg score, Completed tasks, Current streak, Longest streak)
  — despite the same file already importing `EmptyState` from
  `debate-research-evidence/src/ui/panels/panel-shell`. Replaced the local
  `StatTile` with `StatGrid`/`StatTile` imported from that same module
  (which, like `debate-round`'s own `src/ui/panels/panel-shell.tsx`, is a
  byte-identical local copy of `debate-ui/src/panels/panel-shell.tsx` — this
  repo's shared-primitive modules are per-package copies, not one
  cross-package import, so "the right import" is always whichever copy the
  panel's own package already depends on). This drops the tiles' `<dl>`/
  `<dt>`/`<dd>` semantics and moves from a fixed `grid-cols-2` mobile layout
  to `StatGrid`'s own responsive default (`grid-cols-1` below `sm:`,
  `sm:grid-cols-3` at and above), matching every other `StatGrid` consumer
  in this repo (`SharedFlowSyncPanel`, `TopicSprintPanel`) — the same
  "adopt the shared primitive's own presentation, not just its markup"
  trade every prior slice of this audit accepted for `EmptyState`'s
  border/padding and `PanelRow`'s row shape.

  No behavior changed, so this is verified via typecheck/build rather than
  a new test — `packages/debate-contributor-progress`'s Vitest project runs
  in a plain `node` environment with no `jsdom`/React-render setup at all
  (unlike `debate-round`'s `test/panels.test.tsx`), so there was no render
  test to update and adding one from scratch for a single non-behavioral
  JSX swap was judged out of proportion to this slice. See
  `docs/features/contribution-leaderboard.md`'s updated write-up.

  The broader survey (see Follow-ups below) found the `PanelShell`/
  `PanelSection` half of this same follow-up is a much larger, genuinely
  unaudited surface — roughly 45 panel files across six packages hand-roll
  a bordered-card-with-title header or sub-section shape instead of the
  primitive — but confirmed adopting `PanelShell` there is a visible design
  change (it adds a card background/border/shadow no un-migrated panel
  currently has), not a pure refactor, so it needs its own scoped follow-up
  slice(s) rather than folding into this one.

  Ran the full verification gate: `bun run test` (5286 passing, unchanged —
  no behavior changed), `bunx turbo run typecheck` (16/16 packages green),
  and `bun run build:web` (passed cleanly). No `lint`/`format:check` script
  exists anywhere in this repo, so that step was skipped as not applicable.
  PR: #683.
- **fix(judge-decision): restore a lost cross-tab live-update export that broke `bun run build:web`.**
  Before picking a new item, this run's routine "inspect the repository's
  current development state" step ran the full verification gate
  (`bun run test`, `bunx turbo run typecheck`, `bun run build:web`) as a
  sanity check on `master`'s current tip, and found `build:web` completely
  failing: `[MISSING_EXPORT] "isJudgeDecisionPanelLiveUpdateStorageEvent" is
  not exported by "packages/debate-practice-drills/src/state/live-update.ts"`,
  imported by `hooks/useJudgeDecisions.ts`. `bunx turbo run typecheck` failed
  the same way (`debate-practice-rounds#typecheck`).

  Root-caused via `git log -- .../state/live-update.ts` plus
  `git rev-list --parents`: two earlier autonomous runs
  (`887ad86` "feat(response-outcome-charts)" and `4edd8c1`
  "feat(judge-decision)") both branched from the same parent commit
  (`0bfaf05`) and each independently appended their own predicate function
  to this same file — a real concurrent-edit collision, not a bad manual
  merge. `887ad86`'s version is the one every later PR in this file's
  history (`#664`, `#667`, `#669`, `#670`, `#674`, `#675`) built on top of;
  `4edd8c1`'s `JUDGE_DECISION_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isJudgeDecisionPanelLiveUpdateStorageEvent` addition was silently dropped
  along the way even though `4edd8c1` itself is still an ancestor of
  `master`'s tip and its *other* file, `hooks/useJudgeDecisions.ts` (plus
  its already-accurate `docs/features/judge-paradigm-selections.md`
  write-up), survived untouched. This also explains this tracker's own
  previous entry above ("⚖️ AI Judge Decision — cross-tab live update" title
  with a CoachingProgramsPanel-shaped body) — a symptom of the same lost
  update, not a separate bug.

  Restored `JUDGE_DECISION_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isJudgeDecisionPanelLiveUpdateStorageEvent` into
  `packages/debate-practice-drills/src/state/live-update.ts` (appended after
  the existing entries, none of which were touched) verbatim from `4edd8c1`,
  plus its file-header doc-comment mention and its four
  `test/live-update.test.ts` cases (every backing-store key, the null-key
  clear-all case, an unrelated key, and a substring-only match). No other
  code changed — `useJudgeDecisions.ts`'s `storage`-event subscription was
  already complete and correct; it just had nothing to import.

  Ran the full verification gate again after the fix: `bun run test` (5261
  passing, +4 for the restored predicate's cases), `bunx turbo run
  typecheck` (16/16 packages green, `debate-practice-rounds` included), and
  `bun run build:web` (now builds cleanly). No `lint`/`format:check` script
  exists anywhere in this repo, so that step was skipped as not applicable.
  Bundled into the same PR as the next entry below, since this run's normal
  verification gate couldn't otherwise report a clean `build:web`.
- **⚙️ User Settings — cross-tab live update.** Another repeat of the
  standing autonomous-routine prompt ("integrate all the tools into the
  UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built and reconfirmed
  again this run: `user_settings`/`documents`/`saved_flows`/`saved_rounds`
  and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette, and the feature catalog. So this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap — the one
  remaining panel two prior runs had each left open for a future run,
  `UserSettingsPanel` (`debate-round`), since unlike every other panel
  closed so far its `form` is a live, directly-editable draft rather than a
  derived list/roster view, so closing it needed refreshing only the
  persisted values, not stomping an unsaved in-progress edit. This run
  cross-checked the open-PR list (`#663` DB error diagnostics, `#660`
  Parquet card import, `#659` `OpponentPersonaPickerPanel`) and every
  unmerged branch's diff (none touch `UserSettingsPanel.tsx`,
  `state/userSettings.ts`, or `flow/live-update.ts`) before confirming via a
  direct grep that no other branch had already claimed this panel.

  Added `flow/live-update.ts`'s `USER_SETTINGS_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isUserSettingsPanelLiveUpdateStorageEvent`, covering the four
  `localStorage` keys the panel reads directly: `settings` (via
  `state/userSettings.ts`'s new `refreshLocalUserSettingsFromStorage`,
  needed because the local `settings` singleton only reads `localStorage`
  on its own `init()`/`loadFromLocalStorage()` call, not automatically on
  every read — so a different tab's `applyUserSettingsToLocalStore` write
  would otherwise go unnoticed here), `color-theme`, `theme` (next-themes'
  own default storage key), and `fontFamily`.

  Unlike every prior panel this Known gap bullet lists, `UserSettingsPanel`'s
  `form` is a Save-gated draft the user directly edits, not a derived
  view — so a naive "re-read and overwrite on every matching `storage`
  event" would stomp an in-progress, not-yet-saved edit the moment another
  tab (or `theme-dropdown.tsx`'s dock picker) changed anything. Instead,
  `UserSettingsPanel.tsx` now tracks a `baselineRef` (the values `form` was
  last loaded or saved from) and its `storage`-event handler refreshes each
  of the four form fields *individually*, only when that field's current
  value still matches its baseline entry — an edited-but-unsaved field is
  left alone. `fontFamily` (a separate, non-form, always-immediate-apply
  field) is refreshed unconditionally, since there's no draft to protect. A
  refreshed `colorTheme` also reapplies the `theme-*` DOM class in this tab
  (extracted into a new `applyColorThemeClass` helper, reused by the
  existing `applyThemeLocally`), since that's per-tab in-memory `document`
  state a `storage` event alone doesn't update; `themeMode`'s equivalent DOM
  effect is already handled by next-themes' own internal storage listener.
  Saving also updates `baselineRef` to the just-saved values, so a field
  isn't treated as permanently "dirty" after a successful Save.

  See `docs/features/user-settings.md`'s new "Cross-tab live update" section
  and `docs/features/shared-flow-sync.md`'s updated Known gaps bullet (added
  `UserSettingsPanel` to the closed list).
  Vitest-covered: `packages/debate-round/test/live-update.test.ts` (every
  backing-store key, the null-key clear-all case, an unrelated key, and
  substring-only matches, mirroring every other panel's cases in that file)
  and `packages/debate-round/test/userSettings.test.ts` (new
  `refreshLocalUserSettingsFromStorage` describe block: picks up a value
  written straight to `localStorage`, unlike plain `readLocalUserSettings`,
  and returns the current defaults when nothing is stored). The per-field
  dirty-tracking behavior itself has no dedicated render test — this repo
  has no component-render test for any `debate-round` panel — matching how
  every prior cross-tab live-update slice here was verified via its pure
  predicate function plus typecheck/build, not a new render test.

  Ran the full verification gate: `bun run test` (5261 passing — the 4 new
  `isUserSettingsPanelLiveUpdateStorageEvent` cases plus 2 new
  `refreshLocalUserSettingsFromStorage` cases, on top of the 4 restored
  judge-decision cases from the previous entry), `bunx turbo run typecheck`
  (16/16 typecheck-bearing packages green), and `bun run build:web` (passed
  cleanly). No `lint`/`format:check` script exists anywhere in this repo, so
  that step was skipped as not applicable.
- **⚖️ AI Judge Decision — cross-tab live update.** Another repeat of the
  standing autonomous-routine prompt ("integrate all the tools into the
  UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built and reconfirmed
  again this run: `user_settings`/`documents`/`saved_flows`/`saved_rounds`
  and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette, and the feature catalog. So this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap — this run
  cross-checked the open-PR list (`#663` DB error diagnostics, `#660`
  Parquet card import, `#659` `OpponentPersonaPickerPanel`, `#658`
  `JudgeDecisionPanel`, none of them touching this panel) and every
  unmerged branch's diff (none touch `CoachingProgramsPanel.tsx` or its
  backing stores — `state/coachingPrograms.ts`,
  `state/persistedCoachingProgramBoard.ts`, `state/roundContributorFlows.ts`
  — so the "multiple parallel branches mid-refactor" note that left this
  panel unclaimed in a prior run no longer applies) before confirming via a
  direct grep of every panel in `debate-team-collaboration` for an existing
  `storage`-event listener that `CoachingProgramsPanel` was still genuinely
  open and unclaimed, alongside `UserSettingsPanel` (`debate-round` — left
  for a future run, since its `form` is a live, directly-editable settings
  form rather than a derived list/roster view, so closing it needs
  refreshing only the persisted values, not stomping an unsaved in-progress
  edit).

  Added `packages/debate-team-collaboration/src/state/live-update.ts` (the
  first `live-update.ts` in this package) with
  `COACHING_PROGRAMS_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isCoachingProgramsPanelLiveUpdateStorageEvent`, covering the two stores
  `CoachingProgramsPanel` reads directly regardless of which board is open:
  `coachingPrograms` (the persisted program-config list) and
  `roundContributorFlows` (each roster member's "Flow recorded" badge).
  `CoachingProgramsPanel.tsx` now subscribes to `window`'s `storage` event
  and, when the predicate matches, refreshes the program list, re-derives
  the roster's recorded-contributor set, and — if a board is currently open
  — recomposes it. A program's expanded board also transitively depends on
  several other packages' stores (topic-sprint inputs, the group-challenge
  roster, the contribution feed, win events, and practice-round records,
  all read through `state/persistedCoachingProgramBoard.ts`); those are
  deliberately left out of this predicate, matching every other panel's
  "cover the store(s) this panel reads directly, not everything a composed
  view transitively depends on" convention (e.g. `JudgeDecisionPanel`'s
  hook-scoped predicate) — a change to one of those deeper stores in
  another tab still shows up the next time the board is reopened. This is
  recorded as a follow-up in `docs/features/coaching-programs.md`'s Known
  gaps rather than silently left unmentioned.

  See `docs/features/coaching-programs.md`'s new "Cross-tab live update"
  section and `docs/features/shared-flow-sync.md`'s updated Known gaps
  bullet (added `CoachingProgramsPanel` to the closed list).
  Vitest-covered: `packages/debate-team-collaboration/test/live-update.test.ts`
  (every backing-store key, the `null`-key clear-all case, and
  unrelated/substring-matching keys staying ignored, mirroring every other
  panel's cases in that file).

  Ran the full verification gate: `bun run test` (5232 passing, up from
  5228 at HEAD before this change — the 4 new cases above), `bunx turbo run
  typecheck` (16/16 typecheck-bearing packages green), and `bun run
  build:web` (passed cleanly). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable.
- **🧪 Practice Round Simulator — cross-tab live update.** Another repeat of
  the standing autonomous-routine prompt ("integrate all the tools into the
  UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built and reconfirmed
  again this run: `user_settings`/`documents`/`saved_flows`/`saved_rounds`
  and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette, and the feature catalog. So this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap — this run
  cross-checked the open-PR list (`#663` DB error diagnostics, `#660`
  Parquet card import, `#659` `OpponentPersonaPickerPanel`, `#658`
  `JudgeDecisionPanel`, none of them touching this panel) and every
  unmerged branch's diff (one, `claude/gifted-babbage-i2zvcr`, claims
  `FlowSummariesPanel`; the rest touch unrelated features or other
  packages) before a direct grep of every panel in `debate-practice-drills`
  for a `storage`-event listener confirmed `PracticeRoundSimulatorPanel`
  was still genuinely open and unclaimed.

  Extended `packages/debate-practice-drills/src/state/live-update.ts` with
  `PRACTICE_ROUND_SIMULATOR_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isPracticeRoundSimulatorPanelLiveUpdateStorageEvent`, covering both
  stores the panel reads directly: `debate-round`'s `practiceRounds` (the
  saved-round-setup list the panel's form, per-round sections, and "Compare
  your past attempts" section all derive from) and `debate-round`'s
  `aiVersusRounds` (read via `getAiVersusRound`/
  `getPracticeRoundSubmittedSpeeches` for each round's submitted-speech
  progress and "Generate AI opponent speech" availability).
  `PracticeRoundSimulatorPanel.tsx` now subscribes to `window`'s `storage`
  event and calls its existing `refresh()` closure when the predicate
  matches — a teammate saving or clearing a round's setup, submitting or
  generating a speech, or getting an AI judge decision in one tab now shows
  up in every other open tab without a manual reload. The account-synced
  custom opponent persona library ("My persona library"/"Shared by your
  team", via `useCustomOpponentPersonaLibrary`) is deliberately excluded —
  it manages its own refresh through that hook rather than a raw
  `localStorage` read, matching `OpponentPersonaPickerPanel`'s own
  exclusion of the same hook (PR #659). The in-progress round-setup form
  draft, feedback side-key fields, and replay-step selections are left
  untouched, matching every other closed panel's "refresh the derived
  view, not the draft" convention.

  See `docs/features/practice-round-simulator.md`'s new "Cross-tab live
  update" section and `docs/features/shared-flow-sync.md`'s updated Known
  gaps bullet (added `PracticeRoundSimulatorPanel` to the closed list).
  Vitest-covered: `packages/debate-practice-drills/test/live-update.test.ts`
  (both backing-store keys, the `null`-key clear-all case, and
  unrelated/substring-matching keys staying ignored, mirroring every other
  panel's cases in that file). `CoachingProgramsPanel`
  (`debate-team-collaboration` — that package currently has multiple
  parallel branches mid-refactor on conflicting files) and `UserSettingsPanel`
  (`debate-round` — its `form` is a live, directly-editable settings form
  rather than a derived list/roster view, so closing it needs refreshing
  only the persisted values, not stomping an unsaved in-progress edit)
  remain open for a future run to pick up next.

  Ran the full verification gate: `bun run test` (5223 passing, up from
  5219 at HEAD before this change — the 4 new cases above), `bunx turbo run
  typecheck` (16/16 typecheck-bearing packages green), and `bun run
  build:web` (passed cleanly this run). No `lint`/`format:check` script
  exists anywhere in this repo, so that step was skipped as not applicable.
- **🎙️ AI Coach Mode — cross-tab live update.** Another repeat of the
  standing autonomous-routine prompt ("integrate all the tools into the
  UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built and reconfirmed
  again this run: `user_settings`/`documents`/`saved_flows`/`saved_rounds`
  and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette, and the feature catalog. So this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap — this run
  cross-checked the open-PR list (`#663` DB error diagnostics, `#660`
  Parquet card import, `#659` `OpponentPersonaPickerPanel`, `#658`
  `JudgeDecisionPanel`, none of them touching this panel) and every
  unmerged branch's diff before a direct grep of every panel in
  `debate-practice-drills` for a `storage`-event listener confirmed
  `CoachingSessionsPanel` was still genuinely open and unclaimed.

  Extended `packages/debate-practice-drills/src/state/live-update.ts` with
  `COACHING_SESSIONS_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isCoachingSessionsPanelLiveUpdateStorageEvent`, covering the panel's one
  backing store: `coachingSessions` (`state/coachingSessions.ts` — the
  round+side coaching-session list the panel's rendered sessions, "Compare
  two sessions" dropdowns, and comparison view all derive from).
  `CoachingSessionsPanel.tsx` now subscribes to `window`'s `storage` event
  and calls its existing `refresh()` closure when the predicate matches — a
  session saved, restored, or cleared in one tab now shows up in every
  other open tab without a manual reload. The "Generate coaching session"
  side-key field, any in-progress "Compare two sessions" result, and an
  open History panel's contents are left untouched, matching every other
  closed panel's "refresh the derived view, not the draft" convention. The
  sibling `coachingSessionHistory` store (read only when a session's
  History toggle is opened, not part of the main derived view) is
  deliberately left out of the tracked key set, mirroring how every other
  closed panel in this file tracks only its main list's own store.

  See `docs/features/coaching-sessions.md`'s new "Cross-tab live update"
  section and `docs/features/shared-flow-sync.md`'s updated Known gaps
  bullet (added `CoachingSessionsPanel` to the closed list). Vitest-covered:
  `packages/debate-practice-drills/test/live-update.test.ts` (the one
  backing-store key, the `null`-key clear-all case, and unrelated/
  substring-matching keys staying ignored, mirroring every other panel's
  cases in that file). `PracticeRoundSimulatorPanel` (`debate-practice-drills`,
  confirmed still missing a listener by the same grep), `UserSettingsPanel`
  (`debate-round` — its `form` is a live, directly-editable settings form
  rather than a derived list/roster view, so closing it needs refreshing
  only the persisted values, not stomping an unsaved in-progress edit), and
  `CoachingProgramsPanel` (`debate-team-collaboration` — that package
  currently has multiple parallel branches mid-refactor on conflicting
  files) remain open for a future run to pick up next.

  Ran the full verification gate: `bun run test` (5219 passing, up from
  5215 at HEAD before this change — the 4 new cases above), `bunx turbo run
  typecheck` (16/16 typecheck-bearing packages green), and `bun run
  build:web` (passed cleanly this run). No `lint`/`format:check` script
  exists anywhere in this repo, so that step was skipped as not applicable.

  PR: [#674](https://github.com/debate/debate-ai.com/pull/674).
- **⚔️ Online Debate Versus AI — cross-tab live update.** Another repeat of
  the standing autonomous-routine prompt ("integrate all the tools into the
  UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built and reconfirmed
  again this run: `user_settings`/`documents`/`saved_flows`/`saved_rounds`
  and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette, and the feature catalog. So this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap — this run
  cross-checked both the open-PR list (`#663` DB error diagnostics, `#660`
  Parquet card import, `#659` `OpponentPersonaPickerPanel`, `#658`
  `JudgeDecisionPanel`, none of them touching this package's remaining
  panels) and every unmerged branch's log before a direct grep of every
  panel in `debate-practice-drills` for a `storage`-event listener
  confirmed `AiVersusRoundPanel` was still genuinely open and unclaimed.

  Extended `packages/debate-practice-drills/src/state/live-update.ts` with
  `AI_VERSUS_ROUND_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isAiVersusRoundPanelLiveUpdateStorageEvent`, covering the panel's one
  backing store: `aiVersusRounds` (`debate-round`'s
  `state/aiVersusRounds.ts` — the persisted-round list the panel's active
  round, round history, and "Compare transcripts" section all derive
  from). `AiVersusRoundPanel.tsx` now subscribes to `window`'s `storage`
  event and calls its existing `refresh()` closure when the predicate
  matches — a round saved, cleared, or regenerated in one tab now shows up
  in every other open tab without a manual reload. The in-progress
  speech-text draft, round-ID/format/side form fields, and "Compare
  transcripts" dropdown selections are left untouched, matching every
  other closed panel's "refresh the derived view, not the draft"
  convention.

  See `docs/features/ai-versus-rounds.md`'s new "Cross-tab live update"
  section and `docs/features/shared-flow-sync.md`'s updated Known gaps
  bullet (added `AiVersusRoundPanel` to the closed list). Vitest-covered:
  `packages/debate-practice-drills/test/live-update.test.ts` (the one
  backing-store key, the `null`-key clear-all case, and unrelated/
  substring-matching keys staying ignored, mirroring every other panel's
  cases in that file). `CoachingSessionsPanel` and
  `PracticeRoundSimulatorPanel` (`debate-practice-drills`, confirmed still
  missing a listener by the same grep), `UserSettingsPanel`
  (`debate-round` — its `form` is a live, directly-editable settings form
  rather than a derived list/roster view, so closing it needs refreshing
  only the persisted values, not stomping an unsaved in-progress edit), and
  `CoachingProgramsPanel` (`debate-team-collaboration` — that package
  currently has multiple parallel branches mid-refactor on conflicting
  files) remain open for a future run to pick up next.

  Ran the full verification gate: `bun run test` (5211 passing, up from
  5203 at HEAD before this change — the 4 new cases above), `bunx turbo run
  typecheck` (16/16 typecheck-bearing packages green), and `bun run
  build:web` (passed cleanly this run). No `lint`/`format:check` script
  exists anywhere in this repo, so that step was skipped as not applicable.

  PR: [#670](https://github.com/debate/debate-ai.com/pull/670).
- **📚 Practice Drills — cross-tab live update.** Another repeat of the
  standing autonomous-routine prompt ("integrate all the tools into the
  UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built and reconfirmed
  again this run: `user_settings`/`documents`/`saved_flows`/`saved_rounds`
  and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette, and the feature catalog. So this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap — this repo
  again has several parallel sessions racing on that same gap (four open
  PRs at the start of this run — `#663` DB error diagnostics, `#660`
  Parquet card import, `#659` `OpponentPersonaPickerPanel`, `#658`
  `JudgeDecisionPanel` — plus half a dozen unmerged, mostly stale branches
  based on old `master` HEADs), so this run cross-checked both the open-PR
  list and every unmerged branch's log (one, `claude/gifted-babbage-i2zvcr`,
  claims `FlowSummariesPanel`) before a direct grep of every panel in
  `debate-practice-drills` for a `storage`-event listener confirmed
  `DrillSetsPanel` (backed by its `useDrillSets` hook, not read directly by
  the panel) was still genuinely open and unclaimed.

  Extended `packages/debate-practice-drills/src/state/live-update.ts` with
  `DRILL_SETS_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isDrillSetsPanelLiveUpdateStorageEvent`, covering the hook's one backing
  store: `drillSets` (the per-round drill-set list the panel derives its
  round cards, completion meters, and Practice-tier card from).
  `useDrillSets` (`hooks/useDrillSets.ts`) now subscribes to `window`'s
  `storage` event and re-reads `buildDrillSetsPanelView()` when the
  predicate matches — mirroring `useWordCountRounds`'s own `storage`-event
  subscription (the "panel reads through a hook, not directly" pattern) —
  so a drill set generated, completed, scripted, review-scheduled, cleared,
  or synced from the account in one tab now shows up in every other open
  `/drills` tab without a manual reload. The in-progress "Generate drills
  for current round" form's side-key field is left untouched, matching
  every other closed panel's "refresh the derived view, not the draft"
  convention.

  See `docs/features/drill-sets.md`'s new "Cross-tab live update" section
  and `docs/features/shared-flow-sync.md`'s updated Known gaps bullet
  (added `DrillSetsPanel` to the closed list). Vitest-covered:
  `packages/debate-practice-drills/test/live-update.test.ts` (the one
  backing-store key, the `null`-key clear-all case, and unrelated/
  substring-matching keys staying ignored, mirroring every other panel's
  cases in that file). `AiVersusRoundPanel`, `CoachingSessionsPanel`, and
  `PracticeRoundSimulatorPanel` (`debate-practice-drills`, confirmed still
  missing a listener by the same grep), `UserSettingsPanel`
  (`debate-round` — its `form` is a live, directly-editable settings form
  rather than a derived list/roster view, so closing it needs refreshing
  only the persisted values, not stomping an unsaved in-progress edit), and
  `CoachingProgramsPanel` (`debate-team-collaboration` — that package
  currently has multiple parallel branches mid-refactor on conflicting
  files) remain open for a future run to pick up next.

  Ran the full verification gate: `bun run test` (5203 passing, up from
  5199 at HEAD before this change — the 4 new cases above), `bunx turbo run
  typecheck` (16/16 typecheck-bearing packages green), and `bun run
  build:web` (passed cleanly this run). No `lint`/`format:check` script
  exists anywhere in this repo, so that step was skipped as not applicable.

  PR: [#669](https://github.com/debate/debate-ai.com/pull/669).
- **🔢 Word-Count-Only Speech Format — cross-tab live update.** Another
  repeat of the standing autonomous-routine prompt ("integrate all the tools
  into the UI... create user settings and link user db SQL with the ability
  to save flows/docs/debates in SQL and link to users... add tools into
  where needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built and reconfirmed
  again this run: `user_settings`/`documents`/`saved_flows`/`saved_rounds`
  and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command palette,
  and the feature catalog. So this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap — this repo
  currently has many parallel sessions racing on that same gap (four open
  PRs at the start of this run, plus half a dozen unmerged branches), so
  this run cross-checked both the open-PR list (`#658` JudgeDecisionPanel,
  `#659` OpponentPersonaPickerPanel, plus two unrelated PRs) and every
  unmerged branch's diff (one mid-flight on `FlowSummariesPanel`, others on
  unrelated features in `debate-team-collaboration`) before picking a
  genuinely unclaimed panel: a direct grep of every panel in
  `debate-practice-drills` for a `storage`-event listener confirmed
  `WordCountRoundsPanel` (backed by its `useWordCountRounds` hook, not read
  directly by the panel) was still open and unclaimed by any in-flight
  branch.

  Extended `packages/debate-practice-drills/src/state/live-update.ts` with
  `WORD_COUNT_ROUNDS_LIVE_UPDATE_STORAGE_KEYS`/
  `isWordCountRoundsLiveUpdateStorageEvent`, covering the hook's one backing
  store: `wordCountRounds` (the persisted-round list both the round-history
  cards and the word-count trend view derive from). `useWordCountRounds`
  (`hooks/useWordCountRounds.ts`) now subscribes to `window`'s `storage`
  event and re-reads `buildWordCountRoundsPanelView()` when the predicate
  matches — mirroring this same package's `useCounselPanelAssessments`
  hook's own `storage`-event subscription (the "panel reads through a hook,
  not directly" pattern) — so a round saved, cleared, or synced from the
  account in one tab now shows up in every other open `/word-count` tab
  without a manual reload. The in-progress speech drafts, round-ID field,
  and dictation state are left untouched, matching every other closed
  panel's "refresh the derived view, not the draft" convention.

  See `docs/features/word-count-rounds.md`'s new "Cross-tab live update"
  section and `docs/features/shared-flow-sync.md`'s updated Known gaps
  bullet (added `WordCountRoundsPanel` to the closed list). Vitest-covered:
  `packages/debate-practice-drills/test/live-update.test.ts` (the one
  backing-store key, the `null`-key clear-all case, and unrelated/
  substring-matching keys staying ignored, mirroring every other panel's
  cases in that file). `AiVersusRoundPanel`, `CoachingSessionsPanel`,
  `DrillSetsPanel`, and `PracticeRoundSimulatorPanel` (`debate-practice-drills`,
  confirmed still missing a listener by the same grep), `UserSettingsPanel`
  (`debate-round` — its `form` is a live, directly-editable settings form
  rather than a derived list/roster view, so closing it needs refreshing
  only the persisted values, not stomping an unsaved in-progress edit), and
  `CoachingProgramsPanel` (`debate-team-collaboration` — that package
  currently has multiple parallel branches mid-refactor on conflicting
  files) remain open for a future run to pick up next.

  Ran the full verification gate: `bun run test` (5199 passing, up from
  5195 at HEAD before this change — the 4 new cases above), `bunx turbo run
  typecheck` (16/16 typecheck-bearing packages green), and `bun run
  build:web` (passed cleanly this run). No `lint`/`format:check` script
  exists anywhere in this repo, so that step was skipped as not applicable.
- **📝 Outline Filters and Argument Tree View — cross-tab live update.**
  Another repeat of the standing autonomous-routine prompt ("integrate all
  the tools into the UI... create user settings and link user db SQL with
  the ability to save flows/docs/debates in SQL and link to users... add
  tools into where needed in the UI... develop better tool UI") — as with
  every recent repeat, that prompt's own asks are already fully built and
  reconfirmed again this run: `user_settings`/`documents`/`saved_flows`/
  `saved_rounds` and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command palette,
  and the feature catalog. So this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap — with many
  parallel sessions racing on this same gap (five open PRs and half a dozen
  unmerged branches touching neighboring panels at the start of this run),
  this run cross-checked both the open-PR list and every unmerged branch's
  diff before picking a genuinely unclaimed panel: `debate-practice-drills`'s
  `ArgumentTreePanel` (`JudgeDecisionPanel` and `OpponentPersonaPickerPanel`
  already had open PRs, `FlowSummariesPanel` was mid-flight on an unmerged
  branch, and `debate-team-collaboration` had multiple unmerged branches
  mid-refactor on conflicting files, so that whole package was avoided).

  Extended `packages/debate-practice-drills/src/state/live-update.ts` with
  `ARGUMENT_TREE_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isArgumentTreePanelLiveUpdateStorageEvent`, covering both stores the
  panel reads directly: `debate-round`'s `argumentTrees` (the derived
  per-round outline records) and this package's own `argumentTreeFilters`
  (each round's saved filter selection). `ArgumentTreePanel.tsx` now
  subscribes to `window`'s `storage` event and re-reads both when the
  predicate matches — a teammate generating, clearing, or tagging an
  outline, or saving/clearing a round's filter, in one tab now shows up in
  every other open tab without a manual reload. Deliberately excluded:
  `hooks/useOutlineFilterPresets.ts`'s own `outline-filter-presets` store —
  that hook already has a same-tab `CHANGE_EVENT` sync but no cross-tab
  `storage` listener yet, matching every other `use*Presets` hook in this
  repo (e.g. `debate-round`'s `useWordLimitPresets`); closing that separate,
  wider gap across every preset hook is left for a future run.

  See `docs/features/argument-tree-outline.md`'s new "Cross-tab live
  update" section (plus its Known gaps entry noting the excluded presets
  hook) and `docs/features/shared-flow-sync.md`'s updated Known gaps bullet
  (added `ArgumentTreePanel` to the closed list). Vitest-covered:
  `packages/debate-practice-drills/test/live-update.test.ts` (both tracked
  keys, the `null`-key clear-all case, and unrelated/substring-matching keys
  staying ignored, mirroring every other panel's cases in that file).

  Ran the full verification gate: `bun run test` (5177 passing, up from
  5173 at HEAD before this change — the 4 new cases above), `bunx turbo run
  typecheck` (16/16 typecheck-bearing packages green), and `bun run
  build:web` (passed cleanly this run — no repro of the earlier sandbox-only
  `UNLOADABLE_DEPENDENCY` canvas-binding failure some previous runs hit; not
  something this change could have caused either way). No `lint`/
  `format:check` script exists anywhere in this repo, so that step was
  skipped as not applicable.
- **📈 AI Response-Outcome Charts — cross-tab live update.** Another repeat
  of the standing autonomous-routine prompt ("integrate all the tools into
  the UI... create user settings and link user db SQL with the ability to
  save flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built and reconfirmed
  again this run: `user_settings`/`documents`/`saved_flows`/`saved_rounds`
  and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command palette,
  and the feature catalog. So this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap — a direct
  grep of every `panels/*.tsx` file for a `storage`-event listener (not the
  possibly-stale prose in this file) found a parallel session's branch
  already mid-flight on `FlowSummariesPanel`, so this run picked a different,
  genuinely unclaimed panel in the same package instead:
  `debate-practice-drills`'s `VulnerabilityChartsPanel`.

  Extended `packages/debate-practice-drills/src/state/live-update.ts` (which
  already held `JudgeParadigmPickerPanel`'s own predicate) with two new
  predicates: `isVulnerabilityChartsPanelLiveUpdateStorageEvent` (covering
  the panel's directly-read `vulnerabilityReports` store) and
  `isCounselPanelAssessmentsLiveUpdateStorageEvent` (covering
  `counselPanelAssessments`, read through the panel's
  `useCounselPanelAssessments` hook rather than directly). Both
  `VulnerabilityChartsPanel.tsx` and `useCounselPanelAssessments.ts` now
  subscribe to `window`'s `storage` event and refresh their own state when
  the matching predicate fires — mirroring `useStrategyRecommendations`'s
  existing hook-level `storage`-event subscription for the
  `debate-round`/`useCounselPanelAssessments` split of "panel reads one
  store directly, a hook reads another" — so a teammate generating or
  clearing a round's vulnerability report, or requesting or clearing an AI
  counsel-panel assessment, in one tab now shows up in every other open tab
  without a manual reload. The "what if" hypothetical picks and saved
  scenario comparisons stay scratch component state, untouched by either
  refresh, matching every other closed panel's "refresh the derived view,
  not the draft" convention.

  See `docs/features/response-outcome-charts.md`'s new "Cross-tab live
  update" section and `docs/features/shared-flow-sync.md`'s updated Known
  gaps bullet (added `VulnerabilityChartsPanel` to the closed list).
  Vitest-covered: `packages/debate-practice-drills/test/live-update.test.ts`
  (both new predicates' full key sets, each `null`-key clear-all case, and
  unrelated/substring-matching keys staying ignored for each). Every other
  panel in `debate-practice-drills` (`AiVersusRoundPanel`,
  `ArgumentTreePanel`, `CoachingSessionsPanel`, `DrillSetsPanel`,
  `FlowSummariesPanel` — mid-flight on a parallel branch as of this run,
  `JudgeDecisionPanel`, `OpponentPersonaPickerPanel`,
  `PracticeRoundSimulatorPanel`, `WordCountRoundsPanel`),
  `CoachingProgramsPanel` (`debate-team-collaboration` — deliberately
  skipped this run since that package currently has multiple parallel
  branches mid-refactor on conflicting files), and `UserSettingsPanel`
  (`debate-round` — its `form` is a live, directly-editable settings form
  rather than a derived list/roster view, so closing it needs refreshing
  only the persisted values, not stomping an unsaved in-progress edit)
  remain open for a future run to pick up next.

  Ran the full verification gate: `bun run test` (5173 passing, up from
  5165 at HEAD before this change — the 8 new cases above), `bunx turbo run
  typecheck` (16/16 typecheck-bearing packages green, `debate-ai-web` has no
  `typecheck` script), and confirmed `bun run build:web` fails identically
  on this branch and on master before this change (`UNLOADABLE_DEPENDENCY`
  on the native `canvas` binding during the RSC server-bundle scan — a
  pre-existing sandbox/toolchain limitation unrelated to this change, not
  something this run introduced or could fix without rebuilding that native
  dependency for this container). No `lint`/`format:check` script exists
  anywhere in this repo, so that step was skipped as not applicable.
- **⚖️ Judge Paradigm Picker — cross-tab live update.** Another repeat of
  the standing autonomous-routine prompt ("integrate all the tools into the
  UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built and reconfirmed
  again this run: `user_settings`/`documents`/`saved_flows`/`saved_rounds`
  and 25+ other `saved_*` D1 tables all linked to `user.id`
  (`apps/debate-ai.com/lib/database/schema.ts`), and every tool already
  reachable from the Tools page, CardMirror's own `MenuBar`/command
  palette, and the feature catalog. So this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap — this repo
  currently has many parallel sessions racing on that same gap (master's
  history shows `OpponentTeamProfilesPanel`'s cross-tab live update
  implemented redundantly well over half a dozen times by separate PRs in
  quick succession), so rather than compete for an already-heavily-picked
  panel, this run verified via a direct grep of every `panels/*.tsx` file
  in the repo (not the possibly-stale prose in this file, which several of
  those parallel PRs' merges evidently dropped) and picked
  `debate-practice-drills`'s `JudgeParadigmPickerPanel` — a genuinely still-
  open, previously entirely unclaimed panel in a package that had no
  `live-update.ts` at all yet.

  Added `packages/debate-practice-drills/src/state/live-update.ts` (the
  first `live-update.ts` in this package, mirroring `debate-round`'s
  `flow/live-update.ts`, `debate-search-evidence`'s `state/live-update.ts`,
  and `debate-speech-writer`'s `state/live-update.ts` exactly) with
  `JUDGE_PARADIGM_PICKER_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isJudgeParadigmPickerPanelLiveUpdateStorageEvent`, covering the panel's
  one backing store: `judgeParadigmSelections` (the round-by-round saved-
  selection list). `JudgeParadigmPickerPanel.tsx` now subscribes to
  `window`'s `storage` event and calls its existing `refresh()` closure
  when the predicate matches — a teammate saving or clearing a round's
  judge paradigm in one tab now shows up in every other open tab without a
  manual reload. The in-progress "save a round's paradigm" form draft is
  left untouched, matching every other closed panel's "refresh the derived
  view, not the draft" convention.

  See `docs/features/judge-paradigm-selections.md`'s new "Cross-tab live
  update" section and `docs/features/shared-flow-sync.md`'s updated Known
  gaps bullet (added `JudgeParadigmPickerPanel` to the closed list).
  Vitest-covered: `packages/debate-practice-drills/test/live-update.test.ts`
  (the one backing-store key, the `null`-key clear-all case, and
  unrelated/substring-matching keys staying ignored). `UserSettingsPanel`
  (`debate-round` — its `form` is a live, directly-editable settings form
  rather than a derived list/roster view, so closing it needs refreshing
  only the persisted values, not stomping an unsaved in-progress edit),
  `CoachingProgramsPanel` (`debate-team-collaboration`), and every other
  panel in `debate-practice-drills` (`AiVersusRoundPanel`,
  `ArgumentTreePanel`, `CoachingSessionsPanel`, `DrillSetsPanel`,
  `FlowSummariesPanel`, `JudgeDecisionPanel`, `OpponentPersonaPickerPanel`,
  `PracticeRoundSimulatorPanel`, `VulnerabilityChartsPanel`,
  `WordCountRoundsPanel`) remain open for a future run to pick up next —
  each of those can now extend this same new `live-update.ts` file rather
  than creating another one.

  Ran the full verification gate: `bun run test` (5165 passing, up from
  5161 at HEAD before this change — the 4 new cases above), `bunx turbo run
  typecheck` (16/16 typecheck-bearing packages green, `debate-ai-web` has
  no `typecheck` script), and confirmed `bun run build:web` fails
  identically on this branch and on the branch's own HEAD before this
  change (`UNLOADABLE_DEPENDENCY` on the native `canvas` binding during the
  RSC server-bundle scan — a pre-existing sandbox/toolchain limitation
  unrelated to this change, not something this run introduced or could fix
  without rebuilding that native dependency for this container). No
  `lint`/`format:check` script exists anywhere in this repo, so that step
  was skipped as not applicable.
- **🕵️ Opponent Team Profiles — cross-tab live update.** Another repeat of
  the standing autonomous-routine prompt ("integrate all the tools into the
  UI... create user settings and link user db SQL with the ability to save
  flows/docs/debates in SQL and link to users... add tools into where
  needed in the UI... develop better tool UI") — as with every recent
  repeat, that prompt's own asks are already fully built (account settings,
  dozens of `saved_*` D1 tables/`/api/*` routes linking flows, docs, and
  rounds to signed-in users in SQL, and every tool already reachable from
  the Tools page, CardMirror's own `MenuBar`/command palette, and the
  feature catalog, all reconfirmed this run), so this slice again picked up
  `shared-flow-sync.md`'s "every other localStorage-backed panel in this
  repo still has no cross-tab live-update mechanism" Known gap and closed
  it for `debate-round`'s `OpponentTeamProfilesPanel` — explicitly named as
  a next-open candidate by the previous run's own completed-task note,
  confirmed still missing a `storage`-event listener by grepping every
  panel named in that Known gap's own history.

  Extended `packages/debate-round/src/flow/live-update.ts` (which already
  held `FlowSpreadsheet`'s badges plus `FlowAnnotationsPanel`,
  `PrepNoteNotificationsPanel`, `PrepNotesPanel`, `StrategyPanel`, and
  `PreRoundBriefingsPanel`'s own predicates) with
  `OPPONENT_TEAM_PROFILES_PANEL_LIVE_UPDATE_STORAGE_KEYS`/
  `isOpponentTeamProfilesPanelLiveUpdateStorageEvent`, covering the panel's
  four backing stores: `opponentTeamProfiles` (the aggregated roster),
  `opponentRoundRecords` (the logged-round history), and
  `opponentRoundRecordEditHistory`/`opponentRoundRecordRedoHistory` (which
  decide whether a round shows an Undo/Redo action). Deliberately excludes
  `ownRoundHistory`, which the panel only reads inside the on-demand
  "Compare vs. opponent" action, not on refresh.
  `OpponentTeamProfilesPanel.tsx` now subscribes to `window`'s `storage`
  event and calls its existing `refresh()` closure when the predicate
  matches — a teammate logging, editing, undoing/redoing, deleting, or
  bulk-importing a scouted round in one tab now shows up in every other
  open tab without a manual reload. The in-progress "Log a scouted round"
  form draft, "Bulk import (CSV)" textarea, and any built "Compare vs.
  opponent" comparison are left untouched, matching every other closed
  panel's "refresh the derived view, not the draft" convention.

  See `docs/features/opponent-team-profiles.md`'s new "Cross-tab live
  update" section and `docs/features/shared-flow-sync.md`'s updated Known
  gaps bullet (added `OpponentTeamProfilesPanel` to the closed list).
  Vitest-covered: `packages/debate-round/test/live-update.test.ts` (every
  backing-store key, the `null`-key clear-all case, the excluded
  `ownRoundHistory` key, and unrelated/substring-matching keys staying
  ignored). `UserSettingsPanel` (`debate-round` — its `form` is a live,
  directly-editable settings form rather than a derived list/roster view,
  so closing it needs refreshing only the persisted values, not stomping
  an unsaved in-progress edit), `CoachingProgramsPanel`
  (`debate-team-collaboration`), and every panel named in
  `shared-flow-sync.md`'s Known gap history as still lacking the mechanism
  (`ArgumentLibraryPanel`, `EvidenceLibraryPanel`,
  `TopicCoverageDashboardPanel`, `AiVersusRoundPanel`, `ArgumentTreePanel`,
  `CoachingSessionsPanel`, `DrillSetsPanel`, `FlowSummariesPanel`,
  `JudgeDecisionPanel`, `JudgeParadigmPickerPanel`,
  `OpponentPersonaPickerPanel`, `PracticeRoundSimulatorPanel`,
  `VulnerabilityChartsPanel`, `WordCountRoundsPanel`) remain open for a
  future run to pick up next.

  Ran the full verification gate: `bun run test` (5149 passing, up from
  5144 at HEAD before this change — the 5 new cases above), `bunx turbo run
  typecheck` (16/16 typecheck-bearing packages green, `debate-ai-web` has
  no `typecheck` script), and confirmed `bun run build:web` fails
  identically on this branch and on the branch's own HEAD before this
  change (`UNLOADABLE_DEPENDENCY` on the native `canvas` binding during the
  RSC server-bundle scan — a pre-existing sandbox/toolchain limitation
  unrelated to this change, not something this run introduced or could fix
  without rebuilding that native dependency for this container). No
  `lint`/`format:check` script exists anywhere in this repo, so that step
  was skipped as not applicable.
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
  **Update:** closed — see the Tracker Status entry above. Both packages now
  depend on `debate-research-evidence: "workspace:*"` (confirmed non-circular:
  `debate-research-evidence`'s own dependency tree has no edge back to either
  package, unlike `debate-round`, which already depends on both and so would
  have been circular) and all three panels now render the shared
  `EmptyState`. The new dependency edge also unblocks — but does not itself
  close — `PanelShell`/`PanelSection`/`Pill` adoption for these same three
  panels; that's a separate, still-open follow-up (see below), since (per
  the note there) adopting `PanelShell` is a visible design change that
  needs its own deliberate slice, not a side effect of an `EmptyState` swap.
- The broader "`PanelShell`/`PanelSection`/`StatTile`/`Pill` adoption is
  still unaudited" half of idea #17's follow-up (4) remains open — see
  `docs/features/user-settings.md`'s Known gaps for the full history of
  what's been swept so far (undiscoverable routes, duplicated empty states,
  duplicated progress bars, duplicated list rows, and now duplicated stat
  tiles) and what hasn't. The `StatTile`/`StatGrid` half is now closed (see
  the Tracker Status entry above); `PanelShell`/`PanelSection` is partially
  closed — a repo-wide survey found roughly 45 panel files across
  `debate-round`, `debate-search-evidence`, `debate-contributor-progress`,
  `debate-practice-drills`, `debate-speech-writer`, and
  `debate-team-collaboration` hand-roll a top-level `<h1>`-title-plus-
  description header (the shape `PanelShell`'s `title`/`description` props
  already cover) and/or a bordered `<h2>`-titled sub-section (closer to
  `PanelSection`, though it has no border of its own to match); this run
  closed `debate-search-evidence`'s 7 panels, `debate-round`'s 3, and
  `debate-contributor-progress`'s 9 (see the Tracker Status entries above),
  and an open PR (#693) covers `debate-team-collaboration`'s 13. Only
  `debate-practice-drills` remains unaudited; `debate-speech-writer` stays
  blocked on the same cross-package-dependency gap named in the bullet
  above. Left open because
  adopting `PanelShell` is a visible design change, not a pure refactor — it
  adds a card background/border/shadow no un-migrated panel currently
  renders — so it needs a deliberate scoped slice (or several, package by
  package) with that trade-off called out up front, not a blanket
  find-replace. Not every panel `<h1>`/`<h2>` is a clean fit either (some
  are per-item/per-group loop headings, not panel/section headers) —
  see the historical `PanelRow` audit's four deliberately-skipped panels
  for the same kind of judgment call.
  **Update:** two further slices closed `debate-team-collaboration`'s 13
  panels (PR #693) and `debate-round`'s 3 and `debate-contributor-progress`'s
  9 (see the Tracker Status entries above), and this slice closed the last
  remaining package, `debate-practice-drills`'s 12 panels — see the Tracker
  Status entry above. Every package from the original ~45-panel survey that
  depends on a package exporting `PanelShell`/`PanelSection` is now closed;
  only `debate-speech-writer`'s two panels remain, still blocked on the same
  cross-package-dependency gap named above. The "`PanelShell`/`PanelSection`
  adoption is still unaudited" half of follow-up (4) is effectively closed;
  the broader "bring every weaker panel UI up to every shared `debate-ui`
  primitive convention" half of follow-up (4) remains open more generally
  (each pass so far has searched for one specific pattern, not exhaustively
  compared every panel against every shared primitive).
  **Update:** the cross-package-dependency gap itself is now closed (see the
  Tracker Status entry above and the `EmptyState` follow-up bullet above) —
  `debate-speech-writer` and `debate-videos` both now depend on
  `debate-research-evidence`, so `JudgeProfilesPanel`/`CoachMaterialsPanel`/
  `StandingsPanel` could adopt `PanelShell`/`PanelSection` in a future slice
  the same way every other package's panels already have. That slice hasn't
  been done yet — closing the dependency gap only unblocks it — so these
  three panels remain a small, well-scoped, not-yet-picked-up follow-up. A
  `Pill` adoption pass was also spot-checked this run: aside from
  `panel-shell.tsx` itself, only two hand-rolled "pill" chip candidates
  turned up repo-wide (`grep` for `rounded-full`+`border`+`px-2`+`text-xs`
  across every panel), and neither is a clean fit —
  `debate-team-collaboration`'s `SharedCardsPanel` "share with contact"
  chips are interactive toggle `<button>`s with selected/hover states
  `Pill`'s display-only `<span>` has no vocabulary for, and
  `debate-videos`'s `LeaderboardDataRow` tournament chips sit in the same
  `debate-videos` package this slice just unblocked but hasn't yet migrated.
  So `Pill` adoption stays open, folded into the same not-yet-picked-up
  follow-up above rather than tracked separately.
  **Update:** the `debate-videos` half is now closed — see the Tracker Status
  entry above. `LeaderboardDataRow`'s tournament chips now render `Pill`.
  `debate-team-collaboration`'s `SharedCardsPanel` toggle-button chips remain
  open — still not a clean fit, since `Pill`'s display-only `<span>` has no
  selected/hover-state vocabulary for an interactive toggle. The
  `JudgeProfilesPanel`/`CoachMaterialsPanel`/`StandingsPanel` `PanelShell`/
  `PanelSection` migration named just above is covered by open PR #709.
  **Update:** this run swept the two remaining `debate-ui` primitives from the
  same `panel-shell.tsx` family that hadn't yet been audited by name —
  `SummaryText`/`LabeledField` — and found `SummaryText` (a labeled `<pre>`
  block for `build*SummaryText`-shaped output) was exported by all three
  `panel-shell.tsx` copies but imported nowhere in the app; `LabeledField`'s
  shape (`text-muted-foreground font-medium` label span above a form control)
  had no hand-rolled duplicates repo-wide, so it stays effectively adopted
  everywhere already and needs no follow-up. `FlowSummariesPanel`'s and
  `CoachMaterialsPanel`'s three matching hand-rolled `<pre>`/`<p>` blocks now
  render `SummaryText` — see the Tracker Status entry above. The broader
  "bring every weaker panel UI up to every shared `debate-ui` primitive
  convention" half of follow-up (4) remains open more generally — this pass
  covered one more specific pattern, not an exhaustive primitive-by-primitive
  sweep.
