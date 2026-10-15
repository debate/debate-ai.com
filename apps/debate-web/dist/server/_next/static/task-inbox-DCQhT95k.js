import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Task Inbox`},r=`# Task Inbox [#task-inbox]

Shows every research task routed to a contributor, grouped by topic, so a
contributor or coach can see what's assigned, mark tasks done, and have a
different contributor verify them before they count as complete.

- **Route:** \`/research/team?section=inbox\`, the **[Team Research](/docs/features/research-evidence/team-research)** page's tab (the old \`/research/cards/inbox\` redirects there)
- **Package:** \`debate-card-search\`

## What it shows [#what-it-shows]

Per topic: task, coverage level, assignee, a "Mark done" action (moves to
**Awaiting verification**, requiring a different contributor's id to
**Verify**), a "Reassign"/"Assign to\u2026" control, a priority flag, a "My
tasks" filter, and a **Team capacity** view.

## Data flow [#data-flow]

\`\`\`
state/routedTaskQueues.ts (localStorage: routedTaskQueues)
  \u2192 buildTaskInboxView()
state/pendingTaskVerifications.ts (localStorage: pendingTaskVerifications)
  \u2192 verifyAndRecordResearchTask(...) \u2014 state/researchProgress.ts
  \u2192 panels/TaskInboxPanel.tsx
\`\`\`

Both stores account-sync via Tool Data Sync
(\`routedTaskQueues\` by \`topicId\`, \`pendingTaskVerifications\` by a derived
\`\${topicId}::\${argBlock}\` id), so a task marked done on one device still
shows up "Awaiting verification" for a teammate checking from another.

## Known gaps [#known-gaps]

"My tasks" is still free-form text \u2014 a signed-in session only prefills it.
No real "coach" role/permission system gates Reassign or priority.
`,i={contents:[{heading:`task-inbox`,content:`Shows every research task routed to a contributor, grouped by topic, so a
contributor or coach can see what's assigned, mark tasks done, and have a
different contributor verify them before they count as complete.`},{heading:`task-inbox`,content:"**Route:** `/research/team?section=inbox`, the **Team Research** page's tab (the old `/research/cards/inbox` redirects there)"},{heading:`task-inbox`,content:"**Package:** `debate-card-search`"},{heading:`what-it-shows`,content:`Per topic: task, coverage level, assignee, a "Mark done" action (moves to
**Awaiting verification**, requiring a different contributor's id to
**Verify**), a "Reassign"/"Assign to\u2026" control, a priority flag, a "My
tasks" filter, and a **Team capacity** view.`},{heading:`data-flow`,content:'Both stores account-sync via Tool Data Sync\n(`routedTaskQueues` by `topicId`, `pendingTaskVerifications` by a derived\n`${topicId}::${argBlock}` id), so a task marked done on one device still\nshows up "Awaiting verification" for a teammate checking from another.'},{heading:`known-gaps`,content:`"My tasks" is still free-form text \u2014 a signed-in session only prefills it.
No real "coach" role/permission system gates Reassign or priority.`}],headings:[{id:`task-inbox`,content:`Task Inbox`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#task-inbox`,title:(0,t.jsx)(t.Fragment,{children:`Task Inbox`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`task-inbox`,children:`Task Inbox`}),`
`,(0,t.jsx)(n.p,{children:`Shows every research task routed to a contributor, grouped by topic, so a
contributor or coach can see what's assigned, mark tasks done, and have a
different contributor verify them before they count as complete.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/team?section=inbox`}),`, the `,(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/team-research`,children:`Team Research`})}),` page's tab (the old `,(0,t.jsx)(n.code,{children:`/research/cards/inbox`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`Per topic: task, coverage level, assignee, a "Mark done" action (moves to
`,(0,t.jsx)(n.strong,{children:`Awaiting verification`}),`, requiring a different contributor's id to
`,(0,t.jsx)(n.strong,{children:`Verify`}),`), a "Reassign"/"Assign to\u2026" control, a priority flag, a "My
tasks" filter, and a `,(0,t.jsx)(n.strong,{children:`Team capacity`}),` view.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/routedTaskQueues.ts (localStorage: routedTaskQueues)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildTaskInboxView()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/pendingTaskVerifications.ts (localStorage: pendingTaskVerifications)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 verifyAndRecordResearchTask(...) \u2014 state/researchProgress.ts`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/TaskInboxPanel.tsx`})})]})})}),`
`,(0,t.jsxs)(n.p,{children:[`Both stores account-sync via Tool Data Sync
(`,(0,t.jsx)(n.code,{children:`routedTaskQueues`}),` by `,(0,t.jsx)(n.code,{children:`topicId`}),`, `,(0,t.jsx)(n.code,{children:`pendingTaskVerifications`}),` by a derived
`,(0,t.jsx)(n.code,{children:"${topicId}::${argBlock}"}),` id), so a task marked done on one device still
shows up "Awaiting verification" for a teammate checking from another.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`"My tasks" is still free-form text \u2014 a signed-in session only prefills it.
No real "coach" role/permission system gates Reassign or priority.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};