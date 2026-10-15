import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Features Page`},r=`# Features Page [#features-page]

One page that outlines every user-facing surface in the app: each
feature's name, a one-line description, its route, and a link to its
long-form doc, grouped into seven categories and filtered by a search box.

- **Route:** \`/practice/features\`
- **Panel:** \`apps/debate-ai.com/lib/ui/features/FeaturesPanel.tsx\`
  (catalog data lives in \`debate-webview\`'s \`src/lib/feature-catalog.ts\`)

## Why this exists [#why-this-exists]

Nothing in the app listed everything it does \u2014 the dock's Settings menu is
a flat list of forty-odd items, \`/research\` and \`/coaching\` each tab across
one package's panels, and the feature catalog deliberately omits core
workspaces and standings. This page is the map.

## What it shows [#what-it-shows]

The same banner and badge rows as the repository's root \`README.md\`, a
header count line, a strip of the five workspace screenshots from the README
(CARDS, FIAT, LEARN, STREAM, REASON) each linking to its route, the CARDS
overview and seven-point vision (anchored at \`#cards-vision\`), a **Downloads**
section under the badges (the Chrome extension install button, which used to
sit on the card search's empty state), a search box (matching title/description/route/hidden
tags), and a tab bar of the feature categories (Core Workspaces, Evidence &
Research, Team Collaboration, Flowing & Round Analysis, Pre-Round
Intelligence, Practice & Coaching, Recognition & Progress), each tab showing
its feature count. One category is shown at a time: the first tab is
selected on load, clicking a tab shows only that category's feature cards,
and a \`#<category>\` link (for example \`/features#practice\`) opens on that
tab. Searching narrows every tab's count, and if the selected tab has no
matches the first tab that does is shown. Each feature card links to its
route and docs page.

Pointing at a card lights it up \u2014 a gradient that follows the cursor, a
glowing border and a coloured title \u2014 in a shade of its own, so neighbouring
cards never come up the same colour.

## How it works [#how-it-works]

\`debate-webview\`'s \`src/lib/feature-catalog.ts\` holds the pure data
(\`APP_FEATURES\`, \`buildFeatureSections\`, \`searchFeatures\`); \`FeaturesPanel.tsx\`
renders it. Titles/descriptions are copied from each route's own metadata.
The README's banner, badges and imgur screenshots are mirrored in
\`features/readme-media.ts\`; a test compares it against \`README.md\` and fails
when the two drift, so edit the README first and then the mirror.

## Known gaps [#known-gaps]

The catalog is a hand-maintained registry \u2014 a new route has to be added to
it separately.
`,i={contents:[{heading:`features-page`,content:`One page that outlines every user-facing surface in the app: each
feature's name, a one-line description, its route, and a link to its
long-form doc, grouped into seven categories and filtered by a search box.`},{heading:`features-page`,content:"**Route:** `/practice/features`"},{heading:`features-page`,content:"**Panel:** `apps/debate-ai.com/lib/ui/features/FeaturesPanel.tsx`\n(catalog data lives in `debate-webview`'s `src/lib/feature-catalog.ts`)"},{heading:`why-this-exists`,content:"Nothing in the app listed everything it does \u2014 the dock's Settings menu is\na flat list of forty-odd items, `/research` and `/coaching` each tab across\none package's panels, and the feature catalog deliberately omits core\nworkspaces and standings. This page is the map."},{heading:`what-it-shows`,content:`The same banner and badge rows as the repository's root \`README.md\`, a
header count line, a strip of the five workspace screenshots from the README
(CARDS, FIAT, LEARN, STREAM, REASON) each linking to its route, the CARDS
overview and seven-point vision (anchored at \`#cards-vision\`), a **Downloads**
section under the badges (the Chrome extension install button, which used to
sit on the card search's empty state), a search box (matching title/description/route/hidden
tags), and a tab bar of the feature categories (Core Workspaces, Evidence &
Research, Team Collaboration, Flowing & Round Analysis, Pre-Round
Intelligence, Practice & Coaching, Recognition & Progress), each tab showing
its feature count. One category is shown at a time: the first tab is
selected on load, clicking a tab shows only that category's feature cards,
and a \`#<category>\` link (for example \`/features#practice\`) opens on that
tab. Searching narrows every tab's count, and if the selected tab has no
matches the first tab that does is shown. Each feature card links to its
route and docs page.`},{heading:`what-it-shows`,content:`Pointing at a card lights it up \u2014 a gradient that follows the cursor, a
glowing border and a coloured title \u2014 in a shade of its own, so neighbouring
cards never come up the same colour.`},{heading:`how-it-works`,content:"`debate-webview`'s `src/lib/feature-catalog.ts` holds the pure data\n(`APP_FEATURES`, `buildFeatureSections`, `searchFeatures`); `FeaturesPanel.tsx`\nrenders it. Titles/descriptions are copied from each route's own metadata.\nThe README's banner, badges and imgur screenshots are mirrored in\n`features/readme-media.ts`; a test compares it against `README.md` and fails\nwhen the two drift, so edit the README first and then the mirror."},{heading:`known-gaps`,content:`The catalog is a hand-maintained registry \u2014 a new route has to be added to
it separately.`}],headings:[{id:`features-page`,content:`Features Page`},{id:`why-this-exists`,content:`Why this exists`},{id:`what-it-shows`,content:`What it shows`},{id:`how-it-works`,content:`How it works`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#features-page`,title:(0,t.jsx)(t.Fragment,{children:`Features Page`})},{depth:2,url:`#why-this-exists`,title:(0,t.jsx)(t.Fragment,{children:`Why this exists`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#how-it-works`,title:(0,t.jsx)(t.Fragment,{children:`How it works`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`features-page`,children:`Features Page`}),`
`,(0,t.jsx)(n.p,{children:`One page that outlines every user-facing surface in the app: each
feature's name, a one-line description, its route, and a link to its
long-form doc, grouped into seven categories and filtered by a search box.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/practice/features`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Panel:`}),` `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/ui/features/FeaturesPanel.tsx`}),`
(catalog data lives in `,(0,t.jsx)(n.code,{children:`debate-webview`}),`'s `,(0,t.jsx)(n.code,{children:`src/lib/feature-catalog.ts`}),`)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`why-this-exists`,children:`Why this exists`}),`
`,(0,t.jsxs)(n.p,{children:[`Nothing in the app listed everything it does \u2014 the dock's Settings menu is
a flat list of forty-odd items, `,(0,t.jsx)(n.code,{children:`/research`}),` and `,(0,t.jsx)(n.code,{children:`/coaching`}),` each tab across
one package's panels, and the feature catalog deliberately omits core
workspaces and standings. This page is the map.`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`The same banner and badge rows as the repository's root `,(0,t.jsx)(n.code,{children:`README.md`}),`, a
header count line, a strip of the five workspace screenshots from the README
(CARDS, FIAT, LEARN, STREAM, REASON) each linking to its route, the CARDS
overview and seven-point vision (anchored at `,(0,t.jsx)(n.code,{children:`#cards-vision`}),`), a `,(0,t.jsx)(n.strong,{children:`Downloads`}),`
section under the badges (the Chrome extension install button, which used to
sit on the card search's empty state), a search box (matching title/description/route/hidden
tags), and a tab bar of the feature categories (Core Workspaces, Evidence &
Research, Team Collaboration, Flowing & Round Analysis, Pre-Round
Intelligence, Practice & Coaching, Recognition & Progress), each tab showing
its feature count. One category is shown at a time: the first tab is
selected on load, clicking a tab shows only that category's feature cards,
and a `,(0,t.jsx)(n.code,{children:`#<category>`}),` link (for example `,(0,t.jsx)(n.code,{children:`/features#practice`}),`) opens on that
tab. Searching narrows every tab's count, and if the selected tab has no
matches the first tab that does is shown. Each feature card links to its
route and docs page.`]}),`
`,(0,t.jsx)(n.p,{children:`Pointing at a card lights it up \u2014 a gradient that follows the cursor, a
glowing border and a coloured title \u2014 in a shade of its own, so neighbouring
cards never come up the same colour.`}),`
`,(0,t.jsx)(n.h2,{id:`how-it-works`,children:`How it works`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`debate-webview`}),`'s `,(0,t.jsx)(n.code,{children:`src/lib/feature-catalog.ts`}),` holds the pure data
(`,(0,t.jsx)(n.code,{children:`APP_FEATURES`}),`, `,(0,t.jsx)(n.code,{children:`buildFeatureSections`}),`, `,(0,t.jsx)(n.code,{children:`searchFeatures`}),`); `,(0,t.jsx)(n.code,{children:`FeaturesPanel.tsx`}),`
renders it. Titles/descriptions are copied from each route's own metadata.
The README's banner, badges and imgur screenshots are mirrored in
`,(0,t.jsx)(n.code,{children:`features/readme-media.ts`}),`; a test compares it against `,(0,t.jsx)(n.code,{children:`README.md`}),` and fails
when the two drift, so edit the README first and then the mirror.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`The catalog is a hand-maintained registry \u2014 a new route has to be added to
it separately.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};