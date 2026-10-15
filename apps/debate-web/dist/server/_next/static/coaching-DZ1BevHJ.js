import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Coaching`},r=`# Coaching [#coaching]

One page for a coach's tools. Five tools that used to have their own pages
and sidebar entries sit side by side, one tab each:

| Tab | \`?section=\` | What it does |
| --- | --- | --- |
| [Coach Workspace](/docs/features/tournaments-judge/training-tools) | \`workspace\` | Every round and coaching panel, grouped by stage of a round: flow, coaching, prep, scouting, and practice. |
| [AI Coach Mode](/docs/features/ai-coaching/coaching-sessions) | \`ai-coach\` | Extension, refutation, collapse, and weighing prompts generated from each round's flow. |
| [Coaching Programs](/docs/features/ai-coaching/coaching-programs) | \`programs\` | Group coaching spaces scoped to a squad roster, with roster analytics and drill reviews. |
| [Team Calendar](/docs/features/team-collaboration/team-calendar) | \`calendar\` | Research tasks, assignments, deadlines, and group-only virtual tournaments for each group you coach. |
| [Coach Materials](/docs/features/ai-coaching/coach-materials) | \`materials\` | Grounding materials for the team coach AI, with a preview of which ones answer a question. |

- **Route:** \`/coaching\`, listed in the sidebar's **Coaching** section as
  Coach Workspace
- **Package:** \`debate-webview\` (\`components/coach/CoachingWorkspace.tsx\`)
  over panels from \`debate-practice-rounds\`, \`debate-team-collaboration\`
  and \`debate-speech-writer\`

## Sample data [#sample-data]

**Load sample data**, at the top of the page, fills the Coach Workspace with
a demo built from real cards in the card database: opponent team and judge
scouting records with their profiles, and a sample round flowed from those
cards (aff cards as 1AC arguments, neg cards answering them). The sample
round is selected while the page is open, so every "Generate \u2026 for current
round" action works on it.

The sample stays in this browser and is never saved to your account. It is
added beside your own records and never replaces one, and **Clear sample
data** removes only the sample. The sample round is never saved with your
flows: it leaves the round workspace when you leave the page.

## Old addresses [#old-addresses]

Each tool used to have its own page. Those addresses still work and
permanently redirect to the matching tab:

| Old route | Now |
| --- | --- |
| \`/coaching/ai-coach\` | \`/coaching?section=ai-coach\` |
| \`/coaching/programs\` | \`/coaching?section=programs\` |
| \`/coaching/calendar\` | \`/coaching?section=calendar\` |
| \`/coaching/materials\` | \`/coaching?section=materials\` |

## How it works [#how-it-works]

The page is navigation only: each tab mounts the same panel the old page
did, and each panel still reads and writes its own store, so coaching
sessions, programs, calendar items and coach materials carry over unchanged
and keep syncing to your account. The open tab is kept in \`?section=\` (so a
tab can be shared or bookmarked) and remembered in this browser for the next
visit. The tab strip is the same one Team Research and the Prep Workspace use
(\`components/hubs/HubSectionNav.tsx\`).

The Coach Workspace tab keeps its own stage strip (Flow, Coaching, Prep,
Scouting, Practice) under \`?stage=\`, since \`?section=\` belongs to the page's
tabs. Links from before the page had tabs, such as \`/coaching?section=practice\`,
still open the Coach Workspace on that stage.

Outside Next (the browser extension's router), the old routes render this
page opened on their tab instead of redirecting.

## Known gaps [#known-gaps]

- The sample covers scouting and the sample round only; AI Coach Mode,
  Coaching Programs, the Team Calendar and Coach Materials start empty.
- Editing a sample record keeps it local: it never syncs, and clearing the
  sample removes it with your edit.

- AI Coach Mode lost its "Other round tools" cross-link row when it became a
  tab; Outline, Outcomes and Drills still link to it.
- Opening a saved record from the Tools page's recent-items list lands on
  the tab its tool lives in, not on the record itself.
`,i={contents:[{heading:`coaching`,content:`One page for a coach's tools. Five tools that used to have their own pages
and sidebar entries sit side by side, one tab each:`},{heading:`coaching`,content:"| Tab             | `?section=` | What it does                                                                                               |\n| --------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |\n| Coach Workspace | `workspace` | Every round and coaching panel, grouped by stage of a round: flow, coaching, prep, scouting, and practice. |",table:`table-0`},{heading:`coaching`,content:"| Tab           | `?section=` | What it does                                                                            |\n| ------------- | ----------- | --------------------------------------------------------------------------------------- |\n| AI Coach Mode | `ai-coach`  | Extension, refutation, collapse, and weighing prompts generated from each round's flow. |",table:`table-0`},{heading:`coaching`,content:"| Tab               | `?section=` | What it does                                                                             |\n| ----------------- | ----------- | ---------------------------------------------------------------------------------------- |\n| Coaching Programs | `programs`  | Group coaching spaces scoped to a squad roster, with roster analytics and drill reviews. |",table:`table-0`},{heading:`coaching`,content:"| Tab           | `?section=` | What it does                                                                                         |\n| ------------- | ----------- | ---------------------------------------------------------------------------------------------------- |\n| Team Calendar | `calendar`  | Research tasks, assignments, deadlines, and group-only virtual tournaments for each group you coach. |",table:`table-0`},{heading:`coaching`,content:"| Tab             | `?section=` | What it does                                                                               |\n| --------------- | ----------- | ------------------------------------------------------------------------------------------ |\n| Coach Materials | `materials` | Grounding materials for the team coach AI, with a preview of which ones answer a question. |",table:`table-0`},{heading:`coaching`,content:"**Route:** `/coaching`, listed in the sidebar's **Coaching** section as\nCoach Workspace"},{heading:`coaching`,content:"**Package:** `debate-webview` (`components/coach/CoachingWorkspace.tsx`)\nover panels from `debate-practice-rounds`, `debate-team-collaboration`\nand `debate-speech-writer`"},{heading:`sample-data`,content:`**Load sample data**, at the top of the page, fills the Coach Workspace with
a demo built from real cards in the card database: opponent team and judge
scouting records with their profiles, and a sample round flowed from those
cards (aff cards as 1AC arguments, neg cards answering them). The sample
round is selected while the page is open, so every "Generate \u2026 for current
round" action works on it.`},{heading:`sample-data`,content:`The sample stays in this browser and is never saved to your account. It is
added beside your own records and never replaces one, and **Clear sample
data** removes only the sample. The sample round is never saved with your
flows: it leaves the round workspace when you leave the page.`},{heading:`old-addresses`,content:`Each tool used to have its own page. Those addresses still work and
permanently redirect to the matching tab:`},{heading:`old-addresses`,content:"| Old route            | Now                          |\n| -------------------- | ---------------------------- |\n| `/coaching/ai-coach` | `/coaching?section=ai-coach` |",table:`table-1`},{heading:`old-addresses`,content:"| Old route            | Now                          |\n| -------------------- | ---------------------------- |\n| `/coaching/programs` | `/coaching?section=programs` |",table:`table-1`},{heading:`old-addresses`,content:"| Old route            | Now                          |\n| -------------------- | ---------------------------- |\n| `/coaching/calendar` | `/coaching?section=calendar` |",table:`table-1`},{heading:`old-addresses`,content:"| Old route             | Now                           |\n| --------------------- | ----------------------------- |\n| `/coaching/materials` | `/coaching?section=materials` |",table:`table-1`},{heading:`how-it-works`,content:`The page is navigation only: each tab mounts the same panel the old page
did, and each panel still reads and writes its own store, so coaching
sessions, programs, calendar items and coach materials carry over unchanged
and keep syncing to your account. The open tab is kept in \`?section=\` (so a
tab can be shared or bookmarked) and remembered in this browser for the next
visit. The tab strip is the same one Team Research and the Prep Workspace use
(\`components/hubs/HubSectionNav.tsx\`).`},{heading:`how-it-works`,content:"The Coach Workspace tab keeps its own stage strip (Flow, Coaching, Prep,\nScouting, Practice) under `?stage=`, since `?section=` belongs to the page's\ntabs. Links from before the page had tabs, such as `/coaching?section=practice`,\nstill open the Coach Workspace on that stage."},{heading:`how-it-works`,content:`Outside Next (the browser extension's router), the old routes render this
page opened on their tab instead of redirecting.`},{heading:`known-gaps`,content:`The sample covers scouting and the sample round only; AI Coach Mode,
Coaching Programs, the Team Calendar and Coach Materials start empty.`},{heading:`known-gaps`,content:`Editing a sample record keeps it local: it never syncs, and clearing the
sample removes it with your edit.`},{heading:`known-gaps`,content:`AI Coach Mode lost its "Other round tools" cross-link row when it became a
tab; Outline, Outcomes and Drills still link to it.`},{heading:`known-gaps`,content:`Opening a saved record from the Tools page's recent-items list lands on
the tab its tool lives in, not on the record itself.`}],headings:[{id:`coaching`,content:`Coaching`},{id:`sample-data`,content:`Sample data`},{id:`old-addresses`,content:`Old addresses`},{id:`how-it-works`,content:`How it works`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#coaching`,title:(0,t.jsx)(t.Fragment,{children:`Coaching`})},{depth:2,url:`#sample-data`,title:(0,t.jsx)(t.Fragment,{children:`Sample data`})},{depth:2,url:`#old-addresses`,title:(0,t.jsx)(t.Fragment,{children:`Old addresses`})},{depth:2,url:`#how-it-works`,title:(0,t.jsx)(t.Fragment,{children:`How it works`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`coaching`,children:`Coaching`}),`
`,(0,t.jsx)(n.p,{children:`One page for a coach's tools. Five tools that used to have their own pages
and sidebar entries sit side by side, one tab each:`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Tab`}),(0,t.jsx)(n.th,{children:(0,t.jsx)(n.code,{children:`?section=`})}),(0,t.jsx)(n.th,{children:`What it does`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/tournaments-judge/training-tools`,children:`Coach Workspace`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`workspace`})}),(0,t.jsx)(n.td,{children:`Every round and coaching panel, grouped by stage of a round: flow, coaching, prep, scouting, and practice.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/coaching-sessions`,children:`AI Coach Mode`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`ai-coach`})}),(0,t.jsx)(n.td,{children:`Extension, refutation, collapse, and weighing prompts generated from each round's flow.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/coaching-programs`,children:`Coaching Programs`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`programs`})}),(0,t.jsx)(n.td,{children:`Group coaching spaces scoped to a squad roster, with roster analytics and drill reviews.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/team-calendar`,children:`Team Calendar`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`calendar`})}),(0,t.jsx)(n.td,{children:`Research tasks, assignments, deadlines, and group-only virtual tournaments for each group you coach.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/coach-materials`,children:`Coach Materials`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`materials`})}),(0,t.jsx)(n.td,{children:`Grounding materials for the team coach AI, with a preview of which ones answer a question.`})]})]})]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/coaching`}),`, listed in the sidebar's `,(0,t.jsx)(n.strong,{children:`Coaching`}),` section as
Coach Workspace`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-webview`}),` (`,(0,t.jsx)(n.code,{children:`components/coach/CoachingWorkspace.tsx`}),`)
over panels from `,(0,t.jsx)(n.code,{children:`debate-practice-rounds`}),`, `,(0,t.jsx)(n.code,{children:`debate-team-collaboration`}),`
and `,(0,t.jsx)(n.code,{children:`debate-speech-writer`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`sample-data`,children:`Sample data`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Load sample data`}),`, at the top of the page, fills the Coach Workspace with
a demo built from real cards in the card database: opponent team and judge
scouting records with their profiles, and a sample round flowed from those
cards (aff cards as 1AC arguments, neg cards answering them). The sample
round is selected while the page is open, so every "Generate \u2026 for current
round" action works on it.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The sample stays in this browser and is never saved to your account. It is
added beside your own records and never replaces one, and `,(0,t.jsx)(n.strong,{children:`Clear sample
data`}),` removes only the sample. The sample round is never saved with your
flows: it leaves the round workspace when you leave the page.`]}),`
`,(0,t.jsx)(n.h2,{id:`old-addresses`,children:`Old addresses`}),`
`,(0,t.jsx)(n.p,{children:`Each tool used to have its own page. Those addresses still work and
permanently redirect to the matching tab:`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Old route`}),(0,t.jsx)(n.th,{children:`Now`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/coaching/ai-coach`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/coaching?section=ai-coach`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/coaching/programs`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/coaching?section=programs`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/coaching/calendar`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/coaching?section=calendar`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/coaching/materials`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/coaching?section=materials`})})]})]})]}),`
`,(0,t.jsx)(n.h2,{id:`how-it-works`,children:`How it works`}),`
`,(0,t.jsxs)(n.p,{children:[`The page is navigation only: each tab mounts the same panel the old page
did, and each panel still reads and writes its own store, so coaching
sessions, programs, calendar items and coach materials carry over unchanged
and keep syncing to your account. The open tab is kept in `,(0,t.jsx)(n.code,{children:`?section=`}),` (so a
tab can be shared or bookmarked) and remembered in this browser for the next
visit. The tab strip is the same one Team Research and the Prep Workspace use
(`,(0,t.jsx)(n.code,{children:`components/hubs/HubSectionNav.tsx`}),`).`]}),`
`,(0,t.jsxs)(n.p,{children:[`The Coach Workspace tab keeps its own stage strip (Flow, Coaching, Prep,
Scouting, Practice) under `,(0,t.jsx)(n.code,{children:`?stage=`}),`, since `,(0,t.jsx)(n.code,{children:`?section=`}),` belongs to the page's
tabs. Links from before the page had tabs, such as `,(0,t.jsx)(n.code,{children:`/coaching?section=practice`}),`,
still open the Coach Workspace on that stage.`]}),`
`,(0,t.jsx)(n.p,{children:`Outside Next (the browser extension's router), the old routes render this
page opened on their tab instead of redirecting.`}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsx)(n.p,{children:`The sample covers scouting and the sample round only; AI Coach Mode,
Coaching Programs, the Team Calendar and Coach Materials start empty.`}),`
`]}),`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsx)(n.p,{children:`Editing a sample record keeps it local: it never syncs, and clearing the
sample removes it with your edit.`}),`
`]}),`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsx)(n.p,{children:`AI Coach Mode lost its "Other round tools" cross-link row when it became a
tab; Outline, Outcomes and Drills still link to it.`}),`
`]}),`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsx)(n.p,{children:`Opening a saved record from the Tools page's recent-items list lands on
the tab its tool lives in, not on the record itself.`}),`
`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};