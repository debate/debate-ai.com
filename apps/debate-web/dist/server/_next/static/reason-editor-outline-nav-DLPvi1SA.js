import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Expandable Heading Structure`},r=`# Expandable Heading Structure \u2014 outline nav panel + heading breadcrumb [#expandable-heading-structure--outline-nav-panel--heading-breadcrumb]

Renders a heading nav/outline panel alongside the document, plus a sticky
"current heading" breadcrumb, in CardMirror (the editor behind
\`/reason-editor\`).

- **Route:** \`/reason-editor\` (and every other CardMirror-hosted surface)
- **Package:** \`debate-editor\`

## What it shows [#what-it-shows]

**Nav panel** \u2014 every heading-anchored node in the live document, indented
by level, with collapse, drag-and-drop reordering, multi-select, a
per-level filter, and caret-follow highlighting. Defaults to visible on
every CardMirror host except \`/reason-editor\`, which renders its own
file-tree/Open-Tabs sidebar beside the editor and therefore starts the
nav pane hidden \u2014 the left-edge pull-tab or the View-menu toggle re-shows
it there.

Tag rows wrap to two compact lines of small text, with the card's cite
(author and year) in bold underneath, so the author is visible without
hovering. Every pocket, hat and block row has a copy button (shown on
hover); it and the row's right-click menu offer **Copy all tags** (every
tag under that heading, one per line) and **Copy tags, cites & highlighted
text** (each card's tag, cite and highlighted text).

**Heading breadcrumb** \u2014 a sticky one-line ancestor trail (e.g. "Case \u203A
Advantage 1 \u203A Uniqueness") for whichever heading is at the top of the
current scroll position, each segment clickable.

## Data flow [#data-flow]

\`\`\`
editor/headings.ts \u2192 collectHeadings(doc)
editor/nav-panel.ts (NavigationPanel)
editor/heading-breadcrumb.ts \u2192 computeBreadcrumbPath(headings, pos)
editor/heading-breadcrumb-bar.ts (HeadingBreadcrumbBar)
editor/multi-pane-shell.ts \u2192 one HeadingBreadcrumbBar per pane, scoped to
                              that pane's own .pmd-pane-body scroller/view
\`\`\`

## Known gaps [#known-gaps]

The breadcrumb now has one instance per multi-pane pane too
(\`multi-pane-shell.ts\` mounts its own \`HeadingBreadcrumbBar\` scoped to that
pane's scroller), on top of the original single-doc one. Multi-window still
doesn't have one.
`,i={contents:[{heading:`expandable-heading-structure--outline-nav-panel--heading-breadcrumb`,content:`Renders a heading nav/outline panel alongside the document, plus a sticky
"current heading" breadcrumb, in CardMirror (the editor behind
\`/reason-editor\`).`},{heading:`expandable-heading-structure--outline-nav-panel--heading-breadcrumb`,content:"**Route:** `/reason-editor` (and every other CardMirror-hosted surface)"},{heading:`expandable-heading-structure--outline-nav-panel--heading-breadcrumb`,content:"**Package:** `debate-editor`"},{heading:`what-it-shows`,content:`**Nav panel** \u2014 every heading-anchored node in the live document, indented
by level, with collapse, drag-and-drop reordering, multi-select, a
per-level filter, and caret-follow highlighting. Defaults to visible on
every CardMirror host except \`/reason-editor\`, which renders its own
file-tree/Open-Tabs sidebar beside the editor and therefore starts the
nav pane hidden \u2014 the left-edge pull-tab or the View-menu toggle re-shows
it there.`},{heading:`what-it-shows`,content:`Tag rows wrap to two compact lines of small text, with the card's cite
(author and year) in bold underneath, so the author is visible without
hovering. Every pocket, hat and block row has a copy button (shown on
hover); it and the row's right-click menu offer **Copy all tags** (every
tag under that heading, one per line) and **Copy tags, cites & highlighted
text** (each card's tag, cite and highlighted text).`},{heading:`what-it-shows`,content:`**Heading breadcrumb** \u2014 a sticky one-line ancestor trail (e.g. "Case \u203A
Advantage 1 \u203A Uniqueness") for whichever heading is at the top of the
current scroll position, each segment clickable.`},{heading:`known-gaps`,content:"The breadcrumb now has one instance per multi-pane pane too\n(`multi-pane-shell.ts` mounts its own `HeadingBreadcrumbBar` scoped to that\npane's scroller), on top of the original single-doc one. Multi-window still\ndoesn't have one."}],headings:[{id:`expandable-heading-structure--outline-nav-panel--heading-breadcrumb`,content:`Expandable Heading Structure \u2014 outline nav panel + heading breadcrumb`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#expandable-heading-structure--outline-nav-panel--heading-breadcrumb`,title:(0,t.jsx)(t.Fragment,{children:`Expandable Heading Structure \u2014 outline nav panel + heading breadcrumb`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`expandable-heading-structure--outline-nav-panel--heading-breadcrumb`,children:`Expandable Heading Structure \u2014 outline nav panel + heading breadcrumb`}),`
`,(0,t.jsxs)(n.p,{children:[`Renders a heading nav/outline panel alongside the document, plus a sticky
"current heading" breadcrumb, in CardMirror (the editor behind
`,(0,t.jsx)(n.code,{children:`/reason-editor`}),`).`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/reason-editor`}),` (and every other CardMirror-hosted surface)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-editor`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Nav panel`}),` \u2014 every heading-anchored node in the live document, indented
by level, with collapse, drag-and-drop reordering, multi-select, a
per-level filter, and caret-follow highlighting. Defaults to visible on
every CardMirror host except `,(0,t.jsx)(n.code,{children:`/reason-editor`}),`, which renders its own
file-tree/Open-Tabs sidebar beside the editor and therefore starts the
nav pane hidden \u2014 the left-edge pull-tab or the View-menu toggle re-shows
it there.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Tag rows wrap to two compact lines of small text, with the card's cite
(author and year) in bold underneath, so the author is visible without
hovering. Every pocket, hat and block row has a copy button (shown on
hover); it and the row's right-click menu offer `,(0,t.jsx)(n.strong,{children:`Copy all tags`}),` (every
tag under that heading, one per line) and `,(0,t.jsx)(n.strong,{children:`Copy tags, cites & highlighted
text`}),` (each card's tag, cite and highlighted text).`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Heading breadcrumb`}),` \u2014 a sticky one-line ancestor trail (e.g. "Case \u203A
Advantage 1 \u203A Uniqueness") for whichever heading is at the top of the
current scroll position, each segment clickable.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`editor/headings.ts \u2192 collectHeadings(doc)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`editor/nav-panel.ts (NavigationPanel)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`editor/heading-breadcrumb.ts \u2192 computeBreadcrumbPath(headings, pos)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`editor/heading-breadcrumb-bar.ts (HeadingBreadcrumbBar)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`editor/multi-pane-shell.ts \u2192 one HeadingBreadcrumbBar per pane, scoped to`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`                              that pane's own .pmd-pane-body scroller/view`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[`The breadcrumb now has one instance per multi-pane pane too
(`,(0,t.jsx)(n.code,{children:`multi-pane-shell.ts`}),` mounts its own `,(0,t.jsx)(n.code,{children:`HeadingBreadcrumbBar`}),` scoped to that
pane's scroller), on top of the original single-doc one. Multi-window still
doesn't have one.`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};