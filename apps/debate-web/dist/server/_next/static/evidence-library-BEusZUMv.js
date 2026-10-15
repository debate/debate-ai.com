import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Shared Evidence Library`},r=`# Shared Evidence Library [#shared-evidence-library]

A submission form plus a free-text/kind search panel over the team-wide
evidence repository \u2014 cut cards and reusable analytic blocks.

- **Route:** \`/research/cards/library\`
- **Package:** \`debate-card-search\`

## What it shows [#what-it-shows]

A submission form (kind, topic, case area, argument block, citation, tags,
body text with a live word count) plus a search box, kind filter, and
topic/case-area/tags filters over every persisted \`EvidenceLibraryEntry\`.
Each result has Edit and Delete actions; editing records a scored
\`CardRevisionRecord\` for the Revision Incentives leaderboard. A "Check this
page" box checks whether a pasted URL has already been cut, both locally
and against a shared, server-backed reuse index consumed by a browser
extension (\`apps/debate-web-ext\`).

The Argument Library browser (\`/research/cards/argument-library\`) composes this
repository with tagged Contributions Feed submissions into topic/case-area
folders and cross-cutting tag collections, with rename/merge and bulk
tag-editing tools.

## Real search index [#real-search-index]

A real inverted-index, TF-IDF-ranked search (\`lib/evidence-search-index.ts\`)
replaced the original keyword-overlap scan, cached across calls and updated
incrementally rather than rebuilt on every write.

## Opening a pre-filled search [#opening-a-pre-filled-search]

\`/research/cards\` reads its starting search from the URL: \`?q=\` (term), \`?year=\`,
\`?event=\` (\`CX\`, \`PF\`, \`LD\`, \`NDT\`, \`NFA\`) and \`?school=\` / \`?team=\` /
\`?tournament=\`. Other pages build these links with \`buildCardsSearchHref()\`
and \`useSearchState\` reads them once on mount via \`readCardsSearchParams()\`
(both in \`lib/search-query.ts\`). The topics explorer on
\`/practice/statistics\` uses this to link every resolution to its cards.
The URL isn't kept in sync as you edit the search afterwards.

## The first search is ready on open [#the-first-search-is-ready-on-open]

Opening \`/research/cards\` with no pre-filled search shows the default list
(newest cards, quotes) from your last visit straight away, kept in
\`localStorage\` by \`lib/default-search-cache.ts\`, while the page fetches the
current list and swaps it in without a spinner. That first request skips the
300 ms typing debounce. On the server, \`/api/search\` keeps the no-term,
no-filter list in each Worker isolate for five minutes, since it sorts the
\`debate_cards\` table by \`imported_at\`. Every
request still counts toward the daily search limit.

## A new search always wins [#a-new-search-always-wins]

Typing waits out the 300 ms debounce, but changing the term, sort or filters
retires the previous search at once in \`useSearchState\`: its request is
aborted (plain \`fetch\` with an \`AbortController\`, since grab keys cancellation
by path and every query is a different path) and its answer is dropped by a
request sequence number, so results for an older query can't land after a
newer one. A committed query \u2014 Enter, a clicked suggestion, or an accepted
inline completion \u2014 calls \`setSearchTerm(term, { immediate: true })\` and
searches with no debounce; if that term is already waiting on the debounce,
the pending search goes out now.

The search box (\`ui/primitives/autocomplete.tsx\`) shows the top completion
inline as ghost text (\`inlineCompletionSuffix()\` in \`lib/search-query.ts\`),
accepted with Tab or \u2192. \u2191/\u2193 load the next suggestion into the box and its
results follow after the debounce, so stepping quickly through the list costs
one search, not one per suggestion. Suggestion requests carry their own
sequence number, so a slow answer for an earlier prefix can't replace the
list for the newer one. Results are not prefetched for suggestions the user
hasn't reached, because every request counts toward the daily search limit.

## Data flow [#data-flow]

\`\`\`
panels/EvidenceLibraryPanel.tsx
  \u2192 saveEvidenceLibraryEntry() / saveEvidenceLibraryEntryRevision()
  \u2192 searchPersistedEvidenceLibraryWithIndex(query) \u2014 state/evidenceLibraryEntries.ts
  \u2192 checkPersistedPageForExistingCards(url)
\`\`\`

## Known gaps [#known-gaps]

The \`imported_at\` index that turns the default list into an index walk is
created by the weekly cron or an admin search-index action (see
[card library import](/docs/features/research-evidence/card-library-import#search-index)); until one runs,
the uncached default list is still a full-table sort.


Tag identity is still exact-string, though autocomplete matching is
case-insensitive, typed tags are normalized to an existing casing, and the
library browser surfaces/merges any casing variants that slip through.
`,i={contents:[{heading:`shared-evidence-library`,content:`A submission form plus a free-text/kind search panel over the team-wide
evidence repository \u2014 cut cards and reusable analytic blocks.`},{heading:`shared-evidence-library`,content:"**Route:** `/research/cards/library`"},{heading:`shared-evidence-library`,content:"**Package:** `debate-card-search`"},{heading:`what-it-shows`,content:`A submission form (kind, topic, case area, argument block, citation, tags,
body text with a live word count) plus a search box, kind filter, and
topic/case-area/tags filters over every persisted \`EvidenceLibraryEntry\`.
Each result has Edit and Delete actions; editing records a scored
\`CardRevisionRecord\` for the Revision Incentives leaderboard. A "Check this
page" box checks whether a pasted URL has already been cut, both locally
and against a shared, server-backed reuse index consumed by a browser
extension (\`apps/debate-web-ext\`).`},{heading:`what-it-shows`,content:`The Argument Library browser (\`/research/cards/argument-library\`) composes this
repository with tagged Contributions Feed submissions into topic/case-area
folders and cross-cutting tag collections, with rename/merge and bulk
tag-editing tools.`},{heading:`real-search-index`,content:`A real inverted-index, TF-IDF-ranked search (\`lib/evidence-search-index.ts\`)
replaced the original keyword-overlap scan, cached across calls and updated
incrementally rather than rebuilt on every write.`},{heading:`opening-a-pre-filled-search`,content:"`/research/cards` reads its starting search from the URL: `?q=` (term), `?year=`,\n`?event=` (`CX`, `PF`, `LD`, `NDT`, `NFA`) and `?school=` / `?team=` /\n`?tournament=`. Other pages build these links with `buildCardsSearchHref()`\nand `useSearchState` reads them once on mount via `readCardsSearchParams()`\n(both in `lib/search-query.ts`). The topics explorer on\n`/practice/statistics` uses this to link every resolution to its cards.\nThe URL isn't kept in sync as you edit the search afterwards."},{heading:`the-first-search-is-ready-on-open`,content:"Opening `/research/cards` with no pre-filled search shows the default list\n(newest cards, quotes) from your last visit straight away, kept in\n`localStorage` by `lib/default-search-cache.ts`, while the page fetches the\ncurrent list and swaps it in without a spinner. That first request skips the\n300 ms typing debounce. On the server, `/api/search` keeps the no-term,\nno-filter list in each Worker isolate for five minutes, since it sorts the\n`debate_cards` table by `imported_at`. Every\nrequest still counts toward the daily search limit."},{heading:`a-new-search-always-wins`,content:`Typing waits out the 300 ms debounce, but changing the term, sort or filters
retires the previous search at once in \`useSearchState\`: its request is
aborted (plain \`fetch\` with an \`AbortController\`, since grab keys cancellation
by path and every query is a different path) and its answer is dropped by a
request sequence number, so results for an older query can't land after a
newer one. A committed query \u2014 Enter, a clicked suggestion, or an accepted
inline completion \u2014 calls \`setSearchTerm(term, { immediate: true })\` and
searches with no debounce; if that term is already waiting on the debounce,
the pending search goes out now.`},{heading:`a-new-search-always-wins`,content:`The search box (\`ui/primitives/autocomplete.tsx\`) shows the top completion
inline as ghost text (\`inlineCompletionSuffix()\` in \`lib/search-query.ts\`),
accepted with Tab or \u2192. \u2191/\u2193 load the next suggestion into the box and its
results follow after the debounce, so stepping quickly through the list costs
one search, not one per suggestion. Suggestion requests carry their own
sequence number, so a slow answer for an earlier prefix can't replace the
list for the newer one. Results are not prefetched for suggestions the user
hasn't reached, because every request counts toward the daily search limit.`},{heading:`known-gaps`,content:`The \`imported_at\` index that turns the default list into an index walk is
created by the weekly cron or an admin search-index action (see
card library import); until one runs,
the uncached default list is still a full-table sort.`},{heading:`known-gaps`,content:`Tag identity is still exact-string, though autocomplete matching is
case-insensitive, typed tags are normalized to an existing casing, and the
library browser surfaces/merges any casing variants that slip through.`}],headings:[{id:`shared-evidence-library`,content:`Shared Evidence Library`},{id:`what-it-shows`,content:`What it shows`},{id:`real-search-index`,content:`Real search index`},{id:`opening-a-pre-filled-search`,content:`Opening a pre-filled search`},{id:`the-first-search-is-ready-on-open`,content:`The first search is ready on open`},{id:`a-new-search-always-wins`,content:`A new search always wins`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#shared-evidence-library`,title:(0,t.jsx)(t.Fragment,{children:`Shared Evidence Library`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#real-search-index`,title:(0,t.jsx)(t.Fragment,{children:`Real search index`})},{depth:2,url:`#opening-a-pre-filled-search`,title:(0,t.jsx)(t.Fragment,{children:`Opening a pre-filled search`})},{depth:2,url:`#the-first-search-is-ready-on-open`,title:(0,t.jsx)(t.Fragment,{children:`The first search is ready on open`})},{depth:2,url:`#a-new-search-always-wins`,title:(0,t.jsx)(t.Fragment,{children:`A new search always wins`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`shared-evidence-library`,children:`Shared Evidence Library`}),`
`,(0,t.jsx)(n.p,{children:`A submission form plus a free-text/kind search panel over the team-wide
evidence repository \u2014 cut cards and reusable analytic blocks.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/cards/library`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`A submission form (kind, topic, case area, argument block, citation, tags,
body text with a live word count) plus a search box, kind filter, and
topic/case-area/tags filters over every persisted `,(0,t.jsx)(n.code,{children:`EvidenceLibraryEntry`}),`.
Each result has Edit and Delete actions; editing records a scored
`,(0,t.jsx)(n.code,{children:`CardRevisionRecord`}),` for the Revision Incentives leaderboard. A "Check this
page" box checks whether a pasted URL has already been cut, both locally
and against a shared, server-backed reuse index consumed by a browser
extension (`,(0,t.jsx)(n.code,{children:`apps/debate-web-ext`}),`).`]}),`
`,(0,t.jsxs)(n.p,{children:[`The Argument Library browser (`,(0,t.jsx)(n.code,{children:`/research/cards/argument-library`}),`) composes this
repository with tagged Contributions Feed submissions into topic/case-area
folders and cross-cutting tag collections, with rename/merge and bulk
tag-editing tools.`]}),`
`,(0,t.jsx)(n.h2,{id:`real-search-index`,children:`Real search index`}),`
`,(0,t.jsxs)(n.p,{children:[`A real inverted-index, TF-IDF-ranked search (`,(0,t.jsx)(n.code,{children:`lib/evidence-search-index.ts`}),`)
replaced the original keyword-overlap scan, cached across calls and updated
incrementally rather than rebuilt on every write.`]}),`
`,(0,t.jsx)(n.h2,{id:`opening-a-pre-filled-search`,children:`Opening a pre-filled search`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`/research/cards`}),` reads its starting search from the URL: `,(0,t.jsx)(n.code,{children:`?q=`}),` (term), `,(0,t.jsx)(n.code,{children:`?year=`}),`,
`,(0,t.jsx)(n.code,{children:`?event=`}),` (`,(0,t.jsx)(n.code,{children:`CX`}),`, `,(0,t.jsx)(n.code,{children:`PF`}),`, `,(0,t.jsx)(n.code,{children:`LD`}),`, `,(0,t.jsx)(n.code,{children:`NDT`}),`, `,(0,t.jsx)(n.code,{children:`NFA`}),`) and `,(0,t.jsx)(n.code,{children:`?school=`}),` / `,(0,t.jsx)(n.code,{children:`?team=`}),` /
`,(0,t.jsx)(n.code,{children:`?tournament=`}),`. Other pages build these links with `,(0,t.jsx)(n.code,{children:`buildCardsSearchHref()`}),`
and `,(0,t.jsx)(n.code,{children:`useSearchState`}),` reads them once on mount via `,(0,t.jsx)(n.code,{children:`readCardsSearchParams()`}),`
(both in `,(0,t.jsx)(n.code,{children:`lib/search-query.ts`}),`). The topics explorer on
`,(0,t.jsx)(n.code,{children:`/practice/statistics`}),` uses this to link every resolution to its cards.
The URL isn't kept in sync as you edit the search afterwards.`]}),`
`,(0,t.jsx)(n.h2,{id:`the-first-search-is-ready-on-open`,children:`The first search is ready on open`}),`
`,(0,t.jsxs)(n.p,{children:[`Opening `,(0,t.jsx)(n.code,{children:`/research/cards`}),` with no pre-filled search shows the default list
(newest cards, quotes) from your last visit straight away, kept in
`,(0,t.jsx)(n.code,{children:`localStorage`}),` by `,(0,t.jsx)(n.code,{children:`lib/default-search-cache.ts`}),`, while the page fetches the
current list and swaps it in without a spinner. That first request skips the
300 ms typing debounce. On the server, `,(0,t.jsx)(n.code,{children:`/api/search`}),` keeps the no-term,
no-filter list in each Worker isolate for five minutes, since it sorts the
`,(0,t.jsx)(n.code,{children:`debate_cards`}),` table by `,(0,t.jsx)(n.code,{children:`imported_at`}),`. Every
request still counts toward the daily search limit.`]}),`
`,(0,t.jsx)(n.h2,{id:`a-new-search-always-wins`,children:`A new search always wins`}),`
`,(0,t.jsxs)(n.p,{children:[`Typing waits out the 300 ms debounce, but changing the term, sort or filters
retires the previous search at once in `,(0,t.jsx)(n.code,{children:`useSearchState`}),`: its request is
aborted (plain `,(0,t.jsx)(n.code,{children:`fetch`}),` with an `,(0,t.jsx)(n.code,{children:`AbortController`}),`, since grab keys cancellation
by path and every query is a different path) and its answer is dropped by a
request sequence number, so results for an older query can't land after a
newer one. A committed query \u2014 Enter, a clicked suggestion, or an accepted
inline completion \u2014 calls `,(0,t.jsx)(n.code,{children:`setSearchTerm(term, { immediate: true })`}),` and
searches with no debounce; if that term is already waiting on the debounce,
the pending search goes out now.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The search box (`,(0,t.jsx)(n.code,{children:`ui/primitives/autocomplete.tsx`}),`) shows the top completion
inline as ghost text (`,(0,t.jsx)(n.code,{children:`inlineCompletionSuffix()`}),` in `,(0,t.jsx)(n.code,{children:`lib/search-query.ts`}),`),
accepted with Tab or \u2192. \u2191/\u2193 load the next suggestion into the box and its
results follow after the debounce, so stepping quickly through the list costs
one search, not one per suggestion. Suggestion requests carry their own
sequence number, so a slow answer for an earlier prefix can't replace the
list for the newer one. Results are not prefetched for suggestions the user
hasn't reached, because every request counts toward the daily search limit.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`panels/EvidenceLibraryPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 saveEvidenceLibraryEntry() / saveEvidenceLibraryEntryRevision()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 searchPersistedEvidenceLibraryWithIndex(query) \u2014 state/evidenceLibraryEntries.ts`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 checkPersistedPageForExistingCards(url)`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.code,{children:`imported_at`}),` index that turns the default list into an index walk is
created by the weekly cron or an admin search-index action (see
`,(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/card-library-import#search-index`,children:`card library import`}),`); until one runs,
the uncached default list is still a full-table sort.`]}),`
`,(0,t.jsx)(n.p,{children:`Tag identity is still exact-string, though autocomplete matching is
case-insensitive, typed tags are normalized to an existing casing, and the
library browser surfaces/merges any casing variants that slip through.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};