import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Daily Quests`},r=`# Daily Quests [#daily-quests]

Team goals like "find 5 solvency cards" or "add 3 frontline answers today"
\u2014 a quest board that tracks live progress against real, same-day
contribution submissions.

- **Route:** \`/research/cards/quests\`
- **Package:** \`debate-card-search\`

## What it shows [#what-it-shows]

Every saved quest template's progress for the current UTC calendar day, an
optional expiry/recurrence, an easy/medium/hard difficulty worth an
escalating point value, and a "Your streak" section that records today's
mission result and shows the reward.

## Data flow [#data-flow]

\`\`\`
state/dailyQuests.ts (localStorage: dailyQuestTemplates)
state/contributions.ts (localStorage: contributions)
  \u2192 buildPersistedDailyQuestBoard(now)
  \u2192 panels/DailyQuestsPanel.tsx
  \u2192 apps/debate-ai.com/app/cards/quests/page.tsx
\`\`\`

Completing every quest on the board posts a celebration to the News Stream
automatically.

## Known gaps [#known-gaps]

- No contributor identity/permission checks.
- Contributions saved before this change don't carry \`submittedAt\`/
  \`argBlock\` and are excluded from quest scoring.
`,i={contents:[{heading:`daily-quests`,content:`Team goals like "find 5 solvency cards" or "add 3 frontline answers today"
\u2014 a quest board that tracks live progress against real, same-day
contribution submissions.`},{heading:`daily-quests`,content:"**Route:** `/research/cards/quests`"},{heading:`daily-quests`,content:"**Package:** `debate-card-search`"},{heading:`what-it-shows`,content:`Every saved quest template's progress for the current UTC calendar day, an
optional expiry/recurrence, an easy/medium/hard difficulty worth an
escalating point value, and a "Your streak" section that records today's
mission result and shows the reward.`},{heading:`data-flow`,content:`Completing every quest on the board posts a celebration to the News Stream
automatically.`},{heading:`known-gaps`,content:`No contributor identity/permission checks.`},{heading:`known-gaps`,content:"Contributions saved before this change don't carry `submittedAt`/\n`argBlock` and are excluded from quest scoring."}],headings:[{id:`daily-quests`,content:`Daily Quests`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#daily-quests`,title:(0,t.jsx)(t.Fragment,{children:`Daily Quests`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`daily-quests`,children:`Daily Quests`}),`
`,(0,t.jsx)(n.p,{children:`Team goals like "find 5 solvency cards" or "add 3 frontline answers today"
\u2014 a quest board that tracks live progress against real, same-day
contribution submissions.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/cards/quests`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsx)(n.p,{children:`Every saved quest template's progress for the current UTC calendar day, an
optional expiry/recurrence, an easy/medium/hard difficulty worth an
escalating point value, and a "Your streak" section that records today's
mission result and shows the reward.`}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/dailyQuests.ts (localStorage: dailyQuestTemplates)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/contributions.ts (localStorage: contributions)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildPersistedDailyQuestBoard(now)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/DailyQuestsPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/cards/quests/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.p,{children:`Completing every quest on the board posts a celebration to the News Stream
automatically.`}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`No contributor identity/permission checks.`}),`
`,(0,t.jsxs)(n.li,{children:[`Contributions saved before this change don't carry `,(0,t.jsx)(n.code,{children:`submittedAt`}),`/
`,(0,t.jsx)(n.code,{children:`argBlock`}),` and are excluded from quest scoring.`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};