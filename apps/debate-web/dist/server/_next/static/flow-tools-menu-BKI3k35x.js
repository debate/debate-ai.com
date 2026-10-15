import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Round Workspace \u2014 Tools for this round menu`},r=`# Round Workspace \u2014 "Tools for this round" menu [#round-workspace--tools-for-this-round-menu]

Adds a quick-access menu to the round workspace (\`/debate\`) linking
straight to the flow-driven analysis tools that act on whatever flow is
currently selected.

- **Nav:** a wrench-icon button in the round workspace sidebar's
  quick-action row
- **Package:** \`debate-round\`

## What it does [#what-it-does]

Clicking the wrench icon opens a menu of tools with their own "Generate
... for current round" action \u2014 Argument Tree Outline, AI Response-Outcome
Charts, Practice Drills, and AI Coach Mode \u2014 each disabled until a flow is
selected. Each target page also renders an "Other round tools" cross-link
row.

## Data flow [#data-flow]

\`\`\`
round/flow-tool-links.ts (pure)
  \u2192 FLOW_TOOL_LINKS / buildFlowToolsMenuItems(flow)
layout/FlowToolsMenu.tsx
layout/FlowPageSidebar.tsx
layout/RoundToolsCrossLinks.tsx
\`\`\`

## Known gaps [#known-gaps]

Only covers the four tools with a literal "Generate ... for current round"
action \u2014 narrower flow-reading panels were deliberately left out.
`,i={contents:[{heading:`round-workspace--tools-for-this-round-menu`,content:`Adds a quick-access menu to the round workspace (\`/debate\`) linking
straight to the flow-driven analysis tools that act on whatever flow is
currently selected.`},{heading:`round-workspace--tools-for-this-round-menu`,content:`**Nav:** a wrench-icon button in the round workspace sidebar's
quick-action row`},{heading:`round-workspace--tools-for-this-round-menu`,content:"**Package:** `debate-round`"},{heading:`what-it-does`,content:`Clicking the wrench icon opens a menu of tools with their own "Generate
... for current round" action \u2014 Argument Tree Outline, AI Response-Outcome
Charts, Practice Drills, and AI Coach Mode \u2014 each disabled until a flow is
selected. Each target page also renders an "Other round tools" cross-link
row.`},{heading:`known-gaps`,content:`Only covers the four tools with a literal "Generate ... for current round"
action \u2014 narrower flow-reading panels were deliberately left out.`}],headings:[{id:`round-workspace--tools-for-this-round-menu`,content:`Round Workspace \u2014 "Tools for this round" menu`},{id:`what-it-does`,content:`What it does`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#round-workspace--tools-for-this-round-menu`,title:(0,t.jsx)(t.Fragment,{children:`Round Workspace \u2014 "Tools for this round" menu`})},{depth:2,url:`#what-it-does`,title:(0,t.jsx)(t.Fragment,{children:`What it does`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`round-workspace--tools-for-this-round-menu`,children:`Round Workspace \u2014 "Tools for this round" menu`}),`
`,(0,t.jsxs)(n.p,{children:[`Adds a quick-access menu to the round workspace (`,(0,t.jsx)(n.code,{children:`/debate`}),`) linking
straight to the flow-driven analysis tools that act on whatever flow is
currently selected.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Nav:`}),` a wrench-icon button in the round workspace sidebar's
quick-action row`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-does`,children:`What it does`}),`
`,(0,t.jsx)(n.p,{children:`Clicking the wrench icon opens a menu of tools with their own "Generate
... for current round" action \u2014 Argument Tree Outline, AI Response-Outcome
Charts, Practice Drills, and AI Coach Mode \u2014 each disabled until a flow is
selected. Each target page also renders an "Other round tools" cross-link
row.`}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`round/flow-tool-links.ts (pure)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 FLOW_TOOL_LINKS / buildFlowToolsMenuItems(flow)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`layout/FlowToolsMenu.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`layout/FlowPageSidebar.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`layout/RoundToolsCrossLinks.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`Only covers the four tools with a literal "Generate ... for current round"
action \u2014 narrower flow-reading panels were deliberately left out.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};