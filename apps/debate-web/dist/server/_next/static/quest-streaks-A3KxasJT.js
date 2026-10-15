import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Quest Streaks`},r=`# Quest Streaks [#quest-streaks]

A roster of every contributor's daily-quest streak and milestone badges,
plus an on-demand action to compute today's mission result.

- **Route:** \`/research/cards/streaks\`
- **Package:** \`debate-community\`

## What it shows [#what-it-shows]

Current/longest streak, badges, a **streak freeze** ("grace day") action
for a missed day (up to 2 per rolling 30 days), and an opt-in
streak-lapse reminder banner. The mission-result history the streak/badge
state is computed from follows the signed-in visitor to another device for
every contributor's row this browser knows about, and the signed-in
visitor's own streak freezes and reminder opt-in follow them too; see
Quest Streaks for how.

## Data flow [#data-flow]

\`\`\`
state/dailyMissionResults.ts (localStorage: dailyMissionResults)
  \u2192 synced via the account's saved tool records (see the internals doc)
state/streakFreezes.ts (localStorage: streakFreezes)
state/streakLapseReminders.ts (localStorage: streakLapseReminders)
  \u2192 buildQuestStreakRosterWithFreezes(todayUtcDayKey())
  \u2192 panels/QuestStreaksPanel.tsx
  \u2192 hooks/useQuestStreakSync.ts \u2014 syncs the signed-in visitor's own freezes/
      opt-in/mission-result history to their account (see the internals doc)
  \u2192 apps/debate-ai.com/app/cards/streaks/page.tsx
\`\`\`

## Known gaps [#known-gaps]

The trigger is a manual button click, not a scheduled job \u2014 nothing wires
mission-result computation to the repo's cron trigger (see the internals
doc), so it doesn't run on its own. Every contributor's mission-result
history this browser has locally computed or received syncs to the
signed-in visitor's account, but a row for a contributor no signed-in
device has ever computed a result for locally can't appear from nowhere \u2014
there's no contributor-identity system to fetch one on demand. Streak
freezes and the reminder opt-in only ever sync for the signed-in visitor's
own row, never any other contributor's, for the same reason.
`,i={contents:[{heading:`quest-streaks`,content:`A roster of every contributor's daily-quest streak and milestone badges,
plus an on-demand action to compute today's mission result.`},{heading:`quest-streaks`,content:"**Route:** `/research/cards/streaks`"},{heading:`quest-streaks`,content:"**Package:** `debate-community`"},{heading:`what-it-shows`,content:`Current/longest streak, badges, a **streak freeze** ("grace day") action
for a missed day (up to 2 per rolling 30 days), and an opt-in
streak-lapse reminder banner. The mission-result history the streak/badge
state is computed from follows the signed-in visitor to another device for
every contributor's row this browser knows about, and the signed-in
visitor's own streak freezes and reminder opt-in follow them too; see
Quest Streaks for how.`},{heading:`known-gaps`,content:`The trigger is a manual button click, not a scheduled job \u2014 nothing wires
mission-result computation to the repo's cron trigger (see the internals
doc), so it doesn't run on its own. Every contributor's mission-result
history this browser has locally computed or received syncs to the
signed-in visitor's account, but a row for a contributor no signed-in
device has ever computed a result for locally can't appear from nowhere \u2014
there's no contributor-identity system to fetch one on demand. Streak
freezes and the reminder opt-in only ever sync for the signed-in visitor's
own row, never any other contributor's, for the same reason.`}],headings:[{id:`quest-streaks`,content:`Quest Streaks`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#quest-streaks`,title:(0,t.jsx)(t.Fragment,{children:`Quest Streaks`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`quest-streaks`,children:`Quest Streaks`}),`
`,(0,t.jsx)(n.p,{children:`A roster of every contributor's daily-quest streak and milestone badges,
plus an on-demand action to compute today's mission result.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/cards/streaks`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-community`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`Current/longest streak, badges, a `,(0,t.jsx)(n.strong,{children:`streak freeze`}),` ("grace day") action
for a missed day (up to 2 per rolling 30 days), and an opt-in
streak-lapse reminder banner. The mission-result history the streak/badge
state is computed from follows the signed-in visitor to another device for
every contributor's row this browser knows about, and the signed-in
visitor's own streak freezes and reminder opt-in follow them too; see
Quest Streaks for how.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/dailyMissionResults.ts (localStorage: dailyMissionResults)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 synced via the account's saved tool records (see the internals doc)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/streakFreezes.ts (localStorage: streakFreezes)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/streakLapseReminders.ts (localStorage: streakLapseReminders)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildQuestStreakRosterWithFreezes(todayUtcDayKey())`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/QuestStreaksPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 hooks/useQuestStreakSync.ts \u2014 syncs the signed-in visitor's own freezes/`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      opt-in/mission-result history to their account (see the internals doc)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/cards/streaks/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`The trigger is a manual button click, not a scheduled job \u2014 nothing wires
mission-result computation to the repo's cron trigger (see the internals
doc), so it doesn't run on its own. Every contributor's mission-result
history this browser has locally computed or received syncs to the
signed-in visitor's account, but a row for a contributor no signed-in
device has ever computed a result for locally can't appear from nowhere \u2014
there's no contributor-identity system to fetch one on demand. Streak
freezes and the reminder opt-in only ever sync for the signed-in visitor's
own row, never any other contributor's, for the same reason.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};