import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Word-Count-Only Speech Format`},r=`# Word-Count-Only Speech Format [#word-count-only-speech-format]

Lets a debater type each speech of a word-count-limited practice round
against a live word-count readout, and save the round.

- **Route:** \`/word-count\`
- **Package:** \`debate-round\`

## What it shows [#what-it-shows]

A form (round ID, word-count style) with one text area per speech showing
a live word-count badge, recomputed via \`debate-timer\`'s
\`getWordCountStatus\`. The same word-limit mode also works inside the live
round timer (\`/debate\`) via a **Type** toggle. Custom per-style word-limit
presets are managed on this same page, in a collapsible "Manage word limit
presets" section below the form (\`debate-round\`'s \`WordLimitPresetsPanel\`).
A **Word-count trend** section charts history across submissions. Round
history is account-synced with last-write-wins conflict resolution and a
"synced from another device" notice.

## Data flow [#data-flow]

\`\`\`
debate-timer/src/formats/word-count-format.ts \u2192 getWordCountStatus(text, wordLimit)
state/wordCountRounds.ts (localStorage: wordCountRounds)
  \u2192 buildWordCountRoundsPanelView()
  \u2192 panels/WordCountRoundsPanel.tsx \u2500\u2510
debate-round/src/panels/WordLimitPresetsPanel.tsx \u2500\u2534\u2500\u2192 apps/debate-ai.com/app/word-count/page.tsx
\`\`\`

## Known gaps [#known-gaps]

None remain open \u2014 the mobile/dictation gaps this doc previously tracked
are both closed, and word limit presets (previously orphaned when \`/settings\`
stopped being this app's account form \u2014 see
[User Settings](/docs/features/ui-navigation/user-settings)'s "What it no longer shows")
now have a home on this page.
`,i={contents:[{heading:`word-count-only-speech-format`,content:`Lets a debater type each speech of a word-count-limited practice round
against a live word-count readout, and save the round.`},{heading:`word-count-only-speech-format`,content:"**Route:** `/word-count`"},{heading:`word-count-only-speech-format`,content:"**Package:** `debate-round`"},{heading:`what-it-shows`,content:`A form (round ID, word-count style) with one text area per speech showing
a live word-count badge, recomputed via \`debate-timer\`'s
\`getWordCountStatus\`. The same word-limit mode also works inside the live
round timer (\`/debate\`) via a **Type** toggle. Custom per-style word-limit
presets are managed on this same page, in a collapsible "Manage word limit
presets" section below the form (\`debate-round\`'s \`WordLimitPresetsPanel\`).
A **Word-count trend** section charts history across submissions. Round
history is account-synced with last-write-wins conflict resolution and a
"synced from another device" notice.`},{heading:`known-gaps`,content:`None remain open \u2014 the mobile/dictation gaps this doc previously tracked
are both closed, and word limit presets (previously orphaned when \`/settings\`
stopped being this app's account form \u2014 see
User Settings's "What it no longer shows")
now have a home on this page.`}],headings:[{id:`word-count-only-speech-format`,content:`Word-Count-Only Speech Format`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#word-count-only-speech-format`,title:(0,t.jsx)(t.Fragment,{children:`Word-Count-Only Speech Format`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`word-count-only-speech-format`,children:`Word-Count-Only Speech Format`}),`
`,(0,t.jsx)(n.p,{children:`Lets a debater type each speech of a word-count-limited practice round
against a live word-count readout, and save the round.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/word-count`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`A form (round ID, word-count style) with one text area per speech showing
a live word-count badge, recomputed via `,(0,t.jsx)(n.code,{children:`debate-timer`}),`'s
`,(0,t.jsx)(n.code,{children:`getWordCountStatus`}),`. The same word-limit mode also works inside the live
round timer (`,(0,t.jsx)(n.code,{children:`/debate`}),`) via a `,(0,t.jsx)(n.strong,{children:`Type`}),` toggle. Custom per-style word-limit
presets are managed on this same page, in a collapsible "Manage word limit
presets" section below the form (`,(0,t.jsx)(n.code,{children:`debate-round`}),`'s `,(0,t.jsx)(n.code,{children:`WordLimitPresetsPanel`}),`).
A `,(0,t.jsx)(n.strong,{children:`Word-count trend`}),` section charts history across submissions. Round
history is account-synced with last-write-wins conflict resolution and a
"synced from another device" notice.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`debate-timer/src/formats/word-count-format.ts \u2192 getWordCountStatus(text, wordLimit)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/wordCountRounds.ts (localStorage: wordCountRounds)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildWordCountRoundsPanelView()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/WordCountRoundsPanel.tsx \u2500\u2510`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`debate-round/src/panels/WordLimitPresetsPanel.tsx \u2500\u2534\u2500\u2192 apps/debate-ai.com/app/word-count/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[`None remain open \u2014 the mobile/dictation gaps this doc previously tracked
are both closed, and word limit presets (previously orphaned when `,(0,t.jsx)(n.code,{children:`/settings`}),`
stopped being this app's account form \u2014 see
`,(0,t.jsx)(n.a,{href:`/docs/features/ui-navigation/user-settings`,children:`User Settings`}),`'s "What it no longer shows")
now have a home on this page.`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};