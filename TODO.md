
## Tracker Status

### In progress

## Brainstorm Idea Persistence

**Status:** In Progress
**Source:** TODO.md — "Team Brainstorm Assist" bullet under Research Crowdsourcing Organizer Features (follow-up (c): "persisting submitted ideas and votes")
**Branch:** `claude/upbeat-bardeen-2zwaow`
**PR:** Not created yet
**Started:** 2026-08-16

### Goal
Persist `team-brainstorm-assist.ts`'s caller-supplied `BrainstormIdea` records (a squad member's brainstormed idea, including its upvote count) to localStorage, mirroring the existing `groupChallenges.ts`/`peerReviews.ts`/`contributions.ts` persistence convention in this package, so a squad's submitted ideas and votes survive a page reload.

### Scope
- A localStorage-backed CRUD store (`packages/debate-card-search/src/state/brainstormIdeas.ts`) for `BrainstormIdea`, keyed by `id`, upsert-on-save.
- List/get/save/delete operations mirroring `groupChallenges.ts`'s shape exactly.
- Vitest coverage mirroring `groupChallenges.test.ts`'s cases (empty, corrupt JSON, non-array JSON, list, get, upsert, delete, delete no-op).

### Non-goals
- No brainstorm-panel UI for live squad submission/upvoting (separate follow-up).
- No AI-generation call that drafts candidate ideas (separate follow-up).
- No change to `team-brainstorm-assist.ts`'s pure ranking/board logic — it keeps taking a caller-supplied `BrainstormIdea[]`.

### Acceptance criteria
- [x] `listBrainstormIdeas`/`getBrainstormIdea`/`saveBrainstormIdea`/`deleteBrainstormIdea` exist and behave like the `groupChallenges.ts` convention (SSR-safe, corrupt/missing JSON degrades to empty list)
- [x] Upsert-on-save by `id`; delete is a no-op for an unknown id
- [x] Vitest coverage is added or updated
- [x] Typecheck passes (verified in an isolated sandbox — see Remaining work)
- [x] Tests pass (verified in an isolated sandbox — see Remaining work)
- [ ] Production/web build passes — blocked, not run (see Remaining work)
- [x] Documentation is updated if behavior or configuration changes (TODO.md tracker entry)

### Implementation plan
- [x] Inspect affected modules, local instructions, and existing tests
- [x] Confirm API, schema, data-flow, or interface requirements
- [x] Implement the smallest useful vertical slice
- [x] Add focused Vitest success-path coverage
- [x] Add focused failure, validation, or edge-case coverage
- [x] Run focused tests and fix failures
- [x] Run linting and typechecking (no lint script exists in this repo; typecheck run)
- [x] Run the full relevant test suite (via isolated sandbox workaround, not the repo's own `npm test`, which is blocked — see Remaining work)
- [ ] Run the production/web build — blocked, not run (see Remaining work)
- [x] Review the final diff for scope and quality
- [x] Commit and push the branch
- [ ] Create or update the pull request
- [ ] Update tracker status, completed checkboxes, and remaining work

### Remaining work
- **Blocker (pre-existing, environmental, not caused by this change):** `npm install` at the repo root fails on a clean checkout (0 installed packages) with `npm error Cannot read properties of null (reading 'edgesOut')`, thrown from `@npmcli/arborist`'s `#loadPeerSet` during `Arborist.buildIdealTree` (npm 10.9.7 / Node 22.22.2). Reproduced with plain `npm install`, `npm install --legacy-peer-deps` (which additionally regresses to `EUNSUPPORTEDPROTOCOL` on `workspace:*` specs), `npm install --omit=optional`, and `npm install -w packages/debate-card-search -w packages/debate-card-parser -w packages/debate-core -w packages/debate-ui` (still fails — root devDependencies, e.g. `jsdom`'s optional `canvas` peer, are always pulled in). Also reproduced after temporarily removing the root `vinext` devDependency, so it isn't specific to that package either. `pnpm install` refuses outright ("This project is configured to use npm") because of the root `packageManager` field. Because of this, the repo's own `npm test`/`npm run typecheck`/`npm run build` could not be executed at all in this environment. As a substitute, `brainstormIdeas.ts`, `team-brainstorm-assist.ts`, `topic-coverage.ts`, `community-rating.ts`, `llm-card-scoring.ts`, and `brainstormIdeas.test.ts` were copied into an isolated scratch npm project with only `vitest@^4.1.0`/`typescript@^5.9.3` installed and this package's real `tsconfig.json`; `npx vitest run test/brainstormIdeas.test.ts` passed 9/9, and `npx tsc --noEmit` reported no errors. This doesn't substitute for the repo's actual `npm run build` (Cloudflare/vinext production build), which still needs to be run once the root install is unblocked.
- Next agent run: try to unblock the root `npm install` (e.g. a newer/older npm, or a `pnpm-workspace.yaml`+override so `pnpm install` can be used instead), then run `npm run typecheck`, `npm test`, and `npm run build` for real, and open the PR.

### Completed
- **Collaboration Prep Room — evidence + draft blocks + task-routing composition slice.**
  `packages/debate-card-search/src/lib/prep-room.ts` adds
  `buildPrepRoom`/`searchPrepRoomEvidence`/`buildPrepRoomSummaryText`,
  composing the existing "Shared Evidence Library"
  (`shared-evidence-library.ts`'s `buildEvidenceLibraryIndex`/
  `searchEvidenceLibrary`) and "Research Task Routing"
  (`research-task-routing.ts`'s `buildRoutingResult`) slices into one
  topic-scoped `PrepRoom`: the topic's evidence organized into folders/tag
  collections, its `kind: "block"` entries surfaced as draft blocks (the
  existing evidence-library model already distinguishes a team-drafted
  reusable analytic block from a cut evidence card, so no separate block
  model was needed), and its coverage-gap tasks routed to available
  contributors — mirroring the existing `team-collaboration-mode.ts`
  composition precedent (Daily Quests + Research Task Routing + Research
  Progress Tracking composed into one `TopicSprint`). Reuses
  `shared-evidence-library.ts` and `research-task-routing.ts` directly
  rather than introducing a separate evidence or assignment model.
  Vitest-covered in `packages/debate-card-search/test/prep-room.test.ts`.
  This is the first slice only — it works entirely off a caller-supplied
  entry list, coverage report, and contributor-availability list; it
  doesn't persist a prep room or its inputs, or render a prep-room panel
  UI. Follow-ups: (a) persisting a prep room's entries/draft blocks (see
  the existing `sharedEvidenceLibrary.ts`-style localStorage convention
  once a persisted evidence store exists for this package), (b) a
  prep-room panel UI that renders `buildPrepRoom`'s evidence
  index/draft blocks/routing and lets a teammate call
  `searchPrepRoomEvidence`, (c) a live presence/who's-active signal,
  mirroring the "Team Collaboration Mode" idea's own still-open follow-up.
  None of these are started.
  PR: [#118](https://github.com/debate/debate-ai.com/pull/118).
- **Unlock Status Streak Badges — Progress Unlocks/Gamified Quests composition slice.**
  `packages/debate-card-search/src/lib/unlock-streak-status.ts` adds
  `buildContributorUnlockStatusWithStreak`/`buildUnlockStatusWithStreakText`,
  composing the existing "Progress Unlocks" tier/badge logic
  (`progress-unlocks.ts`'s `buildContributorUnlockStatus`) with the existing
  "Gamified Quests" streak logic (`gamified-quests.ts`'s
  `buildContributorQuestStreak`) into one `ContributorUnlockStatusWithStreak`
  that merges tier-earned badges with streak-earned badges (tier badges
  first) and carries the full `StreakStatus` alongside the unlocked skill
  level and next-tier progress. The "🎮 Gamified Quests" bullet's own
  follow-up (c) named this exact gap — see Research Crowdsourcing Organizer
  Features below — mirroring the existing
  `tiered-task-routing.ts` composition precedent (Progress Unlocks composed
  into Research Task Routing). Reuses `progress-unlocks.ts` and
  `gamified-quests.ts` directly rather than introducing a separate tier or
  streak signal. Vitest-covered in
  `packages/debate-card-search/test/unlock-streak-status.test.ts`. This is
  the first slice only — it works entirely off caller-supplied
  `ContributorStats`/`DailyMissionResult`s (neither a contributor's tier nor
  their streak is persisted anywhere in this repo yet); no progress/unlock UI
  in this repo reads it. Follow-ups: (a) persisting a contributor's tier and
  daily mission-completion history so this can be computed from real data
  instead of caller-supplied input, (b) a progress/unlock panel UI that
  renders `buildUnlockStatusWithStreakText`/`ContributorUnlockStatusWithStreak`.
  PR: [#117](https://github.com/debate/debate-ai.com/pull/117).
- **Generated Drill Set Persistence — localStorage drill-set-per-round store.**
  `packages/debate-round/src/state/drillSets.ts` adds
  `listDrillSets`/`getDrillSet`/`saveDrillSet`/`deleteDrillSet`, a
  localStorage-backed CRUD store for `drill-generator.ts`'s generated
  `Drill[]` set (plus the `sideKey` it was generated for), keyed by
  `roundId` with upsert-on-save semantics, mirroring the existing
  `preRoundBriefings.ts`/`judgeParadigmSelections.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). See the "AI Drill Generator" bullet under Research
  Crowdsourcing Organizer Features below — this is the "(c) persisting
  generated drills per round" follow-up named in that slice. This is a
  persistence slice only — it stores whatever `Drill[]` a caller passes in
  verbatim (`buildDrillSet` itself is unchanged); no drill-panel UI in this
  repo yet reads or writes through this store. Vitest-covered in
  `packages/debate-round/test/drillSets.test.ts`. Follow-ups: (a) a
  drill-panel UI that calls `buildDrillSet` and reads/writes through this
  store, (b) an actual AI-generated (rather than templated) drill script.
  PR: [#116](https://github.com/debate/debate-ai.com/pull/116).
- **Pre-Round Briefing Persistence — localStorage briefing store.**
  `packages/debate-round/src/state/preRoundBriefings.ts` adds
  `listPreRoundBriefings`/`getPreRoundBriefing`/`savePreRoundBriefing`/
  `deletePreRoundBriefing`, a localStorage-backed CRUD store for
  `pre-round-briefing.ts`'s `PreRoundBriefing`, keyed by a caller-supplied
  `roundId` with upsert-on-save semantics, mirroring the existing
  `judgeParadigmSelections.ts`/`coachingPrograms.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). See idea #12 ("Pre-Round Intelligence Panel") in
  Product Feature Ideas below — this is the "(c) persisting a generated
  briefing per round" follow-up named in that slice. This is a persistence
  slice only — it stores whatever `PreRoundBriefing` a caller passes in
  verbatim (`buildPreRoundBriefing`/`buildPreRoundBriefingText` themselves
  are unchanged); no round-information-page UI in this repo yet reads or
  writes through this store. Vitest-covered in
  `packages/debate-round/test/preRoundBriefings.test.ts`. Follow-ups: (a) a
  briefing-panel UI that renders a persisted briefing on a round-information
  page, (b) real data sources for tournament results, pairings, event
  details, and room assignments (none exist in this repo today) feeding
  `buildPreRoundBriefing` before it's persisted, (c) wiring
  `savePreRoundBriefing` into whatever eventually calls
  `buildPreRoundBriefing` for a real round.
  PR: [#115](https://github.com/debate/debate-ai.com/pull/115).
- **Opponent Persona Selection Persistence — localStorage persona-per-session store.**
  `packages/debate-speech-writer/src/state/opponentPersonaSelections.ts` adds
  `listOpponentPersonaSelections`/`getOpponentPersonaSelection`/
  `saveOpponentPersonaSelection`/`deleteOpponentPersonaSelection`, a
  localStorage-backed CRUD store for a practice session's selected
  `OpponentPersona` (`opponent/opponent-personas.ts`), keyed by `sessionId`
  with upsert-on-save semantics, mirroring the existing
  `judgeParadigmSelections.ts`/`coachMaterials.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Stores the full `OpponentPersona` object rather
  than just a builtin id, so a future custom persona would persist too. See
  the "AI Practice Opponent" idea in Research Crowdsourcing Organizer
  Features below — this is the "(c) persisting the selected persona per
  practice session" follow-up named in that slice. Vitest-covered in
  `packages/debate-speech-writer/test/opponentPersonaSelections.test.ts`.
  This is a persistence slice only — no persona-picker UI in this repo yet
  reads or writes through this store, and it isn't wired into an actual
  AI speech-generation call. Follow-ups: (a) an actual AI speech-generation
  call that consumes `buildOpponentPersonaPrompt`'s output alongside idea
  #3's `AiSpeechRequest`, (b) a persona-picker UI that reads/writes through
  this store before starting an AI-versus practice round.
  PR: [#114](https://github.com/debate/debate-ai.com/pull/114).
- **Group Challenge Persistence — localStorage challenge-config store.**
  `packages/debate-card-search/src/state/groupChallenges.ts` adds
  `listGroupChallenges`/`getGroupChallenge`/`saveGroupChallenge`/
  `deleteGroupChallenge`, a localStorage-backed CRUD store for
  `group-challenges.ts`'s `GroupChallenge` (id, title, goal, member roster,
  challenge window), keyed by `id` with upsert-on-save semantics, mirroring
  the existing `sprintNotes.ts`/`coachingPrograms.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). Reuses `GroupChallenge` from `group-challenges.ts`
  directly rather than redefining it. Vitest-covered (with an in-memory
  `localStorage` mock, since this package's Vitest environment is `node`
  with no DOM) in
  `packages/debate-card-search/test/groupChallenges.test.ts`. See the
  "Group Challenges" bullet under Research Crowdsourcing Organizer Features
  below (PR #97) — this is the "(c) persisting challenges" follow-up named
  in that slice. This is a config-persistence slice only — it stores a
  challenge's static config verbatim; a challenge's computed progress
  (`computeGroupChallengeProgress`, `GroupChallengeProgress`) stays
  session-derived from caller-supplied contributions/win events rather than
  being persisted, and no challenge-board/creation UI in this repo yet reads
  or writes through this store. Follow-ups: (a) a challenge-board/creation
  UI in `debate-card-search` that reads/writes through this store, (b)
  wiring real contribution-submission/practice-round-result events into
  `computeGroupChallengeProgress` instead of caller-supplied data, (c)
  notifying the squad when a persisted challenge completes.
  PR: [#113](https://github.com/debate/debate-ai.com/pull/113).
- **Judge Paradigm Selection Persistence — localStorage paradigm-per-round store.**
  `packages/debate-speech-writer/src/state/judgeParadigmSelections.ts` adds
  `listJudgeParadigmSelections`/`getJudgeParadigmSelection`/
  `saveJudgeParadigmSelection`/`deleteJudgeParadigmSelection`, a
  localStorage-backed CRUD store for a round's selected `JudgeParadigm`
  (`judge-paradigms.ts`), keyed by `roundId` with upsert-on-save semantics,
  mirroring the existing `opponentTeamProfiles.ts`/`coachMaterials.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). Stores the full
  `JudgeParadigm` object rather than just a builtin id, so a "custom"
  paradigm built with `buildCustomJudgeParadigm` persists too. See idea #5
  ("AI Judge Decision Modes") in Product Feature Ideas below — this is the
  "(c) persisting the selected paradigm per round" follow-up named in that
  slice. This is a persistence slice only — no paradigm-picker UI in this
  repo yet reads or writes through this store, and no AI judge-decision call
  looks up a round's persisted selection to build its prompt. Follow-ups:
  (a) a paradigm-picker UI that reads/writes through this store, (b) wiring
  a round's persisted selection into an actual AI judge-decision call via
  `buildJudgeParadigmPrompt`.
  PR: [#112](https://github.com/debate/debate-ai.com/pull/112).
- **Contribution Leaderboard Persistence — localStorage contribution store.**
  `packages/debate-card-search/src/state/contributions.ts` adds
  `listContributions`/`listContributionsByContributor`/`getContribution`/
  `saveContribution`/`deleteContribution`, a localStorage-backed CRUD store
  for `contribution-leaderboard.ts`'s `AttributedContribution` (a
  `community-rating.ts` `CommunityContribution` attributed to a
  `contributorId`), keyed by `id` with upsert-on-save semantics, mirroring
  the existing `sprintNotes.ts`/`peerReviews.ts`/`opponentTeamProfiles.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing).
  `listContributionsByContributor` reuses `contribution-leaderboard.ts`'s
  existing `groupContributionsByContributor` helper directly rather than
  reimplementing contributor-scoped filtering. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in
  `packages/debate-card-search/test/contributions.test.ts`. See the
  "Contribution Leaderboard" bullet under Research Crowdsourcing Organizer
  Features below — this is the "(a) wiring a `contributorId` into wherever
  contributions are eventually persisted" follow-up named in that slice.
  This is a persistence slice only — it stores whatever
  `AttributedContribution` a caller passes in verbatim (still built from
  caller-supplied like/save/quality/reviewer-endorsement signals, not wired
  to any real contribution-submission flow); no leaderboard UI in this repo
  yet reads or writes through this store, and `buildLeaderboard`/
  `buildContributorStats` still take a caller-supplied contribution list
  rather than reading through this store directly. Follow-ups: (a) wiring
  real like/save/endorse actions and a real submitted-contribution flow into
  `saveContribution`, (b) a leaderboard/ranked-feed UI that reads through
  this store and renders `buildLeaderboard`, (c) composing this store's
  reads directly into `buildLeaderboard`/`buildContributorStats` call sites
  once one exists, instead of requiring a caller-supplied list.
  PR: [#111](https://github.com/debate/debate-ai.com/pull/111).
- **Peer Review Persistence — localStorage review store.**
  `packages/debate-card-search/src/state/peerReviews.ts` adds
  `listPeerReviews`/`getPeerReview`/`savePeerReview`/`deletePeerReview`, a
  localStorage-backed CRUD store for `peer-review.ts`'s `CardReview`
  (status plus its full `ReviewComment` thread), keyed by `cardId` with
  upsert-on-save semantics, mirroring the existing
  `sprintNotes.ts`/`opponentTeamProfiles.ts`/`coachMaterials.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). Reuses `CardReview` from
  `peer-review.ts` directly rather than redefining it. Vitest-covered (with
  an in-memory `localStorage` mock, since this package's Vitest environment
  is `node` with no DOM) in
  `packages/debate-card-search/test/peerReviews.test.ts`. See the "Peer
  Review System" bullet under Research Crowdsourcing Organizer Features
  below — this is the "(a) persisting `CardReview`/`ReviewComment`
  alongside submitted cards" follow-up named in that slice. This is a
  persistence slice only — it stores whatever `CardReview` a caller passes
  in verbatim (still built from caller-supplied state-machine transitions,
  not wired to any real card-submission flow); no review-queue/comment-
  thread UI in this repo yet reads or writes through this store.
  Follow-ups: (a) a review-queue/comment-thread UI that reads/writes
  through this store, (b) reviewer identity/permission checks once
  auth/roles exist, (c) wiring a review's lifecycle to whatever eventually
  persists submitted cards, so `publishReview` can gate a card actually
  going live.
  PR: TBD.
- **Judge Profile Persistence — localStorage profile store.**
  `packages/debate-speech-writer/src/state/judgeProfiles.ts` adds
  `listJudgeProfiles`/`getJudgeProfile`/`saveJudgeProfile`/
  `deleteJudgeProfile`, a localStorage-backed CRUD store for
  `judge-profile.ts`'s `JudgeProfile`, keyed by `judgeId` with
  upsert-on-save semantics, mirroring the existing
  `coachMaterials.ts`/`opponentTeamProfiles.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). See the "Judge Profiles" bullet under Research
  Crowdsourcing Organizer Features below — this is the "(c)
  persisting/looking up profiles by judge across tournaments" follow-up
  named in that slice, mirroring the same follow-up already closed for
  Opponent Team Profiles (PR #108). This is a persistence slice only — it
  stores whatever `JudgeProfile` a caller passes in verbatim (still built
  from caller-supplied `JudgeRoundRecord`s, not a real ballot data source);
  no judge-profile card/panel UI in this repo yet reads or writes through
  this store. Vitest-covered (with an in-memory `localStorage` mock, since
  this package's Vitest environment is `node` with no DOM) in
  `packages/debate-speech-writer/test/judgeProfiles.test.ts`. Follow-ups:
  (a) a real ballot data source producing `JudgeRoundRecord`s so profiles
  reflect real ballots instead of caller-supplied data, (b) a
  judge-profile card/panel UI that renders `buildJudgeTendencySummary` for
  a profile read through this store, (c) wiring `buildPreRoundBriefing`
  (in `debate-round`) to look up a persisted profile here instead of
  requiring the caller to supply one.
  PR: [#109](https://github.com/debate/debate-ai.com/pull/109).
- **Opponent Team Profile Persistence — localStorage profile store.**
  `packages/debate-data-sync/src/state/opponentTeamProfiles.ts` adds
  `listOpponentTeamProfiles`/`getOpponentTeamProfile`/
  `saveOpponentTeamProfile`/`deleteOpponentTeamProfile`, a
  localStorage-backed CRUD store for `opponent-team-profile.ts`'s
  `OpponentTeamProfile`, keyed by `teamId` with upsert-on-save semantics,
  mirroring the existing `coachMaterials.ts`/`sprintNotes.ts` persistence
  convention (SSR/no-storage-safe, corrupt or missing JSON degrades to an
  empty list rather than throwing). This is the first localStorage-backed
  persistence store in the `debate-data-sync` package. Vitest-covered
  (with an in-memory `localStorage` mock, since this package's Vitest
  environment is `node` with no DOM) in
  `packages/debate-data-sync/test/opponentTeamProfiles.test.ts`. See the
  "Opponent Team Profiles" bullet under Research Crowdsourcing Organizer
  Features below — this is the "(c) persisting/looking up profiles by team
  across tournaments" follow-up named in that slice. This is a persistence
  slice only — it stores whatever `OpponentTeamProfile` a caller passes in
  verbatim (still built from caller-supplied `OpponentRoundRecord`s, not a
  real Tabroom/tab-service data source); no scouting-card or
  pre-round-briefing UI in this repo yet reads or writes through this
  store. Follow-ups: (a) a real round-history data source producing
  `OpponentRoundRecord`s so profiles reflect real pairings/ballots instead
  of caller-supplied data, (b) a scouting-card/panel UI that renders
  `buildOpponentScoutingSummary` for a profile read through this store,
  (c) wiring `buildPreRoundBriefing` (in `debate-round`) to look up a
  persisted profile here instead of requiring the caller to supply one.
  PR: [#108](https://github.com/debate/debate-ai.com/pull/108).
- **Coach Material Persistence — localStorage config store.**
  `packages/debate-speech-writer/src/state/coachMaterials.ts` adds
  `listCoachMaterials`/`getCoachMaterial`/`saveCoachMaterial`/
  `deleteCoachMaterial`, a localStorage-backed CRUD store for
  `team-coach-materials.ts`'s `CoachMaterial` (id, kind, title, topic, tags,
  text), keyed by `id` with upsert-on-save semantics, mirroring the existing
  `coachingPrograms.ts`/`prepNotes.ts`/`flowAnnotations.ts`/`sprintNotes.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). Reuses `CoachMaterial`
  from `team-coach-materials.ts` directly rather than redefining it.
  Vitest-covered (with an in-memory `localStorage` mock, since this
  package's Vitest environment is `node` with no DOM) in
  `packages/debate-speech-writer/test/coachMaterials.test.ts`. See the
  "Video-Lecture-Training Coach AI" idea (#8) in Product Feature Ideas
  below — this is the "(d) persisting a team's `CoachMaterial`s" follow-up
  named in that slice (PR #98). This is the first slice only — it persists
  whatever `CoachMaterial` a caller passes in verbatim; no UI in this repo
  yet uploads a material and threads it through `saveCoachMaterial`/
  `deleteCoachMaterial`, and it still doesn't transcribe recordings, parse
  uploaded documents, or call any AI model. Follow-ups: (a)
  transcription/parsing that turns an uploaded recording or document into a
  `CoachMaterial`'s `text`, (b) an actual AI Q&A call that consumes
  `buildGroundedCoachPrompt`'s output, (c) a materials-upload/coach chat
  panel UI that reads/writes through this store.
  PR: TBD.
- **Shared Evidence Library — fast keyword/tag/cite/topic search slice.**
  `packages/debate-card-search/src/lib/shared-evidence-library.ts` adds an
  `EvidenceLibraryEntry` model (extends the existing "Common Argument
  Library" slice's `LibraryCard` with a searchable full-text `text` body, a
  `cite`, and a `kind: "card" | "block"` distinguishing a cut/tagged
  evidence card from a team-drafted reusable analytic block) plus
  `searchEvidenceLibrary` (narrows by topic/case-area/kind/tags — reusing
  `argument-library.ts`'s `filterCardsByTags` directly — then, when a text
  query is given, ranks the remaining entries by keyword-overlap relevance
  against their combined text/argBlock/cite via the existing "LLM Card
  Scoring" slice's `scoreRelevance`, dropping zero-relevance entries rather
  than returning noise), `findEntriesByCite` (citation lookup),
  `buildEvidenceLibraryIndex` (a thin alias of `buildArgumentLibrary`, since
  an `EvidenceLibraryEntry` is already a `LibraryCard`), and
  `buildEvidenceSearchSummaryText`. Reuses `argument-library.ts` and
  `llm-card-scoring.ts` directly rather than introducing a separate
  grouping or relevance-scoring path. Vitest-covered in
  `packages/debate-card-search/test/shared-evidence-library.test.ts`. See
  the "Shared Evidence Library" bullet under Research Crowdsourcing
  Organizer Features below. This is the first slice only — it works
  entirely off a caller-supplied entry list; it doesn't read real submitted
  cards or blocks, persist the repository, or render a search UI, and its
  keyword search is a deterministic overlap heuristic rather than a real
  full-text/fuzzy search index. Follow-ups: (a) wiring real submitted cards
  and team-drafted blocks into a persisted repository instead of
  caller-supplied entries, (b) a search panel UI in `debate-card-search`
  that renders `searchEvidenceLibrary`/`buildEvidenceSearchSummaryText`
  results and `buildEvidenceLibraryIndex`'s folders/collections, (c) a real
  search index (e.g. Typesense, mirroring the existing `search-query.ts`
  CARDS search) once entries are persisted, for relevance/typo-tolerance
  beyond the current keyword-overlap heuristic.
  PR: [#106](https://github.com/debate/debate-ai.com/pull/106).
- **Sprint Note Persistence — localStorage note store.**
  `packages/debate-card-search/src/state/sprintNotes.ts` adds
  `listSprintNotes`/`listSprintNotesForTopic`/`getSprintNote`/
  `saveSprintNote`/`deleteSprintNote`, a localStorage-backed CRUD store for
  `team-collaboration-mode.ts`'s `SprintNote` (id, topic, author, text,
  status, optional assignee), keyed by `id` with upsert-on-save semantics,
  mirroring the existing `debate-round` `prepNotes.ts`/`coachingPrograms.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). This is the first
  localStorage-backed persistence store in the `debate-card-search`
  package. `listSprintNotesForTopic` reuses `team-collaboration-mode.ts`'s
  existing `getNotesForTopic` query helper directly rather than
  reimplementing topic-scoped filtering/sorting. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in
  `packages/debate-card-search/test/sprintNotes.test.ts`. See the "Team
  Collaboration Mode" bullet under Research Crowdsourcing Organizer Features
  below — this is the "(a) persisting `SprintNote`s and a topic sprint's
  inputs somewhere" follow-up named in that slice. This is the first slice
  only — it persists whatever `SprintNote` a caller passes in verbatim; no
  UI in this repo yet calls `createSprintNote`/`updateSprintNoteStatus`/
  `assignSprintNote` and threads the result through
  `saveSprintNote`/`deleteSprintNote`, and a topic sprint's other inputs
  (quest templates, contributor availability) still aren't persisted.
  Follow-ups: (a) a collaboration-mode panel UI in `debate-card-search` that
  reads/writes through this store, (b) persisting a topic sprint's other
  inputs once they have a natural persisted shape, (c) a presence/live-status
  signal for who's currently active in the sprint.
  PR: [#105](https://github.com/debate/debate-ai.com/pull/105).
- **Flow Annotation Persistence — localStorage annotation store.**
  `packages/debate-round/src/state/flowAnnotations.ts` adds
  `listFlowAnnotations`/`listFlowAnnotationsForFlow`/
  `listFlowAnnotationsForSpeech`/`listFlowAnnotationsForBox`/
  `getFlowAnnotation`/`saveFlowAnnotation`/`deleteFlowAnnotation`, a
  localStorage-backed CRUD store for `flow-annotations.ts`'s
  `FlowAnnotation` (id, flow/box address, speech, playback timestamp,
  optional note), keyed by `id` with upsert-on-save semantics, mirroring
  the existing `prepNotes.ts`/`coachingPrograms.ts` persistence convention
  (SSR/no-storage-safe, corrupt or missing JSON degrades to an empty list
  rather than throwing). `listFlowAnnotationsForSpeech`/
  `listFlowAnnotationsForBox` reuse `flow-annotations.ts`'s existing
  `getAnnotationsForSpeech`/`getAnnotationsForBox` query helpers directly
  rather than reimplementing filtering/sorting. Vitest-covered (with an
  in-memory `localStorage` mock, since this package's Vitest environment is
  `node` with no DOM) in `packages/debate-round/test/flowAnnotations.test.ts`.
  See idea #15 below ("Flow-in-Speech Flow Annotations") — this is the "(c)
  persisting annotations alongside a `Round`/`Flow`" follow-up named in
  that slice. This is the first slice only — it persists whatever
  `FlowAnnotation` a caller passes in verbatim; no UI in this repo yet
  calls `createFlowAnnotation` and threads the result through
  `saveFlowAnnotation`/`deleteFlowAnnotation`. Follow-ups: (a) a
  video-player UI (`debate-videos`) that lets a viewer drop an annotation
  at the current playback position, persisted through this store, and jump
  back to one, (b) a flow-grid affordance (`FlowSpreadsheet`) that surfaces
  annotations on their box via `listFlowAnnotationsForBox` and links back
  to the timestamp.
  PR: [#104](https://github.com/debate/debate-ai.com/pull/104).
- **Shared Flow Sync — concurrent-edit merge and conflict-detection slice.**
  `packages/debate-round/src/flow/shared-flow-sync.ts` adds a `FlowEdit`
  model (one contributor's proposed edit to a single flow `Box`'s content,
  addressed via `boxPath` the same way `flow-annotations.ts`/
  `strategy-sync-notes.ts` already address boxes) plus `mergeFlowEdits`
  (reconciles every box's edits into one canonical value — last write wins,
  tie-broken by `id` — except when a box's latest edit and some other,
  different-author edit with different content land within a configurable
  `conflictWindowMs` of each other, in which case that box is left out of
  `merged` and reported in `conflicts` instead, so a teammate's genuinely
  concurrent work is surfaced for a human to resolve rather than silently
  overwritten), `applyMergedEditsToFlow` (immutably applies merged edits to
  a `Flow`'s boxes, skipping an edit whose `boxPath` no longer resolves
  rather than throwing, mirroring `resolveAnnotationBox`'s handling), and
  `buildSharedFlowSyncSummaryText`. See idea #16 below ("Shared,
  Ai-Generated Debate Flow"). This is the first slice only — it's pure
  merge logic over caller-supplied edits; there's no live transport (e.g.
  WebSocket) wiring contributors' edits together in real time, it isn't
  wired into `FlowSpreadsheet`, and it doesn't preload evidence cards into
  flow notes (the idea's "optionally preloading evidence cards" half).
  Vitest-covered (100% statement/branch/function/line coverage) in
  `packages/debate-round/test/shared-flow-sync.test.ts`. Follow-ups: (a) a
  live transport (WebSocket or similar) that turns local `FlowEdit`s into a
  shared stream across a room/team, (b) a `FlowSpreadsheet` affordance that
  applies `mergeFlowEdits`/`applyMergedEditsToFlow` and surfaces
  `conflicts` for a teammate to pick a winner, (c) composing
  `argument-library.ts`'s tagged card corpus to suggest a pre-filled flow
  note from matching evidence, keeping the human in control of whether to
  accept it.
  PR: [#103](https://github.com/debate/debate-ai.com/pull/103).
- **Prep Note Persistence — localStorage note store.**
  `packages/debate-round/src/state/prepNotes.ts` adds
  `listPrepNotes`/`listPrepNotesForFlow`/`getPrepNote`/`savePrepNote`/
  `deletePrepNote`, a localStorage-backed CRUD store for
  `strategy-sync-notes.ts`'s `PrepNote` (id, flow/box address, author, text,
  status, optional assignee), keyed by `id` with upsert-on-save semantics,
  mirroring the existing `coachingPrograms.ts`/`myTeamProfile.ts`
  persistence convention (SSR/no-storage-safe, corrupt or missing JSON
  degrades to an empty list rather than throwing). `listPrepNotesForFlow`
  reuses `strategy-sync-notes.ts`'s existing `getNotesForFlow` query helper
  directly rather than reimplementing flow-scoped filtering/sorting.
  Vitest-covered (with an in-memory `localStorage` mock, since this
  package's Vitest environment is `node` with no DOM) in
  `packages/debate-round/test/prepNotes.test.ts`. See the "Strategy Sync
  Notes" bullet under Research Crowdsourcing Organizer Features below — this
  is the "(a) wiring `PrepNote` into wherever round/flow state is eventually
  persisted" follow-up named in that slice. This is the first slice
  only — it persists whatever `PrepNote` a caller passes in verbatim; no UI
  in this repo yet calls `createPrepNote`/`updateNoteStatus`/`assignNote`
  and threads the result through `savePrepNote`/`deletePrepNote`. Follow-ups:
  (a) a prep-notes panel UI in `debate-round` that reads/writes through this
  store, (b) wiring `updateNoteStatus`/`assignNote`'s returned copies back
  into `savePrepNote` so status/assignment changes persist, (c) an assignee
  notification once a notification system exists.
  PR: [#102](https://github.com/debate/debate-ai.com/pull/102).
- **Coaching Program Persistence — localStorage config store.**
  `packages/debate-round/src/state/coachingPrograms.ts` adds
  `listCoachingPrograms`/`getCoachingProgram`/`saveCoachingProgram`/
  `deleteCoachingProgram`, a localStorage-backed CRUD store for
  `coaching-program.ts`'s `CoachingProgramConfig` (id, name, squad roster),
  keyed by `id` with upsert-on-save semantics, mirroring the existing
  `myTeamProfile.ts` persistence convention (SSR/no-storage-safe, corrupt or
  missing JSON degrades to an empty list rather than throwing). Reuses
  `CoachingProgramConfig` from `coaching-program.ts` directly rather than
  redefining it. Vitest-covered (with an in-memory `localStorage` mock, since
  this package's Vitest environment is `node` with no DOM) in
  `packages/debate-round/test/coachingPrograms.test.ts`. See the "Coaching
  Programs and Group Challenges" idea (#13) in Product Feature Ideas below —
  this is the "(a) persisting a coaching program's config" half of the
  follow-up named in the `coaching-program.ts` slice (PR #99). This is the
  first slice only — it persists a program's *config* only, not its board's
  session-derived inputs (topic-sprint contributions, member flows,
  challenges, win events), and there's no UI reading or writing this store
  yet. Follow-ups: (a) a coaching-space dashboard UI that lists/creates/edits
  programs through this store, (b) wiring `buildCoachingProgramBoard`'s other
  inputs into their own persistence once those have a natural persisted
  shape (most are session-derived rather than static config).
  PR: [#101](https://github.com/debate/debate-ai.com/pull/101).
- **Tiered Task Routing — stats-derived skill-level composition slice.**
  `packages/debate-card-search/src/lib/tiered-task-routing.ts` adds
  `deriveContributorAvailability`/`deriveContributorAvailabilityList` (builds
  a `research-task-routing.ts` `ContributorAvailability` by deriving its
  `skillLevel` from a contributor's `contribution-leaderboard.ts`
  `ContributorStats` via `progress-unlocks.ts`'s
  `buildContributorUnlockStatus`/`getUnlockedSkillLevel`, instead of
  requiring a caller-supplied skill level — throwing if the supplied stats
  and task-load entries don't share a `contributorId`, and skipping a
  contributor with stats but no matching load entry rather than guessing a
  `maxConcurrentTasks` default) and `buildRoutingResultFromContributorStats`
  (composes that straight into the existing `buildTaskQueue`/`routeTasks`).
  This closes the exact gap both the "Progress Unlocks" and "Research Task
  Routing" ideas' own follow-ups named — `progress-unlocks.ts` could derive
  an unlocked skill level but nothing fed it into
  `research-task-routing.ts`'s `ContributorAvailability`. Reuses
  `progress-unlocks.ts` and `research-task-routing.ts` directly rather than
  introducing a separate skill-derivation or routing path. Vitest-covered in
  `packages/debate-card-search/test/tiered-task-routing.test.ts`. See the
  "Research Task Routing" and "Progress Unlocks" bullets under Research
  Crowdsourcing Organizer Features below. This is the first slice only — a
  contributor's `activeTaskCount`/`maxConcurrentTasks` still isn't tracked
  anywhere in this repo, so it remains caller-supplied; this only removes
  the need for a caller-supplied `skillLevel`. Follow-ups: (a) persisting a
  contributor's active-task count so `activeTaskCount` no longer needs to be
  caller-supplied either, (b) wiring `buildRoutingResultFromContributorStats`
  into a task-assignment/inbox UI once one exists, (c) reusing the same
  derive-then-route pattern once `research-task-routing.ts`'s task queue
  gains other skill-gated categories beyond coverage-gap tasks.
  PR: [#100](https://github.com/debate/debate-ai.com/pull/100).
- **Coaching Program Space — topic-sprint/group-challenge/member-drill composition slice.**
  `packages/debate-round/src/round/coaching-program.ts` adds a
  `CoachingProgramConfig` (id, name, squad roster) and
  `buildCoachingProgramBoard`, which composes `debate-card-search`'s
  `team-collaboration-mode.ts` `buildTopicSprint` (shared research sprint),
  `debate-card-search`'s `group-challenges.ts` `buildGroupChallengeBoard`
  (friendly-challenge standings), and this package's own
  `flow/drill-generator.ts` `buildDrillSet` (one practice-drill set per
  roster member who has a flowed practice round, ignoring flows for
  contributors outside the roster) into one renderable coaching-space board,
  plus `buildCoachingProgramSummaryText` and `buildMemberDrillSummaryText`.
  `debate-round` now depends on `debate-card-search` to make this
  composition possible, mirroring the existing precedent of
  `pre-round-briefing.ts` adding new cross-package dependencies. Reuses
  `buildTopicSprint`/`buildGroupChallengeBoard`/`buildDrillSet` directly
  rather than reimplementing any of their quest/challenge/drill logic.
  Vitest-covered in `packages/debate-round/test/coaching-program.test.ts`.
  See the "Coaching Programs and Group Challenges" idea (#13) in Product
  Feature Ideas below — this is the "coaching-program/space model" follow-up
  named in the Group Challenges slice (PR #97). This is the first slice
  only — it works entirely off caller-supplied topic-sprint/challenge/flow
  inputs; it doesn't persist a program, its roster, or its board anywhere,
  doesn't compose `practice-round-simulator.ts`'s
  `buildPracticeRoundSetup`/`buildPracticeRoundFeedback` (a practice round is
  per-member/per-session rather than a fixed part of a program's board), and
  doesn't render a coaching-space UI. Follow-ups: (a) persisting a
  `CoachingProgramConfig` and its board's inputs, (b) a coaching-space
  dashboard UI that renders `buildCoachingProgramBoard`/
  `buildCoachingProgramSummaryText`, (c) letting a coach start (and later
  review feedback from) a member's practice round from within the space by
  wiring in `buildPracticeRoundSetup`/`buildPracticeRoundFeedback`.
  PR: [#99](https://github.com/debate/debate-ai.com/pull/99).
- **Video-Lecture-Training Coach AI — grounding-materials library and
  grounded-prompt slice.**
  `packages/debate-speech-writer/src/coach/team-coach-materials.ts` adds a
  kind-grouped `CoachMaterial` library (`buildCoachMaterialLibrary` — lecture
  transcripts, camp materials, instructional documents, and practice-round
  recordings, in a stable, most-consulted-first order), a deterministic
  keyword-overlap relevance scorer (`scoreMaterialRelevance`/
  `findRelevantMaterials`, matching against a material's title, tags, and
  body text, optionally scoped by topic and capped by limit/threshold), and
  `buildGroundedCoachPrompt` — a self-contained prompt built from the most
  relevant materials that instructs a future AI Q&A call to answer only from
  the supplied grounding materials, mirroring the existing
  `opponent-personas.ts`/`judge-paradigms.ts` structured-prompt convention —
  plus `buildCoachMaterialLibrarySummaryText`. Vitest-covered (100%
  statement/branch coverage) in
  `packages/debate-speech-writer/test/team-coach-materials.test.ts`. See the
  "Video-Lecture-Training Coach AI" idea (#8) in Product Feature Ideas below.
  This is the first slice only — it doesn't transcribe recordings, parse
  uploaded documents, call any AI model, or persist a team's materials.
  Follow-ups: (a) transcription/parsing that turns an uploaded recording or
  document into a `CoachMaterial`'s `text`, (b) an actual AI Q&A call that
  consumes `buildGroundedCoachPrompt`'s output, (c) a materials-upload/coach
  chat panel UI, (d) persisting a team's `CoachMaterial`s.
  PR: [#98](https://github.com/debate/debate-ai.com/pull/98).
- **Group Challenges — squad-scoped friendly-challenge progress-tracking slice.**
  `packages/debate-card-search/src/lib/group-challenges.ts` adds a
  `GroupChallenge` model supporting two goal kinds — `contribution_target`
  (e.g. "the squad finds 20 solvency cards this week", reusing
  `daily-quests.ts`'s `QuestTarget` matching, exported as
  `matchesQuestTarget` for this reuse) and `win_target` (e.g. "the squad wins
  5 rebuttal exercises", from caller-supplied win events) — plus
  `computeGroupChallengeProgress` (scopes progress to the challenge's
  `[startsAt, endsAt)` window and `memberIds` roster, and ranks per-member
  standings by blended helpfulness score for contribution challenges via the
  existing `contribution-leaderboard.ts` `buildLeaderboard` — not raw count,
  so a member with fewer but higher-quality contributions can still lead —
  or by raw win count for win challenges), `buildGroupChallengeBoard`
  (incomplete challenges first, mirroring `buildDailyQuestBoard`'s
  ordering), and `buildGroupChallengeSummaryText`. Reuses
  `daily-quests.ts`/`contribution-leaderboard.ts` directly rather than
  introducing a separate matching or scoring path. Vitest-covered in
  `packages/debate-card-search/test/group-challenges.test.ts`. See the
  "Coaching Programs and Group Challenges" idea (#13) in Product Feature
  Ideas below. This is the first slice only — it's the "friendly challenges"
  half of idea #13 only; it doesn't model coaching "spaces"/rosters,
  assigned drills, research-sprint wiring, or a practice-round composition
  (the rest of idea #13), persist a challenge or its progress, notify the
  squad when a challenge completes, or render a challenge UI. Follow-ups:
  (a) a coaching-program/space model that composes this with
  `drill-generator.ts`'s `buildDrillSet`, `team-collaboration-mode.ts`'s
  `buildTopicSprint`, and `practice-round-simulator.ts`'s
  `buildPracticeRoundSetup`/`buildPracticeRoundFeedback`, (b) a
  challenge-board/creation UI in `debate-card-search`, (c) persisting
  challenges and wiring real contribution-submission/practice-round-result
  events into `computeGroupChallengeProgress` instead of caller-supplied
  data.
  PR: [#97](https://github.com/debate/debate-ai.com/pull/97).
- **Team Collaboration Mode — topic-sprint composition slice.**
  `packages/debate-card-search/src/lib/team-collaboration-mode.ts` adds
  `buildTopicSprint`/`buildTopicSprintSummaryText`, composing the existing
  "Daily Quests and Targets" board (`daily-quests.ts`'s
  `buildDailyQuestBoard`), "Research Task Routing" result
  (`research-task-routing.ts`'s `buildRoutingResult`), and "Research
  Progress Tracking" board (`research-progress.ts`'s
  `buildResearchProgressBoard`) into one shared, topic-scoped session (a
  "Topic Sprint"), plus a topic-addressed `SprintNote` model
  (`createSprintNote`/`updateSprintNoteStatus`/`assignSprintNote`/
  `getNotesForTopic`/`getNotesAssignedTo`/`getOpenFollowUps`) mirroring
  `debate-round`'s `strategy-sync-notes.ts` `PrepNote` lifecycle
  (open/covered/needs-follow-up, assignable as a task) — this package has no
  dependency on `debate-round`, so the box-addressed convention is mirrored
  locally with a topic in place of a flow box rather than introducing a
  separate note-status scheme. Reuses `daily-quests.ts`,
  `research-task-routing.ts`, and `research-progress.ts` directly rather
  than introducing a separate quest/assignment/progress signal.
  Vitest-covered (100% statement/branch/function/line coverage) in
  `packages/debate-card-search/test/team-collaboration-mode.test.ts`. See
  the "Team Collaboration Mode" bullet under Research Crowdsourcing
  Organizer Features below. This is the first slice only — it works
  entirely off caller-supplied quests/contributions/coverage
  reports/contributor availability/assignments/notes; it doesn't persist a
  sprint or its notes, track live/presence status for who's currently
  online, or render a collaboration-mode UI. Follow-ups: (a) persisting
  `SprintNote`s and a topic sprint's inputs (quest templates, contributor
  availability) somewhere, (b) a collaboration-mode panel UI that renders
  `buildTopicSprint`/`buildTopicSprintSummaryText` and calls
  `createSprintNote`/`updateSprintNoteStatus`/`assignSprintNote`, (c) a
  presence/live-status signal for who's currently active in the sprint.
  PR: [#96](https://github.com/debate/debate-ai.com/pull/96).
- **Team Brainstorm Assist — squad brainstorm prompt/board slice.**
  `packages/debate-card-search/src/lib/team-brainstorm-assist.ts` adds
  `buildBrainstormPrompt` (a structured, non-AI-calling brainstorm prompt for
  one argument block across four categories — `argument`, `impact_framing`,
  `frontline`, `response`), `buildBrainstormPromptsForCoverageGaps` (seeds
  prompts straight from the existing Topic Coverage Dashboard's
  `getUnderCoveredArguments`, worst-covered argument first), a squad idea
  board model (`groupIdeasByBoard`, `rankBrainstormIdeas` — reusing the
  existing `community-rating.ts` `scorePopularitySignal` for ranking and the
  existing `llm-card-scoring.ts` `scoreUniqueness` heuristic to flag
  near-duplicate submissions, `buildBrainstormBoard`,
  `buildBrainstormBoardsForCoverageGaps`), and `buildBrainstormSummaryText`.
  Reuses `topic-coverage.ts`, `community-rating.ts`, and `llm-card-scoring.ts`
  directly rather than introducing a separate coverage, popularity, or
  duplicate-detection signal. Vitest-covered (100% statement/branch/
  function/line coverage) in
  `packages/debate-card-search/test/team-brainstorm-assist.test.ts`. See the
  "Team Brainstorm Assist" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it doesn't call any AI
  model to actually generate ideas, persist a board or its submitted ideas,
  or render a brainstorm panel UI. Follow-ups: (a) an actual AI-generation
  call that consumes `buildBrainstormPrompt`'s output to draft candidate
  ideas for the squad to react to instead of starting from a blank board,
  (b) a brainstorm-panel UI in `debate-card-search` that renders
  `buildBrainstormBoard`/`buildBrainstormSummaryText` and lets teammates
  submit/upvote ideas live, (c) persisting submitted ideas and their votes.
  PR: [#95](https://github.com/debate/debate-ai.com/pull/95).
- **Practice Round Simulator — setup/post-round-feedback composition slice.**
  `packages/debate-round/src/round/practice-round-simulator.ts` adds
  `buildPracticeRoundSetup`/`buildPracticeRoundSetupText` (combines idea #3's
  `buildAiVersusSpeechOrder` speech order, `debate-speech-writer`'s
  `judgeParadigms` registry, and its `opponentPersonas` registry into one
  renderable practice-round setup document — accepting either a built-in
  paradigm/persona id or a pre-built one, e.g. from
  `buildCustomJudgeParadigm`) and `buildPracticeRoundFeedback`/
  `buildPracticeRoundFeedbackText` (frames post-round feedback around the
  selected judge paradigm's voting priorities — or its description when it
  has none, as with a custom paradigm — followed by the existing AI Coach
  Mode `buildCoachingSession`/`buildCoachingSummaryText`). Reuses
  `ai-versus-speech-order.ts`, `judge-paradigms.ts`, `opponent-personas.ts`,
  and `coach-mode.ts` directly rather than reimplementing any of that
  speech-order/paradigm/persona/coaching logic. Vitest-covered in
  `packages/debate-round/test/practice-round-simulator.test.ts`. See the
  "Practice Round Simulator" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it doesn't call any AI
  model to actually generate the AI opponent's speeches or a judge decision,
  isn't wired into any round-simulator UI, and doesn't persist a practice
  round anywhere. This repo has no `lint` script configured (only
  `typecheck`/`test`/`build` via turbo), so there was no lint step to run.
  Follow-ups: (a) an actual AI speech-generation call for the AI opponent's
  speeches (consuming idea #3's `buildAiResponseRequest` alongside the
  chosen `opponentPersona`) and an AI judge-decision call under the chosen
  paradigm, (b) a round-simulator UI in `debate-round` that renders
  `buildPracticeRoundSetupText` for setup and `buildPracticeRoundFeedbackText`
  after the round, (c) persisting a simulated practice round (setup,
  submitted speeches, and feedback) once round-state persistence exists.
  PR: [#94](https://github.com/debate/debate-ai.com/pull/94).
- **AI Coach Mode — extension/refutation/collapse/weighing coaching-prompt slice.**
  `packages/debate-round/src/flow/coach-mode.ts` adds
  `buildExtensionPrompts` (unanswered rows whose last flowed entry is on the
  caller's own side — their last word stands, so extend it as
  dropped/conceded), `buildRefutationPrompts` (unanswered rows whose last
  flowed entry is on the opposing side — must be answered before it's
  extended against the caller), `buildCollapsePrompts` (a thin remap of the
  existing `drill-generator.ts` `buildCollapseDrills`), `buildWeighingGuidance`
  (a whole-round weighing prompt comparing the caller's side against every
  other side via `response-outcome.ts`'s `summarizeOutcomeBySide` — ahead on
  both unanswered count and average vulnerability is framed as "weigh on your
  uncontested offense", behind on either is framed as a warning to shore up
  the case first), `buildCoachingSession` (combines all four, refutation
  first since live threats need an answer before anything else), and
  `buildCoachingSummaryText`. Reuses `flow-transcript-summary.ts`,
  `response-outcome.ts`, `argument-tree.ts`'s `getSpeechSideKey`, and
  `drill-generator.ts`'s `buildCollapseDrills` directly rather than
  reimplementing any of that vulnerability/side-classification logic.
  Vitest-covered in `packages/debate-round/test/coach-mode.test.ts`. See the
  "AI Coach Mode" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it's a deterministic template layer
  over the flow's existing clash/vulnerability signals (the same heuristic
  `response-outcome.ts` and `drill-generator.ts` already use), not an actual
  AI-generated coaching call; it isn't wired into any coaching-panel UI, and
  generated sessions aren't persisted anywhere. This repo has no `lint`
  script configured (only `typecheck`/`test`/`build` via turbo), so there was
  no lint step to run. Follow-ups: (a) an actual AI coaching call (live or
  post-round) that consumes the same flow signals for open-ended feedback
  beyond this template layer, (b) a coaching-panel UI in `debate-round` that
  renders `buildCoachingSession`/`buildCoachingSummaryText`, (c) persisting a
  generated coaching session per round.
  PR: [#92](https://github.com/debate/debate-ai.com/pull/92).
- **Strategy Sync Notes — box-addressed prep-note/task-assignment/status slice.**
  `packages/debate-round/src/flow/strategy-sync-notes.ts` adds a `PrepNote`
  data model addressed to a specific flow `Box` the same way
  `flow-annotations.ts` already addresses boxes (`boxPath`/`boxFromPath`):
  `createPrepNote` (validates a non-empty `boxPath`, an `authorId`, and
  non-blank, length-clamped `text`, starting in the `open` status),
  `updateNoteStatus` (moves a note between `open`/`covered`/
  `needs-follow-up`), `assignNote` (assigns — or unassigns, passing `null`
  — a note to a teammate as a task), `getNotesForBox`/`getNotesForFlow`/
  `getNotesAssignedTo`/`getOpenFollowUps` (oldest-first query helpers, so
  the longest-open follow-up surfaces first), `resolvePrepNoteBox` (mirrors
  `resolveAnnotationBox` for a "jump to argument" link), and
  `buildPrepNoteSummaryText` (a status-count line plus one line per open
  follow-up, with its assignee if any). Mirrors `flow-annotations.ts`'s
  box-addressing convention exactly rather than introducing a separate
  argument-addressing scheme. Vitest-covered in
  `packages/debate-round/test/strategy-sync-notes.test.ts`. See the
  "Strategy Sync Notes" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it's pure data-model/query
  logic over caller-supplied notes; nothing in this repo persists a
  `PrepNote`, notifies an assignee when a task is assigned, or renders a
  prep-notes panel UI yet. Follow-ups: (a) wiring `PrepNote` into wherever
  round/flow state is eventually persisted, (b) a prep-notes panel UI in
  `debate-round` (likely alongside `FlowSpreadsheet`) that renders
  `getNotesForFlow`/`buildPrepNoteSummaryText` and calls
  `createPrepNote`/`updateNoteStatus`/`assignNote`, (c) an assignee
  notification once a notification system exists in this repo.
  PR: TBD.
- **Scout-to-Strategy Workflow — case-choice/judge-adaptation/risk-level recommendation slice.**
  `packages/debate-round/src/round/scout-to-strategy.ts` adds
  `computeCaseOverlapScore`/`rankCaseOptions` (ranks caller-supplied case
  options by tag overlap against the opponent's existing `OpponentTeamProfile`
  `topArgumentTags` — a heuristic proxy for "the opponent likely has blocks
  prepped against this" — safest/lowest-overlap first, tie-broken
  alphabetically), `buildJudgeAdaptationNotes` (turns an existing
  `JudgeProfile`'s speed tolerance, theory receptiveness, side bias, and
  most-tagged paradigm into concrete adaptation notes, with explicit
  fallback text when there's no judge data or no notable tendencies),
  `assessMatchupRisk` (combines opponent win rate/side preference and judge
  side bias into a `low`/`medium`/`high` risk level plus the specific
  factors behind it — one risk factor is `medium`, two or more is `high`),
  and `buildStrategyRecommendation`/`buildStrategyRecommendationText`
  (compose all of the above into one renderable recommendation). Mirrors the
  existing `pre-round-briefing.ts` pattern in the same package and reuses
  the existing `OpponentTeamProfile` (`debate-data-sync`)/`JudgeProfile`
  (`debate-speech-writer`) types directly rather than introducing new ones.
  Vitest-covered (100% statement/branch/function/line coverage) in
  `packages/debate-round/test/scout-to-strategy.test.ts`. See the
  "Scout-to-Strategy Workflow" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — the risk/case-overlap
  heuristics are illustrative, not a validated strategic model; it doesn't
  know which side the opponent will be on this round (no `ourSide`/opponent
  side input is wired into the risk heuristic yet), it doesn't call any AI
  model to evaluate case choice, and it isn't wired into any strategy-panel
  UI yet. This repo has no `lint` script configured (only
  `typecheck`/`test`/`build` via turbo), so there was no lint step to run.
  Follow-ups: (a) a case-choice/strategy panel UI in `debate-round` that
  renders `buildStrategyRecommendation`/`buildStrategyRecommendationText`,
  (b) wiring `ourSide`/likely opponent side into the risk heuristic once
  round-setup state exposes it, (c) an actual AI-panel evaluation of case
  choice instead of the tag-overlap heuristic.
  PR: [#90](https://github.com/debate/debate-ai.com/pull/90).
- **AI Practice Opponent — policy-heavy/kritik/lay/fast-flow persona registry slice.**
  `packages/debate-speech-writer/src/opponent/opponent-personas.ts` adds a
  `opponentPersonas` registry of four built-in styles (`policy-heavy`,
  `kritik`, `lay`, `fast-flow`), each with a name/description, pace, ordered
  `preferredArguments`, and imperative `instructions`, plus
  `getOpponentPersona`/`listOpponentPersonas` lookups and
  `buildOpponentPersonaPrompt` for composing a self-contained prompt section.
  Mirrors the existing `judge-paradigms.ts` registry shape exactly rather
  than introducing a separate persona-definition pattern. Vitest-covered
  (100% statement/branch/function/line coverage) in
  `packages/debate-speech-writer/test/opponent-personas.test.ts`. See the "AI
  Practice Opponent" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it doesn't call any AI model, isn't
  wired into idea #3's `buildAiResponseRequest`/`AiSpeechRequest` (which
  lives in `debate-round` and can't import from `debate-speech-writer`
  without inverting the existing dependency direction), and isn't rendered
  in any persona-picker UI. Follow-ups: (a) an actual AI speech-generation
  call that consumes `buildOpponentPersonaPrompt`'s output alongside idea
  #3's `AiSpeechRequest` to produce a persona-styled opponent speech, (b) a
  persona-picker UI for selecting an opponent style before starting an
  AI-versus practice round. (c), persisting the selected persona per
  practice session, is now done — see "Opponent Persona Selection
  Persistence" above.
  PR: TBD.
- **AI Drill Generator — overview/frontline/cross-ex/collapse drill slice.**
  `packages/debate-round/src/flow/drill-generator.ts` adds `buildOverviewDrill`
  (a whole-round overview prompt weighing every side's unanswered-argument
  count and average vulnerability), `buildFrontlineDrills` (a
  frontline-practice prompt per still-live opposing argument), `buildCrossExamDrills`
  (wraps the existing `flow-transcript-summary.ts` `suggestCrossExamQuestions`
  as tagged drills), `buildCollapseDrills` (recommends the opposing side's
  top-N most vulnerable arguments, via the existing `response-outcome.ts`
  `getArgumentVulnerabilityReport`, as collapse-scenario candidates),
  `buildDrillSet` (combines all four in order for a chosen side), and
  `buildDrillSummaryText`. Reuses the existing `flow-transcript-summary.ts`
  and `response-outcome.ts` slices directly rather than introducing a
  separate scoring or template path. Vitest-covered (100% statement/branch/
  function/line coverage) in
  `packages/debate-round/test/drill-generator.test.ts`. See the "AI Drill
  Generator" bullet under Research Crowdsourcing Organizer Features below.
  This is the first slice only — it's a deterministic template layer over
  the flow's existing clash/vulnerability signals, not an actual AI-generated
  drill script; it isn't wired into any drill-panel UI, and generated drills
  aren't persisted anywhere. Follow-ups: (a) an actual drill-panel UI in
  `debate-round` that renders `buildDrillSet`/`buildDrillSummaryText`, (b) an
  AI-generated (rather than templated) overview/frontline script once an LLM
  call is wired in, (c) persisting generated drills per round/practice
  session.
  PR: [#88](https://github.com/debate/debate-ai.com/pull/88).
- **Common Argument Library — topic-folder/case-area/tag-collection organizing slice.**
  `packages/debate-card-search/src/lib/argument-library.ts` adds
  `groupCardsByTopic`, `groupCardsByCaseArea`, `buildTopicFolder` (splits one
  topic's cards into case-area subgroups), `buildTopicFolders` (a folder for
  every topic represented), `buildTagCollections` (a cross-cutting
  collection for every distinct tag, with multi-tag cards appearing under
  each of their tags), `filterCardsByTags` (any/all tag matching),
  `buildArgumentLibrary`, and `buildLibrarySummaryText`. Extends the
  existing "Topic Coverage Dashboard" slice's `argBlock`-tagged
  `CoverageCardSummary` card model with `topic`/`caseArea`/`tags` rather than
  introducing a separate card shape. Vitest-covered in
  `packages/debate-card-search/test/argument-library.test.ts`. See the
  "Common Argument Library" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off a
  caller-supplied, already-tagged card list; it doesn't read real submitted
  cards, persist a library's structure, or render a folder/collection
  browser UI. Follow-ups: (a) wiring a `topic`/`caseArea`/`tags` field into
  wherever submitted cards are eventually persisted, (b) a folder/collection
  browser UI in `debate-card-search` that renders `buildArgumentLibrary`'s
  topic folders and tag collections, (c) a tag-autocomplete/tag-management
  affordance so contributors pick from existing tags instead of free typing.
  PR: TBD.

- **Gamified Quests — streak tracking and milestone-badge slice.**
  `packages/debate-card-search/src/lib/gamified-quests.ts` adds
  `computeDailyMissionResult` (derives whether a day's `daily-quests.ts`
  `QuestProgress` board was fully completed), `computeStreakStatus`
  (current streak walking backward from a caller-supplied "as of" UTC day
  key, plus the longest streak found anywhere in the supplied history),
  `getEarnedStreakBadges` (milestone badges — 3/7/14/30-day streaks by
  default — earned at a given streak length), `buildContributorQuestStreak`,
  and `buildStreakSummaryText`. Reuses `daily-quests.ts`'s `QuestProgress`
  board directly as the per-day completion signal rather than introducing a
  separate mission-tracking data model. Vitest-covered in
  `packages/debate-card-search/test/gamified-quests.test.ts`. See the
  "Gamified Quests" bullet under Research Crowdsourcing Organizer Features
  below — the "Daily Quests and Targets", "Progress Unlocks", and "Revision
  Incentives" slices all named this as a follow-up. This is the first slice
  only — it works entirely off caller-supplied daily mission-completion
  history; it doesn't wire in real contribution-submission events, persist a
  contributor's streak/badges anywhere, or render a streak/badge UI.
  Follow-ups: (a) wiring the existing `daily-quests.ts` board (fed by real
  persisted daily contributions) into `computeDailyMissionResult` per
  contributor per day instead of caller-supplied results, (b) a streak/badge
  widget UI that renders `buildContributorQuestStreak`/
  `buildStreakSummaryText` alongside the quest board, (c) surfacing earned
  streak badges on a contributor's `progress-unlocks.ts` unlock status
  alongside their tier badges.
  PR: TBD.

- **Daily Quests and Targets — per-day quest progress tracking slice.**
  `packages/debate-card-search/src/lib/daily-quests.ts` adds
  `computeQuestProgress` (tallies a day's contributions matching a quest's
  kind/argument-block target against its target count),
  `buildDailyQuestBoard` (progress for every quest on the UTC calendar day
  of a caller-supplied `now`, incomplete quests first), `buildQuestBoardSummaryText`,
  and `buildUnderCoveredArgumentQuests` (turns the existing "Topic Coverage
  Dashboard" slice's `getUnderCoveredArguments` output into a ready-made
  "find N more cards for X" quest per under-covered tracked argument).
  Reuses `topic-coverage.ts`'s coverage classification and
  `daily-best-card.ts`'s `getUtcDayKey` directly rather than introducing a
  separate under-coverage or day-scoping signal. Vitest-covered in
  `packages/debate-card-search/test/daily-quests.test.ts`. See the "Daily
  Quests and Targets" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off
  caller-supplied quest templates and contributions; it doesn't track
  streaks (a separate "Gamified Quests" idea), persist quest completion
  anywhere, or render a quest board UI. Follow-ups: (a) wiring real
  contribution-submission events into a persisted daily contribution feed
  instead of caller-supplied data, (b) a quest-board widget UI that renders
  `buildDailyQuestBoard`/`buildQuestBoardSummaryText`, (c) a streak/reward
  layer on top of quest completion once the "Gamified Quests" idea's own
  first slice exists.
  PR: [#84](https://github.com/debate/debate-ai.com/pull/84).

- **LLM Card Scoring — deterministic heuristic scoring slice.**
  `packages/debate-card-search/src/lib/llm-card-scoring.ts` adds
  `scoreRelevance` (keyword/phrase overlap against a card's argument
  block), `scoreClarity` (average-sentence-length balance), `scoreUniqueness`
  (Jaccard token similarity against the rest of the corpus), `scoreEvidenceQuality`
  (a direct alias of the existing idea #11 `community-rating.ts`
  `scoreQualitySignal`), `scoreUsability` (word-count target band),
  `computeCardScoreBreakdown` (blends all five into a weighted overall
  score and flags likely duplicates), `rankCardScores`, and
  `buildCardScoreSummaryText`. Reuses `scoreQualitySignal` directly rather
  than introducing a separate quality-scoring path. Vitest-covered in
  `packages/debate-card-search/test/llm-card-scoring.test.ts`. See the "LLM
  Card Scoring" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it's a deterministic heuristic
  stand-in for an eventual LLM call, not the LLM call itself; it doesn't
  call any model, persist scores, or render a scoring UI. Follow-ups: (a)
  an actual LLM-scoring call for the more subjective dimensions (clarity,
  usability) that a heuristic can only roughly proxy, (b) wiring real
  argument-block keywords and a real submitted-card corpus into the
  scorer instead of caller-supplied data, (c) a scoring/duplicate-flag
  panel UI in `debate-card-search` that renders `rankCardScores` and
  surfaces `isLikelyDuplicate` cards for moderator review.

- **Research Progress Tracking — per-contributor topic/task/contribution progress slice.**
  `packages/debate-card-search/src/lib/research-progress.ts` adds
  `buildContributorProgress` (combines a contributor's existing
  `contribution-leaderboard.ts` `ContributorStats` with per-topic task
  completion derived from a caller-supplied, topic-tagged
  `research-task-routing.ts` `RoutedAssignment` list), `buildTopicProgress`
  (assigned/completed counts and a completion rate for one topic),
  `groupAssignmentsByContributor`, `buildResearchProgressBoard` (a full,
  roster-sorted board across every contributor found in either the
  contribution or assignment lists), and `buildProgressSummaryText`. Reuses
  the existing `ContributorStats`/`RoutedAssignment` types directly rather
  than introducing a separate scoring or assignment path. Vitest-covered in
  `packages/debate-card-search/test/research-progress.test.ts`. See the
  "Research Progress Tracking" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off
  caller-supplied contributions and a caller-supplied, topic-tagged
  assignment list with a caller-supplied completion timestamp; it doesn't
  track task completion itself (no task system exists in this repo today),
  persist a contributor's progress, or render a progress-tracking UI.
  Follow-ups: (a) wiring real `completedAt` events into a persisted
  assignment/completion history, (b) a progress dashboard/roster UI that
  renders `buildResearchProgressBoard`/`buildProgressSummaryText`, (c)
  feeding a contributor's actual topic-progress history back into
  `progress-unlocks.ts`'s tier computation instead of raw leaderboard stats
  alone.

- **Progress Unlocks — contributor tier/skill/badge scoring slice.**
  `packages/debate-card-search/src/lib/progress-unlocks.ts` adds
  `computeContributorTier` (maps the existing `contribution-leaderboard.ts`
  `ContributorStats` — contribution count and total helpfulness score — to
  an unlock tier: `novice` → `apprentice` → `veteran` → `expert`, gated on
  clearing both a volume and a quality threshold per tier),
  `getUnlockedSkillLevel` (maps a tier to the `research-task-routing.ts`
  `SkillLevel` it grants for taking on routed research tasks — `novice`
  through `veteran` unlock `novice`/`intermediate`, `expert` unlocks
  `advanced`), `getUnlockedBadges` (every badge earned on the way to a
  tier, cumulative), and `buildContributorUnlockStatus`/
  `buildUnlockStatusText` (combine tier, unlocked skill level, badges, and
  progress toward the next tier into a renderable status). Reuses the
  existing `ContributorStats`/`SkillLevel` types directly rather than
  introducing a separate scoring or skill-tagging path. Vitest-covered in
  `packages/debate-card-search/test/progress-unlocks.test.ts`. See the
  "Progress Unlocks" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it works entirely off a
  caller-supplied `ContributorStats`; it doesn't persist a contributor's
  tier/badges, gate any actual UI or task list, or feed the derived
  `SkillLevel` into `research-task-routing.ts`'s `ContributorAvailability`
  itself. Follow-ups: (a) persisting a contributor's tier/badges, (b) a
  progress/unlock UI that renders `buildUnlockStatusText`/
  `buildContributorUnlockStatus`, (c) feeding `getUnlockedSkillLevel` into
  `research-task-routing.ts`'s `ContributorAvailability.skillLevel` instead
  of a caller-supplied value.
  PR: [#80](https://github.com/debate/debate-ai.com/pull/80).
- **Revision Incentives — card-revision reward scoring slice.**
  `packages/debate-card-search/src/lib/revision-incentives.ts` adds
  `evaluateRevision` (scores a before/after card snapshot pair — reusing the
  existing idea #11 `community-rating.ts` `scoreQualitySignal` to measure
  quality gain, doubling the quality-point reward when the card was weak
  beforehand, plus flat bonuses for a meaningful citation-completeness gain
  or citing newer evidence than the prior snapshot), `groupRevisionsByContributor`,
  `buildContributorRevisionStats` (per-contributor revision count, rewarded
  count, total reward points, and weak-cards-improved count), `buildRevisionIncentiveLeaderboard`
  (ranks contributors by total reward points, tie-broken by `contributorId`),
  and `buildRevisionRewardText` (renders a one-line reward notification, or a
  no-reward line when nothing meaningful improved). Reuses the existing idea
  #11 quality scoring directly rather than introducing a separate quality
  metric. Vitest-covered in
  `packages/debate-card-search/test/revision-incentives.test.ts`. See the
  "Revision Incentives" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off
  caller-supplied before/after card snapshots; it doesn't track card
  revision history itself (no such history exists in this repo today),
  persist reward points, or render an incentives UI. Follow-ups: (a) wiring
  actual card-edit events into a persisted `CardRevision` history, (b) a
  reward-notification/incentives-leaderboard UI in `debate-card-search`
  that renders `buildRevisionRewardText`/`buildRevisionIncentiveLeaderboard`,
  (c) an actual "outdated evidence" staleness signal (e.g. flagging cards
  whose `evidenceYear` has fallen behind a topic's current cycle) instead of
  only rewarding a refresh after the fact.
  PR: [#79](https://github.com/debate/debate-ai.com/pull/79).
- **Research Task Routing — coverage-gap-to-contributor routing slice.**
  `packages/debate-card-search/src/lib/research-task-routing.ts` adds
  `buildTaskQueue` (turns a topic-coverage report's under-covered arguments
  — via the existing `topic-coverage.ts` `getUnderCoveredArguments` — into a
  queue of research tasks, most urgent first, each tagged with a required
  skill level: `missing` arguments need at least `intermediate` skill to
  build coverage from scratch, `thin` arguments are open to any skill
  level), `routeTasks` (assigns the queue to caller-supplied contributors,
  gating each task by required skill and remaining capacity, and routing to
  whichever eligible contributor currently has the fewest active tasks —
  updated as assignments happen within the same call — tie-broken by
  `contributorId`, leaving a task in `unassignedTasks` rather than dropping
  it when nobody qualifies or has capacity), `buildRoutingResult` (a
  build-then-route convenience wrapper), and `buildRoutingSummaryText`
  (renders one line per assignment plus an unassigned-count line for a
  task-assignment view). Reuses the existing "Topic Coverage Dashboard"
  slice directly rather than introducing a separate gap-detection path.
  Vitest-covered in
  `packages/debate-card-search/test/research-task-routing.test.ts`. See the
  "Research Task Routing" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off a
  caller-supplied `TopicCoverageReport` and a caller-supplied contributor
  list; it doesn't track contributors' skill levels or active task counts
  itself (neither exists in this repo today), and it isn't wired into any
  task-assignment UI yet. Follow-ups: (a) a persisted contributor profile
  (skill level, active task count) and a persisted task queue, neither of
  which exist in this repo today, (b) a task-assignment/inbox UI in
  `debate-card-search` that renders `buildRoutingSummaryText`/assignments
  and lets a contributor accept or complete a routed task, (c) an
  actual-skill-level signal (e.g. derived from the `Contribution
  Leaderboard`/`community-rating.ts` history) instead of a caller-supplied
  `skillLevel`.
  PR: [#78](https://github.com/debate/debate-ai.com/pull/78).
- **Top Contributor Awards — per-category award selection slice.**
  `packages/debate-card-search/src/lib/contributor-awards.ts` adds
  `groupContributionsByKind` (groups caller-supplied, contributor-attributed
  contributions by their `ContributionKind`), `buildCategoryLeaderboard` (a
  thin wrapper over the existing `contribution-leaderboard.ts`
  `buildLeaderboard` for one kind's contributions), `buildTopContributorAwards`
  (selects one category winner per `ContributionKind` present in the input —
  the contributor with the highest total helpfulness score for that kind,
  tie-broken by `contributorId` — in a stable `card`/`summary`/`highlight`/
  `annotation` order, omitting kinds with no contributions), and
  `buildAwardsAnnouncementText` (renders one human-readable announcement
  line per award for a banner or notification). Reuses the existing idea
  #11 `community-rating.ts` helpfulness scoring via `contribution-leaderboard.ts`
  rather than introducing a separate scoring path. Vitest-covered in
  `packages/debate-card-search/test/contributor-awards.test.ts`. See the
  "Top Contributor Awards" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — the only award categories
  it can produce today are the ones `ContributionKind` already distinguishes
  ("card" → Best Evidence Finder, "summary" → Best Explainer, plus
  "highlight" and "annotation"); it doesn't have a distinct kind for
  "original argument" or "refutation" contributions (neither exists in this
  repo today), and it doesn't persist, schedule, or render an awards
  announcement. Follow-ups: (a) a finer-grained `ContributionKind` (or
  separate tag) for "original argument"/"refutation" contributions, (b) a
  scheduled job that periodically calls `buildTopContributorAwards` and
  persists/announces the winners, (c) an awards UI in `debate-card-search`
  that renders `buildAwardsAnnouncementText`.
  PR: [#77](https://github.com/debate/debate-ai.com/pull/77).
- **Topic Coverage Dashboard — per-argument coverage aggregation slice.**
  `packages/debate-card-search/src/lib/topic-coverage.ts` adds
  `groupCardsByArgument` (groups caller-supplied cards by their `argBlock`),
  `computeArgumentCoverage` (classifies one argument block as `missing`
  (zero cards), `thin` (below configurable card-count/word-count
  thresholds), or `covered`), `buildTopicCoverageReport` (builds coverage
  for every argument in a caller-supplied tracked list — even ones with
  zero submitted cards — plus a separate `untracked` list for any argument
  block cards were filed under that isn't on the tracked list, so an
  unplanned-but-covered argument or a typo'd block name isn't silently
  dropped), `getUnderCoveredArguments` (the tracked arguments still needing
  work, worst-covered first), and `buildTopicCoverageSummaryText` (a short
  dashboard-header summary line). Vitest-covered in
  `packages/debate-card-search/test/topic-coverage.test.ts`. See the "Topic
  Coverage Dashboard" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off a
  caller-supplied card list and a caller-supplied tracked-argument list; it
  doesn't read real submitted cards or a topic's argument checklist from
  anywhere (neither exists in this repo today), and it isn't wired into any
  dashboard UI yet. Follow-ups: (a) an `argBlock`/word-count field wired
  into wherever submitted cards are eventually persisted, (b) a
  team-editable tracked-argument checklist per topic (no topic/checklist
  schema exists in this repo today), (c) a coverage dashboard UI in
  `debate-card-search` that renders `buildTopicCoverageReport`/
  `getUnderCoveredArguments`. None of these are started.
  PR: [#76](https://github.com/debate/debate-ai.com/pull/76).
- **Daily Best Card Challenge — daily-winner selection slice.**
  `packages/debate-card-search/src/lib/daily-best-card.ts` adds
  `groupCardsByDay` (groups caller-supplied, timestamped card contributions
  by their UTC calendar day of submission), `pickBestCardOfDay` (scores a
  single day's cards via the existing `community-rating.ts`
  `computeHelpfulnessBreakdown` and returns the single highest-helpfulness
  card, tie-broken by id), `buildDailyBestCards` (batch-builds one winner
  per represented day, sorted ascending), `getBestCardForDay` (a
  caller-supplied-`now` convenience wrapper for "today's" winner, or `null`
  if nothing was submitted that day), and `buildDailyBestCardHighlight`
  (renders a short highlight line for a challenge banner/widget). A card's
  community "vote" reuses the existing likes/saves signal already scored by
  `computeHelpfulnessBreakdown` rather than introducing a separate voting
  mechanism. Vitest-covered in
  `packages/debate-card-search/test/daily-best-card.test.ts`. See the
  "Daily Best Card Challenge" bullet under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it works entirely off
  already-collected, caller-supplied contributions; it doesn't track
  submission timestamps itself, persist a day's winner, or render a
  challenge banner/widget UI. Follow-ups: (a) wiring a `submittedAt`
  timestamp into wherever card contributions are eventually persisted, (b)
  a scheduled job or view that calls `getBestCardForDay`/`buildDailyBestCards`
  and persists/announces the day's winner, (c) a challenge banner/widget UI
  in `debate-card-search` that renders `buildDailyBestCardHighlight`. None
  of these are started.
  PR: [#74](https://github.com/debate/debate-ai.com/pull/74).
- **Peer Review System — card review lifecycle slice.**
  `packages/debate-card-search/src/lib/peer-review.ts` adds a `CardReview`
  state machine (`draft` → `in_review` → `changes_requested`/`approved`/
  `rejected` → `published`) plus a reviewer-comment thread on top of it:
  `createCardReview`, `submitForReview`, `requestChanges`, `approveReview`,
  `rejectReview`, and `publishReview` enforce only the documented legal
  transitions (throwing `InvalidReviewTransitionError` otherwise), while
  `addReviewComment` (auto-moves an in-review card to `changes_requested`
  when a `blocking`-severity comment is posted), `resolveReviewComment`,
  `getUnresolvedBlockingComments`, and `isReadyToPublish` model the
  comment thread — `approveReview` throws `UnresolvedBlockingCommentsError`
  if any blocking comment is still unresolved, so approval can't skip past
  requested changes. `buildReviewSummary` renders a short status/comment-count
  string for a review-queue or card-detail panel. Vitest-covered in
  `packages/debate-card-search/test/peer-review.test.ts`. See the "Peer
  Review System" bullet under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it's pure state-transition logic
  over a caller-supplied `CardReview`; nothing in this repo persists a
  review, notifies reviewers, or renders a review-queue/comment-thread UI
  yet. Follow-ups: (a) wiring `CardReview`/`ReviewComment` into wherever
  submitted cards are eventually persisted, (b) a review-queue and
  comment-thread UI in `debate-card-search` that calls
  `submitForReview`/`addReviewComment`/`approveReview`/etc., (c) reviewer
  identity/permission checks (e.g. only assigned reviewers can approve)
  once an auth/roles system exists.
  PR: [#73](https://github.com/debate/debate-ai.com/pull/73).
- **Contribution Leaderboard — per-contributor ranking slice.**
  `packages/debate-card-search/src/lib/contribution-leaderboard.ts` adds
  `groupContributionsByContributor` (groups a flat list of
  contributor-attributed contributions by `contributorId`, preserving
  order), `buildContributorStats` (aggregates one contributor's scored
  contributions into a contribution count, total/average helpfulness
  score, their single best contribution, and a count of their
  popularity-only-outlier contributions), and `buildLeaderboard` (groups,
  scores, and ranks every contributor by total helpfulness score
  descending — so a contributor with several well-received contributions
  outranks a single viral hit — tie-broken by `contributorId`). This
  builds directly on the existing idea #11 `community-rating.ts`
  helpfulness-scoring slice (`computeHelpfulnessBreakdown`) rather than
  duplicating its scoring logic. Vitest-covered in
  `packages/debate-card-search/test/contribution-leaderboard.test.ts`. See
  the "Contribution Leaderboard" bullet under Research Crowdsourcing
  Organizer Features below. This is the first slice only — it aggregates
  whatever contributor-attributed contributions the caller passes in; it
  doesn't track "most completed tasks" (no task system exists in this
  repo today), persist standings, or render a leaderboard UI. Follow-ups:
  (a) a `contributorId` field and query wired into wherever
  `CommunityContribution`s are eventually persisted, (b) a "completed
  tasks" signal once a research-task system (see the "Research Task
  Routing"/"Daily Quests and Targets" ideas below) exists to feed it, (c)
  a leaderboard UI in `debate-card-search` that renders `buildLeaderboard`.
  PR: [#72](https://github.com/debate/debate-ai.com/pull/72).
- **Pre-Round Intelligence Panel — briefing composition slice.**
  `packages/debate-round/src/round/pre-round-briefing.ts` adds
  `buildPreRoundBriefing` (combines an already-built `OpponentTeamProfile`
  scouting summary, a `JudgeProfile` tendency summary, a head-to-head
  prior-meetings record derived from caller-supplied `OpponentRoundRecord`s,
  and free-text team prep notes into one structured briefing with a
  labeled section per signal — each missing piece renders an explicit "no
  data on file" line rather than being silently omitted),
  `summarizePriorMeetings` (tallies wins/losses from a head-to-head record
  list), and `buildPreRoundBriefingText` (renders the structured briefing
  as a single markdown-ish document). This reuses the existing
  `buildOpponentScoutingSummary` (`debate-data-sync`) and
  `buildJudgeTendencySummary` (`debate-speech-writer`) slices directly, so
  `debate-round` now depends on both packages. Vitest-covered in
  `packages/debate-round/test/pre-round-briefing.test.ts`. See idea #12
  below. This is the first slice only — it doesn't fetch live tournament
  results, prior pairings, event details, or room assignments from any
  real data source (none exist in this repo today; the caller supplies
  whichever profiles/records/notes they already have), and it isn't wired
  into any round-information page UI yet. Follow-ups: (a) real data
  sources for tournament results, pairings, event details, and room
  assignments to populate `RoundEventInfo` and the head-to-head record
  list automatically instead of relying entirely on caller-supplied data,
  (b) a briefing panel UI in `debate-round` that renders
  `buildPreRoundBriefing`/`buildPreRoundBriefingText` on a round-information
  page, (c) persisting a generated briefing (or its inputs) per round.
  PR: TBD.
- **Opponent Team Profiles — scouting-profile aggregation slice.**
  `packages/debate-data-sync/src/rankings/opponent-team-profile.ts` adds
  `buildOpponentTeamProfile` (aggregates an opposing team's caller-supplied
  round history — `OpponentRoundRecord`s — into an overall win/loss record,
  a per-side win/loss split with a `hasNotableSidePreference` flag once
  there's enough of a sample on both sides, and frequency-ranked
  `topArgumentTags`/`topCases` reflecting the arguments and case names they
  run most often), `groupRecordsByTeam` / `buildOpponentTeamProfiles`
  (batch-build profiles for every team in a flat record list),
  `getHeadToHeadRecords` (filters a record list down to rounds recorded
  specifically against a given opponent, for head-to-head lookups), and
  `buildOpponentScoutingSummary` (renders a profile as short bullet lines
  for a pre-round scouting card, explicitly reporting "unknown" rather than
  fabricating a value when tags/cases were never tracked). Vitest-covered
  in `packages/debate-data-sync/test/opponent-team-profile.test.ts`. See
  the "Opponent Team Profiles" item under Research Crowdsourcing Organizer
  Features below. This is the first slice only — it's pure aggregation
  logic over caller-supplied round records; no scraper in this repo
  reconstructs real head-to-head/round history from Tabroom or tab-service
  ballots, and it isn't wired into any scouting-card or pre-round-briefing
  UI yet. Follow-ups: (a) a real round-history data source (e.g.
  reconstructed from Tabroom pairings/ballots) that produces
  `OpponentRoundRecord`s instead of relying entirely on caller-supplied
  data, (b) a scouting-card/panel UI that renders
  `buildOpponentScoutingSummary`, (c) persisting/looking up profiles by
  team across tournaments rather than recomputing from a full history each
  time.
  PR: TBD.
- **Judge Profiles — tendency-profile aggregation slice.**
  `packages/debate-speech-writer/src/judge/judge-profile.ts` adds
  `buildJudgeProfile` (aggregates a judge's caller-supplied ballot history —
  `JudgeRoundRecord`s — into side-vote win rates with a `hasNotableSideBias`
  flag once there's enough of a sample, average speaker points awarded per
  side, a rough `classifySpeedTolerance` pace-based delivery-speed estimate,
  a `classifyTheoryReceptiveness` theory-argument win-rate estimate, and the
  judge-paradigms.ts paradigm they were most often tagged with),
  `groupRecordsByJudge` / `buildJudgeProfiles` (batch-build profiles for
  every judge in a flat record list), and `buildJudgeTendencySummary`
  (renders a profile as short bullet lines for a pre-round briefing or
  profile card, explicitly reporting "unknown" rather than fabricating a
  value when a signal was never tracked). Vitest-covered in
  `packages/debate-speech-writer/test/judge-profile.test.ts`. See the
  "Judge Profiles" item under Research Crowdsourcing Organizer Features
  below. This is the first slice only — it's pure aggregation logic over
  caller-supplied ballot records; no `Round`/ballot schema in this repo
  captures speaker points, delivery pace, or theory outcomes today, so it
  doesn't read or persist real ballot data, and it isn't wired into any
  judge-profile or pre-round-briefing UI yet. Follow-ups: (a) a real ballot
  data source (e.g. reconstructed from Tabroom ballots) that produces
  `JudgeRoundRecord`s instead of relying entirely on caller-supplied data,
  (b) a judge-profile card/panel UI that renders `buildJudgeTendencySummary`,
  (c) persisting/looking up profiles by judge across tournaments rather than
  recomputing from a full history each time.
  PR: [#69](https://github.com/debate/debate-ai.com/pull/69).
- **Online Debate Versus AI — turn-order and speech-validation slice.**
  `packages/debate-round/src/round/ai-versus-speech-order.ts` adds
  `buildAiVersusSpeechOrder` (flattens a `debate-timer` format's
  `timerSpeeches` into an ordered turn list tagged `speaker: "user" | "ai"`
  from the user's chosen `primary`/`secondary` side), `getNextSpeechSlot` /
  `isUsersTurn` (whose turn is next given how many speeches have already
  been submitted), `validateSpeechSubmission` (checks a submitted speech
  name against the next expected slot, rejecting it when the round is
  already complete, it's the AI's turn, or the name doesn't match), and
  `buildAiResponseRequest` (a structured, non-AI-calling request object —
  the next AI slot, prior speeches to condition on, and whether it's a
  cross-examination turn — for a future prompt-builder to consume).
  Vitest-covered in
  `packages/debate-round/test/ai-versus-speech-order.test.ts`. See idea #3
  below. This is the first slice only — it's pure turn-order/state logic
  over the existing `debateStyles` format registry; it doesn't call any AI
  model, accept text/audio speech submissions, or persist round state, and
  it isn't wired into any online-versus-AI round UI yet; see follow-ups
  noted under idea #3.
  PR: TBD.
- **CX NDCA Standings — qualification points and standings computation slice.**
  `packages/debate-data-sync/src/rankings/ndca-standings.ts` adds
  `computeTournamentPoints` (scores a single tournament result from its
  outround finish, prelim-win record, and a bid-level bonus, against a
  configurable `QualificationPointsTable`), `buildTeamStanding` /
  `buildStandings` (aggregate a team's — or every team's — tournament
  results into a cumulative standing: total qualification points from its
  best N tournaments if capped, overall prelim record and best finish
  across every tournament attended), `rankStandings` (sorts standings by
  total points, tie-broken by team id), and `getQualifiedTeams` (filters
  ranked standings by a minimum-points threshold and/or a qualifier cap).
  The exported `DEFAULT_QUALIFICATION_POINTS_TABLE` is explicitly an
  illustrative default, not the real NDCA point table (which varies by
  circuit/season and isn't public data this repo has) — callers who need
  accurate qualification points should supply their own table.
  Vitest-covered in
  `packages/debate-data-sync/test/ndca-standings.test.ts`. See idea #1
  below. This is the first slice only — it's pure aggregation/ranking logic
  over caller-supplied `TournamentResult` records; it doesn't scrape or
  parse real Tabroom/NDCA results into that shape (the existing
  `sync-tournaments.ts` only fetches tournament *names*, not per-team
  results), and it isn't wired into any standings dashboard UI yet; see
  follow-ups noted under idea #1.
  PR: TBD.
- **Community-Rated Summaries and Highlights — helpfulness scoring and ranking slice.**
  `packages/debate-card-search/src/lib/community-rating.ts` adds
  `scorePopularitySignal` (logarithmically dampens raw likes/saves so votes
  alone can't dominate), `scoreQualitySignal` (averages popularity-independent
  quality signals), `scoreReviewerSignal` (dampens summed reviewer-credibility
  weight the same way), `computeHelpfulnessBreakdown` (blends the three into
  a 0-100 `helpfulnessScore` under a default 30/40/30 popularity/quality/reviewer
  weighting, and flags a heavily-voted-but-substance-poor contribution as an
  `isPopularityOnlyOutlier`), and `rankContributions` (sorts a contribution
  list by that blended score, tie-broken by id). Vitest-covered in
  `packages/debate-card-search/test/community-rating.test.ts`. See idea #11
  below. This is the first slice only — it scores whatever like/save/quality/
  endorsement counts the caller passes in; it doesn't track those signals
  itself (no like/save/endorse actions, no persistence), compute per-reviewer
  credibility, or render a leaderboard/moderation UI; see follow-ups noted
  under idea #11.
  PR: TBD.
- **AI Response-Outcome Charts — flow-derived vulnerability scoring slice.**
  `packages/debate-round/src/flow/response-outcome.ts` adds
  `scoreArgumentVulnerability` (a deterministic 0-100 heuristic over an
  already-flowed argument thread — unanswered arguments score highest,
  repeated direct opposing responses raise it further, same-side
  extensions/defense lower it), `getArgumentVulnerabilityReport` (every
  argument row scored and sorted by vulnerability), `summarizeOutcomeBySide`
  (rolls the report up per side into argument/unanswered counts and an
  average vulnerability), and `buildVulnerabilityChartData` (top-N
  label/value points ready for a bar chart). Vitest-covered in
  `packages/debate-round/test/response-outcome.test.ts`. See idea #4 below.
  This is the first slice only — it's a deterministic heuristic over the
  flow's existing clash signals, not an actual AI panel evaluating response
  paths or estimating win probabilities, and it isn't wired into any
  chart/panel UI yet; see follow-ups noted under idea #4.
  PR: TBD.
- **Legacy Verbatim / Cardmirror Compatibility — condense/cite/reorder logic slice.**
  `packages/debate-card-parser/src/utils/verbatim-shortcuts.ts` adds
  `condenseCardHtml` (collapses a card's HTML down to its underlined "read"
  runs, preserving nested `<mark>` emphasis and joining non-adjacent runs
  with an ellipsis, mirroring Verbatim's condense command), `formatShortCiteTag`
  (builds a Verbatim-style short cite tag like `"Smith 24"` or `"Smith ND"`
  from a card's author/year), and `moveOutlineNode` (swaps an outline node
  with its previous/next sibling, backing a heading/card reorder shortcut).
  Vitest-covered in
  `packages/debate-card-parser/test/verbatim-shortcuts.test.ts`. See idea #14
  below. This is the first slice only — it covers 3 of the 5 shortcuts idea
  #14 describes (condensing cards, formatting citations, moving headings);
  "sending selected evidence to a speech document" and "emphasizing text"
  are not implemented since they need editor-selection/document-target state
  that doesn't exist yet. None of these functions are wired to an actual
  keyboard-shortcut handler or UI; see follow-ups noted under idea #14.
  PR: [#64](https://github.com/debate/debate-ai.com/pull/64).
- **Outline Filters and Argument Tree View — heading-grouped argument tree slice.**
  `packages/debate-round/src/flow/argument-tree.ts` adds `buildArgumentTree`
  (groups a flow's rows into a tree keyed by its `isHeading` rows, nesting
  each argument under the most recent heading above it),
  `filterArgumentTree` (filters by speech, by a `sideKey` derived from each
  argument's origin speech via `getSpeechSideKey`, by unanswered/dropped
  status, and by heading-vs-argument `kind` — including a pure `kind:
  "heading"` outline view), `flattenArgumentTree`, and `getFlowSideKeys`.
  Vitest-covered in `packages/debate-round/test/argument-tree.test.ts`. See
  idea #10 below. This is the first slice only — it doesn't distinguish
  finer argument types (link, impact, turn, answer, extension) or track
  contributor/evidence-status, since neither exists in the flow schema
  today, and it isn't wired into any tree/outline UI yet; see follow-ups
  noted under idea #10.
  PR: [#63](https://github.com/debate/debate-ai.com/pull/63).
- **Speech Transcript Summaries and Answers — flow-derived unanswered-argument slice.**
  `packages/debate-round/src/flow/flow-transcript-summary.ts` adds
  `summarizeFlowRow`, `getFlowRowSummaries`, `getUnansweredFlowRows`,
  `buildFlowSummaryText`, `suggestCrossExamQuestions`, and
  `suggestExtensionIdeas` so a viewer can turn an already-flowed `Flow` (the
  existing `Box`/column grid) into a concise per-argument summary, flag
  which arguments currently stand unanswered as of the flow's latest
  state, and get template cross-examination questions and extension ideas
  built from those drops. Vitest-covered in
  `packages/debate-round/test/flow-transcript-summary.test.ts`. See idea #6
  below. This is the first slice only — it doesn't transcribe audio or use
  an AI model to extract claims/warrants/impacts from raw speech text (it
  works off the flow grid a debater has already flowed), and it isn't wired
  into any summary/cross-ex UI yet; see follow-ups noted under idea #6.
  PR: TBD.
- **Flow-in-Speech Flow Annotations — timestamped annotation data model slice.**
  `packages/debate-round/src/flow/flow-annotations.ts` adds a `FlowAnnotation`
  type plus `createFlowAnnotation`, `sortAnnotationsByTimestamp`,
  `getAnnotationsForSpeech`, `getAnnotationsForBox`,
  `findAnnotationAtPlaybackPosition`, and `resolveAnnotationBox` so a viewer
  scrubbing a streamed/recorded speech can drop a timestamped note on a
  specific flow `Box` (addressed via the existing `boxFromPath` path
  convention) and later jump straight back to it. Vitest-covered in
  `packages/debate-round/test/flow-annotations.test.ts`. See idea #15 below.
  This is the first slice only — it is not wired into the video player
  (`debate-videos`) or the `FlowSpreadsheet`/flow grid UI, and annotations
  aren't persisted anywhere yet; see follow-ups noted under idea #15.
  PR: [#61](https://github.com/debate/debate-ai.com/pull/61).
- **AI Judge Decision Modes — judge-paradigm registry slice.**
  `packages/debate-speech-writer/src/judge/judge-paradigms.ts` adds a registry
  of configurable judge personas (flow, lay, policymaker, critic, educator,
  truth-tester) plus `buildJudgeParadigmPrompt` (composes a paradigm-specific
  prompt section) and `buildCustomJudgeParadigm` (builds a "custom" paradigm
  from a real judge's own publicly stated preferences). Vitest-covered in
  `packages/debate-speech-writer/test/judge-paradigms.test.ts`. See idea #5
  below. This is the first slice only — it is not wired into the existing
  `judgeDecisionPrompt` AI call or into any paradigm-picker UI; see
  follow-ups noted under idea #5.
  PR: [#60](https://github.com/debate/debate-ai.com/pull/60).
- **Expandable Heading Structure — outline/collapse logic slice.**
  `packages/reason-editor/src/engine/outline/heading-outline.ts` adds
  `buildHeadingOutline`, `getVisibleHeadingIds`, `getCollapsedRanges`, and
  `isPositionCollapsed` so a nav panel or editor view can implement
  collapsible H1-H4 sections (pocket/hat/block/tag+analytic) over the
  existing flat heading schema, without any schema change. Vitest-covered
  in `packages/reason-editor/test/heading-outline.test.ts`. See idea #9
  below. This is the first slice only — it is not wired into any React
  nav panel/outline UI yet (no such component exists in `reason-editor`
  today); see follow-ups noted under idea #9.
  PR: [#58](https://github.com/debate/debate-ai.com/pull/58).
- **Word-Count-Only Speech Format — pure logic slice.** `packages/debate-timer/src/formats/word-count-format.ts`
  adds `countWords`, `getWordCountStatus`, `estimateWordLimit`, and a `wordCountStyles` registry
  (mirrors Public Forum's speech order with word limits instead of timers). Vitest-covered in
  `packages/debate-timer/test/word-count-format.test.ts`. See idea #2 below. This is the first
  slice only — it is not wired into `SpeechTimer`/`debate-round`'s timer state (built around
  elapsed milliseconds) or exposed in any submission UI; see follow-ups noted under idea #2.
  PR: [#57](https://github.com/debate/debate-ai.com/pull/57).

## Product Feature Ideas

1. **CX NDCA Standings** — Add a standings dashboard modeled around NDCA-style results, allowing users to browse qualification points, rankings, cumulative records, and tournament performance history across the season. Tabroom already supports tournament results and NDCA-points configuration, so this could expose those data in a more searchable, user-friendly analytics view. [tabroom](https://www.tabroom.com/index/tourn/index.mhtml?tourn_id=26597) _Status: first slice done (see Tracker Status above) — `debate-data-sync` now has `computeTournamentPoints`/`buildTeamStanding`/`buildStandings`/`rankStandings`/`getQualifiedTeams` for turning per-team tournament results into ranked, cumulative season standings against a configurable (not authoritative) points table. Follow-ups: (a) a Tabroom/NDCA scraper that produces real `TournamentResult` records per team (today's `sync-tournaments.ts` only fetches tournament names), (b) a real, circuit-sourced `QualificationPointsTable` instead of the illustrative default, (c) a standings dashboard UI (likely under `/rank`) that renders `rankStandings`/`getQualifiedTeams`. None of these are started._

2. **Word-Count-Only Speech Format** — Support a practice and online-debate format where speeches are constrained by a maximum word count rather than a time limit, helping students practice concise writing, efficient argument construction, and comparable asynchronous submissions. _Status: first slice done (see Tracker Status above) — `debate-timer` now has word-count/limit-status utilities and a `wordCountStyles` registry. Follow-ups: (a) a submission UI in `debate-round`/`reason-editor` that calls `getWordCountStatus` while a debater types, (b) extending `useTimerState`/`SpeechTimer` to support a non-timed, word-limited speech mode, (c) persisting word-count-mode round results alongside timed rounds. None of these are started._

3. **Online Debate Versus AI** — Allow a debater or team to enter an online practice debate against an AI opponent, select the debate format and side, submit speeches in text or audio, and receive structured responses that follow the expected speech order. _Status: first slice done (see Tracker Status above) — `debate-round` now has `buildAiVersusSpeechOrder`/`getNextSpeechSlot`/`isUsersTurn`/`validateSpeechSubmission`/`buildAiResponseRequest` for turning a `debate-timer` format + chosen side into an ordered, speaker-tagged turn sequence, validating a submitted speech against whose turn it is, and building a structured (non-AI-calling) request describing the AI's next speech. Follow-ups: (a) an actual AI speech-generation call that consumes `buildAiResponseRequest`'s output (prior speeches + slot + cross-ex flag) to produce the AI's next speech text, (b) a round-setup + submission UI in `debate-round` that lets a user pick a format/side, type or record a speech, and calls `validateSpeechSubmission`, (c) persisting an online-versus-AI round's submitted speeches. None of these are started._

4. **AI Response-Outcome Charts** — Use a panel of specialized models or “AI counsel” roles to evaluate likely response paths, map which arguments are most vulnerable, estimate where clash will occur, and visualize how different strategic choices may change likely round outcomes. _Status: first slice done (see Tracker Status above) — `debate-round` now has `scoreArgumentVulnerability`/`getArgumentVulnerabilityReport`/`summarizeOutcomeBySide`/`buildVulnerabilityChartData` for deriving a per-argument exposure score and chart-ready datasets directly from an already-flowed grid's existing clash signals (unanswered status, opposing responses, same-side extensions). Follow-ups: (a) an actual AI-panel call (multiple "counsel" model roles) that evaluates likely response paths and clash points beyond this deterministic heuristic, (b) a chart/panel UI in `debate-round` that renders `buildVulnerabilityChartData`/`summarizeOutcomeBySide`, (c) a "what if" mode that recomputes the score against a hypothetical strategic choice rather than only the flow's current state. None of these are started._

5. **AI Judge Decision Modes** — Provide configurable AI judge personas that evaluate a completed practice round through different paradigms, such as flow judge, lay judge, policymaker, critic, educator, truth tester, or a user-created paradigm based on a real judge’s publicly provided preferences. _Status: first slices done (see Tracker Status above) — `debate-speech-writer` now has a `judgeParadigms` registry, `buildJudgeParadigmPrompt`, and `buildCustomJudgeParadigm`. A second slice, `judgeParadigmSelections.ts` (see Tracker Status above), now persists a round's selected `JudgeParadigm` to localStorage. Follow-ups: (a) an AI judge-decision call that uses `buildJudgeParadigmPrompt` output instead of (or alongside) the existing static `judgeDecisionPrompt`, (b) a paradigm-picker UI for selecting a built-in paradigm or entering a custom judge's notes that reads/writes through the persistence store. None of these are started._

6. **Speech Transcript Summaries and Answers** — Transcribe a speech, identify its claims, warrants, impacts, evidence, and unanswered arguments, then produce a concise flow-oriented summary along with possible responses, cross-examination questions, and extension ideas. _Status: first slice done (see Tracker Status above) — `debate-round` now has `getFlowRowSummaries`/`getUnansweredFlowRows`/`buildFlowSummaryText`/`suggestCrossExamQuestions`/`suggestExtensionIdeas` for deriving a per-argument summary and drop/answer status directly from an already-flowed grid. Follow-ups: (a) audio/video transcription plus an AI call to extract claims/warrants/impacts/evidence from raw speech text rather than relying on a manually flowed grid, (b) a summary/cross-ex panel UI in `debate-round` that renders `buildFlowSummaryText`/`suggestCrossExamQuestions`/`suggestExtensionIdeas` for the selected speech, (c) persisting generated summaries per round. None of these are started._

7. **On Page Card Reuse Search** — See if any one has cut this article in the chrome ext 

8. **Video-Lecture-Training Coach AI** — Let coaches upload practice-round recordings, lecture transcripts, camp materials, and approved instructional documents to create a private team coach AI that explains concepts and gives advice grounded in that team’s own teaching materials. _Status: first slices done (see Tracker Status above) — `debate-speech-writer` now has `buildCoachMaterialLibrary`/`findRelevantMaterials`/`buildGroundedCoachPrompt` for organizing a team's caller-supplied materials (lecture transcripts, camp materials, instructional documents, practice-round recordings) into a kind-grouped library, scoring each material's relevance to a question with a deterministic keyword-overlap heuristic, and composing a self-contained, grounded prompt from the most relevant materials, mirroring the existing `opponent-personas.ts`/`judge-paradigms.ts` structured-prompt convention. A second slice, `coachMaterials.ts` (see Tracker Status above), now persists `CoachMaterial` records to localStorage. Follow-ups: (a) transcription/parsing that turns an uploaded recording or document into a material's text, (b) an actual AI Q&A call that consumes `buildGroundedCoachPrompt`'s output, (c) a materials-upload/coach chat panel UI that reads/writes through the persistence store. None of these are started._

9. **Expandable Heading Structure** — Make research documents and outlines collapsible by heading level, allowing users to expand or collapse H1, H2, and H3 sections so they can move quickly between a high-level argument map and detailed evidence. _Status: first slice done (see Tracker Status above) — `reason-editor`'s engine now has `buildHeadingOutline`/`getVisibleHeadingIds`/`getCollapsedRanges`/`isPositionCollapsed` for deriving H1-H4 structure and collapse ranges from the existing flat heading schema. Follow-ups: (a) a React nav/outline panel in `reason-editor` that renders the outline and toggles collapsed ids, (b) a ProseMirror decoration plugin that hides collapsed ranges in the actual editor view using `getCollapsedRanges`, (c) persisting collapsed-state per document. None of these are started._

10. **Outline Filters and Argument Tree View** — Provide a filterable outline and visual tree that shows the relationship between contentions, links, internal links, impacts, turns, answers, and extensions, with filters for side, speech, contributor, evidence status, and argument type. _Status: first slice done (see Tracker Status above) — `debate-round` now has `buildArgumentTree`/`filterArgumentTree`/`flattenArgumentTree`/`getFlowSideKeys` for deriving a heading-grouped argument tree from an already-flowed grid and filtering it by speech, side, unanswered status, and heading-vs-argument kind. Follow-ups: (a) a React tree/outline panel in `debate-round` that renders the filtered tree next to (or instead of) `FlowSpreadsheet`, (b) finer argument-type tagging (link/impact/turn/answer/extension) and contributor/evidence-status fields, none of which exist in the `Box`/`Flow` schema today, (c) persisting the user's chosen filter state per round. None of these are started._

11. **Community-Rated Summaries and Highlights** — Let users like, save, and endorse the most useful research summaries, analytic explanations, evidence highlights, and annotations, then rank contributions by helpfulness while guarding against popularity-only scoring through quality and reviewer-weight signals. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `scorePopularitySignal`/`scoreQualitySignal`/`scoreReviewerSignal`/`computeHelpfulnessBreakdown`/`rankContributions` for blending logarithmically-dampened popularity with quality and reviewer-credibility signals into a ranked, popularity-resistant helpfulness score. Follow-ups: (a) wiring up actual like/save/endorse actions and persisting those counts per contribution, (b) a real reviewer-credibility system instead of a caller-supplied weight per endorsement, (c) a leaderboard/ranked-feed UI in `debate-card-search` that renders `rankContributions` and surfaces `isPopularityOnlyOutlier` contributions for moderator review. None of these are started._

12. **Pre-Round Intelligence Panel** — On every round-information page, combine live tournament results, prior pairings, opponent records, judge paradigms, event details, room assignments, and relevant team prep notes into one focused pre-round briefing. _Status: first slice done (see Tracker Status above) — `debate-round` now has `buildPreRoundBriefing`/`summarizePriorMeetings`/`buildPreRoundBriefingText` for composing an opponent-scouting summary, a judge-tendency summary, a head-to-head prior-meetings record, and team prep notes into one structured, renderable briefing, reusing the existing `debate-data-sync`/`debate-speech-writer` profile slices. Follow-ups: (a) real data sources for tournament results, pairings, event details, and room assignments (none exist in this repo today), (b) a briefing panel UI that renders it on a round-information page, (c) persisting a generated briefing per round. None of these are started._

13. **Coaching Programs and Group Challenges** — Enable coaches to create group coaching spaces with assigned drills, research sprints, practice rounds, shared feedback, progress tracking, and friendly challenges such as completing a set of blocks or winning a rebuttal exercise. _Status: first slices done (see Tracker Status above) — the "friendly challenges" half has `debate-card-search`'s `group-challenges.ts` (`buildGroupChallengeBoard`), and the coaching-space model tying it together has `debate-round`'s `coaching-program.ts` (`buildCoachingProgramBoard`), composing that group-challenge board with the existing Team Collaboration Mode topic sprint and AI Drill Generator drill sets per roster member. Follow-ups: (a) persisting a coaching program's config and board inputs, (b) a coaching-space dashboard UI, (c) wiring a member's practice-round setup/feedback (Practice Round Simulator) into the space. None of these are started._

14. **Legacy Verbatim / Cardmirror Compatibility** — Offer optional keyboard shortcuts that mirror familiar Verbatim and paperless-debate workflows, including sending selected evidence to a speech document, formatting citations, condensing cards, emphasizing text, and moving headings. _Status: first slice done (see Tracker Status above) — `debate-card-parser` now has `condenseCardHtml`, `formatShortCiteTag`, and `moveOutlineNode` for condensing a card to its underlined "read" text, formatting a short cite tag, and reordering outline nodes. Follow-ups: (a) wiring these into actual keyboard-shortcut handlers in `reason-editor`'s toolbar/editor view, (b) a "send selected evidence to a speech document" command, which needs a speech-document target that doesn't exist yet, (c) a text-emphasize (toggle `<mark>`) command over an editor selection range. None of these are started._

15. **Flow-in-Speech Flow Annotations** — While viewing a streamed or recorded round, let users create timestamped flow entries for each speech and attach an entry directly to a particular argument or response bubble, making it easy to revisit exactly where an answer was made. _Status: first slice done (see Tracker Status above) — `debate-round` now has a `FlowAnnotation` data model and query helpers (`createFlowAnnotation`, `getAnnotationsForSpeech`, `getAnnotationsForBox`, `findAnnotationAtPlaybackPosition`, `resolveAnnotationBox`) for tying a playback timestamp to a specific flow box. A second slice, `flowAnnotations.ts` (see Tracker Status above), now persists `FlowAnnotation` records to localStorage. Follow-ups: (a) a video-player UI (`debate-videos`) that lets a viewer drop an annotation at the current playback position, persisted through `flowAnnotations.ts`, and jump back to one, (b) a flow-grid affordance (`FlowSpreadsheet`) that surfaces annotations on their box via `listFlowAnnotationsForBox` and links back to the timestamp. Neither of these are started._

16. **Shared, Ai-Generated Debate Flow** — Synchronize a live flow across a team or room so collaborators can follow the same argument map, while optionally preloading evidence cards with structured flow notes to reduce manual flowing. Existing debate-flow products show the feasibility of live transcription, argument tracking, shared notes, saved flows, and structured ballot assistance; this feature should keep humans in control of the actual flow and strategic interpretation. [github](https://github.com/saranchockan/DebateFlow) _Status: first slice done (see Tracker Status above) — `debate-round` now has `mergeFlowEdits`/`applyMergedEditsToFlow`/`buildSharedFlowSyncSummaryText` for reconciling multiple teammates' concurrent box-level flow edits into one canonical flow (last write wins), flagging genuinely concurrent, diverging edits from different authors as conflicts for a human to resolve instead of silently overwriting them. Follow-ups: (a) a live transport (WebSocket or similar) that turns local edits into a shared stream across a room/team, (b) a `FlowSpreadsheet` affordance that applies the merge and surfaces conflicts, (c) composing the Common Argument Library's tagged card corpus to suggest (not auto-apply) a pre-filled flow note from matching evidence. None of these are started._



## Research Crowdsourcing Organizer Features

* 🧩 Community Research Hub - A shared space where debaters contribute cards, evidence, and summaries to a common argument pool.
* 🏅 Contribution Leaderboard - Track who has submitted the most useful research, highest-rated cards, and most completed tasks. _Status: first slices done (see Tracker Status above) — `debate-card-search` now has `buildLeaderboard`/`buildContributorStats`/`groupContributionsByContributor` for aggregating contributor-attributed contributions (scored via the idea #11 `community-rating.ts` helpfulness scoring) into a ranked, per-contributor leaderboard. A second slice, `contributions.ts` (see Tracker Status above), now persists `AttributedContribution` records to localStorage. Follow-ups: (a) wiring real like/save/endorse actions and a real submitted-contribution flow into the persistence store, (b) a "completed tasks" signal once a research-task system exists, (c) a leaderboard UI that reads through the persistence store. None of these are started._
* 🎮 Gamified Quests - Turn research work into missions, challenges, and streaks that reward consistent contribution. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `computeDailyMissionResult`/`computeStreakStatus`/`getEarnedStreakBadges`/`buildContributorQuestStreak`/`buildStreakSummaryText` for turning a contributor's daily `daily-quests.ts` mission-completion history into a current/longest streak and the milestone badges (3/7/14/30-day streaks by default) that streak has earned. Follow-ups: (a) wiring real, persisted daily contributions into `computeDailyMissionResult` per contributor per day, (b) a streak/badge widget UI. A third follow-up, surfacing earned streak badges on a contributor's `progress-unlocks.ts` unlock status, is now done — see the "Unlock Status Streak Badges" entry above (`unlock-streak-status.ts`)._
* 🔓 Progress Unlocks - Unlock harder research tasks, advanced topics, and special badges as users contribute more. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `computeContributorTier`/`getUnlockedSkillLevel`/`getUnlockedBadges`/`buildContributorUnlockStatus`/`buildUnlockStatusText` for mapping a contributor's existing leaderboard stats to an unlock tier, the `research-task-routing.ts` skill level that tier grants, and the badges earned along the way, reusing the existing `ContributorStats`/`SkillLevel` types directly. A second slice, `tiered-task-routing.ts` (see Tracker Status above), now feeds the derived skill level into `research-task-routing.ts`'s `ContributorAvailability`. A third slice, `unlock-streak-status.ts` (see Tracker Status above, "Unlock Status Streak Badges"), now merges the Gamified Quests streak badges into this unlock status. Follow-ups: (a) persisting a contributor's tier/badges, (b) a progress/unlock UI. Neither of these are started._
* 🧠 LLM Card Scoring - Use an LLM to score cards for relevance, clarity, uniqueness, evidence quality, and usability. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `scoreRelevance`/`scoreClarity`/`scoreUniqueness`/`scoreEvidenceQuality`/`scoreUsability`/`computeCardScoreBreakdown`/`rankCardScores`/`buildCardScoreSummaryText` for scoring a card across all five dimensions with deterministic heuristics and flagging likely duplicates, reusing the existing idea #11 `community-rating.ts` quality-signal scoring for evidence quality. Follow-ups: (a) an actual LLM-scoring call for the more subjective dimensions instead of the heuristic proxy, (b) wiring real argument-block keywords and a real submitted-card corpus into the scorer, (c) a scoring/duplicate-flag panel UI. None of these are started._
* 📈 Research Progress Tracking - Show each debater’s progress across topics, task completion, and contribution history. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildContributorProgress`/`buildTopicProgress`/`buildResearchProgressBoard`/`buildProgressSummaryText` for combining a contributor's existing leaderboard contribution stats with per-topic task-completion counts derived from a topic-tagged research-task-routing assignment list, reusing the existing `ContributorStats`/`RoutedAssignment` types directly. Follow-ups: (a) wiring real task-completion events into a persisted assignment/completion history, (b) a progress dashboard/roster UI, (c) feeding a contributor's topic-progress history back into `progress-unlocks.ts`'s tier computation. None of these are started._
* 📚 Common Argument Library - Organize all shared research into topic folders, case areas, and tag-based collections. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `groupCardsByTopic`/`groupCardsByCaseArea`/`buildTopicFolder`/`buildTopicFolders`/`buildTagCollections`/`filterCardsByTags`/`buildArgumentLibrary`/`buildLibrarySummaryText` for organizing a caller-supplied, tagged card list into topic folders (each split into case-area subgroups) and cross-cutting tag-based collections, extending the existing Topic Coverage Dashboard's `argBlock`-tagged card model with `topic`/`caseArea`/`tags`. Follow-ups: (a) wiring a `topic`/`caseArea`/`tags` field into wherever submitted cards are eventually persisted, (b) a folder/collection browser UI, (c) a tag-autocomplete/tag-management affordance. None of these are started._
* 🕵️ Daily Best Card Challenge - Highlight the highest-scoring card of the day and let the community vote on it. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `groupCardsByDay`/`pickBestCardOfDay`/`buildDailyBestCards`/`getBestCardForDay`/`buildDailyBestCardHighlight` for grouping timestamped card contributions by UTC submission day and picking each day's single highest-helpfulness card, reusing the existing `community-rating.ts` helpfulness scoring (a card's likes/saves already model the community "vote"). Follow-ups: (a) wiring a `submittedAt` timestamp into wherever card contributions are eventually persisted, (b) a scheduled job or view that persists/announces the day's winner, (c) a challenge banner/widget UI. None of these are started._
* 🗣️ Peer Review System - Allow teammates to review, comment on, and refine submitted cards before they go live. _Status: first slices done (see Tracker Status above) — `debate-card-search` now has a `CardReview` status state machine (`createCardReview`/`submitForReview`/`requestChanges`/`approveReview`/`rejectReview`/`publishReview`) plus a blocking-aware comment thread (`addReviewComment`/`resolveReviewComment`/`getUnresolvedBlockingComments`/`isReadyToPublish`/`buildReviewSummary`) that blocks approval until every blocking comment is resolved. A second slice, `peerReviews.ts` (see Tracker Status above), now persists `CardReview` records (including their `ReviewComment` thread) to localStorage, keyed by `cardId`. Follow-ups: (a) a review-queue/comment-thread UI that reads/writes through this store, (b) reviewer identity/permission checks once auth/roles exist, (c) wiring a review's lifecycle to whatever eventually persists submitted cards, so `publishReview` can gate a card actually going live. Two of these are not started._
* 🏆 Top Contributor Awards - Give recognition for best evidence finder, best explainers, best original argument, and best refutations. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildTopContributorAwards`/`buildCategoryLeaderboard`/`groupContributionsByKind`/`buildAwardsAnnouncementText` for grouping contributor-attributed contributions by `ContributionKind` and selecting a per-kind category winner by helpfulness score, reusing the existing idea #11/Contribution Leaderboard scoring. Follow-ups: (a) a finer-grained kind/tag for "original argument" and "refutation" contributions, neither of which exists as a distinct kind today, (b) a scheduled job to persist/announce winners, (c) an awards UI. None of these are started._
* 🧭 Research Task Routing - Assign specific research jobs to debaters based on topic gaps, skill level, and current needs. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildTaskQueue`/`routeTasks`/`buildRoutingResult`/`buildRoutingSummaryText` for turning a topic-coverage report's under-covered arguments into a skill-gated task queue and routing it to whichever eligible, caller-supplied contributor currently has the fewest active tasks. A second slice, `tiered-task-routing.ts` (see Tracker Status above), now derives each contributor's skill level from their contribution history (via the Progress Unlocks tier logic) instead of requiring a caller-supplied value. Follow-ups: (a) persisted contributor profiles (active task count — skill level is now derived) and a persisted task queue, (b) a task-assignment/inbox UI. None of these are started._
* 🔁 Revision Incentives - Reward users for improving weak cards, updating outdated evidence, and strengthening citations. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `evaluateRevision`/`buildContributorRevisionStats`/`buildRevisionIncentiveLeaderboard`/`buildRevisionRewardText` for scoring a before/after card revision's quality gain (doubled when the card was weak beforehand), citation-strengthening, and evidence-refresh bonuses, reusing the existing idea #11 `community-rating.ts` quality scoring. Follow-ups: (a) wiring actual card-edit events into a persisted revision history, (b) a reward-notification/incentives-leaderboard UI, (c) an actual evidence-staleness signal instead of only rewarding a refresh after the fact. None of these are started._
* 📊 Topic Coverage Dashboard - Show which arguments are well-covered, which are missing, and where the team needs more work. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildTopicCoverageReport`/`getUnderCoveredArguments`/`buildTopicCoverageSummaryText` for classifying a topic's tracked argument blocks as missing, thin, or covered from caller-supplied cards and card-count/word-count thresholds, and surfacing cards filed under an untracked argument block separately. Follow-ups: (a) an `argBlock`/word-count field wired into wherever submitted cards are eventually persisted, (b) a team-editable tracked-argument checklist per topic, (c) a coverage dashboard UI. None of these are started._
* 🎯 Daily Quests and Targets - Set team goals like “find 5 solvency cards” or “add 3 frontline answers today.” _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `computeQuestProgress`/`buildDailyQuestBoard`/`buildQuestBoardSummaryText`/`buildUnderCoveredArgumentQuests` for tracking a day's progress toward caller-supplied kind/argument-block quest targets, including a ready-made quest set derived directly from the existing Topic Coverage Dashboard's under-covered arguments. Follow-ups: (a) wiring real contribution-submission events into a persisted daily feed, (b) a quest-board widget UI, (c) a streak/reward layer once the Gamified Quests idea has its own first slice. None of these are started._
* 🤝 Team Collaboration Mode - Let multiple debaters work on the same topic sprint with shared notes, assignments, and live status. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildTopicSprint`/`buildTopicSprintSummaryText` for composing the existing Daily Quests board, Research Task Routing result, and Research Progress Tracking board into one shared topic-scoped session, plus a topic-addressed `SprintNote` model (`createSprintNote`/`updateSprintNoteStatus`/`assignSprintNote`) for shared prep notes, mirroring `debate-round`'s `strategy-sync-notes.ts` `PrepNote` lifecycle. A second slice, `sprintNotes.ts` (see Tracker Status above), now persists `SprintNote` records to localStorage. Follow-ups: (a) a collaboration-mode panel UI, (b) persisting a topic sprint's other inputs, (c) a presence/live-status signal for who's currently active. Neither of these are started._
* 
* 🕵️ Opponent Team Profiles - Build tournament-scoped profiles for opposing teams, including likely cases, preferred strategies, past results, and habit notes. _Status: first slices done (see Tracker Status above) — `debate-data-sync` now has `buildOpponentTeamProfile`/`buildOpponentTeamProfiles`/`groupRecordsByTeam`/`getHeadToHeadRecords`/`buildOpponentScoutingSummary` for aggregating a team's round history into an overall and per-side win/loss record, a side-preference signal, frequency-ranked common arguments/cases, and head-to-head lookups. A second slice, `opponentTeamProfiles.ts` (see Tracker Status above), now persists `OpponentTeamProfile` records to localStorage, keyed by `teamId`. Follow-ups: (a) a real round-history data source producing `OpponentRoundRecord`s (e.g. from Tabroom pairings/ballots) instead of relying on caller-supplied data, (b) a scouting-card/panel UI, (c) wiring `buildPreRoundBriefing` to look up a persisted profile through this store. Neither of these are started._
* 
* ⚖️ Judge Profiles - Show judge tendencies, paradigm summaries, decision patterns, speed tolerance, theory preferences, and speaker-point habits. _Status: first slice done (see Tracker Status above) — `debate-speech-writer` now has `buildJudgeProfile`/`buildJudgeProfiles`/`groupRecordsByJudge`/`buildJudgeTendencySummary` for aggregating a judge's ballot history into side-vote bias, average speaker points, a pace-based speed-tolerance estimate, theory receptiveness, and their most-tagged paradigm. Follow-ups: (a) a real ballot data source producing `JudgeRoundRecord`s instead of relying on caller-supplied data, (b) a judge-profile card/panel UI, (c) persisting/looking up profiles by judge across tournaments. None of these are started._
* 
* 🤖 AI Practice Opponent - Let debaters spar against an AI that simulates common styles like policy heavy, kritik, lay, or fast-flowing opponents. _Status: first slices done (see Tracker Status above) — `debate-speech-writer` now has an `opponentPersonas` registry (`policy-heavy`/`kritik`/`lay`/`fast-flow`) plus `getOpponentPersona`/`listOpponentPersonas`/`buildOpponentPersonaPrompt` for composing a self-contained, style-specific prompt section. A second slice, `opponentPersonaSelections.ts` (see Tracker Status above), now persists a practice session's selected `OpponentPersona` to localStorage. Follow-ups: (a) an actual AI speech-generation call that consumes `buildOpponentPersonaPrompt`'s output alongside idea #3's `AiSpeechRequest`, (b) a persona-picker UI that reads/writes through the persistence store. Neither of these are started._
* 
* 🎙️ AI Coach Mode - Provide live or post-round coaching with prompts for extensions, refutation ideas, strategic collapse, and weighing guidance. _Status: first slice done (see Tracker Status above) — `debate-round` now has `buildExtensionPrompts`/`buildRefutationPrompts`/`buildCollapsePrompts`/`buildWeighingGuidance`/`buildCoachingSession`/`buildCoachingSummaryText` for turning an already-flowed `Flow` into extension/refutation/collapse/weighing coaching prompts for a chosen side, reusing the existing `flow-transcript-summary.ts`/`response-outcome.ts`/`argument-tree.ts`/`drill-generator.ts` slices directly. Follow-ups: (a) an actual AI coaching call for open-ended feedback beyond this template layer, (b) a coaching-panel UI, (c) persisting a generated coaching session per round. None of these are started._
* 
* 🧑‍🤝‍🧑 Collaboration Prep Room - Create a shared prep space for teammates to research, draft blocks, organize evidence, and coordinate assignments. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildPrepRoom`/`searchPrepRoomEvidence`/`buildPrepRoomSummaryText` for composing the existing Shared Evidence Library and Research Task Routing slices into one topic-scoped prep room: organized evidence, draft blocks, and routed research assignments. Follow-ups: (a) persisting a prep room's entries/draft blocks, (b) a prep-room panel UI, (c) a live presence/who's-active signal. None of these are started._
* 
* 🧠 Team Brainstorm Assist - Use AI to help the whole squad generate arguments, impact framing, frontlines, and responses during prep sessions. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildBrainstormPrompt`/`buildBrainstormPromptsForCoverageGaps` for structured, category-tagged brainstorm prompts (seedable straight from the existing Topic Coverage Dashboard's under-covered arguments) plus a squad idea board (`groupIdeasByBoard`/`rankBrainstormIdeas`/`buildBrainstormBoard`/`buildBrainstormBoardsForCoverageGaps`/`buildBrainstormSummaryText`) that ranks submitted ideas by the existing `community-rating.ts` popularity scoring and flags near-duplicates via the existing `llm-card-scoring.ts` uniqueness heuristic. Follow-ups: (a) an actual AI-generation call that drafts candidate ideas from `buildBrainstormPrompt`'s output, (b) a brainstorm-panel UI for live squad submission/upvoting, (c) persisting submitted ideas and votes. None of these are started._
* 
* 📋 Shared Evidence Library - Keep a team-wide repository of cards, tags, cites, analytics, and reusable blocks with fast search. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `searchEvidenceLibrary`/`findEntriesByCite`/`buildEvidenceLibraryIndex`/`buildEvidenceSearchSummaryText` for a fast-search `EvidenceLibraryEntry` repository (extending the existing Common Argument Library's `LibraryCard` with a full-text body, citation, and card-vs-reusable-block kind) — filterable by topic/case area/kind/tags and rankable by keyword-overlap relevance, reusing `argument-library.ts`'s tag filtering and the LLM Card Scoring slice's `scoreRelevance` directly. Follow-ups: (a) wiring real submitted cards/blocks into a persisted repository, (b) a search panel UI, (c) a real search index (e.g. Typesense) once entries are persisted. None of these are started._
* 
* 🔄 Strategy Sync Notes - Let teammates leave live prep notes, assign tasks, and mark which arguments have been covered or need follow-up. _Status: first slice done (see Tracker Status above) — `debate-round` now has a box-addressed `PrepNote` model (`createPrepNote`/`updateNoteStatus`/`assignNote`) plus `getNotesForBox`/`getNotesForFlow`/`getNotesAssignedTo`/`getOpenFollowUps`/`resolvePrepNoteBox`/`buildPrepNoteSummaryText` for attaching a note to a specific flow argument, assigning it to a teammate as a task, and tracking whether it's still open, covered, or needs follow-up, reusing the existing `flow-annotations.ts` box-addressing convention directly. Follow-ups: (a) wiring `PrepNote` into wherever round/flow state is eventually persisted, (b) a prep-notes panel UI, (c) an assignee notification once a notification system exists. None of these are started._
* 
* 📊 Matchup Prep Dashboard - Combine opponent profiles, judge profiles, and topic-specific prep into a single pre-round view. _Status: first slice done (see Tracker Status above, "Pre-Round Intelligence Panel") — `debate-round` now has `buildPreRoundBriefing`/`buildPreRoundBriefingText` for combining an opponent-scouting summary, judge-tendency summary, head-to-head record, and prep notes into one structured briefing. See idea #12 in Product Feature Ideas above for the full status and follow-ups._
* 
* 🧪 Practice Round Simulator - Recreate a tournament round with timer, speeches, judge persona, and post-round feedback. _Status: first slice done (see Tracker Status above) — `debate-round` now has `buildPracticeRoundSetup`/`buildPracticeRoundSetupText` for composing a format's speech order with a selected judge paradigm and AI opponent persona into a renderable round setup, and `buildPracticeRoundFeedback`/`buildPracticeRoundFeedbackText` for framing post-round feedback around the selected paradigm plus the existing AI Coach Mode coaching session, reusing the existing `ai-versus-speech-order.ts`/`judge-paradigms.ts`/`opponent-personas.ts`/`coach-mode.ts` slices directly. Follow-ups: (a) an actual AI speech-generation call for the AI opponent's speeches and an AI judge-decision call under the chosen paradigm, (b) a round-simulator UI, (c) persisting a simulated practice round. None of these are started._
* 
* 📚 AI Drill Generator - Generate quick drills for overviews, frontline practice, cross-ex responses, and collapse scenarios. _Status: first slice done (see Tracker Status above) — `debate-round` now has `buildOverviewDrill`/`buildFrontlineDrills`/`buildCrossExamDrills`/`buildCollapseDrills`/`buildDrillSet`/`buildDrillSummaryText` for turning an already-flowed `Flow` into a whole-round overview prompt, per-argument frontline/cross-ex prompts, and top-N collapse-scenario recommendations, reusing the existing `flow-transcript-summary.ts`/`response-outcome.ts` slices directly. A second slice, `drillSets.ts` (see Tracker Status above), now persists a round's generated `Drill[]` set to localStorage. Follow-ups: (a) a drill-panel UI that reads/writes through the persistence store, (b) an actual AI-generated (rather than templated) script. Neither of these are started._
* 
* 🧭 Scout-to-Strategy Workflow - Turn scouting data into recommended game plans, case choices, judge adaptation, and risk levels. _Status: first slice done (see Tracker Status above) — `debate-round` now has `rankCaseOptions`/`computeCaseOverlapScore`/`buildJudgeAdaptationNotes`/`assessMatchupRisk`/`buildStrategyRecommendation`/`buildStrategyRecommendationText` for ranking caller-supplied case options by opponent-tag overlap, turning judge tendencies into adaptation notes, and combining opponent/judge signals into a risk level with its contributing factors, reusing the existing `OpponentTeamProfile`/`JudgeProfile` types directly. Follow-ups: (a) a case-choice/strategy panel UI, (b) wiring `ourSide`/likely opponent side into the risk heuristic, (c) an actual AI-panel evaluation of case choice instead of the tag-overlap heuristic. None of these are started._