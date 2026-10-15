import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Flow Cloud Save`},r=`# Flow Cloud Save [#flow-cloud-save]

Lets a signed-in user save an individual flow to their account and load it
back on any device.

- **Nav:** \`FlowHistoryDialog\`'s "Saved to account" tab; a cloud-upload icon
  on each flow chip in the "Rounds" tab
- **Package:** \`debate-round\` (dialog + validation + fetch client),
  \`apps/debate-ai.com\` (\`/api/flows\`, \`saved_flows\` D1 table)

## What it does [#what-it-does]

Clicking a flow's cloud icon PUTs that flow to the account, keyed by its
local id. The "Saved to account" tab lists every saved flow with Load and
Remove actions. A signed-out user sees a sign-in prompt instead of a fetch
attempt; local behavior is never blocked.

The save is optimistic-concurrency checked: it sends along the \`updatedAt\`
of the cloud copy this browser last knew about (from the last list/load/save
response it saw). If that doesn't match what's actually saved \u2014 someone else
saved a newer version since \u2014 the save is rejected with a conflict instead
of silently overwriting it, and the flow's cloud icon turns into a warning
that a second click (an explicit "save anyway") resolves.

## Data flow [#data-flow]

\`\`\`
state/savedFlows.ts (pure validation, hasFlowSaveConflict)
round/saved-flows-client.ts (fetch: list/fetch/save/delete)
dialogs/FlowHistoryDialog.tsx
apps/debate-ai.com/app/api/flows/[route.ts, [clientId]/route.ts]
\`\`\`
`,i={contents:[{heading:`flow-cloud-save`,content:`Lets a signed-in user save an individual flow to their account and load it
back on any device.`},{heading:`flow-cloud-save`,content:`**Nav:** \`FlowHistoryDialog\`'s "Saved to account" tab; a cloud-upload icon
on each flow chip in the "Rounds" tab`},{heading:`flow-cloud-save`,content:"**Package:** `debate-round` (dialog + validation + fetch client),\n`apps/debate-ai.com` (`/api/flows`, `saved_flows` D1 table)"},{heading:`what-it-does`,content:`Clicking a flow's cloud icon PUTs that flow to the account, keyed by its
local id. The "Saved to account" tab lists every saved flow with Load and
Remove actions. A signed-out user sees a sign-in prompt instead of a fetch
attempt; local behavior is never blocked.`},{heading:`what-it-does`,content:`The save is optimistic-concurrency checked: it sends along the \`updatedAt\`
of the cloud copy this browser last knew about (from the last list/load/save
response it saw). If that doesn't match what's actually saved \u2014 someone else
saved a newer version since \u2014 the save is rejected with a conflict instead
of silently overwriting it, and the flow's cloud icon turns into a warning
that a second click (an explicit "save anyway") resolves.`}],headings:[{id:`flow-cloud-save`,content:`Flow Cloud Save`},{id:`what-it-does`,content:`What it does`},{id:`data-flow`,content:`Data flow`}]},a=[{depth:1,url:`#flow-cloud-save`,title:(0,t.jsx)(t.Fragment,{children:`Flow Cloud Save`})},{depth:2,url:`#what-it-does`,title:(0,t.jsx)(t.Fragment,{children:`What it does`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`flow-cloud-save`,children:`Flow Cloud Save`}),`
`,(0,t.jsx)(n.p,{children:`Lets a signed-in user save an individual flow to their account and load it
back on any device.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Nav:`}),` `,(0,t.jsx)(n.code,{children:`FlowHistoryDialog`}),`'s "Saved to account" tab; a cloud-upload icon
on each flow chip in the "Rounds" tab`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`}),` (dialog + validation + fetch client),
`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com`}),` (`,(0,t.jsx)(n.code,{children:`/api/flows`}),`, `,(0,t.jsx)(n.code,{children:`saved_flows`}),` D1 table)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-does`,children:`What it does`}),`
`,(0,t.jsx)(n.p,{children:`Clicking a flow's cloud icon PUTs that flow to the account, keyed by its
local id. The "Saved to account" tab lists every saved flow with Load and
Remove actions. A signed-out user sees a sign-in prompt instead of a fetch
attempt; local behavior is never blocked.`}),`
`,(0,t.jsxs)(n.p,{children:[`The save is optimistic-concurrency checked: it sends along the `,(0,t.jsx)(n.code,{children:`updatedAt`}),`
of the cloud copy this browser last knew about (from the last list/load/save
response it saw). If that doesn't match what's actually saved \u2014 someone else
saved a newer version since \u2014 the save is rejected with a conflict instead
of silently overwriting it, and the flow's cloud icon turns into a warning
that a second click (an explicit "save anyway") resolves.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/savedFlows.ts (pure validation, hasFlowSaveConflict)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`round/saved-flows-client.ts (fetch: list/fetch/save/delete)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`dialogs/FlowHistoryDialog.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`apps/debate-ai.com/app/api/flows/[route.ts, [clientId]/route.ts]`})})]})})})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};