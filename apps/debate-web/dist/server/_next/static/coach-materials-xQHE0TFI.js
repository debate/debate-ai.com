import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Coach Materials`},r=`# Coach Materials [#coach-materials]

Lets a coach upload grounding materials \u2014 lecture transcripts, camp
materials, instructional documents, and practice-round recordings \u2014 for a
private team coach AI, preview which materials a question would draw on,
and ask the coach AI a real question grounded strictly in those materials.

- **Route:** \`/coaching?section=materials\`, the Coach Materials tab of [Coaching](/docs/features/ai-coaching/coaching) (the old \`/coaching/materials\` redirects there)
- **Package:** \`debate-speech-writer\`

## What it shows [#what-it-shows]

An upload form (kind, title, topic, tags, material text), a document/mic
upload shortcut, a search/filter bar, materials grouped by kind, and an
"Ask the coach" section with a persisted conversation history.

## Data flow [#data-flow]

\`\`\`
state/coachMaterials.ts (localStorage)
  \u2192 buildCoachMaterialLibraryFromStore()
  \u2192 findRelevantMaterialsFromStore()
  \u2192 panels/CoachMaterialsPanel.tsx
  \u2192 apps/debate-ai.com/app/coach-materials/page.tsx
\`\`\`

Materials are account-synced (D1-backed) with full version history and a
reviewer/approval workflow (pending/approved/rejected) gating what grounds
an answer.

## Known gaps [#known-gaps]

- No transcription of an uploaded audio/video recording file.
- \`.docx\` upload only works from the browser (needs \`DOMParser\`).
- Conversation history syncs to a signed-in user's account (the same
  \`coachConversation\` collection AI Coach Mode uses \u2014 see
  Tool Data Sync), but it is still
  per-user, not a shared team resource.
`,i={contents:[{heading:`coach-materials`,content:`Lets a coach upload grounding materials \u2014 lecture transcripts, camp
materials, instructional documents, and practice-round recordings \u2014 for a
private team coach AI, preview which materials a question would draw on,
and ask the coach AI a real question grounded strictly in those materials.`},{heading:`coach-materials`,content:"**Route:** `/coaching?section=materials`, the Coach Materials tab of Coaching (the old `/coaching/materials` redirects there)"},{heading:`coach-materials`,content:"**Package:** `debate-speech-writer`"},{heading:`what-it-shows`,content:`An upload form (kind, title, topic, tags, material text), a document/mic
upload shortcut, a search/filter bar, materials grouped by kind, and an
"Ask the coach" section with a persisted conversation history.`},{heading:`data-flow`,content:`Materials are account-synced (D1-backed) with full version history and a
reviewer/approval workflow (pending/approved/rejected) gating what grounds
an answer.`},{heading:`known-gaps`,content:`No transcription of an uploaded audio/video recording file.`},{heading:`known-gaps`,content:"`.docx` upload only works from the browser (needs `DOMParser`)."},{heading:`known-gaps`,content:`Conversation history syncs to a signed-in user's account (the same
\`coachConversation\` collection AI Coach Mode uses \u2014 see
Tool Data Sync), but it is still
per-user, not a shared team resource.`}],headings:[{id:`coach-materials`,content:`Coach Materials`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#coach-materials`,title:(0,t.jsx)(t.Fragment,{children:`Coach Materials`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`coach-materials`,children:`Coach Materials`}),`
`,(0,t.jsx)(n.p,{children:`Lets a coach upload grounding materials \u2014 lecture transcripts, camp
materials, instructional documents, and practice-round recordings \u2014 for a
private team coach AI, preview which materials a question would draw on,
and ask the coach AI a real question grounded strictly in those materials.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/coaching?section=materials`}),`, the Coach Materials tab of `,(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/coaching`,children:`Coaching`}),` (the old `,(0,t.jsx)(n.code,{children:`/coaching/materials`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-speech-writer`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsx)(n.p,{children:`An upload form (kind, title, topic, tags, material text), a document/mic
upload shortcut, a search/filter bar, materials grouped by kind, and an
"Ask the coach" section with a persisted conversation history.`}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/coachMaterials.ts (localStorage)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildCoachMaterialLibraryFromStore()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 findRelevantMaterialsFromStore()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/CoachMaterialsPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/coach-materials/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.p,{children:`Materials are account-synced (D1-backed) with full version history and a
reviewer/approval workflow (pending/approved/rejected) gating what grounds
an answer.`}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`No transcription of an uploaded audio/video recording file.`}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`.docx`}),` upload only works from the browser (needs `,(0,t.jsx)(n.code,{children:`DOMParser`}),`).`]}),`
`,(0,t.jsxs)(n.li,{children:[`Conversation history syncs to a signed-in user's account (the same
`,(0,t.jsx)(n.code,{children:`coachConversation`}),` collection AI Coach Mode uses \u2014 see
Tool Data Sync), but it is still
per-user, not a shared team resource.`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};