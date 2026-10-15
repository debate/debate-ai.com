import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Contribution Leaderboard`},r=`# Contribution Leaderboard [#contribution-leaderboard]

Ranks community contributors \u2014 cards, summaries, analytics, and other
research contributions \u2014 by a blended helpfulness score, and shows each
contributor's unlock tier, earned badges, and current daily-quest streak.

- **Route:** \`/coaching/leaderboard\`
- **Package:** \`debate-card-search\`

## What it shows [#what-it-shows]

| Column | Source |
| --- | --- |
| Rank | \`buildLeaderboard\`'s sort order |
| Contributor | \`contributorId\` |
| Tier | novice/apprentice/veteran/expert |
| Contributions | Count of persisted contributions |
| Total/Avg score | Blended helpfulness score |
| Streak | Current consecutive-day quest streak |
| Badges | Tier + streak-milestone badges |

A **Range** filter (All time/This week/This month) and a **Category**
filter re-derive the whole roster. Each row has a "History" toggle showing
endorsement history.

## Data flow [#data-flow]

\`\`\`
state/contributions.ts (localStorage)
  \u2192 buildPersistedLeaderboard()
  \u2192 buildContributorUnlockStatusWithStreakFromStore()
  \u2192 panels/ContributionLeaderboardPanel.tsx
  \u2192 apps/debate-ai.com/app/cards/leaderboard/page.tsx
\`\`\`

## Known gaps [#known-gaps]

- No reviewer-identity/permission checks (no auth/roles in this repo yet).
- "My endorsement activity" only appears for a signed-in visitor.
`,i={contents:[{heading:`contribution-leaderboard`,content:`Ranks community contributors \u2014 cards, summaries, analytics, and other
research contributions \u2014 by a blended helpfulness score, and shows each
contributor's unlock tier, earned badges, and current daily-quest streak.`},{heading:`contribution-leaderboard`,content:"**Route:** `/coaching/leaderboard`"},{heading:`contribution-leaderboard`,content:"**Package:** `debate-card-search`"},{heading:`what-it-shows`,content:`| Column | Source                          |
| ------ | ------------------------------- |
| Rank   | \`buildLeaderboard\`'s sort order |`,table:`table-0`},{heading:`what-it-shows`,content:`| Column      | Source          |
| ----------- | --------------- |
| Contributor | \`contributorId\` |`,table:`table-0`},{heading:`what-it-shows`,content:`| Column | Source                           |
| ------ | -------------------------------- |
| Tier   | novice/apprentice/veteran/expert |`,table:`table-0`},{heading:`what-it-shows`,content:`| Column        | Source                           |
| ------------- | -------------------------------- |
| Contributions | Count of persisted contributions |`,table:`table-0`},{heading:`what-it-shows`,content:`| Column          | Source                    |
| --------------- | ------------------------- |
| Total/Avg score | Blended helpfulness score |`,table:`table-0`},{heading:`what-it-shows`,content:`| Column | Source                               |
| ------ | ------------------------------------ |
| Streak | Current consecutive-day quest streak |`,table:`table-0`},{heading:`what-it-shows`,content:`| Column | Source                         |
| ------ | ------------------------------ |
| Badges | Tier + streak-milestone badges |`,table:`table-0`},{heading:`what-it-shows`,content:`A **Range** filter (All time/This week/This month) and a **Category**
filter re-derive the whole roster. Each row has a "History" toggle showing
endorsement history.`},{heading:`known-gaps`,content:`No reviewer-identity/permission checks (no auth/roles in this repo yet).`},{heading:`known-gaps`,content:`"My endorsement activity" only appears for a signed-in visitor.`}],headings:[{id:`contribution-leaderboard`,content:`Contribution Leaderboard`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#contribution-leaderboard`,title:(0,t.jsx)(t.Fragment,{children:`Contribution Leaderboard`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`contribution-leaderboard`,children:`Contribution Leaderboard`}),`
`,(0,t.jsx)(n.p,{children:`Ranks community contributors \u2014 cards, summaries, analytics, and other
research contributions \u2014 by a blended helpfulness score, and shows each
contributor's unlock tier, earned badges, and current daily-quest streak.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/coaching/leaderboard`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Column`}),(0,t.jsx)(n.th,{children:`Source`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Rank`}),(0,t.jsxs)(n.td,{children:[(0,t.jsx)(n.code,{children:`buildLeaderboard`}),`'s sort order`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Contributor`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`contributorId`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Tier`}),(0,t.jsx)(n.td,{children:`novice/apprentice/veteran/expert`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Contributions`}),(0,t.jsx)(n.td,{children:`Count of persisted contributions`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Total/Avg score`}),(0,t.jsx)(n.td,{children:`Blended helpfulness score`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Streak`}),(0,t.jsx)(n.td,{children:`Current consecutive-day quest streak`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Badges`}),(0,t.jsx)(n.td,{children:`Tier + streak-milestone badges`})]})]})]}),`
`,(0,t.jsxs)(n.p,{children:[`A `,(0,t.jsx)(n.strong,{children:`Range`}),` filter (All time/This week/This month) and a `,(0,t.jsx)(n.strong,{children:`Category`}),`
filter re-derive the whole roster. Each row has a "History" toggle showing
endorsement history.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/contributions.ts (localStorage)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildPersistedLeaderboard()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildContributorUnlockStatusWithStreakFromStore()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/ContributionLeaderboardPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/cards/leaderboard/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`No reviewer-identity/permission checks (no auth/roles in this repo yet).`}),`
`,(0,t.jsx)(n.li,{children:`"My endorsement activity" only appears for a signed-in visitor.`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};