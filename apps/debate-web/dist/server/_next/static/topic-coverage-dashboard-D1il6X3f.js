import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Topic Coverage Dashboard`},r=`# Topic Coverage Dashboard [#topic-coverage-dashboard]

Tracks a topic's argument checklist and shows which arguments are
well-covered, thin, or missing entirely, based on cards already submitted
to the shared evidence library.

- **Route:** \`/research/team?section=coverage\`, the **[Team Research](/docs/features/research-evidence/team-research)** page's tab (the old \`/research/cards/coverage\` redirects there)
- **Package:** \`debate-card-search\`

## What it shows [#what-it-shows]

A topic switcher, an "Add to checklist" form, coverage rows (missing/
thin/covered, card count, word count), a "Needs the most work" list, and an
untracked section for submitted-but-unchecklisted argument blocks.

## Data flow [#data-flow]

\`\`\`
state/trackedArguments.ts (localStorage \u2014 topic checklist)
  \u2192 buildPersistedTopicCoverageReport(topic)
      \u2192 buildTopicCoverageReport() \u2014 lib/topic-coverage.ts (pure)
  \u2192 panels/TopicCoverageDashboardPanel.tsx
  \u2192 apps/debate-ai.com/app/cards/coverage/page.tsx
\`\`\`

## Known gaps [#known-gaps]

The checklist (\`trackedArguments\`) syncs to a signed-in user's account \u2014
see Tool Data Sync \u2014 but still per-user,
not a shared team resource: two contributors tracking the same topic each
keep their own checklist rather than editing one shared list.
`,i={contents:[{heading:`topic-coverage-dashboard`,content:`Tracks a topic's argument checklist and shows which arguments are
well-covered, thin, or missing entirely, based on cards already submitted
to the shared evidence library.`},{heading:`topic-coverage-dashboard`,content:"**Route:** `/research/team?section=coverage`, the **Team Research** page's tab (the old `/research/cards/coverage` redirects there)"},{heading:`topic-coverage-dashboard`,content:"**Package:** `debate-card-search`"},{heading:`what-it-shows`,content:`A topic switcher, an "Add to checklist" form, coverage rows (missing/
thin/covered, card count, word count), a "Needs the most work" list, and an
untracked section for submitted-but-unchecklisted argument blocks.`},{heading:`known-gaps`,content:`The checklist (\`trackedArguments\`) syncs to a signed-in user's account \u2014
see Tool Data Sync \u2014 but still per-user,
not a shared team resource: two contributors tracking the same topic each
keep their own checklist rather than editing one shared list.`}],headings:[{id:`topic-coverage-dashboard`,content:`Topic Coverage Dashboard`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#topic-coverage-dashboard`,title:(0,t.jsx)(t.Fragment,{children:`Topic Coverage Dashboard`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`topic-coverage-dashboard`,children:`Topic Coverage Dashboard`}),`
`,(0,t.jsx)(n.p,{children:`Tracks a topic's argument checklist and shows which arguments are
well-covered, thin, or missing entirely, based on cards already submitted
to the shared evidence library.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/team?section=coverage`}),`, the `,(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/team-research`,children:`Team Research`})}),` page's tab (the old `,(0,t.jsx)(n.code,{children:`/research/cards/coverage`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsx)(n.p,{children:`A topic switcher, an "Add to checklist" form, coverage rows (missing/
thin/covered, card count, word count), a "Needs the most work" list, and an
untracked section for submitted-but-unchecklisted argument blocks.`}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/trackedArguments.ts (localStorage \u2014 topic checklist)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildPersistedTopicCoverageReport(topic)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 buildTopicCoverageReport() \u2014 lib/topic-coverage.ts (pure)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/TopicCoverageDashboardPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/cards/coverage/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[`The checklist (`,(0,t.jsx)(n.code,{children:`trackedArguments`}),`) syncs to a signed-in user's account \u2014
see Tool Data Sync \u2014 but still per-user,
not a shared team resource: two contributors tracking the same topic each
keep their own checklist rather than editing one shared list.`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};