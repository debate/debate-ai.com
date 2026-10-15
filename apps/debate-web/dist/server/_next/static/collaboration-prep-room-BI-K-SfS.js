import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Collaboration Prep Room`},r=`# Collaboration Prep Room [#collaboration-prep-room]

A topic's shared prep space: a switcher for every topic with either a
tracked-argument checklist or submitted evidence, a keyword search over
that topic's evidence and draft blocks, and the topic's coverage-gap
research tasks routed to available contributors.

- **Route:** \`/research/team?section=prep-room\`, the **[Team Research](/docs/features/research-evidence/team-research)** page's tab (the old \`/research/cards/prep-room\` redirects there)
- **Package:** \`debate-card-search\`

## What it shows [#what-it-shows]

| Element | Source |
| --- | --- |
| Topic switcher | \`listPrepRoomTopics()\` |
| Summary line | \`buildPrepRoomSummaryText\` |
| Evidence/draft-block search | \`searchPrepRoomEvidence\` |
| Routed research tasks | The room's routing assignments |
| Active-now roster | \`listPersistedActiveContributors(topic, now)\` |
| Room activity timeline | \`buildPrepRoomActivityTimeline(room)\` |

A **Shared task checklist** lets any teammate add a freeform todo item,
toggle it done, and remove it.

## Data flow [#data-flow]

\`\`\`
state/evidenceLibraryEntries.ts (localStorage)
state/trackedArguments.ts (localStorage)
state/contributorAvailability.ts (localStorage)
  \u2192 buildPersistedPrepRoom(topic) \u2014 state/prepRooms.ts
state/prepRoomChecklist.ts (localStorage) \u2014 the "Shared task checklist" section
  \u2192 panels/PrepRoomPanel.tsx
  \u2192 apps/debate-ai.com/app/cards/prep-room/page.tsx
\`\`\`

## Known gaps [#known-gaps]

- Every store the room reads (\`evidenceLibraryEntries\`, \`trackedArguments\`,
  \`contributorAvailability\`, \`prepRoomChecklist\`) syncs to a signed-in
  user's account \u2014 see Tool Data Sync \u2014
  but still per-user, not a shared team resource: each teammate's browser
  keeps its own copy rather than reading and writing one server-side room.
- No reviewer-identity/permission checks.
- No "shared file/attachment area".
`,i={contents:[{heading:`collaboration-prep-room`,content:`A topic's shared prep space: a switcher for every topic with either a
tracked-argument checklist or submitted evidence, a keyword search over
that topic's evidence and draft blocks, and the topic's coverage-gap
research tasks routed to available contributors.`},{heading:`collaboration-prep-room`,content:"**Route:** `/research/team?section=prep-room`, the **Team Research** page's tab (the old `/research/cards/prep-room` redirects there)"},{heading:`collaboration-prep-room`,content:"**Package:** `debate-card-search`"},{heading:`what-it-shows`,content:`| Element        | Source                 |
| -------------- | ---------------------- |
| Topic switcher | \`listPrepRoomTopics()\` |`,table:`table-0`},{heading:`what-it-shows`,content:`| Element      | Source                     |
| ------------ | -------------------------- |
| Summary line | \`buildPrepRoomSummaryText\` |`,table:`table-0`},{heading:`what-it-shows`,content:`| Element                     | Source                   |
| --------------------------- | ------------------------ |
| Evidence/draft-block search | \`searchPrepRoomEvidence\` |`,table:`table-0`},{heading:`what-it-shows`,content:`| Element               | Source                         |
| --------------------- | ------------------------------ |
| Routed research tasks | The room's routing assignments |`,table:`table-0`},{heading:`what-it-shows`,content:`| Element           | Source                                        |
| ----------------- | --------------------------------------------- |
| Active-now roster | \`listPersistedActiveContributors(topic, now)\` |`,table:`table-0`},{heading:`what-it-shows`,content:`| Element                | Source                                |
| ---------------------- | ------------------------------------- |
| Room activity timeline | \`buildPrepRoomActivityTimeline(room)\` |`,table:`table-0`},{heading:`what-it-shows`,content:`A **Shared task checklist** lets any teammate add a freeform todo item,
toggle it done, and remove it.`},{heading:`known-gaps`,content:"Every store the room reads (`evidenceLibraryEntries`, `trackedArguments`,\n`contributorAvailability`, `prepRoomChecklist`) syncs to a signed-in\nuser's account \u2014 see Tool Data Sync \u2014\nbut still per-user, not a shared team resource: each teammate's browser\nkeeps its own copy rather than reading and writing one server-side room."},{heading:`known-gaps`,content:`No reviewer-identity/permission checks.`},{heading:`known-gaps`,content:`No "shared file/attachment area".`}],headings:[{id:`collaboration-prep-room`,content:`Collaboration Prep Room`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#collaboration-prep-room`,title:(0,t.jsx)(t.Fragment,{children:`Collaboration Prep Room`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`collaboration-prep-room`,children:`Collaboration Prep Room`}),`
`,(0,t.jsx)(n.p,{children:`A topic's shared prep space: a switcher for every topic with either a
tracked-argument checklist or submitted evidence, a keyword search over
that topic's evidence and draft blocks, and the topic's coverage-gap
research tasks routed to available contributors.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/team?section=prep-room`}),`, the `,(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/team-research`,children:`Team Research`})}),` page's tab (the old `,(0,t.jsx)(n.code,{children:`/research/cards/prep-room`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Element`}),(0,t.jsx)(n.th,{children:`Source`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Topic switcher`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`listPrepRoomTopics()`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Summary line`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`buildPrepRoomSummaryText`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Evidence/draft-block search`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`searchPrepRoomEvidence`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Routed research tasks`}),(0,t.jsx)(n.td,{children:`The room's routing assignments`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Active-now roster`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`listPersistedActiveContributors(topic, now)`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Room activity timeline`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`buildPrepRoomActivityTimeline(room)`})})]})]})]}),`
`,(0,t.jsxs)(n.p,{children:[`A `,(0,t.jsx)(n.strong,{children:`Shared task checklist`}),` lets any teammate add a freeform todo item,
toggle it done, and remove it.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/evidenceLibraryEntries.ts (localStorage)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/trackedArguments.ts (localStorage)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/contributorAvailability.ts (localStorage)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildPersistedPrepRoom(topic) \u2014 state/prepRooms.ts`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/prepRoomChecklist.ts (localStorage) \u2014 the "Shared task checklist" section`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/PrepRoomPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/cards/prep-room/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`Every store the room reads (`,(0,t.jsx)(n.code,{children:`evidenceLibraryEntries`}),`, `,(0,t.jsx)(n.code,{children:`trackedArguments`}),`,
`,(0,t.jsx)(n.code,{children:`contributorAvailability`}),`, `,(0,t.jsx)(n.code,{children:`prepRoomChecklist`}),`) syncs to a signed-in
user's account \u2014 see Tool Data Sync \u2014
but still per-user, not a shared team resource: each teammate's browser
keeps its own copy rather than reading and writing one server-side room.`]}),`
`,(0,t.jsx)(n.li,{children:`No reviewer-identity/permission checks.`}),`
`,(0,t.jsx)(n.li,{children:`No "shared file/attachment area".`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};