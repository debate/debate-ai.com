import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Outline Filters and Argument Tree View`},r=`# Outline Filters and Argument Tree View [#outline-filters-and-argument-tree-view]

Renders a filterable, heading-grouped outline of a round's flow.

- **Route:** \`/outline\`
- **Nav:** the Tools page's Prep & Practice group; \`t outline\` in the Reason
  Editor's search palette
- **Package:** \`debate-round\`

## What it shows [#what-it-shows]

Every persisted \`ArgumentTreeRecord\` (one card per round). Each card has
seven filter controls \u2014 **Kind**, **Side**, **Speech**, **Argument type**,
**Contributor**, **Evidence status**, and an **Unanswered only** toggle.
Changing a control re-filters the tree in place and saves the chosen
filter through \`saveArgumentTreeFilterSelection\`.

## Map views [#map-views]

A switcher at the top of each round card picks how the (filtered) tree is
shown: **Outline** (the plain row list, where tagging and bulk selection
live) or one of five map views. The panel remembers the last view per
browser and opens on **Tiered tree** the first time.

| View | What it draws |
| --- | --- |
| Tiered tree | Kialo-style minimap: one small box per claim, in tiers |
| Sunburst | The round in the center, each ring one level deeper, wedges sized by how many claims sit under them |
| Mind map | The round in the middle, pros branching right and cons branching left, with labels |
| Bubble map | Nested circles: each claim's bubble holds its responses |
| Sankey | The round flowing into contentions, arguments and responses, widths by claim count |

The map is a claim hierarchy: the round at the root, each flow heading as
a contention, each argument row under its heading, and each later speech's
entry on that row as a response to the entry before it. Every claim is
colored **green (pro)** or **red (con)** relative to its parent, the way
Kialo does it: an aff/pro row supports the round, a response from the same
side extends its parent, and a response from the other side answers it.
A heading takes the side of most of its rows.

Under the chart, the focused claim sits in a large card with its parent
above it (the arrow walks back up) and its responses split into **Pros**
and **Cons** columns. Clicking any claim, in the chart or in a column,
focuses it; hovering a chart mark shows its full text. The d3 chart code
loads only when a map view is first shown.

## Filter presets [#filter-presets]

Each round card has a "Filter presets" row: apply a saved preset, or save
the round's current filter combination under a new name. Local-first and
best-effort account-synced through the same \`/api/settings\` row.

The panel also has one global "Saved filter presets" list, above every
round card. There, each preset's name records which round it was saved
from; clicking it applies that filter to its origin round and scrolls that
round's card into view, so a preset saved from a round that isn't currently
on screen is still reachable. A preset saved before this existed, or whose
origin round's outline was since cleared, stays inert there \u2014 it's still
usable from any round's own "Filter presets" dropdown.

## Tagging an argument from the flow grid [#tagging-an-argument-from-the-flow-grid]

Right-clicking any row in the live flow grid offers **Tag Argument\u2026**,
opening a popover with an Argument type select, Evidence status select, and
a Contributor field. Saving writes the tags onto the row's root \`Box\`.

## Outline export [#outline-export]

Each round card has a "Download outline" button that downloads the
flattened, filtered rows as a plain-text \`.txt\` outline.

## Data flow [#data-flow]

\`\`\`
flow/argument-tree.ts
  \u2192 buildArgumentTree(flow)
  \u2192 filterArgumentTree(tree, filter)
  \u2192 flattenArgumentTree(nodes)

state/argumentTrees.ts (localStorage: argumentTrees)
  \u2192 buildAndSaveArgumentTree(flow, roundId)
  \u2192 panels/ArgumentTreePanel.tsx
      \u2192 flow/argument-map.ts buildArgumentMap(filteredTree)   (pro/con claim hierarchy)
      \u2192 panels/argument-map/ArgumentMapView.tsx               (focus view + Pros/Cons)
      \u2192 panels/argument-map/ArgumentMapChart.tsx              (d3 layouts, React.lazy)
  \u2192 apps/debate-ai.com/app/outline/page.tsx
\`\`\`

## Known gaps [#known-gaps]

- Tagging is row-level, not per-speech.
- The contributor field is a free-form typed id, not an authenticated user.
- The map's root is labelled "Round \u2026" because outlines don't store the
  resolution, and a claim's pro/con stance comes only from which side's
  speech made it (there is no per-claim stance override).
- Tagging and bulk selection are only in the Outline view.
`,i={contents:[{heading:`outline-filters-and-argument-tree-view`,content:`Renders a filterable, heading-grouped outline of a round's flow.`},{heading:`outline-filters-and-argument-tree-view`,content:"**Route:** `/outline`"},{heading:`outline-filters-and-argument-tree-view`,content:"**Nav:** the Tools page's Prep & Practice group; `t outline` in the Reason\nEditor's search palette"},{heading:`outline-filters-and-argument-tree-view`,content:"**Package:** `debate-round`"},{heading:`what-it-shows`,content:`Every persisted \`ArgumentTreeRecord\` (one card per round). Each card has
seven filter controls \u2014 **Kind**, **Side**, **Speech**, **Argument type**,
**Contributor**, **Evidence status**, and an **Unanswered only** toggle.
Changing a control re-filters the tree in place and saves the chosen
filter through \`saveArgumentTreeFilterSelection\`.`},{heading:`map-views`,content:`A switcher at the top of each round card picks how the (filtered) tree is
shown: **Outline** (the plain row list, where tagging and bulk selection
live) or one of five map views. The panel remembers the last view per
browser and opens on **Tiered tree** the first time.`},{heading:`map-views`,content:`| View        | What it draws                                          |
| ----------- | ------------------------------------------------------ |
| Tiered tree | Kialo-style minimap: one small box per claim, in tiers |`,table:`table-0`},{heading:`map-views`,content:`| View     | What it draws                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------- |
| Sunburst | The round in the center, each ring one level deeper, wedges sized by how many claims sit under them |`,table:`table-0`},{heading:`map-views`,content:`| View     | What it draws                                                                      |
| -------- | ---------------------------------------------------------------------------------- |
| Mind map | The round in the middle, pros branching right and cons branching left, with labels |`,table:`table-0`},{heading:`map-views`,content:`| View       | What it draws                                           |
| ---------- | ------------------------------------------------------- |
| Bubble map | Nested circles: each claim's bubble holds its responses |`,table:`table-0`},{heading:`map-views`,content:`| View   | What it draws                                                                      |
| ------ | ---------------------------------------------------------------------------------- |
| Sankey | The round flowing into contentions, arguments and responses, widths by claim count |`,table:`table-0`},{heading:`map-views`,content:`The map is a claim hierarchy: the round at the root, each flow heading as
a contention, each argument row under its heading, and each later speech's
entry on that row as a response to the entry before it. Every claim is
colored **green (pro)** or **red (con)** relative to its parent, the way
Kialo does it: an aff/pro row supports the round, a response from the same
side extends its parent, and a response from the other side answers it.
A heading takes the side of most of its rows.`},{heading:`map-views`,content:`Under the chart, the focused claim sits in a large card with its parent
above it (the arrow walks back up) and its responses split into **Pros**
and **Cons** columns. Clicking any claim, in the chart or in a column,
focuses it; hovering a chart mark shows its full text. The d3 chart code
loads only when a map view is first shown.`},{heading:`filter-presets`,content:`Each round card has a "Filter presets" row: apply a saved preset, or save
the round's current filter combination under a new name. Local-first and
best-effort account-synced through the same \`/api/settings\` row.`},{heading:`filter-presets`,content:`The panel also has one global "Saved filter presets" list, above every
round card. There, each preset's name records which round it was saved
from; clicking it applies that filter to its origin round and scrolls that
round's card into view, so a preset saved from a round that isn't currently
on screen is still reachable. A preset saved before this existed, or whose
origin round's outline was since cleared, stays inert there \u2014 it's still
usable from any round's own "Filter presets" dropdown.`},{heading:`tagging-an-argument-from-the-flow-grid`,content:`Right-clicking any row in the live flow grid offers **Tag Argument\u2026**,
opening a popover with an Argument type select, Evidence status select, and
a Contributor field. Saving writes the tags onto the row's root \`Box\`.`},{heading:`outline-export`,content:'Each round card has a "Download outline" button that downloads the\nflattened, filtered rows as a plain-text `.txt` outline.'},{heading:`known-gaps`,content:`Tagging is row-level, not per-speech.`},{heading:`known-gaps`,content:`The contributor field is a free-form typed id, not an authenticated user.`},{heading:`known-gaps`,content:`The map's root is labelled "Round \u2026" because outlines don't store the
resolution, and a claim's pro/con stance comes only from which side's
speech made it (there is no per-claim stance override).`},{heading:`known-gaps`,content:`Tagging and bulk selection are only in the Outline view.`}],headings:[{id:`outline-filters-and-argument-tree-view`,content:`Outline Filters and Argument Tree View`},{id:`what-it-shows`,content:`What it shows`},{id:`map-views`,content:`Map views`},{id:`filter-presets`,content:`Filter presets`},{id:`tagging-an-argument-from-the-flow-grid`,content:`Tagging an argument from the flow grid`},{id:`outline-export`,content:`Outline export`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#outline-filters-and-argument-tree-view`,title:(0,t.jsx)(t.Fragment,{children:`Outline Filters and Argument Tree View`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#map-views`,title:(0,t.jsx)(t.Fragment,{children:`Map views`})},{depth:2,url:`#filter-presets`,title:(0,t.jsx)(t.Fragment,{children:`Filter presets`})},{depth:2,url:`#tagging-an-argument-from-the-flow-grid`,title:(0,t.jsx)(t.Fragment,{children:`Tagging an argument from the flow grid`})},{depth:2,url:`#outline-export`,title:(0,t.jsx)(t.Fragment,{children:`Outline export`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`outline-filters-and-argument-tree-view`,children:`Outline Filters and Argument Tree View`}),`
`,(0,t.jsx)(n.p,{children:`Renders a filterable, heading-grouped outline of a round's flow.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/outline`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Nav:`}),` the Tools page's Prep & Practice group; `,(0,t.jsx)(n.code,{children:`t outline`}),` in the Reason
Editor's search palette`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`Every persisted `,(0,t.jsx)(n.code,{children:`ArgumentTreeRecord`}),` (one card per round). Each card has
seven filter controls \u2014 `,(0,t.jsx)(n.strong,{children:`Kind`}),`, `,(0,t.jsx)(n.strong,{children:`Side`}),`, `,(0,t.jsx)(n.strong,{children:`Speech`}),`, `,(0,t.jsx)(n.strong,{children:`Argument type`}),`,
`,(0,t.jsx)(n.strong,{children:`Contributor`}),`, `,(0,t.jsx)(n.strong,{children:`Evidence status`}),`, and an `,(0,t.jsx)(n.strong,{children:`Unanswered only`}),` toggle.
Changing a control re-filters the tree in place and saves the chosen
filter through `,(0,t.jsx)(n.code,{children:`saveArgumentTreeFilterSelection`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`map-views`,children:`Map views`}),`
`,(0,t.jsxs)(n.p,{children:[`A switcher at the top of each round card picks how the (filtered) tree is
shown: `,(0,t.jsx)(n.strong,{children:`Outline`}),` (the plain row list, where tagging and bulk selection
live) or one of five map views. The panel remembers the last view per
browser and opens on `,(0,t.jsx)(n.strong,{children:`Tiered tree`}),` the first time.`]}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`View`}),(0,t.jsx)(n.th,{children:`What it draws`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Tiered tree`}),(0,t.jsx)(n.td,{children:`Kialo-style minimap: one small box per claim, in tiers`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Sunburst`}),(0,t.jsx)(n.td,{children:`The round in the center, each ring one level deeper, wedges sized by how many claims sit under them`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Mind map`}),(0,t.jsx)(n.td,{children:`The round in the middle, pros branching right and cons branching left, with labels`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Bubble map`}),(0,t.jsx)(n.td,{children:`Nested circles: each claim's bubble holds its responses`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Sankey`}),(0,t.jsx)(n.td,{children:`The round flowing into contentions, arguments and responses, widths by claim count`})]})]})]}),`
`,(0,t.jsxs)(n.p,{children:[`The map is a claim hierarchy: the round at the root, each flow heading as
a contention, each argument row under its heading, and each later speech's
entry on that row as a response to the entry before it. Every claim is
colored `,(0,t.jsx)(n.strong,{children:`green (pro)`}),` or `,(0,t.jsx)(n.strong,{children:`red (con)`}),` relative to its parent, the way
Kialo does it: an aff/pro row supports the round, a response from the same
side extends its parent, and a response from the other side answers it.
A heading takes the side of most of its rows.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Under the chart, the focused claim sits in a large card with its parent
above it (the arrow walks back up) and its responses split into `,(0,t.jsx)(n.strong,{children:`Pros`}),`
and `,(0,t.jsx)(n.strong,{children:`Cons`}),` columns. Clicking any claim, in the chart or in a column,
focuses it; hovering a chart mark shows its full text. The d3 chart code
loads only when a map view is first shown.`]}),`
`,(0,t.jsx)(n.h2,{id:`filter-presets`,children:`Filter presets`}),`
`,(0,t.jsxs)(n.p,{children:[`Each round card has a "Filter presets" row: apply a saved preset, or save
the round's current filter combination under a new name. Local-first and
best-effort account-synced through the same `,(0,t.jsx)(n.code,{children:`/api/settings`}),` row.`]}),`
`,(0,t.jsx)(n.p,{children:`The panel also has one global "Saved filter presets" list, above every
round card. There, each preset's name records which round it was saved
from; clicking it applies that filter to its origin round and scrolls that
round's card into view, so a preset saved from a round that isn't currently
on screen is still reachable. A preset saved before this existed, or whose
origin round's outline was since cleared, stays inert there \u2014 it's still
usable from any round's own "Filter presets" dropdown.`}),`
`,(0,t.jsx)(n.h2,{id:`tagging-an-argument-from-the-flow-grid`,children:`Tagging an argument from the flow grid`}),`
`,(0,t.jsxs)(n.p,{children:[`Right-clicking any row in the live flow grid offers `,(0,t.jsx)(n.strong,{children:`Tag Argument\u2026`}),`,
opening a popover with an Argument type select, Evidence status select, and
a Contributor field. Saving writes the tags onto the row's root `,(0,t.jsx)(n.code,{children:`Box`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`outline-export`,children:`Outline export`}),`
`,(0,t.jsxs)(n.p,{children:[`Each round card has a "Download outline" button that downloads the
flattened, filtered rows as a plain-text `,(0,t.jsx)(n.code,{children:`.txt`}),` outline.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`flow/argument-tree.ts`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildArgumentTree(flow)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 filterArgumentTree(tree, filter)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 flattenArgumentTree(nodes)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/argumentTrees.ts (localStorage: argumentTrees)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildAndSaveArgumentTree(flow, roundId)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/ArgumentTreePanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 flow/argument-map.ts buildArgumentMap(filteredTree)   (pro/con claim hierarchy)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 panels/argument-map/ArgumentMapView.tsx               (focus view + Pros/Cons)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 panels/argument-map/ArgumentMapChart.tsx              (d3 layouts, React.lazy)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/outline/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`Tagging is row-level, not per-speech.`}),`
`,(0,t.jsx)(n.li,{children:`The contributor field is a free-form typed id, not an authenticated user.`}),`
`,(0,t.jsx)(n.li,{children:`The map's root is labelled "Round \u2026" because outlines don't store the
resolution, and a claim's pro/con stance comes only from which side's
speech made it (there is no per-claim stance override).`}),`
`,(0,t.jsx)(n.li,{children:`Tagging and bulk selection are only in the Outline view.`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};