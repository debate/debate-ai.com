import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Scout-to-Strategy Workflow`},r=`# Scout-to-Strategy Workflow [#scout-to-strategy-workflow]

Turns existing opponent-scouting and judge-tendency profiles into a
deterministic case-choice/risk recommendation for an upcoming matchup.

- **Route:** \`/practice/prep?section=strategy\`, a tab of the [Prep Workspace](/docs/features/rounds/prep-workspace) (the old \`/practice/strategy\` redirects there)
- **Package:** \`debate-round\`

## What it shows [#what-it-shows]

A form (matchup id, opponent/judge lookup, our side, case options) builds
a recommendation appended to that matchup's history log: recommended
case/rankings, judge adaptation notes, risk level/factors, a **Case
comparison** table, and a "Get AI case-choice evaluation" action. A **Send
to Pre-Round Briefing** action exports a one-line summary.

## Data flow [#data-flow]

\`\`\`
round/scout-to-strategy.ts
  \u2192 rankCaseOptions / assessMatchupRisk(opponentProfile, judgeProfile, ourSide)
  \u2192 buildStrategyRecommendationFromStores(...)
state/strategyRecommendations.ts (localStorage: strategyRecommendations)
  \u2192 panels/StrategyPanel.tsx
  \u2192 apps/debate-ai.com/app/strategy/page.tsx
\`\`\`

Recommendation history is account-synced (\`/api/strategy-recommendations\`).

## Known gaps [#known-gaps]

None remain open for this idea.
`,i={contents:[{heading:`scout-to-strategy-workflow`,content:`Turns existing opponent-scouting and judge-tendency profiles into a
deterministic case-choice/risk recommendation for an upcoming matchup.`},{heading:`scout-to-strategy-workflow`,content:"**Route:** `/practice/prep?section=strategy`, a tab of the Prep Workspace (the old `/practice/strategy` redirects there)"},{heading:`scout-to-strategy-workflow`,content:"**Package:** `debate-round`"},{heading:`what-it-shows`,content:`A form (matchup id, opponent/judge lookup, our side, case options) builds
a recommendation appended to that matchup's history log: recommended
case/rankings, judge adaptation notes, risk level/factors, a **Case
comparison** table, and a "Get AI case-choice evaluation" action. A **Send
to Pre-Round Briefing** action exports a one-line summary.`},{heading:`data-flow`,content:"Recommendation history is account-synced (`/api/strategy-recommendations`)."},{heading:`known-gaps`,content:`None remain open for this idea.`}],headings:[{id:`scout-to-strategy-workflow`,content:`Scout-to-Strategy Workflow`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#scout-to-strategy-workflow`,title:(0,t.jsx)(t.Fragment,{children:`Scout-to-Strategy Workflow`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`scout-to-strategy-workflow`,children:`Scout-to-Strategy Workflow`}),`
`,(0,t.jsx)(n.p,{children:`Turns existing opponent-scouting and judge-tendency profiles into a
deterministic case-choice/risk recommendation for an upcoming matchup.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/practice/prep?section=strategy`}),`, a tab of the `,(0,t.jsx)(n.a,{href:`/docs/features/rounds/prep-workspace`,children:`Prep Workspace`}),` (the old `,(0,t.jsx)(n.code,{children:`/practice/strategy`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`A form (matchup id, opponent/judge lookup, our side, case options) builds
a recommendation appended to that matchup's history log: recommended
case/rankings, judge adaptation notes, risk level/factors, a `,(0,t.jsx)(n.strong,{children:`Case
comparison`}),` table, and a "Get AI case-choice evaluation" action. A `,(0,t.jsx)(n.strong,{children:`Send
to Pre-Round Briefing`}),` action exports a one-line summary.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`round/scout-to-strategy.ts`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 rankCaseOptions / assessMatchupRisk(opponentProfile, judgeProfile, ourSide)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildStrategyRecommendationFromStores(...)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/strategyRecommendations.ts (localStorage: strategyRecommendations)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/StrategyPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/strategy/page.tsx`})})]})})}),`
`,(0,t.jsxs)(n.p,{children:[`Recommendation history is account-synced (`,(0,t.jsx)(n.code,{children:`/api/strategy-recommendations`}),`).`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`None remain open for this idea.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};