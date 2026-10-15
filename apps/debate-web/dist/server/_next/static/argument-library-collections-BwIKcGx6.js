import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Common Argument Library \u2014 Saved Collections`},r=`# Common Argument Library \u2014 Saved Collections [#common-argument-library--saved-collections]

- **Route:** \`/research/cards/argument-library\`
- **Package:** \`debate-search-evidence\`

## What it shows [#what-it-shows]

\`ArgumentLibraryPanel\`'s tag-chip filter bar now has a **Saved collections**
section beneath it, shown whenever the library has at least one tag
collection:

- Every saved collection renders as a button (its name plus tag count) \u2014
  clicking it replaces the current tag-chip selection with that
  collection's saved tags, next to "Rename", "Update" (shown once at least
  one tag is active \u2014 replaces the collection's tags with the current
  selection), and a small "\u2715" remove button.
- "Rename" swaps the button for a text field; renaming onto another saved
  collection's name is refused (case-insensitively) rather than merging.
- A "Save current selection as" field + "Save collection" button saves the
  currently active tag chips under a new name. Disabled until at least one
  tag is selected and a name is typed.

## Data flow [#data-flow]

\`\`\`
lib/argument-library-collections.ts (pure validation/(de)serialization)
  \u2192 lib/argument-library-collections-client.ts (GET/PUT /api/settings)
  \u2192 hooks/useSavedArgumentCollections.ts (localStorage: saved-argument-collections)
  \u2192 panels/ArgumentLibraryPanel.tsx
\`\`\`

Local-first (works fully signed out) and best-effort account-synced through
the same \`/api/settings\` row every other picker-style setting uses. Up to
50 collections, each name unique case-insensitively, each holding 1-30 tags.

## Known gaps [#known-gaps]

None open. A saved collection can be renamed ("Rename" next to its button)
and have its tag list replaced with the current selection ("Update", shown
once at least one tag is active) \u2014 both close the two gaps this page
previously tracked. The lost-update race this page used to track \u2014 a
rename/update/add/remove from two signed-in devices at once silently
dropping whichever PUT landed second, since the whole
\`savedArgumentCollections\` list was a single account-settings field \u2014 is
also fixed: every code path that changes a collection
(\`addCollection\`/\`removeCollection\`/\`renameCollection\`/\`updateCollection\` in
\`useSavedArgumentCollections.ts\`) now sends a single
\`addSavedArgumentCollection\`/\`removeSavedArgumentCollection\`/
\`renameSavedArgumentCollection\`/\`updateSavedArgumentCollectionTags\` op
instead, resolved by \`/api/settings\` against the account's row as it stands
at write time rather than a client-computed whole-list replace \u2014 mirroring
[User Settings](/docs/features/ui-navigation/user-settings)'s \`favoriteTools\` fix. A plain
whole-list \`savedArgumentCollections\` replace is still accepted by the route
for a caller that genuinely needs one, but nothing in the app sends one
anymore.
`,i={contents:[{heading:`common-argument-library--saved-collections`,content:"**Route:** `/research/cards/argument-library`"},{heading:`common-argument-library--saved-collections`,content:"**Package:** `debate-search-evidence`"},{heading:`what-it-shows`,content:`\`ArgumentLibraryPanel\`'s tag-chip filter bar now has a **Saved collections**
section beneath it, shown whenever the library has at least one tag
collection:`},{heading:`what-it-shows`,content:`Every saved collection renders as a button (its name plus tag count) \u2014
clicking it replaces the current tag-chip selection with that
collection's saved tags, next to "Rename", "Update" (shown once at least
one tag is active \u2014 replaces the collection's tags with the current
selection), and a small "\u2715" remove button.`},{heading:`what-it-shows`,content:`"Rename" swaps the button for a text field; renaming onto another saved
collection's name is refused (case-insensitively) rather than merging.`},{heading:`what-it-shows`,content:`A "Save current selection as" field + "Save collection" button saves the
currently active tag chips under a new name. Disabled until at least one
tag is selected and a name is typed.`},{heading:`data-flow`,content:`Local-first (works fully signed out) and best-effort account-synced through
the same \`/api/settings\` row every other picker-style setting uses. Up to
50 collections, each name unique case-insensitively, each holding 1-30 tags.`},{heading:`known-gaps`,content:'None open. A saved collection can be renamed ("Rename" next to its button)\nand have its tag list replaced with the current selection ("Update", shown\nonce at least one tag is active) \u2014 both close the two gaps this page\npreviously tracked. The lost-update race this page used to track \u2014 a\nrename/update/add/remove from two signed-in devices at once silently\ndropping whichever PUT landed second, since the whole\n`savedArgumentCollections` list was a single account-settings field \u2014 is\nalso fixed: every code path that changes a collection\n(`addCollection`/`removeCollection`/`renameCollection`/`updateCollection` in\n`useSavedArgumentCollections.ts`) now sends a single\n`addSavedArgumentCollection`/`removeSavedArgumentCollection`/\n`renameSavedArgumentCollection`/`updateSavedArgumentCollectionTags` op\ninstead, resolved by `/api/settings` against the account\'s row as it stands\nat write time rather than a client-computed whole-list replace \u2014 mirroring\nUser Settings\'s `favoriteTools` fix. A plain\nwhole-list `savedArgumentCollections` replace is still accepted by the route\nfor a caller that genuinely needs one, but nothing in the app sends one\nanymore.'}],headings:[{id:`common-argument-library--saved-collections`,content:`Common Argument Library \u2014 Saved Collections`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#common-argument-library--saved-collections`,title:(0,t.jsx)(t.Fragment,{children:`Common Argument Library \u2014 Saved Collections`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`common-argument-library--saved-collections`,children:`Common Argument Library \u2014 Saved Collections`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/cards/argument-library`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-search-evidence`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`ArgumentLibraryPanel`}),`'s tag-chip filter bar now has a `,(0,t.jsx)(n.strong,{children:`Saved collections`}),`
section beneath it, shown whenever the library has at least one tag
collection:`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`Every saved collection renders as a button (its name plus tag count) \u2014
clicking it replaces the current tag-chip selection with that
collection's saved tags, next to "Rename", "Update" (shown once at least
one tag is active \u2014 replaces the collection's tags with the current
selection), and a small "\u2715" remove button.`}),`
`,(0,t.jsx)(n.li,{children:`"Rename" swaps the button for a text field; renaming onto another saved
collection's name is refused (case-insensitively) rather than merging.`}),`
`,(0,t.jsx)(n.li,{children:`A "Save current selection as" field + "Save collection" button saves the
currently active tag chips under a new name. Disabled until at least one
tag is selected and a name is typed.`}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`lib/argument-library-collections.ts (pure validation/(de)serialization)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 lib/argument-library-collections-client.ts (GET/PUT /api/settings)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 hooks/useSavedArgumentCollections.ts (localStorage: saved-argument-collections)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/ArgumentLibraryPanel.tsx`})})]})})}),`
`,(0,t.jsxs)(n.p,{children:[`Local-first (works fully signed out) and best-effort account-synced through
the same `,(0,t.jsx)(n.code,{children:`/api/settings`}),` row every other picker-style setting uses. Up to
50 collections, each name unique case-insensitively, each holding 1-30 tags.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[`None open. A saved collection can be renamed ("Rename" next to its button)
and have its tag list replaced with the current selection ("Update", shown
once at least one tag is active) \u2014 both close the two gaps this page
previously tracked. The lost-update race this page used to track \u2014 a
rename/update/add/remove from two signed-in devices at once silently
dropping whichever PUT landed second, since the whole
`,(0,t.jsx)(n.code,{children:`savedArgumentCollections`}),` list was a single account-settings field \u2014 is
also fixed: every code path that changes a collection
(`,(0,t.jsx)(n.code,{children:`addCollection`}),`/`,(0,t.jsx)(n.code,{children:`removeCollection`}),`/`,(0,t.jsx)(n.code,{children:`renameCollection`}),`/`,(0,t.jsx)(n.code,{children:`updateCollection`}),` in
`,(0,t.jsx)(n.code,{children:`useSavedArgumentCollections.ts`}),`) now sends a single
`,(0,t.jsx)(n.code,{children:`addSavedArgumentCollection`}),`/`,(0,t.jsx)(n.code,{children:`removeSavedArgumentCollection`}),`/
`,(0,t.jsx)(n.code,{children:`renameSavedArgumentCollection`}),`/`,(0,t.jsx)(n.code,{children:`updateSavedArgumentCollectionTags`}),` op
instead, resolved by `,(0,t.jsx)(n.code,{children:`/api/settings`}),` against the account's row as it stands
at write time rather than a client-computed whole-list replace \u2014 mirroring
`,(0,t.jsx)(n.a,{href:`/docs/features/ui-navigation/user-settings`,children:`User Settings`}),`'s `,(0,t.jsx)(n.code,{children:`favoriteTools`}),` fix. A plain
whole-list `,(0,t.jsx)(n.code,{children:`savedArgumentCollections`}),` replace is still accepted by the route
for a caller that genuinely needs one, but nothing in the app sends one
anymore.`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};