import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`LLM Card Scoring`},r=`# LLM Card Scoring [#llm-card-scoring]

Scores a submitted debate-evidence card across five dimensions \u2014
relevance, clarity, uniqueness, evidence quality, usability \u2014 with a
deterministic heuristic, ranks every card, flags likely duplicates, and
optionally requests a real Anthropic-backed qualitative assessment.

- **Route:** \`/research/cards/scoring\`
- **Package:** \`debate-card-search\`

## What it shows [#what-it-shows]

A topic switcher, a "Score card" form, a "Bulk import" textarea
(\`---\`-delimited batches), a ranked list with per-dimension scores and a
"Likely duplicate" badge, and a "Get AI assessment" button per card.
Evidence Library results also carry a "Score card" action with an inline
score badge.

## Data flow [#data-flow]

\`\`\`
state/cardScores.ts (localStorage)
  \u2192 buildPersistedCardScoreRanking()
  \u2192 panels/CardScoringPanel.tsx

"Get AI assessment":
  \u2192 requestCardScoringAiAssessment() \u2014 lib/llm-card-scoring-client.ts
      \u2192 POST /api/reason-ai
\`\`\`

## Known gaps [#known-gaps]

Bulk import is pasted plain text, not a real file upload. AI assessments sync
to your account like card scores do (see Tool Data Sync)
but are still not a shared team resource \u2014 a squad member scoring the same
card sees their own assessment, not a teammate's.
`,i={contents:[{heading:`llm-card-scoring`,content:`Scores a submitted debate-evidence card across five dimensions \u2014
relevance, clarity, uniqueness, evidence quality, usability \u2014 with a
deterministic heuristic, ranks every card, flags likely duplicates, and
optionally requests a real Anthropic-backed qualitative assessment.`},{heading:`llm-card-scoring`,content:"**Route:** `/research/cards/scoring`"},{heading:`llm-card-scoring`,content:"**Package:** `debate-card-search`"},{heading:`what-it-shows`,content:`A topic switcher, a "Score card" form, a "Bulk import" textarea
(\`---\`-delimited batches), a ranked list with per-dimension scores and a
"Likely duplicate" badge, and a "Get AI assessment" button per card.
Evidence Library results also carry a "Score card" action with an inline
score badge.`},{heading:`known-gaps`,content:`Bulk import is pasted plain text, not a real file upload. AI assessments sync
to your account like card scores do (see Tool Data Sync)
but are still not a shared team resource \u2014 a squad member scoring the same
card sees their own assessment, not a teammate's.`}],headings:[{id:`llm-card-scoring`,content:`LLM Card Scoring`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#llm-card-scoring`,title:(0,t.jsx)(t.Fragment,{children:`LLM Card Scoring`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`llm-card-scoring`,children:`LLM Card Scoring`}),`
`,(0,t.jsx)(n.p,{children:`Scores a submitted debate-evidence card across five dimensions \u2014
relevance, clarity, uniqueness, evidence quality, usability \u2014 with a
deterministic heuristic, ranks every card, flags likely duplicates, and
optionally requests a real Anthropic-backed qualitative assessment.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/cards/scoring`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`A topic switcher, a "Score card" form, a "Bulk import" textarea
(`,(0,t.jsx)(n.code,{children:`---`}),`-delimited batches), a ranked list with per-dimension scores and a
"Likely duplicate" badge, and a "Get AI assessment" button per card.
Evidence Library results also carry a "Score card" action with an inline
score badge.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/cardScores.ts (localStorage)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildPersistedCardScoreRanking()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/CardScoringPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`"Get AI assessment":`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 requestCardScoringAiAssessment() \u2014 lib/llm-card-scoring-client.ts`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 POST /api/reason-ai`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`Bulk import is pasted plain text, not a real file upload. AI assessments sync
to your account like card scores do (see Tool Data Sync)
but are still not a shared team resource \u2014 a squad member scoring the same
card sees their own assessment, not a teammate's.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};