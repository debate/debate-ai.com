import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Shared, AI-Generated Debate Flow`},r=`# Shared, Ai-Generated Debate Flow \u2014 Flow Edit Log + Sync [#shared-ai-generated-debate-flow--flow-edit-log--sync]

Lets a contributor log a proposed edit to a specific flow argument and
previews how every logged edit merges into the round's flow, flagging
genuinely concurrent, diverging edits for a human to resolve.

- **Where:** the Coach hub's Flow section (\`/coaching\`)
- **Package:** \`debate-round\`

## What it shows [#what-it-shows]

A **Flow Edit Log** form, grouped by flow, with a merge preview
(**Shared Flow Sync**) showing how many boxes would update and flagging
conflicts. A "Live sync" toggle turns on a D1-backed short-poll transport
sharing edits across contributors' browsers, plus a "who's editing now"
presence indicator. Conflicts render as a word-level side-by-side diff.

## Data flow [#data-flow]

\`\`\`
flow/shared-flow-sync.ts \u2014 createFlowEdit, mergeFlowEdits, applyMergedEditsToFlow
state/flowEdits.ts (localStorage: flowEdits)
  \u2192 panels/FlowEditLogPanel.tsx / panels/SharedFlowSyncPanel.tsx

Live sync:
  flow/flow-sync-client.ts \u2192 GET/POST /api/flow-sync
  flow/flow-presence-client.ts \u2192 GET/POST /api/flow-presence
\`\`\`

## Known gaps [#known-gaps]

Live sync is opt-in, per-Flow-ID, off by default, and polls on a ~4s
interval rather than pushing instantly.

Logged edits themselves follow the account-wide
Tool Data Sync: they sync to your account
like any other tool's saved work, so signing in on another device carries
your flow edit log with you \u2014 separate from the live sync toggle above, which
is about sharing *in-progress* edits with teammates in real time.
`,i={contents:[{heading:`shared-ai-generated-debate-flow--flow-edit-log--sync`,content:`Lets a contributor log a proposed edit to a specific flow argument and
previews how every logged edit merges into the round's flow, flagging
genuinely concurrent, diverging edits for a human to resolve.`},{heading:`shared-ai-generated-debate-flow--flow-edit-log--sync`,content:"**Where:** the Coach hub's Flow section (`/coaching`)"},{heading:`shared-ai-generated-debate-flow--flow-edit-log--sync`,content:"**Package:** `debate-round`"},{heading:`what-it-shows`,content:`A **Flow Edit Log** form, grouped by flow, with a merge preview
(**Shared Flow Sync**) showing how many boxes would update and flagging
conflicts. A "Live sync" toggle turns on a D1-backed short-poll transport
sharing edits across contributors' browsers, plus a "who's editing now"
presence indicator. Conflicts render as a word-level side-by-side diff.`},{heading:`known-gaps`,content:`Live sync is opt-in, per-Flow-ID, off by default, and polls on a ~4s
interval rather than pushing instantly.`},{heading:`known-gaps`,content:`Logged edits themselves follow the account-wide
Tool Data Sync: they sync to your account
like any other tool's saved work, so signing in on another device carries
your flow edit log with you \u2014 separate from the live sync toggle above, which
is about sharing *in-progress* edits with teammates in real time.`}],headings:[{id:`shared-ai-generated-debate-flow--flow-edit-log--sync`,content:`Shared, Ai-Generated Debate Flow \u2014 Flow Edit Log + Sync`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#shared-ai-generated-debate-flow--flow-edit-log--sync`,title:(0,t.jsx)(t.Fragment,{children:`Shared, Ai-Generated Debate Flow \u2014 Flow Edit Log + Sync`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,em:`em`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`shared-ai-generated-debate-flow--flow-edit-log--sync`,children:`Shared, Ai-Generated Debate Flow \u2014 Flow Edit Log + Sync`}),`
`,(0,t.jsx)(n.p,{children:`Lets a contributor log a proposed edit to a specific flow argument and
previews how every logged edit merges into the round's flow, flagging
genuinely concurrent, diverging edits for a human to resolve.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Where:`}),` the Coach hub's Flow section (`,(0,t.jsx)(n.code,{children:`/coaching`}),`)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`A `,(0,t.jsx)(n.strong,{children:`Flow Edit Log`}),` form, grouped by flow, with a merge preview
(`,(0,t.jsx)(n.strong,{children:`Shared Flow Sync`}),`) showing how many boxes would update and flagging
conflicts. A "Live sync" toggle turns on a D1-backed short-poll transport
sharing edits across contributors' browsers, plus a "who's editing now"
presence indicator. Conflicts render as a word-level side-by-side diff.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`flow/shared-flow-sync.ts \u2014 createFlowEdit, mergeFlowEdits, applyMergedEditsToFlow`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/flowEdits.ts (localStorage: flowEdits)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/FlowEditLogPanel.tsx / panels/SharedFlowSyncPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`Live sync:`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  flow/flow-sync-client.ts \u2192 GET/POST /api/flow-sync`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  flow/flow-presence-client.ts \u2192 GET/POST /api/flow-presence`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`Live sync is opt-in, per-Flow-ID, off by default, and polls on a ~4s
interval rather than pushing instantly.`}),`
`,(0,t.jsxs)(n.p,{children:[`Logged edits themselves follow the account-wide
Tool Data Sync: they sync to your account
like any other tool's saved work, so signing in on another device carries
your flow edit log with you \u2014 separate from the live sync toggle above, which
is about sharing `,(0,t.jsx)(n.em,{children:`in-progress`}),` edits with teammates in real time.`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};