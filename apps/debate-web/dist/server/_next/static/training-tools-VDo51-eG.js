import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Training tools`,description:`Coach a flowed round \u2014 argument trees, AI coaching prompts, drills, coach materials, scouting, and briefings`,icon:`Dumbbell`},r=`# Training tools [#training-tools]

The training tools turn a round you've already flowed into something to practice from. They all live in the
**[Coach Workspace](https://debate-ai.com/coach)** (\`/coaching\`), and each also has its own page. Every one of
them starts from the same input: the **current round**, meaning the flow selected in the
[round workspace](https://debate-ai.com/debate) (\`/debate\`). The Coach Workspace shows which round that is at
the top of every section, with a link to change it.

The Coach Workspace is the first tab of the [Coaching](/docs/features/ai-coaching/coaching) page. AI Coach
Mode, Coaching Programs, the Team Calendar and Coach Materials each have a tab of their own next to it, so
the "own page" for each of those is its tab.

## The workflow [#the-workflow]

1. **Flow the round** in the round workspace, or open a saved one.
2. **Read it** in the *Flow* section: the argument tree, per-argument summaries, and the exposure charts show
   what was answered, what was dropped, and where each side is vulnerable.
3. **Generate training** in the *Coaching* section: coaching prompts and drills are derived from the flowed
   arguments, so they're specific to this round rather than generic.
4. **Practice**, mark drills done, and come back for review reminders.
5. **Prep the next round** in the *Prep* and *Scouting* sections: briefings pull scouting on the opponent and
   judge together with your team's prep notes.

## Flow section [#flow-section]

| Tool | Route | What it does |
| --- | --- | --- |
| Argument Tree Outline | [\`/outline\`](/docs/features/research-evidence/argument-tree-outline) | A filterable outline of the round grouped by heading \u2014 filter by kind, side, speech, argument type, contributor, and evidence status, with an "unanswered only" toggle. |
| Speech Transcript Summaries | [\`/summaries\`](/docs/features/flow-speech/flow-summaries) | One summary per flowed argument, with suggested cross-examination questions and extension ideas. |
| AI Response-Outcome Charts | [\`/coaching/outcomes\`](/docs/features/ai-coaching/response-outcome-charts) | Per-side exposure and the most vulnerable arguments, with a "what if" picker that recomputes exposure under a hypothetical extend, answer, or concede. |
| Shared Flow Sync | \u2014 | Previews a merge of a partner's concurrent edits to the same flow and applies it back into the round workspace. See [Shared flow sync](/docs/features/flow-speech/shared-flow-sync). |
| Flow Edit Log | \u2014 | The log of partner edits Shared Flow Sync merges from. |

The four pages that act on the current round \u2014 Outline, Outcomes, Drills, and Coaching \u2014 link to each other
from a **related tools** row under their headers, so you can move between them without returning to the round
workspace.

## Coaching section [#coaching-section]

| Tool | Route | What it does |
| --- | --- | --- |
| AI Coach Mode | [\`/coaching?section=ai-coach\`](/docs/features/ai-coaching/coaching-sessions) | Extension, refutation, collapse, and weighing prompts generated from the round for one side. "Get AI feedback" expands any prompt into open-ended coaching; sessions keep a history and can be compared side by side or downloaded. |
| Practice Drills | [\`/practice/drills\`](/docs/features/tournaments-judge/drill-sets) | Overview, frontline, cross-ex, and collapse drills derived from the round, each with a difficulty rating, an optional AI-written script, a "mark practiced" toggle, and a review reminder. Practiced drills feed a practice tier. |
| Coaching Programs | [\`/coaching?section=programs\`](/docs/features/ai-coaching/coaching-programs) | A group coaching space scoped to a squad roster: a shared topic sprint, group-challenge standings, and drills on one board, plus roster analytics. |
| Coach Materials | [\`/coaching?section=materials\`](/docs/features/ai-coaching/coach-materials) | Upload \`.docx\`/\`.txt\`/\`.md\` files or dictate by voice to ground the team coach AI, and preview which materials a question would draw on. |

Drill sets and coaching sessions are saved to your account when signed in, so they follow you across devices.

## Prep section [#prep-section]

Pre-Round Briefings and Prep Notes, plus the three Scouting tools below, also share one page of their own:
the [Prep Workspace](/docs/features/rounds/prep-workspace) (\`/practice/prep\`), one tab per tool.

| Tool | Route | What it does |
| --- | --- | --- |
| Pre-Round Briefings | [\`/practice/prep?section=briefings\`](/docs/features/tournaments-judge/pre-round-briefings) | One briefing per upcoming round: opponent scouting, judge tendencies, the head-to-head record, and free-text team prep notes. |
| Prep Notes | [\`/practice/prep?section=notes\`](/docs/features/flow-speech/prep-notes) | Live prep notes across every flow, grouped needs-follow-up \u2192 open \u2192 covered. Assigning a note to a teammate sends them a [notification](/docs/features/rounds/round-invites-and-notifications). |
| Flow Annotations | [\`/annotations\`](/docs/features/flow-speech/flow-annotations) | Timestamped annotations tied to a specific flowed argument while watching a recorded round, with a jump back to the moment. |

## Scouting section [#scouting-section]

| Tool | Route | What it does |
| --- | --- | --- |
| Opponent Team Profiles | [\`/practice/prep?section=opponents\`](/docs/features/tournaments-judge/opponent-team-profiles) | Records, Aff/Neg side tendencies, and the arguments and cases a team runs most. |
| Judge Profiles | [\`/practice/prep?section=judges\`](/docs/features/tournaments-judge/judge-profiles) | Side-vote bias, average speaker points, speed tolerance, and theory receptiveness for every saved judge. |
| Scout-to-Strategy | [\`/practice/prep?section=strategy\`](/docs/features/ai-coaching/scout-to-strategy) | Turns those two profiles into a ranked list of case options with a judge-adaptation note each, and a matchup risk level. |

## Practice section [#practice-section]

The Coach Workspace's fifth section holds the practice tools \u2014 simulated rounds, rounds against the AI, and
the paradigm and persona pickers they use. Those are covered in the [Practice tools](/docs/features/rounds/practice-tools)
guide.

## Tips [#tips]

- **Nothing to generate?** Every "Generate \u2026 for current round" action is disabled until a round is selected.
  The current-round bar at the top of the Coach Workspace says which round is selected and links to
  \`/debate\` to flow or pick one.
- **Working on one tool?** Open it as its own page from the chip in the section heading; the standalone page
  has the same data and a lighter layout.
- **Sharing a section:** the URL carries the open stage, e.g. \`/coaching?stage=coaching\`. Older links that put the stage in \`?section=\` still open it.
`,i={contents:[{heading:`training-tools`,content:`The training tools turn a round you've already flowed into something to practice from. They all live in the
**Coach Workspace** (\`/coaching\`), and each also has its own page. Every one of
them starts from the same input: the **current round**, meaning the flow selected in the
round workspace (\`/debate\`). The Coach Workspace shows which round that is at
the top of every section, with a link to change it.`},{heading:`training-tools`,content:`The Coach Workspace is the first tab of the Coaching page. AI Coach
Mode, Coaching Programs, the Team Calendar and Coach Materials each have a tab of their own next to it, so
the "own page" for each of those is its tab.`},{heading:`the-workflow`,content:`**Flow the round** in the round workspace, or open a saved one.`},{heading:`the-workflow`,content:`**Read it** in the *Flow* section: the argument tree, per-argument summaries, and the exposure charts show
what was answered, what was dropped, and where each side is vulnerable.`},{heading:`the-workflow`,content:`**Generate training** in the *Coaching* section: coaching prompts and drills are derived from the flowed
arguments, so they're specific to this round rather than generic.`},{heading:`the-workflow`,content:`**Practice**, mark drills done, and come back for review reminders.`},{heading:`the-workflow`,content:`**Prep the next round** in the *Prep* and *Scouting* sections: briefings pull scouting on the opponent and
judge together with your team's prep notes.`},{heading:`flow-section`,content:`| Tool                  | Route      | What it does                                                                                                                                                            |
| --------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Argument Tree Outline | \`/outline\` | A filterable outline of the round grouped by heading \u2014 filter by kind, side, speech, argument type, contributor, and evidence status, with an "unanswered only" toggle. |`,table:`table-0`},{heading:`flow-section`,content:`| Tool                        | Route        | What it does                                                                                     |
| --------------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| Speech Transcript Summaries | \`/summaries\` | One summary per flowed argument, with suggested cross-examination questions and extension ideas. |`,table:`table-0`},{heading:`flow-section`,content:`| Tool                       | Route                | What it does                                                                                                                                           |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AI Response-Outcome Charts | \`/coaching/outcomes\` | Per-side exposure and the most vulnerable arguments, with a "what if" picker that recomputes exposure under a hypothetical extend, answer, or concede. |`,table:`table-0`},{heading:`flow-section`,content:`| Tool             | Route | What it does                                                                                                                          |
| ---------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Shared Flow Sync | \u2014     | Previews a merge of a partner's concurrent edits to the same flow and applies it back into the round workspace. See Shared flow sync. |`,table:`table-0`},{heading:`flow-section`,content:`| Tool          | Route | What it does                                           |
| ------------- | ----- | ------------------------------------------------------ |
| Flow Edit Log | \u2014     | The log of partner edits Shared Flow Sync merges from. |`,table:`table-0`},{heading:`flow-section`,content:`The four pages that act on the current round \u2014 Outline, Outcomes, Drills, and Coaching \u2014 link to each other
from a **related tools** row under their headers, so you can move between them without returning to the round
workspace.`},{heading:`coaching-section`,content:`| Tool          | Route                        | What it does                                                                                                                                                                                                                        |
| ------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI Coach Mode | \`/coaching?section=ai-coach\` | Extension, refutation, collapse, and weighing prompts generated from the round for one side. "Get AI feedback" expands any prompt into open-ended coaching; sessions keep a history and can be compared side by side or downloaded. |`,table:`table-1`},{heading:`coaching-section`,content:`| Tool            | Route              | What it does                                                                                                                                                                                                                      |
| --------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Practice Drills | \`/practice/drills\` | Overview, frontline, cross-ex, and collapse drills derived from the round, each with a difficulty rating, an optional AI-written script, a "mark practiced" toggle, and a review reminder. Practiced drills feed a practice tier. |`,table:`table-1`},{heading:`coaching-section`,content:`| Tool              | Route                        | What it does                                                                                                                                       |
| ----------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coaching Programs | \`/coaching?section=programs\` | A group coaching space scoped to a squad roster: a shared topic sprint, group-challenge standings, and drills on one board, plus roster analytics. |`,table:`table-1`},{heading:`coaching-section`,content:"| Tool            | Route                         | What it does                                                                                                                             |\n| --------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |\n| Coach Materials | `/coaching?section=materials` | Upload `.docx`/`.txt`/`.md` files or dictate by voice to ground the team coach AI, and preview which materials a question would draw on. |",table:`table-1`},{heading:`coaching-section`,content:`Drill sets and coaching sessions are saved to your account when signed in, so they follow you across devices.`},{heading:`prep-section`,content:"Pre-Round Briefings and Prep Notes, plus the three Scouting tools below, also share one page of their own:\nthe Prep Workspace (`/practice/prep`), one tab per tool."},{heading:`prep-section`,content:`| Tool                | Route                              | What it does                                                                                                                  |
| ------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Pre-Round Briefings | \`/practice/prep?section=briefings\` | One briefing per upcoming round: opponent scouting, judge tendencies, the head-to-head record, and free-text team prep notes. |`,table:`table-2`},{heading:`prep-section`,content:`| Tool       | Route                          | What it does                                                                                                                           |
| ---------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Prep Notes | \`/practice/prep?section=notes\` | Live prep notes across every flow, grouped needs-follow-up \u2192 open \u2192 covered. Assigning a note to a teammate sends them a notification. |`,table:`table-2`},{heading:`prep-section`,content:`| Tool             | Route          | What it does                                                                                                                |
| ---------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Flow Annotations | \`/annotations\` | Timestamped annotations tied to a specific flowed argument while watching a recorded round, with a jump back to the moment. |`,table:`table-2`},{heading:`scouting-section`,content:`| Tool                   | Route                              | What it does                                                                    |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| Opponent Team Profiles | \`/practice/prep?section=opponents\` | Records, Aff/Neg side tendencies, and the arguments and cases a team runs most. |`,table:`table-3`},{heading:`scouting-section`,content:`| Tool           | Route                           | What it does                                                                                             |
| -------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Judge Profiles | \`/practice/prep?section=judges\` | Side-vote bias, average speaker points, speed tolerance, and theory receptiveness for every saved judge. |`,table:`table-3`},{heading:`scouting-section`,content:`| Tool              | Route                             | What it does                                                                                                             |
| ----------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Scout-to-Strategy | \`/practice/prep?section=strategy\` | Turns those two profiles into a ranked list of case options with a judge-adaptation note each, and a matchup risk level. |`,table:`table-3`},{heading:`practice-section`,content:`The Coach Workspace's fifth section holds the practice tools \u2014 simulated rounds, rounds against the AI, and
the paradigm and persona pickers they use. Those are covered in the Practice tools
guide.`},{heading:`tips`,content:`**Nothing to generate?** Every "Generate \u2026 for current round" action is disabled until a round is selected.
The current-round bar at the top of the Coach Workspace says which round is selected and links to
\`/debate\` to flow or pick one.`},{heading:`tips`,content:`**Working on one tool?** Open it as its own page from the chip in the section heading; the standalone page
has the same data and a lighter layout.`},{heading:`tips`,content:"**Sharing a section:** the URL carries the open stage, e.g. `/coaching?stage=coaching`. Older links that put the stage in `?section=` still open it."}],headings:[{id:`training-tools`,content:`Training tools`},{id:`the-workflow`,content:`The workflow`},{id:`flow-section`,content:`Flow section`},{id:`coaching-section`,content:`Coaching section`},{id:`prep-section`,content:`Prep section`},{id:`scouting-section`,content:`Scouting section`},{id:`practice-section`,content:`Practice section`},{id:`tips`,content:`Tips`}]},a=[{depth:1,url:`#training-tools`,title:(0,t.jsx)(t.Fragment,{children:`Training tools`})},{depth:2,url:`#the-workflow`,title:(0,t.jsx)(t.Fragment,{children:`The workflow`})},{depth:2,url:`#flow-section`,title:(0,t.jsx)(t.Fragment,{children:`Flow section`})},{depth:2,url:`#coaching-section`,title:(0,t.jsx)(t.Fragment,{children:`Coaching section`})},{depth:2,url:`#prep-section`,title:(0,t.jsx)(t.Fragment,{children:`Prep section`})},{depth:2,url:`#scouting-section`,title:(0,t.jsx)(t.Fragment,{children:`Scouting section`})},{depth:2,url:`#practice-section`,title:(0,t.jsx)(t.Fragment,{children:`Practice section`})},{depth:2,url:`#tips`,title:(0,t.jsx)(t.Fragment,{children:`Tips`})}];function o(e){let n={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,li:`li`,ol:`ol`,p:`p`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`training-tools`,children:`Training tools`}),`
`,(0,t.jsxs)(n.p,{children:[`The training tools turn a round you've already flowed into something to practice from. They all live in the
`,(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`https://debate-ai.com/coach`,children:`Coach Workspace`})}),` (`,(0,t.jsx)(n.code,{children:`/coaching`}),`), and each also has its own page. Every one of
them starts from the same input: the `,(0,t.jsx)(n.strong,{children:`current round`}),`, meaning the flow selected in the
`,(0,t.jsx)(n.a,{href:`https://debate-ai.com/debate`,children:`round workspace`}),` (`,(0,t.jsx)(n.code,{children:`/debate`}),`). The Coach Workspace shows which round that is at
the top of every section, with a link to change it.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The Coach Workspace is the first tab of the `,(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/coaching`,children:`Coaching`}),` page. AI Coach
Mode, Coaching Programs, the Team Calendar and Coach Materials each have a tab of their own next to it, so
the "own page" for each of those is its tab.`]}),`
`,(0,t.jsx)(n.h2,{id:`the-workflow`,children:`The workflow`}),`
`,(0,t.jsxs)(n.ol,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Flow the round`}),` in the round workspace, or open a saved one.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Read it`}),` in the `,(0,t.jsx)(n.em,{children:`Flow`}),` section: the argument tree, per-argument summaries, and the exposure charts show
what was answered, what was dropped, and where each side is vulnerable.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Generate training`}),` in the `,(0,t.jsx)(n.em,{children:`Coaching`}),` section: coaching prompts and drills are derived from the flowed
arguments, so they're specific to this round rather than generic.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Practice`}),`, mark drills done, and come back for review reminders.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Prep the next round`}),` in the `,(0,t.jsx)(n.em,{children:`Prep`}),` and `,(0,t.jsx)(n.em,{children:`Scouting`}),` sections: briefings pull scouting on the opponent and
judge together with your team's prep notes.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`flow-section`,children:`Flow section`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Tool`}),(0,t.jsx)(n.th,{children:`Route`}),(0,t.jsx)(n.th,{children:`What it does`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Argument Tree Outline`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/argument-tree-outline`,children:(0,t.jsx)(n.code,{children:`/outline`})})}),(0,t.jsx)(n.td,{children:`A filterable outline of the round grouped by heading \u2014 filter by kind, side, speech, argument type, contributor, and evidence status, with an "unanswered only" toggle.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Speech Transcript Summaries`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/flow-speech/flow-summaries`,children:(0,t.jsx)(n.code,{children:`/summaries`})})}),(0,t.jsx)(n.td,{children:`One summary per flowed argument, with suggested cross-examination questions and extension ideas.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`AI Response-Outcome Charts`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/response-outcome-charts`,children:(0,t.jsx)(n.code,{children:`/coaching/outcomes`})})}),(0,t.jsx)(n.td,{children:`Per-side exposure and the most vulnerable arguments, with a "what if" picker that recomputes exposure under a hypothetical extend, answer, or concede.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Shared Flow Sync`}),(0,t.jsx)(n.td,{children:`\u2014`}),(0,t.jsxs)(n.td,{children:[`Previews a merge of a partner's concurrent edits to the same flow and applies it back into the round workspace. See `,(0,t.jsx)(n.a,{href:`/docs/features/flow-speech/shared-flow-sync`,children:`Shared flow sync`}),`.`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Flow Edit Log`}),(0,t.jsx)(n.td,{children:`\u2014`}),(0,t.jsx)(n.td,{children:`The log of partner edits Shared Flow Sync merges from.`})]})]})]}),`
`,(0,t.jsxs)(n.p,{children:[`The four pages that act on the current round \u2014 Outline, Outcomes, Drills, and Coaching \u2014 link to each other
from a `,(0,t.jsx)(n.strong,{children:`related tools`}),` row under their headers, so you can move between them without returning to the round
workspace.`]}),`
`,(0,t.jsx)(n.h2,{id:`coaching-section`,children:`Coaching section`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Tool`}),(0,t.jsx)(n.th,{children:`Route`}),(0,t.jsx)(n.th,{children:`What it does`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`AI Coach Mode`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/coaching-sessions`,children:(0,t.jsx)(n.code,{children:`/coaching?section=ai-coach`})})}),(0,t.jsx)(n.td,{children:`Extension, refutation, collapse, and weighing prompts generated from the round for one side. "Get AI feedback" expands any prompt into open-ended coaching; sessions keep a history and can be compared side by side or downloaded.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Practice Drills`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/tournaments-judge/drill-sets`,children:(0,t.jsx)(n.code,{children:`/practice/drills`})})}),(0,t.jsx)(n.td,{children:`Overview, frontline, cross-ex, and collapse drills derived from the round, each with a difficulty rating, an optional AI-written script, a "mark practiced" toggle, and a review reminder. Practiced drills feed a practice tier.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Coaching Programs`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/coaching-programs`,children:(0,t.jsx)(n.code,{children:`/coaching?section=programs`})})}),(0,t.jsx)(n.td,{children:`A group coaching space scoped to a squad roster: a shared topic sprint, group-challenge standings, and drills on one board, plus roster analytics.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Coach Materials`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/coach-materials`,children:(0,t.jsx)(n.code,{children:`/coaching?section=materials`})})}),(0,t.jsxs)(n.td,{children:[`Upload `,(0,t.jsx)(n.code,{children:`.docx`}),`/`,(0,t.jsx)(n.code,{children:`.txt`}),`/`,(0,t.jsx)(n.code,{children:`.md`}),` files or dictate by voice to ground the team coach AI, and preview which materials a question would draw on.`]})]})]})]}),`
`,(0,t.jsx)(n.p,{children:`Drill sets and coaching sessions are saved to your account when signed in, so they follow you across devices.`}),`
`,(0,t.jsx)(n.h2,{id:`prep-section`,children:`Prep section`}),`
`,(0,t.jsxs)(n.p,{children:[`Pre-Round Briefings and Prep Notes, plus the three Scouting tools below, also share one page of their own:
the `,(0,t.jsx)(n.a,{href:`/docs/features/rounds/prep-workspace`,children:`Prep Workspace`}),` (`,(0,t.jsx)(n.code,{children:`/practice/prep`}),`), one tab per tool.`]}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Tool`}),(0,t.jsx)(n.th,{children:`Route`}),(0,t.jsx)(n.th,{children:`What it does`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Pre-Round Briefings`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/tournaments-judge/pre-round-briefings`,children:(0,t.jsx)(n.code,{children:`/practice/prep?section=briefings`})})}),(0,t.jsx)(n.td,{children:`One briefing per upcoming round: opponent scouting, judge tendencies, the head-to-head record, and free-text team prep notes.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Prep Notes`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/flow-speech/prep-notes`,children:(0,t.jsx)(n.code,{children:`/practice/prep?section=notes`})})}),(0,t.jsxs)(n.td,{children:[`Live prep notes across every flow, grouped needs-follow-up \u2192 open \u2192 covered. Assigning a note to a teammate sends them a `,(0,t.jsx)(n.a,{href:`/docs/features/rounds/round-invites-and-notifications`,children:`notification`}),`.`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Flow Annotations`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/flow-speech/flow-annotations`,children:(0,t.jsx)(n.code,{children:`/annotations`})})}),(0,t.jsx)(n.td,{children:`Timestamped annotations tied to a specific flowed argument while watching a recorded round, with a jump back to the moment.`})]})]})]}),`
`,(0,t.jsx)(n.h2,{id:`scouting-section`,children:`Scouting section`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Tool`}),(0,t.jsx)(n.th,{children:`Route`}),(0,t.jsx)(n.th,{children:`What it does`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Opponent Team Profiles`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/tournaments-judge/opponent-team-profiles`,children:(0,t.jsx)(n.code,{children:`/practice/prep?section=opponents`})})}),(0,t.jsx)(n.td,{children:`Records, Aff/Neg side tendencies, and the arguments and cases a team runs most.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Judge Profiles`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/tournaments-judge/judge-profiles`,children:(0,t.jsx)(n.code,{children:`/practice/prep?section=judges`})})}),(0,t.jsx)(n.td,{children:`Side-vote bias, average speaker points, speed tolerance, and theory receptiveness for every saved judge.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Scout-to-Strategy`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/scout-to-strategy`,children:(0,t.jsx)(n.code,{children:`/practice/prep?section=strategy`})})}),(0,t.jsx)(n.td,{children:`Turns those two profiles into a ranked list of case options with a judge-adaptation note each, and a matchup risk level.`})]})]})]}),`
`,(0,t.jsx)(n.h2,{id:`practice-section`,children:`Practice section`}),`
`,(0,t.jsxs)(n.p,{children:[`The Coach Workspace's fifth section holds the practice tools \u2014 simulated rounds, rounds against the AI, and
the paradigm and persona pickers they use. Those are covered in the `,(0,t.jsx)(n.a,{href:`/docs/features/rounds/practice-tools`,children:`Practice tools`}),`
guide.`]}),`
`,(0,t.jsx)(n.h2,{id:`tips`,children:`Tips`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Nothing to generate?`}),` Every "Generate \u2026 for current round" action is disabled until a round is selected.
The current-round bar at the top of the Coach Workspace says which round is selected and links to
`,(0,t.jsx)(n.code,{children:`/debate`}),` to flow or pick one.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Working on one tool?`}),` Open it as its own page from the chip in the section heading; the standalone page
has the same data and a lighter layout.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Sharing a section:`}),` the URL carries the open stage, e.g. `,(0,t.jsx)(n.code,{children:`/coaching?stage=coaching`}),`. Older links that put the stage in `,(0,t.jsx)(n.code,{children:`?section=`}),` still open it.`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};