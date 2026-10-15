import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Team Calendar`},r=`# Team Calendar [#team-calendar]

A month calendar for each group of researchers you coach. Put research
tasks and assignments on a due date, assign them to members of the group,
watch who has finished, and schedule virtual tournaments that only that
group enters.

- **Route:** \`/coaching?section=calendar\` (sidebar \u2192 Coaching \u2192 Coach Workspace \u2192 Team Calendar tab; the old \`/coaching/calendar\` redirects there)
- **Package:** \`debate-team-collaboration\`

## Using it [#using-it]

1. **Pick a group.** Groups are your [Coaching Programs](/docs/features/ai-coaching/coaching-programs)
   rosters. You can also add one right on the calendar: give it a name and a
   comma-separated list of researchers.
2. **Pick a day** on the month grid. Arrows step between months; dots under a
   day show what's on it \u2014 blue for tasks, amber for assignments, violet for
   tournaments.
3. **Schedule** a task, assignment or tournament for that day. Choose who it is
   for (or **Everyone**), an optional time, and notes.
4. **Track it.** The day's agenda is split into **Tasks**, **Assignments** and
   **Tournaments** tabs. Tick a researcher's name when they finish their part;
   an entry everyone has finished shows **Done**, one past its date that isn't
   shows **Overdue**.

## Group virtual tournaments [#group-virtual-tournaments]

A tournament is a calendar entry whose entrants are the group's roster (all
of it unless you pick some). Choose the format (PF, LD or Policy) and up to
eight rounds; the card shows round-robin pairings, with a bye when the
group has an odd number of entrants. Nobody outside the group can be entered.

## Upcoming deadlines and workload [#upcoming-deadlines-and-workload]

The right-hand column lists every unfinished task and assignment, earliest
first so overdue work leads, and a table of each researcher's open, overdue
and finished items.

## Data and privacy [#data-and-privacy]

Entries are saved in your browser and, when you are signed in, synced to
your account like the other Coaching tools. An assignee must be on the
group's roster \u2014 the calendar refuses to assign work to anyone outside it.

## How it works [#how-it-works]

\`\`\`
lib/team-calendar.ts        month grid, agenda, deadlines, validation, pairings (pure)
state/teamCalendar.ts       localStorage: teamCalendarItems (+ tool-record mirror)
panels/TeamCalendarPanel.tsx
  \u2192 @debate/webview routes/team-calendar/page.tsx
  \u2192 @debate/webview components/coach/CoachingWorkspace.tsx ("calendar" tab)
  \u2192 apps/debate-ai.com/app/coaching/page.tsx
\`\`\`

## Known gaps [#known-gaps]

- Researchers are roster IDs, not linked accounts, so the calendar does not
  notify an assignee; completion is ticked by whoever has the calendar open.
- Tournament pairings are generated for display only \u2014 rounds aren't yet
  launched into the round workspace or scored on the group's standings.
- No recurring entries and no \`.ics\` export.
`,i={contents:[{heading:`team-calendar`,content:`A month calendar for each group of researchers you coach. Put research
tasks and assignments on a due date, assign them to members of the group,
watch who has finished, and schedule virtual tournaments that only that
group enters.`},{heading:`team-calendar`,content:"**Route:** `/coaching?section=calendar` (sidebar \u2192 Coaching \u2192 Coach Workspace \u2192 Team Calendar tab; the old `/coaching/calendar` redirects there)"},{heading:`team-calendar`,content:"**Package:** `debate-team-collaboration`"},{heading:`using-it`,content:`**Pick a group.** Groups are your Coaching Programs
rosters. You can also add one right on the calendar: give it a name and a
comma-separated list of researchers.`},{heading:`using-it`,content:`**Pick a day** on the month grid. Arrows step between months; dots under a
day show what's on it \u2014 blue for tasks, amber for assignments, violet for
tournaments.`},{heading:`using-it`,content:`**Schedule** a task, assignment or tournament for that day. Choose who it is
for (or **Everyone**), an optional time, and notes.`},{heading:`using-it`,content:`**Track it.** The day's agenda is split into **Tasks**, **Assignments** and
**Tournaments** tabs. Tick a researcher's name when they finish their part;
an entry everyone has finished shows **Done**, one past its date that isn't
shows **Overdue**.`},{heading:`group-virtual-tournaments`,content:`A tournament is a calendar entry whose entrants are the group's roster (all
of it unless you pick some). Choose the format (PF, LD or Policy) and up to
eight rounds; the card shows round-robin pairings, with a bye when the
group has an odd number of entrants. Nobody outside the group can be entered.`},{heading:`upcoming-deadlines-and-workload`,content:`The right-hand column lists every unfinished task and assignment, earliest
first so overdue work leads, and a table of each researcher's open, overdue
and finished items.`},{heading:`data-and-privacy`,content:`Entries are saved in your browser and, when you are signed in, synced to
your account like the other Coaching tools. An assignee must be on the
group's roster \u2014 the calendar refuses to assign work to anyone outside it.`},{heading:`known-gaps`,content:`Researchers are roster IDs, not linked accounts, so the calendar does not
notify an assignee; completion is ticked by whoever has the calendar open.`},{heading:`known-gaps`,content:`Tournament pairings are generated for display only \u2014 rounds aren't yet
launched into the round workspace or scored on the group's standings.`},{heading:`known-gaps`,content:"No recurring entries and no `.ics` export."}],headings:[{id:`team-calendar`,content:`Team Calendar`},{id:`using-it`,content:`Using it`},{id:`group-virtual-tournaments`,content:`Group virtual tournaments`},{id:`upcoming-deadlines-and-workload`,content:`Upcoming deadlines and workload`},{id:`data-and-privacy`,content:`Data and privacy`},{id:`how-it-works`,content:`How it works`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#team-calendar`,title:(0,t.jsx)(t.Fragment,{children:`Team Calendar`})},{depth:2,url:`#using-it`,title:(0,t.jsx)(t.Fragment,{children:`Using it`})},{depth:2,url:`#group-virtual-tournaments`,title:(0,t.jsx)(t.Fragment,{children:`Group virtual tournaments`})},{depth:2,url:`#upcoming-deadlines-and-workload`,title:(0,t.jsx)(t.Fragment,{children:`Upcoming deadlines and workload`})},{depth:2,url:`#data-and-privacy`,title:(0,t.jsx)(t.Fragment,{children:`Data and privacy`})},{depth:2,url:`#how-it-works`,title:(0,t.jsx)(t.Fragment,{children:`How it works`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,ol:`ol`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`team-calendar`,children:`Team Calendar`}),`
`,(0,t.jsx)(n.p,{children:`A month calendar for each group of researchers you coach. Put research
tasks and assignments on a due date, assign them to members of the group,
watch who has finished, and schedule virtual tournaments that only that
group enters.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/coaching?section=calendar`}),` (sidebar \u2192 Coaching \u2192 Coach Workspace \u2192 Team Calendar tab; the old `,(0,t.jsx)(n.code,{children:`/coaching/calendar`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-team-collaboration`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`using-it`,children:`Using it`}),`
`,(0,t.jsxs)(n.ol,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Pick a group.`}),` Groups are your `,(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/coaching-programs`,children:`Coaching Programs`}),`
rosters. You can also add one right on the calendar: give it a name and a
comma-separated list of researchers.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Pick a day`}),` on the month grid. Arrows step between months; dots under a
day show what's on it \u2014 blue for tasks, amber for assignments, violet for
tournaments.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Schedule`}),` a task, assignment or tournament for that day. Choose who it is
for (or `,(0,t.jsx)(n.strong,{children:`Everyone`}),`), an optional time, and notes.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Track it.`}),` The day's agenda is split into `,(0,t.jsx)(n.strong,{children:`Tasks`}),`, `,(0,t.jsx)(n.strong,{children:`Assignments`}),` and
`,(0,t.jsx)(n.strong,{children:`Tournaments`}),` tabs. Tick a researcher's name when they finish their part;
an entry everyone has finished shows `,(0,t.jsx)(n.strong,{children:`Done`}),`, one past its date that isn't
shows `,(0,t.jsx)(n.strong,{children:`Overdue`}),`.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`group-virtual-tournaments`,children:`Group virtual tournaments`}),`
`,(0,t.jsx)(n.p,{children:`A tournament is a calendar entry whose entrants are the group's roster (all
of it unless you pick some). Choose the format (PF, LD or Policy) and up to
eight rounds; the card shows round-robin pairings, with a bye when the
group has an odd number of entrants. Nobody outside the group can be entered.`}),`
`,(0,t.jsx)(n.h2,{id:`upcoming-deadlines-and-workload`,children:`Upcoming deadlines and workload`}),`
`,(0,t.jsx)(n.p,{children:`The right-hand column lists every unfinished task and assignment, earliest
first so overdue work leads, and a table of each researcher's open, overdue
and finished items.`}),`
`,(0,t.jsx)(n.h2,{id:`data-and-privacy`,children:`Data and privacy`}),`
`,(0,t.jsx)(n.p,{children:`Entries are saved in your browser and, when you are signed in, synced to
your account like the other Coaching tools. An assignee must be on the
group's roster \u2014 the calendar refuses to assign work to anyone outside it.`}),`
`,(0,t.jsx)(n.h2,{id:`how-it-works`,children:`How it works`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`lib/team-calendar.ts        month grid, agenda, deadlines, validation, pairings (pure)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/teamCalendar.ts       localStorage: teamCalendarItems (+ tool-record mirror)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`panels/TeamCalendarPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 @debate/webview routes/team-calendar/page.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 @debate/webview components/coach/CoachingWorkspace.tsx ("calendar" tab)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/coaching/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`Researchers are roster IDs, not linked accounts, so the calendar does not
notify an assignee; completion is ticked by whoever has the calendar open.`}),`
`,(0,t.jsx)(n.li,{children:`Tournament pairings are generated for display only \u2014 rounds aren't yet
launched into the round workspace or scored on the group's standings.`}),`
`,(0,t.jsxs)(n.li,{children:[`No recurring entries and no `,(0,t.jsx)(n.code,{children:`.ics`}),` export.`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};