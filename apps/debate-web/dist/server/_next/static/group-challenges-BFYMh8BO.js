import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Group Challenges`},r=`# Group Challenges [#group-challenges]

Lets a coach create a squad-scoped friendly challenge \u2014 either "reach N
matching contributions" or "reach N recorded wins" \u2014 with a roster and a
challenge window, showing every challenge's live standings.

- **Route:** \`/research/cards/group-challenges\`
- **Package:** \`debate-card-search\`

## What it shows [#what-it-shows]

Each persisted \`GroupChallenge\` renders as its own card: title, goal,
window, roster, and live standings (best first, \u{1F3C6} marking the MVP). A
\`win_target\` challenge gets a "Record a win" action.

## Data flow [#data-flow]

\`\`\`
state/groupChallenges.ts (localStorage: groupChallenges)
state/challengeWinEvents.ts (localStorage: challengeWinEvents)
  \u2192 buildPersistedGroupChallengeBoard(now)
  \u2192 panels/GroupChallengesPanel.tsx
\`\`\`

Both stores sync to a signed-in user's account \u2014 see
Tool Data Sync.

## Known gaps [#known-gaps]

"Record a win" is still free-form text, not a login \u2014 a real signed-in
session only prefills it.
`,i={contents:[{heading:`group-challenges`,content:`Lets a coach create a squad-scoped friendly challenge \u2014 either "reach N
matching contributions" or "reach N recorded wins" \u2014 with a roster and a
challenge window, showing every challenge's live standings.`},{heading:`group-challenges`,content:"**Route:** `/research/cards/group-challenges`"},{heading:`group-challenges`,content:"**Package:** `debate-card-search`"},{heading:`what-it-shows`,content:'Each persisted `GroupChallenge` renders as its own card: title, goal,\nwindow, roster, and live standings (best first, \u{1F3C6} marking the MVP). A\n`win_target` challenge gets a "Record a win" action.'},{heading:`data-flow`,content:`Both stores sync to a signed-in user's account \u2014 see
Tool Data Sync.`},{heading:`known-gaps`,content:`"Record a win" is still free-form text, not a login \u2014 a real signed-in
session only prefills it.`}],headings:[{id:`group-challenges`,content:`Group Challenges`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#group-challenges`,title:(0,t.jsx)(t.Fragment,{children:`Group Challenges`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`group-challenges`,children:`Group Challenges`}),`
`,(0,t.jsx)(n.p,{children:`Lets a coach create a squad-scoped friendly challenge \u2014 either "reach N
matching contributions" or "reach N recorded wins" \u2014 with a roster and a
challenge window, showing every challenge's live standings.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/cards/group-challenges`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`Each persisted `,(0,t.jsx)(n.code,{children:`GroupChallenge`}),` renders as its own card: title, goal,
window, roster, and live standings (best first, \u{1F3C6} marking the MVP). A
`,(0,t.jsx)(n.code,{children:`win_target`}),` challenge gets a "Record a win" action.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/groupChallenges.ts (localStorage: groupChallenges)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/challengeWinEvents.ts (localStorage: challengeWinEvents)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildPersistedGroupChallengeBoard(now)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/GroupChallengesPanel.tsx`})})]})})}),`
`,(0,t.jsx)(n.p,{children:`Both stores sync to a signed-in user's account \u2014 see
Tool Data Sync.`}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`"Record a win" is still free-form text, not a login \u2014 a real signed-in
session only prefills it.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};