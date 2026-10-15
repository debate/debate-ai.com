import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Prep Notes`},r=`# Prep Notes [#prep-notes]

Shows every persisted "Strategy Sync Notes" note across every flow,
grouped by status (needs follow-up first), with a "cycle status" action and
an "assign to" control for handing a note off as a task.

- **Route:** \`/practice/prep?section=notes\`, a tab of the [Prep Workspace](/docs/features/rounds/prep-workspace) (the old \`/practice/prep-notes\` redirects there)
- **Package:** \`debate-round\`

## What it shows [#what-it-shows]

Notes grouped into Needs follow-up / Open / Covered, each with a priority
flag, an assignee, a status-cycle button, and a **Replies** thread. A
related **Notifications** page (\`/notifications\`) shows assignment digests
per day. Each note has a "Jump to argument" link back into the live flow
grid, and a note can be created directly from a \`FlowSpreadsheet\` cell
badge.

## Data flow [#data-flow]

\`\`\`
state/prepNotes.ts (localStorage: prepNotes)
  \u2192 buildPrepNotesPanelView()
  \u2192 panels/PrepNotesPanel.tsx
  \u2192 apps/debate-ai.com/app/prep-notes/page.tsx
\`\`\`

## Known gaps [#known-gaps]

A reply's "Your name" field is free-form text, not an authenticated
identity \u2014 signed in, it prefills from your account, but you can still
type over it. Notifications are in-app only, covering prep-note
assignment.
`,i={contents:[{heading:`prep-notes`,content:`Shows every persisted "Strategy Sync Notes" note across every flow,
grouped by status (needs follow-up first), with a "cycle status" action and
an "assign to" control for handing a note off as a task.`},{heading:`prep-notes`,content:"**Route:** `/practice/prep?section=notes`, a tab of the Prep Workspace (the old `/practice/prep-notes` redirects there)"},{heading:`prep-notes`,content:"**Package:** `debate-round`"},{heading:`what-it-shows`,content:`Notes grouped into Needs follow-up / Open / Covered, each with a priority
flag, an assignee, a status-cycle button, and a **Replies** thread. A
related **Notifications** page (\`/notifications\`) shows assignment digests
per day. Each note has a "Jump to argument" link back into the live flow
grid, and a note can be created directly from a \`FlowSpreadsheet\` cell
badge.`},{heading:`known-gaps`,content:`A reply's "Your name" field is free-form text, not an authenticated
identity \u2014 signed in, it prefills from your account, but you can still
type over it. Notifications are in-app only, covering prep-note
assignment.`}],headings:[{id:`prep-notes`,content:`Prep Notes`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#prep-notes`,title:(0,t.jsx)(t.Fragment,{children:`Prep Notes`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`prep-notes`,children:`Prep Notes`}),`
`,(0,t.jsx)(n.p,{children:`Shows every persisted "Strategy Sync Notes" note across every flow,
grouped by status (needs follow-up first), with a "cycle status" action and
an "assign to" control for handing a note off as a task.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/practice/prep?section=notes`}),`, a tab of the `,(0,t.jsx)(n.a,{href:`/docs/features/rounds/prep-workspace`,children:`Prep Workspace`}),` (the old `,(0,t.jsx)(n.code,{children:`/practice/prep-notes`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`Notes grouped into Needs follow-up / Open / Covered, each with a priority
flag, an assignee, a status-cycle button, and a `,(0,t.jsx)(n.strong,{children:`Replies`}),` thread. A
related `,(0,t.jsx)(n.strong,{children:`Notifications`}),` page (`,(0,t.jsx)(n.code,{children:`/notifications`}),`) shows assignment digests
per day. Each note has a "Jump to argument" link back into the live flow
grid, and a note can be created directly from a `,(0,t.jsx)(n.code,{children:`FlowSpreadsheet`}),` cell
badge.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/prepNotes.ts (localStorage: prepNotes)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildPrepNotesPanelView()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/PrepNotesPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/prep-notes/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`A reply's "Your name" field is free-form text, not an authenticated
identity \u2014 signed in, it prefills from your account, but you can still
type over it. Notifications are in-app only, covering prep-note
assignment.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};