
## Tracker Status

### In progress
_(none)_

### Completed
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

5. **AI Judge Decision Modes** — Provide configurable AI judge personas that evaluate a completed practice round through different paradigms, such as flow judge, lay judge, policymaker, critic, educator, truth tester, or a user-created paradigm based on a real judge’s publicly provided preferences. _Status: first slice done (see Tracker Status above) — `debate-speech-writer` now has a `judgeParadigms` registry, `buildJudgeParadigmPrompt`, and `buildCustomJudgeParadigm`. Follow-ups: (a) an AI judge-decision call that uses `buildJudgeParadigmPrompt` output instead of (or alongside) the existing static `judgeDecisionPrompt`, (b) a paradigm-picker UI for selecting a built-in paradigm or entering a custom judge's notes, (c) persisting the selected paradigm per round. None of these are started._

6. **Speech Transcript Summaries and Answers** — Transcribe a speech, identify its claims, warrants, impacts, evidence, and unanswered arguments, then produce a concise flow-oriented summary along with possible responses, cross-examination questions, and extension ideas. _Status: first slice done (see Tracker Status above) — `debate-round` now has `getFlowRowSummaries`/`getUnansweredFlowRows`/`buildFlowSummaryText`/`suggestCrossExamQuestions`/`suggestExtensionIdeas` for deriving a per-argument summary and drop/answer status directly from an already-flowed grid. Follow-ups: (a) audio/video transcription plus an AI call to extract claims/warrants/impacts/evidence from raw speech text rather than relying on a manually flowed grid, (b) a summary/cross-ex panel UI in `debate-round` that renders `buildFlowSummaryText`/`suggestCrossExamQuestions`/`suggestExtensionIdeas` for the selected speech, (c) persisting generated summaries per round. None of these are started._

7. **On Page Card Reuse Search** — See if any one has cut this article in the chrome ext 

8. **Video-Lecture-Training Coach AI** — Let coaches upload practice-round recordings, lecture transcripts, camp materials, and approved instructional documents to create a private team coach AI that explains concepts and gives advice grounded in that team’s own teaching materials.

9. **Expandable Heading Structure** — Make research documents and outlines collapsible by heading level, allowing users to expand or collapse H1, H2, and H3 sections so they can move quickly between a high-level argument map and detailed evidence. _Status: first slice done (see Tracker Status above) — `reason-editor`'s engine now has `buildHeadingOutline`/`getVisibleHeadingIds`/`getCollapsedRanges`/`isPositionCollapsed` for deriving H1-H4 structure and collapse ranges from the existing flat heading schema. Follow-ups: (a) a React nav/outline panel in `reason-editor` that renders the outline and toggles collapsed ids, (b) a ProseMirror decoration plugin that hides collapsed ranges in the actual editor view using `getCollapsedRanges`, (c) persisting collapsed-state per document. None of these are started._

10. **Outline Filters and Argument Tree View** — Provide a filterable outline and visual tree that shows the relationship between contentions, links, internal links, impacts, turns, answers, and extensions, with filters for side, speech, contributor, evidence status, and argument type. _Status: first slice done (see Tracker Status above) — `debate-round` now has `buildArgumentTree`/`filterArgumentTree`/`flattenArgumentTree`/`getFlowSideKeys` for deriving a heading-grouped argument tree from an already-flowed grid and filtering it by speech, side, unanswered status, and heading-vs-argument kind. Follow-ups: (a) a React tree/outline panel in `debate-round` that renders the filtered tree next to (or instead of) `FlowSpreadsheet`, (b) finer argument-type tagging (link/impact/turn/answer/extension) and contributor/evidence-status fields, none of which exist in the `Box`/`Flow` schema today, (c) persisting the user's chosen filter state per round. None of these are started._

11. **Community-Rated Summaries and Highlights** — Let users like, save, and endorse the most useful research summaries, analytic explanations, evidence highlights, and annotations, then rank contributions by helpfulness while guarding against popularity-only scoring through quality and reviewer-weight signals. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `scorePopularitySignal`/`scoreQualitySignal`/`scoreReviewerSignal`/`computeHelpfulnessBreakdown`/`rankContributions` for blending logarithmically-dampened popularity with quality and reviewer-credibility signals into a ranked, popularity-resistant helpfulness score. Follow-ups: (a) wiring up actual like/save/endorse actions and persisting those counts per contribution, (b) a real reviewer-credibility system instead of a caller-supplied weight per endorsement, (c) a leaderboard/ranked-feed UI in `debate-card-search` that renders `rankContributions` and surfaces `isPopularityOnlyOutlier` contributions for moderator review. None of these are started._

12. **Pre-Round Intelligence Panel** — On every round-information page, combine live tournament results, prior pairings, opponent records, judge paradigms, event details, room assignments, and relevant team prep notes into one focused pre-round briefing. _Status: first slice done (see Tracker Status above) — `debate-round` now has `buildPreRoundBriefing`/`summarizePriorMeetings`/`buildPreRoundBriefingText` for composing an opponent-scouting summary, a judge-tendency summary, a head-to-head prior-meetings record, and team prep notes into one structured, renderable briefing, reusing the existing `debate-data-sync`/`debate-speech-writer` profile slices. Follow-ups: (a) real data sources for tournament results, pairings, event details, and room assignments (none exist in this repo today), (b) a briefing panel UI that renders it on a round-information page, (c) persisting a generated briefing per round. None of these are started._

13. **Coaching Programs and Group Challenges** — Enable coaches to create group coaching spaces with assigned drills, research sprints, practice rounds, shared feedback, progress tracking, and friendly challenges such as completing a set of blocks or winning a rebuttal exercise.

14. **Legacy Verbatim / Cardmirror Compatibility** — Offer optional keyboard shortcuts that mirror familiar Verbatim and paperless-debate workflows, including sending selected evidence to a speech document, formatting citations, condensing cards, emphasizing text, and moving headings. _Status: first slice done (see Tracker Status above) — `debate-card-parser` now has `condenseCardHtml`, `formatShortCiteTag`, and `moveOutlineNode` for condensing a card to its underlined "read" text, formatting a short cite tag, and reordering outline nodes. Follow-ups: (a) wiring these into actual keyboard-shortcut handlers in `reason-editor`'s toolbar/editor view, (b) a "send selected evidence to a speech document" command, which needs a speech-document target that doesn't exist yet, (c) a text-emphasize (toggle `<mark>`) command over an editor selection range. None of these are started._

15. **Flow-in-Speech Flow Annotations** — While viewing a streamed or recorded round, let users create timestamped flow entries for each speech and attach an entry directly to a particular argument or response bubble, making it easy to revisit exactly where an answer was made. _Status: first slice done (see Tracker Status above) — `debate-round` now has a `FlowAnnotation` data model and query helpers (`createFlowAnnotation`, `getAnnotationsForSpeech`, `getAnnotationsForBox`, `findAnnotationAtPlaybackPosition`, `resolveAnnotationBox`) for tying a playback timestamp to a specific flow box. Follow-ups: (a) a video-player UI (`debate-videos`) that lets a viewer drop an annotation at the current playback position and jump back to one, (b) a flow-grid affordance (`FlowSpreadsheet`) that surfaces annotations on their box and links back to the timestamp, (c) persisting annotations alongside a `Round`/`Flow`. None of these are started._

16. **Shared, Ai-Generated Debate Flow** — Synchronize a live flow across a team or room so collaborators can follow the same argument map, while optionally preloading evidence cards with structured flow notes to reduce manual flowing. Existing debate-flow products show the feasibility of live transcription, argument tracking, shared notes, saved flows, and structured ballot assistance; this feature should keep humans in control of the actual flow and strategic interpretation. [github](https://github.com/saranchockan/DebateFlow)



## Research Crowdsourcing Organizer Features

* 🧩 Community Research Hub - A shared space where debaters contribute cards, evidence, and summaries to a common argument pool.
* 🏅 Contribution Leaderboard - Track who has submitted the most useful research, highest-rated cards, and most completed tasks. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildLeaderboard`/`buildContributorStats`/`groupContributionsByContributor` for aggregating contributor-attributed contributions (scored via the idea #11 `community-rating.ts` helpfulness scoring) into a ranked, per-contributor leaderboard. Follow-ups: (a) wiring a `contributorId` into wherever contributions are eventually persisted, (b) a "completed tasks" signal once a research-task system exists, (c) a leaderboard UI. None of these are started._
* 🎮 Gamified Quests - Turn research work into missions, challenges, and streaks that reward consistent contribution.
* 🔓 Progress Unlocks - Unlock harder research tasks, advanced topics, and special badges as users contribute more.
* 🧠 LLM Card Scoring - Use an LLM to score cards for relevance, clarity, uniqueness, evidence quality, and usability.
* 📈 Research Progress Tracking - Show each debater’s progress across topics, task completion, and contribution history.
* 📚 Common Argument Library - Organize all shared research into topic folders, case areas, and tag-based collections.
* 🕵️ Daily Best Card Challenge - Highlight the highest-scoring card of the day and let the community vote on it. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `groupCardsByDay`/`pickBestCardOfDay`/`buildDailyBestCards`/`getBestCardForDay`/`buildDailyBestCardHighlight` for grouping timestamped card contributions by UTC submission day and picking each day's single highest-helpfulness card, reusing the existing `community-rating.ts` helpfulness scoring (a card's likes/saves already model the community "vote"). Follow-ups: (a) wiring a `submittedAt` timestamp into wherever card contributions are eventually persisted, (b) a scheduled job or view that persists/announces the day's winner, (c) a challenge banner/widget UI. None of these are started._
* 🗣️ Peer Review System - Allow teammates to review, comment on, and refine submitted cards before they go live. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has a `CardReview` status state machine (`createCardReview`/`submitForReview`/`requestChanges`/`approveReview`/`rejectReview`/`publishReview`) plus a blocking-aware comment thread (`addReviewComment`/`resolveReviewComment`/`getUnresolvedBlockingComments`/`isReadyToPublish`/`buildReviewSummary`) that blocks approval until every blocking comment is resolved. Follow-ups: (a) persisting `CardReview`/`ReviewComment` alongside submitted cards, (b) a review-queue/comment-thread UI, (c) reviewer identity/permission checks once auth/roles exist. None of these are started._
* 🏆 Top Contributor Awards - Give recognition for best evidence finder, best explainers, best original argument, and best refutations. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildTopContributorAwards`/`buildCategoryLeaderboard`/`groupContributionsByKind`/`buildAwardsAnnouncementText` for grouping contributor-attributed contributions by `ContributionKind` and selecting a per-kind category winner by helpfulness score, reusing the existing idea #11/Contribution Leaderboard scoring. Follow-ups: (a) a finer-grained kind/tag for "original argument" and "refutation" contributions, neither of which exists as a distinct kind today, (b) a scheduled job to persist/announce winners, (c) an awards UI. None of these are started._
* 🧭 Research Task Routing - Assign specific research jobs to debaters based on topic gaps, skill level, and current needs. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildTaskQueue`/`routeTasks`/`buildRoutingResult`/`buildRoutingSummaryText` for turning a topic-coverage report's under-covered arguments into a skill-gated task queue and routing it to whichever eligible, caller-supplied contributor currently has the fewest active tasks. Follow-ups: (a) persisted contributor profiles (skill level, active task count) and a persisted task queue, (b) a task-assignment/inbox UI, (c) an actual-skill-level signal derived from contribution history instead of a caller-supplied value. None of these are started._
* 🔁 Revision Incentives - Reward users for improving weak cards, updating outdated evidence, and strengthening citations. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `evaluateRevision`/`buildContributorRevisionStats`/`buildRevisionIncentiveLeaderboard`/`buildRevisionRewardText` for scoring a before/after card revision's quality gain (doubled when the card was weak beforehand), citation-strengthening, and evidence-refresh bonuses, reusing the existing idea #11 `community-rating.ts` quality scoring. Follow-ups: (a) wiring actual card-edit events into a persisted revision history, (b) a reward-notification/incentives-leaderboard UI, (c) an actual evidence-staleness signal instead of only rewarding a refresh after the fact. None of these are started._
* 📊 Topic Coverage Dashboard - Show which arguments are well-covered, which are missing, and where the team needs more work. _Status: first slice done (see Tracker Status above) — `debate-card-search` now has `buildTopicCoverageReport`/`getUnderCoveredArguments`/`buildTopicCoverageSummaryText` for classifying a topic's tracked argument blocks as missing, thin, or covered from caller-supplied cards and card-count/word-count thresholds, and surfacing cards filed under an untracked argument block separately. Follow-ups: (a) an `argBlock`/word-count field wired into wherever submitted cards are eventually persisted, (b) a team-editable tracked-argument checklist per topic, (c) a coverage dashboard UI. None of these are started._
* 🎯 Daily Quests and Targets - Set team goals like “find 5 solvency cards” or “add 3 frontline answers today.”
* 🤝 Team Collaboration Mode - Let multiple debaters work on the same topic sprint with shared notes, assignments, and live status.
* 
* 🕵️ Opponent Team Profiles - Build tournament-scoped profiles for opposing teams, including likely cases, preferred strategies, past results, and habit notes. _Status: first slice done (see Tracker Status above) — `debate-data-sync` now has `buildOpponentTeamProfile`/`buildOpponentTeamProfiles`/`groupRecordsByTeam`/`getHeadToHeadRecords`/`buildOpponentScoutingSummary` for aggregating a team's round history into an overall and per-side win/loss record, a side-preference signal, frequency-ranked common arguments/cases, and head-to-head lookups. Follow-ups: (a) a real round-history data source producing `OpponentRoundRecord`s (e.g. from Tabroom pairings/ballots) instead of relying on caller-supplied data, (b) a scouting-card/panel UI, (c) persisting/looking up profiles by team across tournaments. None of these are started._
* 
* ⚖️ Judge Profiles - Show judge tendencies, paradigm summaries, decision patterns, speed tolerance, theory preferences, and speaker-point habits. _Status: first slice done (see Tracker Status above) — `debate-speech-writer` now has `buildJudgeProfile`/`buildJudgeProfiles`/`groupRecordsByJudge`/`buildJudgeTendencySummary` for aggregating a judge's ballot history into side-vote bias, average speaker points, a pace-based speed-tolerance estimate, theory receptiveness, and their most-tagged paradigm. Follow-ups: (a) a real ballot data source producing `JudgeRoundRecord`s instead of relying on caller-supplied data, (b) a judge-profile card/panel UI, (c) persisting/looking up profiles by judge across tournaments. None of these are started._
* 
* 🤖 AI Practice Opponent - Let debaters spar against an AI that simulates common styles like policy heavy, kritik, lay, or fast-flowing opponents.
* 
* 🎙️ AI Coach Mode - Provide live or post-round coaching with prompts for extensions, refutation ideas, strategic collapse, and weighing guidance.
* 
* 🧑‍🤝‍🧑 Collaboration Prep Room - Create a shared prep space for teammates to research, draft blocks, organize evidence, and coordinate assignments.
* 
* 🧠 Team Brainstorm Assist - Use AI to help the whole squad generate arguments, impact framing, frontlines, and responses during prep sessions.
* 
* 📋 Shared Evidence Library - Keep a team-wide repository of cards, tags, cites, analytics, and reusable blocks with fast search.
* 
* 🔄 Strategy Sync Notes - Let teammates leave live prep notes, assign tasks, and mark which arguments have been covered or need follow-up.
* 
* 📊 Matchup Prep Dashboard - Combine opponent profiles, judge profiles, and topic-specific prep into a single pre-round view. _Status: first slice done (see Tracker Status above, "Pre-Round Intelligence Panel") — `debate-round` now has `buildPreRoundBriefing`/`buildPreRoundBriefingText` for combining an opponent-scouting summary, judge-tendency summary, head-to-head record, and prep notes into one structured briefing. See idea #12 in Product Feature Ideas above for the full status and follow-ups._
* 
* 🧪 Practice Round Simulator - Recreate a tournament round with timer, speeches, judge persona, and post-round feedback.
* 
* 📚 AI Drill Generator - Generate quick drills for overviews, frontline practice, cross-ex responses, and collapse scenarios.
* 
* 🧭 Scout-to-Strategy Workflow - Turn scouting data into recommended game plans, case choices, judge adaptation, and risk levels.