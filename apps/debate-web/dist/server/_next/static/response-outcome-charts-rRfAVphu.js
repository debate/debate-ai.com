import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`AI Response-Outcome Charts`},r=`# AI Response-Outcome Charts [#ai-response-outcome-charts]

Shows every persisted vulnerability report, one card per round \u2014 a
per-side exposure summary plus a "most exposed arguments" bar chart.

- **Route:** \`/coaching/outcomes\`
- **Package:** \`debate-round\`

## What it shows [#what-it-shows]

A per-side exposure summary, a "most exposed arguments" bar chart with a
per-argument "what if" (Extend/Answer/Concede) picker, an "AI Counsel
Panel" action calling a real three-role AI panel (Policy/Critique/Weighing
Counsel) with an append-only assessment history, and a "Download report"
plain-text export.

## Data flow [#data-flow]

\`\`\`
flow/response-outcome.ts
  \u2192 scoreArgumentVulnerability(row) / getArgumentVulnerabilityReport(flow)
state/vulnerabilityReports.ts (localStorage: vulnerabilityReports)
  \u2192 panels/VulnerabilityChartsPanel.tsx
  \u2192 apps/debate-ai.com/app/outcomes/page.tsx

"Get AI counsel panel":
  \u2192 flow/response-outcome-ai.ts + flow/response-outcome-client.ts \u2192 POST /api/reason-ai
\`\`\`

## Known gaps [#known-gaps]

None remain open for this idea.
`,i={contents:[{heading:`ai-response-outcome-charts`,content:`Shows every persisted vulnerability report, one card per round \u2014 a
per-side exposure summary plus a "most exposed arguments" bar chart.`},{heading:`ai-response-outcome-charts`,content:"**Route:** `/coaching/outcomes`"},{heading:`ai-response-outcome-charts`,content:"**Package:** `debate-round`"},{heading:`what-it-shows`,content:`A per-side exposure summary, a "most exposed arguments" bar chart with a
per-argument "what if" (Extend/Answer/Concede) picker, an "AI Counsel
Panel" action calling a real three-role AI panel (Policy/Critique/Weighing
Counsel) with an append-only assessment history, and a "Download report"
plain-text export.`},{heading:`known-gaps`,content:`None remain open for this idea.`}],headings:[{id:`ai-response-outcome-charts`,content:`AI Response-Outcome Charts`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#ai-response-outcome-charts`,title:(0,t.jsx)(t.Fragment,{children:`AI Response-Outcome Charts`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`ai-response-outcome-charts`,children:`AI Response-Outcome Charts`}),`
`,(0,t.jsx)(n.p,{children:`Shows every persisted vulnerability report, one card per round \u2014 a
per-side exposure summary plus a "most exposed arguments" bar chart.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/coaching/outcomes`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsx)(n.p,{children:`A per-side exposure summary, a "most exposed arguments" bar chart with a
per-argument "what if" (Extend/Answer/Concede) picker, an "AI Counsel
Panel" action calling a real three-role AI panel (Policy/Critique/Weighing
Counsel) with an append-only assessment history, and a "Download report"
plain-text export.`}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`flow/response-outcome.ts`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 scoreArgumentVulnerability(row) / getArgumentVulnerabilityReport(flow)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/vulnerabilityReports.ts (localStorage: vulnerabilityReports)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/VulnerabilityChartsPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/outcomes/page.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`"Get AI counsel panel":`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 flow/response-outcome-ai.ts + flow/response-outcome-client.ts \u2192 POST /api/reason-ai`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`None remain open for this idea.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};