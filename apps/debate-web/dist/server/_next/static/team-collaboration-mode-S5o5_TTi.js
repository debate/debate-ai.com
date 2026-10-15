import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Team Collaboration Mode`},r=`# Team Collaboration Mode [#team-collaboration-mode]

Lets a teammate leave a live prep note against a shared topic sprint, and
shows every persisted \`SprintNote\` grouped by topic.

- **Route:** \`/research/cards/collaboration\`
- **Package:** \`debate-card-search\`

## What it shows [#what-it-shows]

A form to add a note, notes grouped by topic with status-cycle and
assign/unassign actions, a live "active now" roster (per-topic presence
heartbeat), and (via \`TopicSprintPanel\`) a full topic sprint composition
(quests, task routing, progress board, notes) plus an **End-of-sprint
retrospective** download.

## Data flow [#data-flow]

\`\`\`
state/sprintNotes.ts (localStorage: sprintNotes)
  \u2192 buildSprintNotesPanelView()
  \u2192 panels/SprintNotesPanel.tsx
  \u2192 apps/debate-ai.com/app/cards/collaboration/page.tsx

state/topicSprints.ts \u2192 buildPersistedTopicSprint(topic)
\`\`\`

## Known gaps [#known-gaps]

All id fields are still free-form text \u2014 a signed-in session only
prefills them.
`,i={contents:[{heading:`team-collaboration-mode`,content:"Lets a teammate leave a live prep note against a shared topic sprint, and\nshows every persisted `SprintNote` grouped by topic."},{heading:`team-collaboration-mode`,content:"**Route:** `/research/cards/collaboration`"},{heading:`team-collaboration-mode`,content:"**Package:** `debate-card-search`"},{heading:`what-it-shows`,content:`A form to add a note, notes grouped by topic with status-cycle and
assign/unassign actions, a live "active now" roster (per-topic presence
heartbeat), and (via \`TopicSprintPanel\`) a full topic sprint composition
(quests, task routing, progress board, notes) plus an **End-of-sprint
retrospective** download.`},{heading:`known-gaps`,content:`All id fields are still free-form text \u2014 a signed-in session only
prefills them.`}],headings:[{id:`team-collaboration-mode`,content:`Team Collaboration Mode`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#team-collaboration-mode`,title:(0,t.jsx)(t.Fragment,{children:`Team Collaboration Mode`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`team-collaboration-mode`,children:`Team Collaboration Mode`}),`
`,(0,t.jsxs)(n.p,{children:[`Lets a teammate leave a live prep note against a shared topic sprint, and
shows every persisted `,(0,t.jsx)(n.code,{children:`SprintNote`}),` grouped by topic.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/cards/collaboration`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`A form to add a note, notes grouped by topic with status-cycle and
assign/unassign actions, a live "active now" roster (per-topic presence
heartbeat), and (via `,(0,t.jsx)(n.code,{children:`TopicSprintPanel`}),`) a full topic sprint composition
(quests, task routing, progress board, notes) plus an `,(0,t.jsx)(n.strong,{children:`End-of-sprint
retrospective`}),` download.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/sprintNotes.ts (localStorage: sprintNotes)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildSprintNotesPanelView()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/SprintNotesPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/cards/collaboration/page.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/topicSprints.ts \u2192 buildPersistedTopicSprint(topic)`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`All id fields are still free-form text \u2014 a signed-in session only
prefills them.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};