import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Practice Drills`},r=`# Practice Drills [#practice-drills]

Shows every persisted "AI Drill Generator" \`Drill\` set, grouped by round \u2014
overview, frontline, cross-ex, and collapse-scenario prompts derived from
that round's flow.

- **Route:** \`/practice/drills\`
- **Package:** \`debate-round\`

## What it shows [#what-it-shows]

Each persisted \`DrillSetRecord\` renders as its own card with kind badges
(Overview/Frontline/Cross-Ex/Collapse) and a difficulty rating
(easy/medium/hard, derived from the argument's vulnerability score). Each
drill has a "Get AI script" action, a "Mark practiced" toggle with a
progress meter, and a "Review reminder" date field with a "Due" badge. A
"Practice tier" card feeds practiced-drill counts into the Progress
Unlocks tier system.

## Data flow [#data-flow]

\`\`\`
state/drillSets.ts (localStorage: drillSets)
  \u2192 buildDrillSetsPanelView()
  \u2192 panels/DrillSetsPanel.tsx
  \u2192 apps/debate-ai.com/app/drills/page.tsx
\`\`\`

Every drill set \u2014 scripts, completion state, reminders \u2014 is account-synced
across devices (\`saved_drill_sets\` D1 table, \`/api/drill-sets\`).

## Known gaps [#known-gaps]

The "Practice tier" card still feeds a synthetic, drill-set-scoped stats
object rather than the real cross-tool Progress Unlocks roster.
`,i={contents:[{heading:`practice-drills`,content:`Shows every persisted "AI Drill Generator" \`Drill\` set, grouped by round \u2014
overview, frontline, cross-ex, and collapse-scenario prompts derived from
that round's flow.`},{heading:`practice-drills`,content:"**Route:** `/practice/drills`"},{heading:`practice-drills`,content:"**Package:** `debate-round`"},{heading:`what-it-shows`,content:`Each persisted \`DrillSetRecord\` renders as its own card with kind badges
(Overview/Frontline/Cross-Ex/Collapse) and a difficulty rating
(easy/medium/hard, derived from the argument's vulnerability score). Each
drill has a "Get AI script" action, a "Mark practiced" toggle with a
progress meter, and a "Review reminder" date field with a "Due" badge. A
"Practice tier" card feeds practiced-drill counts into the Progress
Unlocks tier system.`},{heading:`data-flow`,content:"Every drill set \u2014 scripts, completion state, reminders \u2014 is account-synced\nacross devices (`saved_drill_sets` D1 table, `/api/drill-sets`)."},{heading:`known-gaps`,content:`The "Practice tier" card still feeds a synthetic, drill-set-scoped stats
object rather than the real cross-tool Progress Unlocks roster.`}],headings:[{id:`practice-drills`,content:`Practice Drills`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#practice-drills`,title:(0,t.jsx)(t.Fragment,{children:`Practice Drills`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`practice-drills`,children:`Practice Drills`}),`
`,(0,t.jsxs)(n.p,{children:[`Shows every persisted "AI Drill Generator" `,(0,t.jsx)(n.code,{children:`Drill`}),` set, grouped by round \u2014
overview, frontline, cross-ex, and collapse-scenario prompts derived from
that round's flow.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/practice/drills`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`Each persisted `,(0,t.jsx)(n.code,{children:`DrillSetRecord`}),` renders as its own card with kind badges
(Overview/Frontline/Cross-Ex/Collapse) and a difficulty rating
(easy/medium/hard, derived from the argument's vulnerability score). Each
drill has a "Get AI script" action, a "Mark practiced" toggle with a
progress meter, and a "Review reminder" date field with a "Due" badge. A
"Practice tier" card feeds practiced-drill counts into the Progress
Unlocks tier system.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/drillSets.ts (localStorage: drillSets)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildDrillSetsPanelView()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/DrillSetsPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/drills/page.tsx`})})]})})}),`
`,(0,t.jsxs)(n.p,{children:[`Every drill set \u2014 scripts, completion state, reminders \u2014 is account-synced
across devices (`,(0,t.jsx)(n.code,{children:`saved_drill_sets`}),` D1 table, `,(0,t.jsx)(n.code,{children:`/api/drill-sets`}),`).`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`The "Practice tier" card still feeds a synthetic, drill-set-scoped stats
object rather than the real cross-tool Progress Unlocks roster.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};