import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Coaching Programs and Group Challenges`},r=`# Coaching Programs and Group Challenges [#coaching-programs-and-group-challenges]

Lets a coach create a named coaching space scoped to a squad roster, and
opens each program's live board: its shared topic sprint, its group-challenge
standings, and each member's generated drill set.

- **Route:** \`/coaching?section=programs\`, the Coaching Programs tab of [Coaching](/docs/features/ai-coaching/coaching) (the old \`/coaching/programs\` redirects there)
- **Package:** \`debate-round\`

## What it shows [#what-it-shows]

A form to create a coaching space, then every persisted
\`CoachingProgramConfig\` with a roster badge list. Each program has a "View
board" action showing topic-sprint status, group-challenge standings, and a
"Member flows" roster for recording each member's practice round.

## Roster analytics dashboard [#roster-analytics-dashboard]

A **Roster Analytics** section shows every roster member's group-challenge
standing and daily-quest streak in one table, plus a **Recent challenge
results** digest scoped to that program's roster.

## Data flow [#data-flow]

\`\`\`
state/coachingPrograms.ts (localStorage: coachingPrograms)
  \u2192 buildCoachingProgramsPanelView()
  \u2192 panels/CoachingProgramsPanel.tsx
  \u2192 apps/debate-ai.com/app/coaching-programs/page.tsx
\`\`\`

## Known gaps [#known-gaps]

- No follow-ups remain open on the "roster analytics table doesn't fold in
  drill-completion rate or practice-round counts" gap \u2014 the table now has
  "Drills completed" and "Practice round" columns per member; see
  Per-member drill/practice-round status
  in that doc's "Per-member drill/practice-round status" section.
`,i={contents:[{heading:`coaching-programs-and-group-challenges`,content:`Lets a coach create a named coaching space scoped to a squad roster, and
opens each program's live board: its shared topic sprint, its group-challenge
standings, and each member's generated drill set.`},{heading:`coaching-programs-and-group-challenges`,content:"**Route:** `/coaching?section=programs`, the Coaching Programs tab of Coaching (the old `/coaching/programs` redirects there)"},{heading:`coaching-programs-and-group-challenges`,content:"**Package:** `debate-round`"},{heading:`what-it-shows`,content:`A form to create a coaching space, then every persisted
\`CoachingProgramConfig\` with a roster badge list. Each program has a "View
board" action showing topic-sprint status, group-challenge standings, and a
"Member flows" roster for recording each member's practice round.`},{heading:`roster-analytics-dashboard`,content:`A **Roster Analytics** section shows every roster member's group-challenge
standing and daily-quest streak in one table, plus a **Recent challenge
results** digest scoped to that program's roster.`},{heading:`known-gaps`,content:`No follow-ups remain open on the "roster analytics table doesn't fold in
drill-completion rate or practice-round counts" gap \u2014 the table now has
"Drills completed" and "Practice round" columns per member; see
Per-member drill/practice-round status
in that doc's "Per-member drill/practice-round status" section.`}],headings:[{id:`coaching-programs-and-group-challenges`,content:`Coaching Programs and Group Challenges`},{id:`what-it-shows`,content:`What it shows`},{id:`roster-analytics-dashboard`,content:`Roster analytics dashboard`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#coaching-programs-and-group-challenges`,title:(0,t.jsx)(t.Fragment,{children:`Coaching Programs and Group Challenges`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#roster-analytics-dashboard`,title:(0,t.jsx)(t.Fragment,{children:`Roster analytics dashboard`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`coaching-programs-and-group-challenges`,children:`Coaching Programs and Group Challenges`}),`
`,(0,t.jsx)(n.p,{children:`Lets a coach create a named coaching space scoped to a squad roster, and
opens each program's live board: its shared topic sprint, its group-challenge
standings, and each member's generated drill set.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/coaching?section=programs`}),`, the Coaching Programs tab of `,(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/coaching`,children:`Coaching`}),` (the old `,(0,t.jsx)(n.code,{children:`/coaching/programs`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`A form to create a coaching space, then every persisted
`,(0,t.jsx)(n.code,{children:`CoachingProgramConfig`}),` with a roster badge list. Each program has a "View
board" action showing topic-sprint status, group-challenge standings, and a
"Member flows" roster for recording each member's practice round.`]}),`
`,(0,t.jsx)(n.h2,{id:`roster-analytics-dashboard`,children:`Roster analytics dashboard`}),`
`,(0,t.jsxs)(n.p,{children:[`A `,(0,t.jsx)(n.strong,{children:`Roster Analytics`}),` section shows every roster member's group-challenge
standing and daily-quest streak in one table, plus a `,(0,t.jsx)(n.strong,{children:`Recent challenge
results`}),` digest scoped to that program's roster.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/coachingPrograms.ts (localStorage: coachingPrograms)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildCoachingProgramsPanelView()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/CoachingProgramsPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/coaching-programs/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`No follow-ups remain open on the "roster analytics table doesn't fold in
drill-completion rate or practice-round counts" gap \u2014 the table now has
"Drills completed" and "Practice round" columns per member; see
Per-member drill/practice-round status
in that doc's "Per-member drill/practice-round status" section.`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};