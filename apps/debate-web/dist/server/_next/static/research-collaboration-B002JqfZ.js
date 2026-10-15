import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Research collaboration`,description:`Run a squad's research sprint \u2014 topic coverage, the prep room, task routing, brainstorming, peer review, quests, and the leaderboard`,icon:`Users`},r=`# Research collaboration [#research-collaboration]

The research collaboration tools organize a squad's evidence work as one cycle: find the gaps, assign the
work, do it together, review it, and recognize who did it. They all live in the
**[Research Workspace](https://debate-ai.com/research)** (\`/research\`), whose ten sections follow that cycle
in order, and each also has its own page under \`/research/cards/*\`. Six of them (Topic Coverage, the
Collaboration Prep Room, the Review Queue, the Task Inbox, the Contributions Feed, and Team Brainstorm
Assist) share one tabbed page instead, **[Team Research](/docs/features/research-evidence/team-research)**
(\`/research/team\`), with one tab each.

## Identity and topic [#identity-and-topic]

Two fields at the top of the Research Workspace scope everything below them:

- **Your contributor id** \u2014 the id every panel attributes submissions, completed tasks, and quest progress to.
  It's prefilled from your signed-in account and remembered on this device; edit it to work as a different id.
- **Topic** \u2014 scopes the *Sprint* section's composition. Defaults to the first tagged case area in the
  evidence library.

## Sample data [#sample-data]

**Load sample data**, at the top of the Research Workspace, fills it with a
demo built from real cards in the card database: those cards as evidence
library entries filed under one topic, the arguments they cover as tracked
arguments, and squad contributions attributed to the schools the cards came
from. Coverage, Library, Evidence, Sprint and Rewards then all have something
to show.

The sample stays in this browser and is never saved to your account. It is
added beside your own records and never replaces one, and **Clear sample
data** removes only the sample. Editing a sample record keeps it local too.

## The cycle, section by section [#the-cycle-section-by-section]

### 1. Coverage \u2014 where does the squad need work? [#1-coverage--where-does-the-squad-need-work]

**[Topic Coverage Dashboard](https://debate-ai.com/research/team?section=coverage)** (\`/research/team?section=coverage\`, [spec](/docs/features/research-evidence/topic-coverage-dashboard))
lists every tracked argument as missing, thin, or covered, by card count and word count, plus an *untracked*
section for submitted cards nobody added to the checklist. Start here: the gaps it finds become the tasks and
quests in later sections.

### 2\u20133. Library and Evidence \u2014 what do we already have? [#23-library-and-evidence--what-do-we-already-have]

| Tool | Route | What it does |
| --- | --- | --- |
| Argument Library | [\`/research/cards/argument-library\`](/docs/features/research-evidence/argument-library-collections) | Shared research organized into topic folders, case-area subgroups, and cross-cutting tag collections. |
| Evidence Library | [\`/research/cards/library\`](/docs/features/research-evidence/evidence-library) | Full-text search across every shared cut card and reusable analytic, with kind, topic, case-area, and tag filters. Edits here score toward Revision Incentives. |

### 4. Sprint \u2014 work a topic together [#4-sprint--work-a-topic-together]

| Tool | Route | What it does |
| --- | --- | --- |
| Collaboration Prep Room | [\`/research/team?section=prep-room\`](/docs/features/team-collaboration/collaboration-prep-room) | A topic's shared space: its evidence, draft blocks, and routed tasks, a keyword search scoped to just this topic, an active-now roster, and an activity timeline. |
| Topic Sprint | \u2014 | The sprint composition for the selected topic \u2014 see the [Team collaboration mode](/docs/features/team-collaboration/team-collaboration-mode) spec. |
| Team Collaboration Mode | [\`/research/cards/collaboration\`](/docs/features/team-collaboration/team-collaboration-mode) | Live prep notes on the shared sprint, grouped by topic, each cycling open \u2192 covered \u2192 needs-follow-up, and assignable to a teammate from the board. |
| Team Brainstorm Assist | [\`/research/team?section=brainstorm\`](/docs/features/research-evidence/brainstorm-board) | Idea boards for new arguments, impact framing, frontlines, and turns, with upvotes, a near-duplicate badge, and AI-generated idea seeding. |

### 5. Routing \u2014 who does what? [#5-routing--who-does-what]

**[Task Inbox](https://debate-ai.com/research/team?section=inbox)** (\`/research/team?section=inbox\`, [spec](/docs/features/team-collaboration/task-inbox)) routes coverage-gap
tasks to contributors by skill level, grouped by topic. A task marked done is verified by a *different*
contributor before it counts.

### 6. Progress \u2014 how is everyone doing? [#6-progress--how-is-everyone-doing]

| Tool | Route | What it does |
| --- | --- | --- |
| Research Progress | [\`/coaching/progress\`](/docs/features/research-evidence/research-progress-tracking) | Each contributor's contribution history, task completion rate, and per-topic breakdown. |
| Progress | [\`/research/cards/progress\`](/docs/features/gamification/progress-unlocks) | Unlock tiers, the task skill level each tier unlocks, badges, and daily-quest streaks \u2014 with how far each contributor is from the next tier. |

### 7. Quests \u2014 keep the sprint moving [#7-quests--keep-the-sprint-moving]

| Tool | Route | What it does |
| --- | --- | --- |
| Daily Quests | [\`/research/cards/quests\`](/docs/features/gamification/daily-quests) | Team goals like "find 5 solvency cards", tracked live against today's real contributions; bulk-seed them from a topic's under-covered arguments. |
| Quest Streaks | [\`/research/cards/streaks\`](/docs/features/gamification/quest-streaks) | Current and longest streaks with 3/7/14/30-day milestone badges. |
| Group Challenges | [\`/research/cards/group-challenges\`](/docs/features/team-collaboration/group-challenges) | Squad-scoped challenges on contribution counts or recorded rebuttal wins, with live standings and an MVP badge. |

### 8. Rewards \u2014 recognize the work [#8-rewards--recognize-the-work]

| Tool | Route | What it does |
| --- | --- | --- |
| Leaderboard | [\`/coaching/leaderboard\`](/docs/features/team-collaboration/contribution-leaderboard) | Contributors ranked by total helpfulness score, with tier, streak, and milestone badges. |
| Contributor Awards | [\`/research/cards/awards\`](/docs/features/team-collaboration/contributor-awards) | Category winners \u2014 best evidence finder, best explainer, and so on \u2014 with a freeze action to announce a day's standings. |
| Contributions Feed | [\`/research/team?section=contributions\`](/docs/features/team-collaboration/contributions-feed) | Every contribution kind in one scored feed; likes, saves, and endorsements feed the Leaderboard. |
| Daily Best Card | [\`/research/cards/best-card\`](/docs/features/gamification/daily-best-card) | Today's highest-helpfulness card and every past day's winner. |
| Revision Incentives | [\`/research/cards/revisions\`](/docs/features/gamification/revision-incentives) | Points for improving weak cards, strengthening citations, and refreshing stale evidence. |

### 9. Review \u2014 is it ready to publish? [#9-review--is-it-ready-to-publish]

**[Review Queue](https://debate-ai.com/research/team?section=reviews)** (\`/research/team?section=reviews\`, [spec](/docs/features/team-collaboration/review-queue)) moves a card
through draft \u2192 in review \u2192 changes requested \u2192 approved \u2192 published. Blocking comments must be resolved
before approval.

### 10. Scoring \u2014 how good is it? [#10-scoring--how-good-is-it]

**[LLM Card Scoring](https://debate-ai.com/cards/scoring)** (\`/research/cards/scoring\`, [spec](/docs/features/ai-coaching/llm-card-scoring)) scores
cards on relevance, clarity, uniqueness, evidence quality, and usability, flags likely duplicates against the
shared evidence library, and can add an AI-written qualitative verdict per card.

## Tips [#tips]

- **Sharing a section:** the URL carries the open section, e.g. \`/research?section=sprint\`.
- **One panel at a time:** every chip in a section heading has an arrow that opens that panel's own page.
- **Notifications:** assigning a prep note or a task to a teammate creates a
  [notification](/docs/features/rounds/round-invites-and-notifications) for them at \`/notifications\`.
`,i={contents:[{heading:`research-collaboration`,content:`The research collaboration tools organize a squad's evidence work as one cycle: find the gaps, assign the
work, do it together, review it, and recognize who did it. They all live in the
**Research Workspace** (\`/research\`), whose ten sections follow that cycle
in order, and each also has its own page under \`/research/cards/*\`. Six of them (Topic Coverage, the
Collaboration Prep Room, the Review Queue, the Task Inbox, the Contributions Feed, and Team Brainstorm
Assist) share one tabbed page instead, **Team Research**
(\`/research/team\`), with one tab each.`},{heading:`identity-and-topic`,content:`Two fields at the top of the Research Workspace scope everything below them:`},{heading:`identity-and-topic`,content:`**Your contributor id** \u2014 the id every panel attributes submissions, completed tasks, and quest progress to.
It's prefilled from your signed-in account and remembered on this device; edit it to work as a different id.`},{heading:`identity-and-topic`,content:`**Topic** \u2014 scopes the *Sprint* section's composition. Defaults to the first tagged case area in the
evidence library.`},{heading:`sample-data`,content:`**Load sample data**, at the top of the Research Workspace, fills it with a
demo built from real cards in the card database: those cards as evidence
library entries filed under one topic, the arguments they cover as tracked
arguments, and squad contributions attributed to the schools the cards came
from. Coverage, Library, Evidence, Sprint and Rewards then all have something
to show.`},{heading:`sample-data`,content:`The sample stays in this browser and is never saved to your account. It is
added beside your own records and never replaces one, and **Clear sample
data** removes only the sample. Editing a sample record keeps it local too.`},{heading:`1-coverage--where-does-the-squad-need-work`,content:`**Topic Coverage Dashboard** (\`/research/team?section=coverage\`, spec)
lists every tracked argument as missing, thin, or covered, by card count and word count, plus an *untracked*
section for submitted cards nobody added to the checklist. Start here: the gaps it finds become the tasks and
quests in later sections.`},{heading:`23-library-and-evidence--what-do-we-already-have`,content:`| Tool             | Route                              | What it does                                                                                          |
| ---------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Argument Library | \`/research/cards/argument-library\` | Shared research organized into topic folders, case-area subgroups, and cross-cutting tag collections. |`,table:`table-0`},{heading:`23-library-and-evidence--what-do-we-already-have`,content:`| Tool             | Route                     | What it does                                                                                                                                                    |
| ---------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence Library | \`/research/cards/library\` | Full-text search across every shared cut card and reusable analytic, with kind, topic, case-area, and tag filters. Edits here score toward Revision Incentives. |`,table:`table-0`},{heading:`4-sprint--work-a-topic-together`,content:`| Tool                    | Route                              | What it does                                                                                                                                                      |
| ----------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Collaboration Prep Room | \`/research/team?section=prep-room\` | A topic's shared space: its evidence, draft blocks, and routed tasks, a keyword search scoped to just this topic, an active-now roster, and an activity timeline. |`,table:`table-1`},{heading:`4-sprint--work-a-topic-together`,content:`| Tool         | Route | What it does                                                                          |
| ------------ | ----- | ------------------------------------------------------------------------------------- |
| Topic Sprint | \u2014     | The sprint composition for the selected topic \u2014 see the Team collaboration mode spec. |`,table:`table-1`},{heading:`4-sprint--work-a-topic-together`,content:`| Tool                    | Route                           | What it does                                                                                                                                        |
| ----------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team Collaboration Mode | \`/research/cards/collaboration\` | Live prep notes on the shared sprint, grouped by topic, each cycling open \u2192 covered \u2192 needs-follow-up, and assignable to a teammate from the board. |`,table:`table-1`},{heading:`4-sprint--work-a-topic-together`,content:`| Tool                   | Route                               | What it does                                                                                                                               |
| ---------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Team Brainstorm Assist | \`/research/team?section=brainstorm\` | Idea boards for new arguments, impact framing, frontlines, and turns, with upvotes, a near-duplicate badge, and AI-generated idea seeding. |`,table:`table-1`},{heading:`5-routing--who-does-what`,content:`**Task Inbox** (\`/research/team?section=inbox\`, spec) routes coverage-gap
tasks to contributors by skill level, grouped by topic. A task marked done is verified by a *different*
contributor before it counts.`},{heading:`6-progress--how-is-everyone-doing`,content:`| Tool              | Route                | What it does                                                                            |
| ----------------- | -------------------- | --------------------------------------------------------------------------------------- |
| Research Progress | \`/coaching/progress\` | Each contributor's contribution history, task completion rate, and per-topic breakdown. |`,table:`table-2`},{heading:`6-progress--how-is-everyone-doing`,content:`| Tool     | Route                      | What it does                                                                                                                                 |
| -------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Progress | \`/research/cards/progress\` | Unlock tiers, the task skill level each tier unlocks, badges, and daily-quest streaks \u2014 with how far each contributor is from the next tier. |`,table:`table-2`},{heading:`7-quests--keep-the-sprint-moving`,content:`| Tool         | Route                    | What it does                                                                                                                                     |
| ------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Daily Quests | \`/research/cards/quests\` | Team goals like "find 5 solvency cards", tracked live against today's real contributions; bulk-seed them from a topic's under-covered arguments. |`,table:`table-3`},{heading:`7-quests--keep-the-sprint-moving`,content:`| Tool          | Route                     | What it does                                                     |
| ------------- | ------------------------- | ---------------------------------------------------------------- |
| Quest Streaks | \`/research/cards/streaks\` | Current and longest streaks with 3/7/14/30-day milestone badges. |`,table:`table-3`},{heading:`7-quests--keep-the-sprint-moving`,content:`| Tool             | Route                              | What it does                                                                                                    |
| ---------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Group Challenges | \`/research/cards/group-challenges\` | Squad-scoped challenges on contribution counts or recorded rebuttal wins, with live standings and an MVP badge. |`,table:`table-3`},{heading:`8-rewards--recognize-the-work`,content:`| Tool        | Route                   | What it does                                                                             |
| ----------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| Leaderboard | \`/coaching/leaderboard\` | Contributors ranked by total helpfulness score, with tier, streak, and milestone badges. |`,table:`table-4`},{heading:`8-rewards--recognize-the-work`,content:`| Tool               | Route                    | What it does                                                                                                             |
| ------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Contributor Awards | \`/research/cards/awards\` | Category winners \u2014 best evidence finder, best explainer, and so on \u2014 with a freeze action to announce a day's standings. |`,table:`table-4`},{heading:`8-rewards--recognize-the-work`,content:`| Tool               | Route                                  | What it does                                                                                     |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Contributions Feed | \`/research/team?section=contributions\` | Every contribution kind in one scored feed; likes, saves, and endorsements feed the Leaderboard. |`,table:`table-4`},{heading:`8-rewards--recognize-the-work`,content:`| Tool            | Route                       | What it does                                                  |
| --------------- | --------------------------- | ------------------------------------------------------------- |
| Daily Best Card | \`/research/cards/best-card\` | Today's highest-helpfulness card and every past day's winner. |`,table:`table-4`},{heading:`8-rewards--recognize-the-work`,content:`| Tool                | Route                       | What it does                                                                             |
| ------------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| Revision Incentives | \`/research/cards/revisions\` | Points for improving weak cards, strengthening citations, and refreshing stale evidence. |`,table:`table-4`},{heading:`9-review--is-it-ready-to-publish`,content:`**Review Queue** (\`/research/team?section=reviews\`, spec) moves a card
through draft \u2192 in review \u2192 changes requested \u2192 approved \u2192 published. Blocking comments must be resolved
before approval.`},{heading:`10-scoring--how-good-is-it`,content:`**LLM Card Scoring** (\`/research/cards/scoring\`, spec) scores
cards on relevance, clarity, uniqueness, evidence quality, and usability, flags likely duplicates against the
shared evidence library, and can add an AI-written qualitative verdict per card.`},{heading:`tips`,content:"**Sharing a section:** the URL carries the open section, e.g. `/research?section=sprint`."},{heading:`tips`,content:`**One panel at a time:** every chip in a section heading has an arrow that opens that panel's own page.`},{heading:`tips`,content:"**Notifications:** assigning a prep note or a task to a teammate creates a\nnotification for them at `/notifications`."}],headings:[{id:`research-collaboration`,content:`Research collaboration`},{id:`identity-and-topic`,content:`Identity and topic`},{id:`sample-data`,content:`Sample data`},{id:`the-cycle-section-by-section`,content:`The cycle, section by section`},{id:`1-coverage--where-does-the-squad-need-work`,content:`1. Coverage \u2014 where does the squad need work?`},{id:`23-library-and-evidence--what-do-we-already-have`,content:`2\u20133. Library and Evidence \u2014 what do we already have?`},{id:`4-sprint--work-a-topic-together`,content:`4. Sprint \u2014 work a topic together`},{id:`5-routing--who-does-what`,content:`5. Routing \u2014 who does what?`},{id:`6-progress--how-is-everyone-doing`,content:`6. Progress \u2014 how is everyone doing?`},{id:`7-quests--keep-the-sprint-moving`,content:`7. Quests \u2014 keep the sprint moving`},{id:`8-rewards--recognize-the-work`,content:`8. Rewards \u2014 recognize the work`},{id:`9-review--is-it-ready-to-publish`,content:`9. Review \u2014 is it ready to publish?`},{id:`10-scoring--how-good-is-it`,content:`10. Scoring \u2014 how good is it?`},{id:`tips`,content:`Tips`}]},a=[{depth:1,url:`#research-collaboration`,title:(0,t.jsx)(t.Fragment,{children:`Research collaboration`})},{depth:2,url:`#identity-and-topic`,title:(0,t.jsx)(t.Fragment,{children:`Identity and topic`})},{depth:2,url:`#sample-data`,title:(0,t.jsx)(t.Fragment,{children:`Sample data`})},{depth:2,url:`#the-cycle-section-by-section`,title:(0,t.jsx)(t.Fragment,{children:`The cycle, section by section`})},{depth:3,url:`#1-coverage--where-does-the-squad-need-work`,title:(0,t.jsx)(t.Fragment,{children:`1. Coverage \u2014 where does the squad need work?`})},{depth:3,url:`#23-library-and-evidence--what-do-we-already-have`,title:(0,t.jsx)(t.Fragment,{children:`2\u20133. Library and Evidence \u2014 what do we already have?`})},{depth:3,url:`#4-sprint--work-a-topic-together`,title:(0,t.jsx)(t.Fragment,{children:`4. Sprint \u2014 work a topic together`})},{depth:3,url:`#5-routing--who-does-what`,title:(0,t.jsx)(t.Fragment,{children:`5. Routing \u2014 who does what?`})},{depth:3,url:`#6-progress--how-is-everyone-doing`,title:(0,t.jsx)(t.Fragment,{children:`6. Progress \u2014 how is everyone doing?`})},{depth:3,url:`#7-quests--keep-the-sprint-moving`,title:(0,t.jsx)(t.Fragment,{children:`7. Quests \u2014 keep the sprint moving`})},{depth:3,url:`#8-rewards--recognize-the-work`,title:(0,t.jsx)(t.Fragment,{children:`8. Rewards \u2014 recognize the work`})},{depth:3,url:`#9-review--is-it-ready-to-publish`,title:(0,t.jsx)(t.Fragment,{children:`9. Review \u2014 is it ready to publish?`})},{depth:3,url:`#10-scoring--how-good-is-it`,title:(0,t.jsx)(t.Fragment,{children:`10. Scoring \u2014 how good is it?`})},{depth:2,url:`#tips`,title:(0,t.jsx)(t.Fragment,{children:`Tips`})}];function o(e){let n={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,h3:`h3`,li:`li`,p:`p`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`research-collaboration`,children:`Research collaboration`}),`
`,(0,t.jsxs)(n.p,{children:[`The research collaboration tools organize a squad's evidence work as one cycle: find the gaps, assign the
work, do it together, review it, and recognize who did it. They all live in the
`,(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`https://debate-ai.com/research`,children:`Research Workspace`})}),` (`,(0,t.jsx)(n.code,{children:`/research`}),`), whose ten sections follow that cycle
in order, and each also has its own page under `,(0,t.jsx)(n.code,{children:`/research/cards/*`}),`. Six of them (Topic Coverage, the
Collaboration Prep Room, the Review Queue, the Task Inbox, the Contributions Feed, and Team Brainstorm
Assist) share one tabbed page instead, `,(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/team-research`,children:`Team Research`})}),`
(`,(0,t.jsx)(n.code,{children:`/research/team`}),`), with one tab each.`]}),`
`,(0,t.jsx)(n.h2,{id:`identity-and-topic`,children:`Identity and topic`}),`
`,(0,t.jsx)(n.p,{children:`Two fields at the top of the Research Workspace scope everything below them:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Your contributor id`}),` \u2014 the id every panel attributes submissions, completed tasks, and quest progress to.
It's prefilled from your signed-in account and remembered on this device; edit it to work as a different id.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Topic`}),` \u2014 scopes the `,(0,t.jsx)(n.em,{children:`Sprint`}),` section's composition. Defaults to the first tagged case area in the
evidence library.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`sample-data`,children:`Sample data`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Load sample data`}),`, at the top of the Research Workspace, fills it with a
demo built from real cards in the card database: those cards as evidence
library entries filed under one topic, the arguments they cover as tracked
arguments, and squad contributions attributed to the schools the cards came
from. Coverage, Library, Evidence, Sprint and Rewards then all have something
to show.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The sample stays in this browser and is never saved to your account. It is
added beside your own records and never replaces one, and `,(0,t.jsx)(n.strong,{children:`Clear sample
data`}),` removes only the sample. Editing a sample record keeps it local too.`]}),`
`,(0,t.jsx)(n.h2,{id:`the-cycle-section-by-section`,children:`The cycle, section by section`}),`
`,(0,t.jsx)(n.h3,{id:`1-coverage--where-does-the-squad-need-work`,children:`1. Coverage \u2014 where does the squad need work?`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`https://debate-ai.com/research/team?section=coverage`,children:`Topic Coverage Dashboard`})}),` (`,(0,t.jsx)(n.code,{children:`/research/team?section=coverage`}),`, `,(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/topic-coverage-dashboard`,children:`spec`}),`)
lists every tracked argument as missing, thin, or covered, by card count and word count, plus an `,(0,t.jsx)(n.em,{children:`untracked`}),`
section for submitted cards nobody added to the checklist. Start here: the gaps it finds become the tasks and
quests in later sections.`]}),`
`,(0,t.jsx)(n.h3,{id:`23-library-and-evidence--what-do-we-already-have`,children:`2\u20133. Library and Evidence \u2014 what do we already have?`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Tool`}),(0,t.jsx)(n.th,{children:`Route`}),(0,t.jsx)(n.th,{children:`What it does`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Argument Library`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/argument-library-collections`,children:(0,t.jsx)(n.code,{children:`/research/cards/argument-library`})})}),(0,t.jsx)(n.td,{children:`Shared research organized into topic folders, case-area subgroups, and cross-cutting tag collections.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Evidence Library`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/evidence-library`,children:(0,t.jsx)(n.code,{children:`/research/cards/library`})})}),(0,t.jsx)(n.td,{children:`Full-text search across every shared cut card and reusable analytic, with kind, topic, case-area, and tag filters. Edits here score toward Revision Incentives.`})]})]})]}),`
`,(0,t.jsx)(n.h3,{id:`4-sprint--work-a-topic-together`,children:`4. Sprint \u2014 work a topic together`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Tool`}),(0,t.jsx)(n.th,{children:`Route`}),(0,t.jsx)(n.th,{children:`What it does`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Collaboration Prep Room`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/collaboration-prep-room`,children:(0,t.jsx)(n.code,{children:`/research/team?section=prep-room`})})}),(0,t.jsx)(n.td,{children:`A topic's shared space: its evidence, draft blocks, and routed tasks, a keyword search scoped to just this topic, an active-now roster, and an activity timeline.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Topic Sprint`}),(0,t.jsx)(n.td,{children:`\u2014`}),(0,t.jsxs)(n.td,{children:[`The sprint composition for the selected topic \u2014 see the `,(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/team-collaboration-mode`,children:`Team collaboration mode`}),` spec.`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Team Collaboration Mode`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/team-collaboration-mode`,children:(0,t.jsx)(n.code,{children:`/research/cards/collaboration`})})}),(0,t.jsx)(n.td,{children:`Live prep notes on the shared sprint, grouped by topic, each cycling open \u2192 covered \u2192 needs-follow-up, and assignable to a teammate from the board.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Team Brainstorm Assist`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/brainstorm-board`,children:(0,t.jsx)(n.code,{children:`/research/team?section=brainstorm`})})}),(0,t.jsx)(n.td,{children:`Idea boards for new arguments, impact framing, frontlines, and turns, with upvotes, a near-duplicate badge, and AI-generated idea seeding.`})]})]})]}),`
`,(0,t.jsx)(n.h3,{id:`5-routing--who-does-what`,children:`5. Routing \u2014 who does what?`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`https://debate-ai.com/research/team?section=inbox`,children:`Task Inbox`})}),` (`,(0,t.jsx)(n.code,{children:`/research/team?section=inbox`}),`, `,(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/task-inbox`,children:`spec`}),`) routes coverage-gap
tasks to contributors by skill level, grouped by topic. A task marked done is verified by a `,(0,t.jsx)(n.em,{children:`different`}),`
contributor before it counts.`]}),`
`,(0,t.jsx)(n.h3,{id:`6-progress--how-is-everyone-doing`,children:`6. Progress \u2014 how is everyone doing?`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Tool`}),(0,t.jsx)(n.th,{children:`Route`}),(0,t.jsx)(n.th,{children:`What it does`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Research Progress`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/research-progress-tracking`,children:(0,t.jsx)(n.code,{children:`/coaching/progress`})})}),(0,t.jsx)(n.td,{children:`Each contributor's contribution history, task completion rate, and per-topic breakdown.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Progress`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/gamification/progress-unlocks`,children:(0,t.jsx)(n.code,{children:`/research/cards/progress`})})}),(0,t.jsx)(n.td,{children:`Unlock tiers, the task skill level each tier unlocks, badges, and daily-quest streaks \u2014 with how far each contributor is from the next tier.`})]})]})]}),`
`,(0,t.jsx)(n.h3,{id:`7-quests--keep-the-sprint-moving`,children:`7. Quests \u2014 keep the sprint moving`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Tool`}),(0,t.jsx)(n.th,{children:`Route`}),(0,t.jsx)(n.th,{children:`What it does`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Daily Quests`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/gamification/daily-quests`,children:(0,t.jsx)(n.code,{children:`/research/cards/quests`})})}),(0,t.jsx)(n.td,{children:`Team goals like "find 5 solvency cards", tracked live against today's real contributions; bulk-seed them from a topic's under-covered arguments.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Quest Streaks`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/gamification/quest-streaks`,children:(0,t.jsx)(n.code,{children:`/research/cards/streaks`})})}),(0,t.jsx)(n.td,{children:`Current and longest streaks with 3/7/14/30-day milestone badges.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Group Challenges`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/group-challenges`,children:(0,t.jsx)(n.code,{children:`/research/cards/group-challenges`})})}),(0,t.jsx)(n.td,{children:`Squad-scoped challenges on contribution counts or recorded rebuttal wins, with live standings and an MVP badge.`})]})]})]}),`
`,(0,t.jsx)(n.h3,{id:`8-rewards--recognize-the-work`,children:`8. Rewards \u2014 recognize the work`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Tool`}),(0,t.jsx)(n.th,{children:`Route`}),(0,t.jsx)(n.th,{children:`What it does`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Leaderboard`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/contribution-leaderboard`,children:(0,t.jsx)(n.code,{children:`/coaching/leaderboard`})})}),(0,t.jsx)(n.td,{children:`Contributors ranked by total helpfulness score, with tier, streak, and milestone badges.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Contributor Awards`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/contributor-awards`,children:(0,t.jsx)(n.code,{children:`/research/cards/awards`})})}),(0,t.jsx)(n.td,{children:`Category winners \u2014 best evidence finder, best explainer, and so on \u2014 with a freeze action to announce a day's standings.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Contributions Feed`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/contributions-feed`,children:(0,t.jsx)(n.code,{children:`/research/team?section=contributions`})})}),(0,t.jsx)(n.td,{children:`Every contribution kind in one scored feed; likes, saves, and endorsements feed the Leaderboard.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Daily Best Card`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/gamification/daily-best-card`,children:(0,t.jsx)(n.code,{children:`/research/cards/best-card`})})}),(0,t.jsx)(n.td,{children:`Today's highest-helpfulness card and every past day's winner.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Revision Incentives`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/gamification/revision-incentives`,children:(0,t.jsx)(n.code,{children:`/research/cards/revisions`})})}),(0,t.jsx)(n.td,{children:`Points for improving weak cards, strengthening citations, and refreshing stale evidence.`})]})]})]}),`
`,(0,t.jsx)(n.h3,{id:`9-review--is-it-ready-to-publish`,children:`9. Review \u2014 is it ready to publish?`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`https://debate-ai.com/research/team?section=reviews`,children:`Review Queue`})}),` (`,(0,t.jsx)(n.code,{children:`/research/team?section=reviews`}),`, `,(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/review-queue`,children:`spec`}),`) moves a card
through draft \u2192 in review \u2192 changes requested \u2192 approved \u2192 published. Blocking comments must be resolved
before approval.`]}),`
`,(0,t.jsx)(n.h3,{id:`10-scoring--how-good-is-it`,children:`10. Scoring \u2014 how good is it?`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`https://debate-ai.com/cards/scoring`,children:`LLM Card Scoring`})}),` (`,(0,t.jsx)(n.code,{children:`/research/cards/scoring`}),`, `,(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/llm-card-scoring`,children:`spec`}),`) scores
cards on relevance, clarity, uniqueness, evidence quality, and usability, flags likely duplicates against the
shared evidence library, and can add an AI-written qualitative verdict per card.`]}),`
`,(0,t.jsx)(n.h2,{id:`tips`,children:`Tips`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Sharing a section:`}),` the URL carries the open section, e.g. `,(0,t.jsx)(n.code,{children:`/research?section=sprint`}),`.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`One panel at a time:`}),` every chip in a section heading has an arrow that opens that panel's own page.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Notifications:`}),` assigning a prep note or a task to a teammate creates a
`,(0,t.jsx)(n.a,{href:`/docs/features/rounds/round-invites-and-notifications`,children:`notification`}),` for them at `,(0,t.jsx)(n.code,{children:`/notifications`}),`.`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};