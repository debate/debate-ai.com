import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Flow-in-Speech Flow Annotations`},r=`# Flow-in-Speech Flow Annotations [#flow-in-speech-flow-annotations]

Lets a viewer drop a timestamped note while watching a streamed or recorded
round in the \`debate-videos\` player, tie it to a specific flow argument,
and jump straight back to it later.

- **Route:** \`/annotations\`
- **Package:** \`debate-round\`

## What it shows [#what-it-shows]

A form to drop a new \`FlowAnnotation\` (flow ID, speech, box path, timestamp
defaulting to the player's live position, optional note, speaker, and tag).
Every persisted annotation renders newest-first with **Jump to** (switches
videos if needed) and **Clear** actions. Search/filter by speech, speaker,
or tag, plus a per-flow "Download annotations" export.

Every cell in the live \`FlowSpreadsheet\` grid whose box has annotations
shows a clock badge; clicking it jumps to the earliest one.

## Data flow [#data-flow]

\`\`\`
state/flowAnnotations.ts (localStorage: flowAnnotations)
  \u2192 mirrorToolRecordSave() / mirrorToolRecordDelete() on every save/delete
  \u2192 buildFlowAnnotationsPanelView()
  \u2192 panels/FlowAnnotationsPanel.tsx
  \u2192 apps/debate-ai.com/app/annotations/page.tsx
\`\`\`

## Known gaps [#known-gaps]

~~No collaborative/live sync \u2014 annotations are local \`localStorage\` only.~~
**Fixed:** \`flowAnnotations\` is one of Tool Data Sync's
catalog entries, and \`saveFlowAnnotation\`/\`deleteFlowAnnotation\`
(\`state/flowAnnotations.ts\`) additionally call
\`mirrorToolRecordSave\`/\`mirrorToolRecordDelete\` directly rather than relying
on the generic watcher alone, so a drop or a Clear reaches the account on the
click rather than at its next tick. Pinned by
\`test/tool-record-sync-wiring.test.ts\`'s "flow annotations" suite (save+delete
requests, still-writes-locally-on-a-500, and no request while signed out).

The gaps this leaves are the same ones every synced tool-record collection
has \u2014 still per-user rather than a shared team resource, and a record saved
on another device shows up on next reload rather than live \u2014 see
Tool Data Sync's own Known gaps.
`,i={contents:[{heading:`flow-in-speech-flow-annotations`,content:`Lets a viewer drop a timestamped note while watching a streamed or recorded
round in the \`debate-videos\` player, tie it to a specific flow argument,
and jump straight back to it later.`},{heading:`flow-in-speech-flow-annotations`,content:"**Route:** `/annotations`"},{heading:`flow-in-speech-flow-annotations`,content:"**Package:** `debate-round`"},{heading:`what-it-shows`,content:`A form to drop a new \`FlowAnnotation\` (flow ID, speech, box path, timestamp
defaulting to the player's live position, optional note, speaker, and tag).
Every persisted annotation renders newest-first with **Jump to** (switches
videos if needed) and **Clear** actions. Search/filter by speech, speaker,
or tag, plus a per-flow "Download annotations" export.`},{heading:`what-it-shows`,content:"Every cell in the live `FlowSpreadsheet` grid whose box has annotations\nshows a clock badge; clicking it jumps to the earliest one."},{heading:`known-gaps`,content:"~~No collaborative/live sync \u2014 annotations are local `localStorage` only.~~\n**Fixed:** `flowAnnotations` is one of Tool Data Sync's\ncatalog entries, and `saveFlowAnnotation`/`deleteFlowAnnotation`\n(`state/flowAnnotations.ts`) additionally call\n`mirrorToolRecordSave`/`mirrorToolRecordDelete` directly rather than relying\non the generic watcher alone, so a drop or a Clear reaches the account on the\nclick rather than at its next tick. Pinned by\n`test/tool-record-sync-wiring.test.ts`'s \"flow annotations\" suite (save+delete\nrequests, still-writes-locally-on-a-500, and no request while signed out)."},{heading:`known-gaps`,content:`The gaps this leaves are the same ones every synced tool-record collection
has \u2014 still per-user rather than a shared team resource, and a record saved
on another device shows up on next reload rather than live \u2014 see
Tool Data Sync's own Known gaps.`}],headings:[{id:`flow-in-speech-flow-annotations`,content:`Flow-in-Speech Flow Annotations`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#flow-in-speech-flow-annotations`,title:(0,t.jsx)(t.Fragment,{children:`Flow-in-Speech Flow Annotations`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,del:`del`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`flow-in-speech-flow-annotations`,children:`Flow-in-Speech Flow Annotations`}),`
`,(0,t.jsxs)(n.p,{children:[`Lets a viewer drop a timestamped note while watching a streamed or recorded
round in the `,(0,t.jsx)(n.code,{children:`debate-videos`}),` player, tie it to a specific flow argument,
and jump straight back to it later.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/annotations`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`A form to drop a new `,(0,t.jsx)(n.code,{children:`FlowAnnotation`}),` (flow ID, speech, box path, timestamp
defaulting to the player's live position, optional note, speaker, and tag).
Every persisted annotation renders newest-first with `,(0,t.jsx)(n.strong,{children:`Jump to`}),` (switches
videos if needed) and `,(0,t.jsx)(n.strong,{children:`Clear`}),` actions. Search/filter by speech, speaker,
or tag, plus a per-flow "Download annotations" export.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Every cell in the live `,(0,t.jsx)(n.code,{children:`FlowSpreadsheet`}),` grid whose box has annotations
shows a clock badge; clicking it jumps to the earliest one.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/flowAnnotations.ts (localStorage: flowAnnotations)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 mirrorToolRecordSave() / mirrorToolRecordDelete() on every save/delete`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildFlowAnnotationsPanelView()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/FlowAnnotationsPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/annotations/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsxs)(n.del,{children:[`No collaborative/live sync \u2014 annotations are local `,(0,t.jsx)(n.code,{children:`localStorage`}),` only.`]}),`
`,(0,t.jsx)(n.strong,{children:`Fixed:`}),` `,(0,t.jsx)(n.code,{children:`flowAnnotations`}),` is one of Tool Data Sync's
catalog entries, and `,(0,t.jsx)(n.code,{children:`saveFlowAnnotation`}),`/`,(0,t.jsx)(n.code,{children:`deleteFlowAnnotation`}),`
(`,(0,t.jsx)(n.code,{children:`state/flowAnnotations.ts`}),`) additionally call
`,(0,t.jsx)(n.code,{children:`mirrorToolRecordSave`}),`/`,(0,t.jsx)(n.code,{children:`mirrorToolRecordDelete`}),` directly rather than relying
on the generic watcher alone, so a drop or a Clear reaches the account on the
click rather than at its next tick. Pinned by
`,(0,t.jsx)(n.code,{children:`test/tool-record-sync-wiring.test.ts`}),`'s "flow annotations" suite (save+delete
requests, still-writes-locally-on-a-500, and no request while signed out).`]}),`
`,(0,t.jsx)(n.p,{children:`The gaps this leaves are the same ones every synced tool-record collection
has \u2014 still per-user rather than a shared team resource, and a record saved
on another device shows up on next reload rather than live \u2014 see
Tool Data Sync's own Known gaps.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};