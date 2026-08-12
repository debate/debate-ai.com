
## Tracker Status

### In progress
_(none)_

### Completed
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
  PR: TBD.
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

1. **CX NDCA Standings** — Add a standings dashboard modeled around NDCA-style results, allowing users to browse qualification points, rankings, cumulative records, and tournament performance history across the season. Tabroom already supports tournament results and NDCA-points configuration, so this could expose those data in a more searchable, user-friendly analytics view. [tabroom](https://www.tabroom.com/index/tourn/index.mhtml?tourn_id=26597)

2. **Word-Count-Only Speech Format** — Support a practice and online-debate format where speeches are constrained by a maximum word count rather than a time limit, helping students practice concise writing, efficient argument construction, and comparable asynchronous submissions. _Status: first slice done (see Tracker Status above) — `debate-timer` now has word-count/limit-status utilities and a `wordCountStyles` registry. Follow-ups: (a) a submission UI in `debate-round`/`reason-editor` that calls `getWordCountStatus` while a debater types, (b) extending `useTimerState`/`SpeechTimer` to support a non-timed, word-limited speech mode, (c) persisting word-count-mode round results alongside timed rounds. None of these are started._

3. **Online Debate Versus AI** — Allow a debater or team to enter an online practice debate against an AI opponent, select the debate format and side, submit speeches in text or audio, and receive structured responses that follow the expected speech order.

4. **AI Response-Outcome Charts** — Use a panel of specialized models or “AI counsel” roles to evaluate likely response paths, map which arguments are most vulnerable, estimate where clash will occur, and visualize how different strategic choices may change likely round outcomes.

5. **AI Judge Decision Modes** — Provide configurable AI judge personas that evaluate a completed practice round through different paradigms, such as flow judge, lay judge, policymaker, critic, educator, truth tester, or a user-created paradigm based on a real judge’s publicly provided preferences. _Status: first slice done (see Tracker Status above) — `debate-speech-writer` now has a `judgeParadigms` registry, `buildJudgeParadigmPrompt`, and `buildCustomJudgeParadigm`. Follow-ups: (a) an AI judge-decision call that uses `buildJudgeParadigmPrompt` output instead of (or alongside) the existing static `judgeDecisionPrompt`, (b) a paradigm-picker UI for selecting a built-in paradigm or entering a custom judge's notes, (c) persisting the selected paradigm per round. None of these are started._

6. **Speech Transcript Summaries and Answers** — Transcribe a speech, identify its claims, warrants, impacts, evidence, and unanswered arguments, then produce a concise flow-oriented summary along with possible responses, cross-examination questions, and extension ideas. _Status: first slice done (see Tracker Status above) — `debate-round` now has `getFlowRowSummaries`/`getUnansweredFlowRows`/`buildFlowSummaryText`/`suggestCrossExamQuestions`/`suggestExtensionIdeas` for deriving a per-argument summary and drop/answer status directly from an already-flowed grid. Follow-ups: (a) audio/video transcription plus an AI call to extract claims/warrants/impacts/evidence from raw speech text rather than relying on a manually flowed grid, (b) a summary/cross-ex panel UI in `debate-round` that renders `buildFlowSummaryText`/`suggestCrossExamQuestions`/`suggestExtensionIdeas` for the selected speech, (c) persisting generated summaries per round. None of these are started._

7. **On Page Card Reuse Search** — See if any one has cut this article in the chrome ext 

8. **Video-Lecture-Training Coach AI** — Let coaches upload practice-round recordings, lecture transcripts, camp materials, and approved instructional documents to create a private team coach AI that explains concepts and gives advice grounded in that team’s own teaching materials.

9. **Expandable Heading Structure** — Make research documents and outlines collapsible by heading level, allowing users to expand or collapse H1, H2, and H3 sections so they can move quickly between a high-level argument map and detailed evidence. _Status: first slice done (see Tracker Status above) — `reason-editor`'s engine now has `buildHeadingOutline`/`getVisibleHeadingIds`/`getCollapsedRanges`/`isPositionCollapsed` for deriving H1-H4 structure and collapse ranges from the existing flat heading schema. Follow-ups: (a) a React nav/outline panel in `reason-editor` that renders the outline and toggles collapsed ids, (b) a ProseMirror decoration plugin that hides collapsed ranges in the actual editor view using `getCollapsedRanges`, (c) persisting collapsed-state per document. None of these are started._

10. **Outline Filters and Argument Tree View** — Provide a filterable outline and visual tree that shows the relationship between contentions, links, internal links, impacts, turns, answers, and extensions, with filters for side, speech, contributor, evidence status, and argument type. _Status: first slice done (see Tracker Status above) — `debate-round` now has `buildArgumentTree`/`filterArgumentTree`/`flattenArgumentTree`/`getFlowSideKeys` for deriving a heading-grouped argument tree from an already-flowed grid and filtering it by speech, side, unanswered status, and heading-vs-argument kind. Follow-ups: (a) a React tree/outline panel in `debate-round` that renders the filtered tree next to (or instead of) `FlowSpreadsheet`, (b) finer argument-type tagging (link/impact/turn/answer/extension) and contributor/evidence-status fields, none of which exist in the `Box`/`Flow` schema today, (c) persisting the user's chosen filter state per round. None of these are started._

11. **Community-Rated Summaries and Highlights** — Let users like, save, and endorse the most useful research summaries, analytic explanations, evidence highlights, and annotations, then rank contributions by helpfulness while guarding against popularity-only scoring through quality and reviewer-weight signals.

12. **Pre-Round Intelligence Panel** — On every round-information page, combine live tournament results, prior pairings, opponent records, judge paradigms, event details, room assignments, and relevant team prep notes into one focused pre-round briefing.

13. **Coaching Programs and Group Challenges** — Enable coaches to create group coaching spaces with assigned drills, research sprints, practice rounds, shared feedback, progress tracking, and friendly challenges such as completing a set of blocks or winning a rebuttal exercise.

14. **Legacy Verbatim / Cardmirror Compatibility** — Offer optional keyboard shortcuts that mirror familiar Verbatim and paperless-debate workflows, including sending selected evidence to a speech document, formatting citations, condensing cards, emphasizing text, and moving headings. 

15. **Flow-in-Speech Flow Annotations** — While viewing a streamed or recorded round, let users create timestamped flow entries for each speech and attach an entry directly to a particular argument or response bubble, making it easy to revisit exactly where an answer was made. _Status: first slice done (see Tracker Status above) — `debate-round` now has a `FlowAnnotation` data model and query helpers (`createFlowAnnotation`, `getAnnotationsForSpeech`, `getAnnotationsForBox`, `findAnnotationAtPlaybackPosition`, `resolveAnnotationBox`) for tying a playback timestamp to a specific flow box. Follow-ups: (a) a video-player UI (`debate-videos`) that lets a viewer drop an annotation at the current playback position and jump back to one, (b) a flow-grid affordance (`FlowSpreadsheet`) that surfaces annotations on their box and links back to the timestamp, (c) persisting annotations alongside a `Round`/`Flow`. None of these are started._

16. **Shared, Ai-Generated Debate Flow** — Synchronize a live flow across a team or room so collaborators can follow the same argument map, while optionally preloading evidence cards with structured flow notes to reduce manual flowing. Existing debate-flow products show the feasibility of live transcription, argument tracking, shared notes, saved flows, and structured ballot assistance; this feature should keep humans in control of the actual flow and strategic interpretation. [github](https://github.com/saranchockan/DebateFlow)



## Research Crowdsourcing Organizer Features

* 🧩 Community Research Hub - A shared space where debaters contribute cards, evidence, and summaries to a common argument pool.
* 🏅 Contribution Leaderboard - Track who has submitted the most useful research, highest-rated cards, and most completed tasks.
* 🎮 Gamified Quests - Turn research work into missions, challenges, and streaks that reward consistent contribution.
* 🔓 Progress Unlocks - Unlock harder research tasks, advanced topics, and special badges as users contribute more.
* 🧠 LLM Card Scoring - Use an LLM to score cards for relevance, clarity, uniqueness, evidence quality, and usability.
* 📈 Research Progress Tracking - Show each debater’s progress across topics, task completion, and contribution history.
* 📚 Common Argument Library - Organize all shared research into topic folders, case areas, and tag-based collections.
* 🕵️ Daily Best Card Challenge - Highlight the highest-scoring card of the day and let the community vote on it.
* 🗣️ Peer Review System - Allow teammates to review, comment on, and refine submitted cards before they go live.
* 🏆 Top Contributor Awards - Give recognition for best evidence finder, best explainers, best original argument, and best refutations.
* 🧭 Research Task Routing - Assign specific research jobs to debaters based on topic gaps, skill level, and current needs.
* 🔁 Revision Incentives - Reward users for improving weak cards, updating outdated evidence, and strengthening citations.
* 📊 Topic Coverage Dashboard - Show which arguments are well-covered, which are missing, and where the team needs more work.
* 🎯 Daily Quests and Targets - Set team goals like “find 5 solvency cards” or “add 3 frontline answers today.”
* 🤝 Team Collaboration Mode - Let multiple debaters work on the same topic sprint with shared notes, assignments, and live status.
* 
* 🕵️ Opponent Team Profiles - Build tournament-scoped profiles for opposing teams, including likely cases, preferred strategies, past results, and habit notes.
* 
* ⚖️ Judge Profiles - Show judge tendencies, paradigm summaries, decision patterns, speed tolerance, theory preferences, and speaker-point habits.
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
* 📊 Matchup Prep Dashboard - Combine opponent profiles, judge profiles, and topic-specific prep into a single pre-round view.
* 
* 🧪 Practice Round Simulator - Recreate a tournament round with timer, speeches, judge persona, and post-round feedback.
* 
* 📚 AI Drill Generator - Generate quick drills for overviews, frontline practice, cross-ex responses, and collapse scenarios.
* 
* 🧭 Scout-to-Strategy Workflow - Turn scouting data into recommended game plans, case choices, judge adaptation, and risk levels.