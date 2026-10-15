import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Pre-Round Briefings`},r=`# Pre-Round Briefings [#pre-round-briefings]

Shows every persisted Pre-Round Intelligence Panel briefing \u2014 opponent
scouting, judge tendencies, head-to-head record, and team prep notes
combined into one briefing per round.

- **Route:** \`/practice/prep?section=briefings\`, a tab of the [Prep Workspace](/docs/features/rounds/prep-workspace) (the old \`/practice/briefings\` redirects there)
- **Package:** \`debate-round\`

## What it shows [#what-it-shows]

A "create briefing" form (round ID, tournament, division, side, optional
opponent/judge pick, prep notes), every persisted briefing as its own card,
a "Log a round" form for this team's own round history, a "Download"
plain-text export, a freshness ("pending N hours") badge, and a manual
"Pairing schedule" section (account-synced across devices).

## Data flow [#data-flow]

\`\`\`
state/preRoundBriefings.ts (localStorage: preRoundBriefings)
  \u2192 buildPreRoundBriefingRecordFromDraft(draft)
      \u2192 buildPreRoundBriefingFromStores(...) \u2014 round/pre-round-briefing.ts
  \u2192 panels/PreRoundBriefingsPanel.tsx
  \u2192 apps/debate-ai.com/app/briefings/page.tsx
\`\`\`

## Known gaps [#known-gaps]

No real data source for tournament results/ballots \u2014 scouting/judge data is
entered by hand; pairings have a dedicated manual-entry form as the
practical stand-in for still-blocked live Tabroom data.
`,i={contents:[{heading:`pre-round-briefings`,content:`Shows every persisted Pre-Round Intelligence Panel briefing \u2014 opponent
scouting, judge tendencies, head-to-head record, and team prep notes
combined into one briefing per round.`},{heading:`pre-round-briefings`,content:"**Route:** `/practice/prep?section=briefings`, a tab of the Prep Workspace (the old `/practice/briefings` redirects there)"},{heading:`pre-round-briefings`,content:"**Package:** `debate-round`"},{heading:`what-it-shows`,content:`A "create briefing" form (round ID, tournament, division, side, optional
opponent/judge pick, prep notes), every persisted briefing as its own card,
a "Log a round" form for this team's own round history, a "Download"
plain-text export, a freshness ("pending N hours") badge, and a manual
"Pairing schedule" section (account-synced across devices).`},{heading:`known-gaps`,content:`No real data source for tournament results/ballots \u2014 scouting/judge data is
entered by hand; pairings have a dedicated manual-entry form as the
practical stand-in for still-blocked live Tabroom data.`}],headings:[{id:`pre-round-briefings`,content:`Pre-Round Briefings`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#pre-round-briefings`,title:(0,t.jsx)(t.Fragment,{children:`Pre-Round Briefings`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`pre-round-briefings`,children:`Pre-Round Briefings`}),`
`,(0,t.jsx)(n.p,{children:`Shows every persisted Pre-Round Intelligence Panel briefing \u2014 opponent
scouting, judge tendencies, head-to-head record, and team prep notes
combined into one briefing per round.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/practice/prep?section=briefings`}),`, a tab of the `,(0,t.jsx)(n.a,{href:`/docs/features/rounds/prep-workspace`,children:`Prep Workspace`}),` (the old `,(0,t.jsx)(n.code,{children:`/practice/briefings`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsx)(n.p,{children:`A "create briefing" form (round ID, tournament, division, side, optional
opponent/judge pick, prep notes), every persisted briefing as its own card,
a "Log a round" form for this team's own round history, a "Download"
plain-text export, a freshness ("pending N hours") badge, and a manual
"Pairing schedule" section (account-synced across devices).`}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/preRoundBriefings.ts (localStorage: preRoundBriefings)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildPreRoundBriefingRecordFromDraft(draft)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 buildPreRoundBriefingFromStores(...) \u2014 round/pre-round-briefing.ts`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/PreRoundBriefingsPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/briefings/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`No real data source for tournament results/ballots \u2014 scouting/judge data is
entered by hand; pairings have a dedicated manual-entry form as the
practical stand-in for still-blocked live Tabroom data.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};