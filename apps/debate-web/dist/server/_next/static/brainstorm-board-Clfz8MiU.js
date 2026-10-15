import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Team Brainstorm Assist`},r=`# Team Brainstorm Assist [#team-brainstorm-assist]

Lets a squad submit, AI-generate, and upvote brainstorm ideas against an
argument block, grouped into boards by category, each board ranked by
popularity with a near-duplicate badge.

- **Route:** \`/research/team?section=brainstorm\`, the **[Team Research](/docs/features/research-evidence/team-research)** page's tab (the old \`/research/cards/brainstorm\` redirects there)
- **Nav:** the Tools page's Community & Progress group
- **Package:** \`debate-card-search\`

## What it shows [#what-it-shows]

An optional topic switcher, a submission form (argument block, contributor
ID, category, idea text), and every board, sorted by argument block then
category, each idea ranked by popularity score with a "possible duplicate"
badge and a "Merge into\u2026" select. A "Generate AI ideas" button drafts
candidate ideas via a real Anthropic call.

## Data flow [#data-flow]

\`\`\`
state/brainstormIdeas.ts (localStorage: brainstormIdeas)
  \u2192 buildBrainstormBoardsPanelView()
  \u2192 panels/BrainstormBoardPanel.tsx
  \u2192 apps/debate-ai.com/app/cards/brainstorm/page.tsx

"Generate AI ideas":
  \u2192 requestTeamBrainstormAiIdeas() \u2014 lib/team-brainstorm-client.ts
      \u2192 buildTeamBrainstormAiUserPrompt() \u2014 lib/team-brainstorm-ai.ts (pure)
      \u2192 POST /api/reason-ai
      \u2192 parseTeamBrainstormAiResponse()
\`\`\`

## Session timer [#session-timer]

An optional "Session timer" widget lets a moderator time-box a sprint: pick
a duration (3/5/10/15 minutes), Start, Pause/resume, or Reset. It's
\`localStorage\`-backed per browser (so a countdown started in one tab is
visible, live, in any other open tab of the same browser via a \`storage\`
listener) and, for a real signed-in visitor, also account-synced through
\`/api/settings\`'s \`brainstormSessionTimer\` field via
\`hooks/useBrainstormSessionTimerSync.ts\` \u2014 so the same countdown follows
them to another device, not just another tab.

## Known gaps [#known-gaps]

- No reviewer/moderator identity check gates the merge or "Send to Argument
  Library" actions.
- "Contributor ID" is still free-form text, not a login.
`,i={contents:[{heading:`team-brainstorm-assist`,content:`Lets a squad submit, AI-generate, and upvote brainstorm ideas against an
argument block, grouped into boards by category, each board ranked by
popularity with a near-duplicate badge.`},{heading:`team-brainstorm-assist`,content:"**Route:** `/research/team?section=brainstorm`, the **Team Research** page's tab (the old `/research/cards/brainstorm` redirects there)"},{heading:`team-brainstorm-assist`,content:`**Nav:** the Tools page's Community & Progress group`},{heading:`team-brainstorm-assist`,content:"**Package:** `debate-card-search`"},{heading:`what-it-shows`,content:`An optional topic switcher, a submission form (argument block, contributor
ID, category, idea text), and every board, sorted by argument block then
category, each idea ranked by popularity score with a "possible duplicate"
badge and a "Merge into\u2026" select. A "Generate AI ideas" button drafts
candidate ideas via a real Anthropic call.`},{heading:`session-timer`,content:"An optional \"Session timer\" widget lets a moderator time-box a sprint: pick\na duration (3/5/10/15 minutes), Start, Pause/resume, or Reset. It's\n`localStorage`-backed per browser (so a countdown started in one tab is\nvisible, live, in any other open tab of the same browser via a `storage`\nlistener) and, for a real signed-in visitor, also account-synced through\n`/api/settings`'s `brainstormSessionTimer` field via\n`hooks/useBrainstormSessionTimerSync.ts` \u2014 so the same countdown follows\nthem to another device, not just another tab."},{heading:`known-gaps`,content:`No reviewer/moderator identity check gates the merge or "Send to Argument
Library" actions.`},{heading:`known-gaps`,content:`"Contributor ID" is still free-form text, not a login.`}],headings:[{id:`team-brainstorm-assist`,content:`Team Brainstorm Assist`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`session-timer`,content:`Session timer`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#team-brainstorm-assist`,title:(0,t.jsx)(t.Fragment,{children:`Team Brainstorm Assist`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#session-timer`,title:(0,t.jsx)(t.Fragment,{children:`Session timer`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`team-brainstorm-assist`,children:`Team Brainstorm Assist`}),`
`,(0,t.jsx)(n.p,{children:`Lets a squad submit, AI-generate, and upvote brainstorm ideas against an
argument block, grouped into boards by category, each board ranked by
popularity with a near-duplicate badge.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/team?section=brainstorm`}),`, the `,(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/team-research`,children:`Team Research`})}),` page's tab (the old `,(0,t.jsx)(n.code,{children:`/research/cards/brainstorm`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Nav:`}),` the Tools page's Community & Progress group`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsx)(n.p,{children:`An optional topic switcher, a submission form (argument block, contributor
ID, category, idea text), and every board, sorted by argument block then
category, each idea ranked by popularity score with a "possible duplicate"
badge and a "Merge into\u2026" select. A "Generate AI ideas" button drafts
candidate ideas via a real Anthropic call.`}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/brainstormIdeas.ts (localStorage: brainstormIdeas)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildBrainstormBoardsPanelView()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/BrainstormBoardPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/cards/brainstorm/page.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`"Generate AI ideas":`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 requestTeamBrainstormAiIdeas() \u2014 lib/team-brainstorm-client.ts`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 buildTeamBrainstormAiUserPrompt() \u2014 lib/team-brainstorm-ai.ts (pure)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 POST /api/reason-ai`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 parseTeamBrainstormAiResponse()`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`session-timer`,children:`Session timer`}),`
`,(0,t.jsxs)(n.p,{children:[`An optional "Session timer" widget lets a moderator time-box a sprint: pick
a duration (3/5/10/15 minutes), Start, Pause/resume, or Reset. It's
`,(0,t.jsx)(n.code,{children:`localStorage`}),`-backed per browser (so a countdown started in one tab is
visible, live, in any other open tab of the same browser via a `,(0,t.jsx)(n.code,{children:`storage`}),`
listener) and, for a real signed-in visitor, also account-synced through
`,(0,t.jsx)(n.code,{children:`/api/settings`}),`'s `,(0,t.jsx)(n.code,{children:`brainstormSessionTimer`}),` field via
`,(0,t.jsx)(n.code,{children:`hooks/useBrainstormSessionTimerSync.ts`}),` \u2014 so the same countdown follows
them to another device, not just another tab.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`No reviewer/moderator identity check gates the merge or "Send to Argument
Library" actions.`}),`
`,(0,t.jsx)(n.li,{children:`"Contributor ID" is still free-form text, not a login.`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};