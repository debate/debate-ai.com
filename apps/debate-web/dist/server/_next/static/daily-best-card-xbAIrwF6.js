import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Daily Best Card Challenge`},r=`# Daily Best Card Challenge [#daily-best-card-challenge]

Highlights the single highest-helpfulness card submitted each UTC calendar
day, and lets a day's winner be frozen as an official "announced" result.

- **Route:** \`/research/cards/best-card\`
- **Package:** \`debate-card-search\`

## What it shows [#what-it-shows]

**Today's leader**, an **Announce today's winner** action, a **Winner
history calendar**, **Announced history**, a **Best of the week** rollup,
and a per-day **comment thread**.

## Data flow [#data-flow]

\`\`\`
state/contributions.ts (localStorage, "contributions")
  \u2192 getTodaysBestCardFromStore() / buildDailyBestCardsFromStore()
state/dailyBestCardAnnouncements.ts
  \u2192 announceDailyBestCard()
  \u2192 panels/DailyBestCardPanel.tsx
  \u2192 apps/debate-ai.com/app/cards/best-card/page.tsx
\`\`\`

## Known gaps [#known-gaps]

- No scheduled job announces automatically.
- A comment's "Your name" field is a free-form prefill, not an identity gate.
- Frozen daily winners sync to a signed-in user's account as the
  \`dailyBestCardAnnouncements\` collection \u2014 see
  Tool Data Sync \u2014 and the comment thread
  syncs too, through its own \`saved_daily_best_card_comments\` table
  (\`hooks/useDailyBestCardComments.ts\`) rather than that shared one. Both are
  still per-user, not a shared team resource.
`,i={contents:[{heading:`daily-best-card-challenge`,content:`Highlights the single highest-helpfulness card submitted each UTC calendar
day, and lets a day's winner be frozen as an official "announced" result.`},{heading:`daily-best-card-challenge`,content:"**Route:** `/research/cards/best-card`"},{heading:`daily-best-card-challenge`,content:"**Package:** `debate-card-search`"},{heading:`what-it-shows`,content:`**Today's leader**, an **Announce today's winner** action, a **Winner
history calendar**, **Announced history**, a **Best of the week** rollup,
and a per-day **comment thread**.`},{heading:`known-gaps`,content:`No scheduled job announces automatically.`},{heading:`known-gaps`,content:`A comment's "Your name" field is a free-form prefill, not an identity gate.`},{heading:`known-gaps`,content:"Frozen daily winners sync to a signed-in user's account as the\n`dailyBestCardAnnouncements` collection \u2014 see\nTool Data Sync \u2014 and the comment thread\nsyncs too, through its own `saved_daily_best_card_comments` table\n(`hooks/useDailyBestCardComments.ts`) rather than that shared one. Both are\nstill per-user, not a shared team resource."}],headings:[{id:`daily-best-card-challenge`,content:`Daily Best Card Challenge`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#daily-best-card-challenge`,title:(0,t.jsx)(t.Fragment,{children:`Daily Best Card Challenge`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`daily-best-card-challenge`,children:`Daily Best Card Challenge`}),`
`,(0,t.jsx)(n.p,{children:`Highlights the single highest-helpfulness card submitted each UTC calendar
day, and lets a day's winner be frozen as an official "announced" result.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/cards/best-card`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Today's leader`}),`, an `,(0,t.jsx)(n.strong,{children:`Announce today's winner`}),` action, a `,(0,t.jsx)(n.strong,{children:`Winner
history calendar`}),`, `,(0,t.jsx)(n.strong,{children:`Announced history`}),`, a `,(0,t.jsx)(n.strong,{children:`Best of the week`}),` rollup,
and a per-day `,(0,t.jsx)(n.strong,{children:`comment thread`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/contributions.ts (localStorage, "contributions")`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 getTodaysBestCardFromStore() / buildDailyBestCardsFromStore()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/dailyBestCardAnnouncements.ts`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 announceDailyBestCard()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/DailyBestCardPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/cards/best-card/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`No scheduled job announces automatically.`}),`
`,(0,t.jsx)(n.li,{children:`A comment's "Your name" field is a free-form prefill, not an identity gate.`}),`
`,(0,t.jsxs)(n.li,{children:[`Frozen daily winners sync to a signed-in user's account as the
`,(0,t.jsx)(n.code,{children:`dailyBestCardAnnouncements`}),` collection \u2014 see
Tool Data Sync \u2014 and the comment thread
syncs too, through its own `,(0,t.jsx)(n.code,{children:`saved_daily_best_card_comments`}),` table
(`,(0,t.jsx)(n.code,{children:`hooks/useDailyBestCardComments.ts`}),`) rather than that shared one. Both are
still per-user, not a shared team resource.`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};