import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Speech Documents`},r=`# Speech Documents \u2014 a history of what CardMirror actually sent [#speech-documents--a-history-of-what-cardmirror-actually-sent]

\`/speech-documents\` shows a durable, listable send log of everything the
live Reason Editor (CardMirror) has sent into a designated "speech doc"
pane.

- **Route:** \`/speech-documents\` (view/manage history) \u2014 send from any
  CardMirror document (e.g. \`/reason-editor\`)
- **Package:** \`debate-editor\`

## How sending works [#how-sending-works]

CardMirror's speech-doc feature is a pane-designation model: mark a pane as
the speech doc (File menu \u2192 Speech), then send the current selection (or
card/section) with the backtick key. A live ProseMirror slice is inserted
directly into the designated pane \u2014 same-window, or cross-tab via
\`BroadcastChannel\`. The speech doc is just an ordinary open document \u2014
CardMirror keeps no separate copy.

## What this page shows [#what-this-page-shows]

A **send log**, not a document list: the plain text of what actually landed
for every send, in IndexedDB, newest first, with per-entry Remove and a
Clear history action.

## Data flow [#data-flow]

\`\`\`
debate-editor/src/editor/speech-doc-send.ts \u2192 sendToSpeech / insertSpeechSlice
debate-editor/src/editor/speech-send-log.ts (IndexedDB, "speech-send-log")
apps/debate-ai.com/app/speech-documents/SpeechSendLogPanel.tsx
\`\`\`

## Known gaps [#known-gaps]

Today's log is one global history, not grouped per speech-doc identity.

## Linking a speech to an editor document [#linking-a-speech-to-an-editor-document]

A speech's header can point at one of your recent editor documents, so its
word counts come from that file instead of the flow's own speech text. Links
are scoped to the round (or the flow, when it has no round) and are stored as
\`speechDocLinks\` records (\`id\` is \`ROUND-SCOPE:SPEECH\`, \`docId\` is the
document's account id). The store is in the account's synced tool records, so
a signed-in user's links follow them to other devices; a signed-out browser
keeps them in \`localStorage\`. Links saved under the old \`speech-doc-links\`
map are read once and folded into the new store on the next change.

A link only resolves on another device once both the round and the document
it names have synced there too \u2014 until then the speech falls back to its own
text.
`,i={contents:[{heading:`speech-documents--a-history-of-what-cardmirror-actually-sent`,content:`\`/speech-documents\` shows a durable, listable send log of everything the
live Reason Editor (CardMirror) has sent into a designated "speech doc"
pane.`},{heading:`speech-documents--a-history-of-what-cardmirror-actually-sent`,content:"**Route:** `/speech-documents` (view/manage history) \u2014 send from any\nCardMirror document (e.g. `/reason-editor`)"},{heading:`speech-documents--a-history-of-what-cardmirror-actually-sent`,content:"**Package:** `debate-editor`"},{heading:`how-sending-works`,content:`CardMirror's speech-doc feature is a pane-designation model: mark a pane as
the speech doc (File menu \u2192 Speech), then send the current selection (or
card/section) with the backtick key. A live ProseMirror slice is inserted
directly into the designated pane \u2014 same-window, or cross-tab via
\`BroadcastChannel\`. The speech doc is just an ordinary open document \u2014
CardMirror keeps no separate copy.`},{heading:`what-this-page-shows`,content:`A **send log**, not a document list: the plain text of what actually landed
for every send, in IndexedDB, newest first, with per-entry Remove and a
Clear history action.`},{heading:`known-gaps`,content:`Today's log is one global history, not grouped per speech-doc identity.`},{heading:`linking-a-speech-to-an-editor-document`,content:"A speech's header can point at one of your recent editor documents, so its\nword counts come from that file instead of the flow's own speech text. Links\nare scoped to the round (or the flow, when it has no round) and are stored as\n`speechDocLinks` records (`id` is `ROUND-SCOPE:SPEECH`, `docId` is the\ndocument's account id). The store is in the account's synced tool records, so\na signed-in user's links follow them to other devices; a signed-out browser\nkeeps them in `localStorage`. Links saved under the old `speech-doc-links`\nmap are read once and folded into the new store on the next change."},{heading:`linking-a-speech-to-an-editor-document`,content:`A link only resolves on another device once both the round and the document
it names have synced there too \u2014 until then the speech falls back to its own
text.`}],headings:[{id:`speech-documents--a-history-of-what-cardmirror-actually-sent`,content:`Speech Documents \u2014 a history of what CardMirror actually sent`},{id:`how-sending-works`,content:`How sending works`},{id:`what-this-page-shows`,content:`What this page shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`},{id:`linking-a-speech-to-an-editor-document`,content:`Linking a speech to an editor document`}]},a=[{depth:1,url:`#speech-documents--a-history-of-what-cardmirror-actually-sent`,title:(0,t.jsx)(t.Fragment,{children:`Speech Documents \u2014 a history of what CardMirror actually sent`})},{depth:2,url:`#how-sending-works`,title:(0,t.jsx)(t.Fragment,{children:`How sending works`})},{depth:2,url:`#what-this-page-shows`,title:(0,t.jsx)(t.Fragment,{children:`What this page shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})},{depth:2,url:`#linking-a-speech-to-an-editor-document`,title:(0,t.jsx)(t.Fragment,{children:`Linking a speech to an editor document`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`speech-documents--a-history-of-what-cardmirror-actually-sent`,children:`Speech Documents \u2014 a history of what CardMirror actually sent`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`/speech-documents`}),` shows a durable, listable send log of everything the
live Reason Editor (CardMirror) has sent into a designated "speech doc"
pane.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/speech-documents`}),` (view/manage history) \u2014 send from any
CardMirror document (e.g. `,(0,t.jsx)(n.code,{children:`/reason-editor`}),`)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-editor`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`how-sending-works`,children:`How sending works`}),`
`,(0,t.jsxs)(n.p,{children:[`CardMirror's speech-doc feature is a pane-designation model: mark a pane as
the speech doc (File menu \u2192 Speech), then send the current selection (or
card/section) with the backtick key. A live ProseMirror slice is inserted
directly into the designated pane \u2014 same-window, or cross-tab via
`,(0,t.jsx)(n.code,{children:`BroadcastChannel`}),`. The speech doc is just an ordinary open document \u2014
CardMirror keeps no separate copy.`]}),`
`,(0,t.jsx)(n.h2,{id:`what-this-page-shows`,children:`What this page shows`}),`
`,(0,t.jsxs)(n.p,{children:[`A `,(0,t.jsx)(n.strong,{children:`send log`}),`, not a document list: the plain text of what actually landed
for every send, in IndexedDB, newest first, with per-entry Remove and a
Clear history action.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`debate-editor/src/editor/speech-doc-send.ts \u2192 sendToSpeech / insertSpeechSlice`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`debate-editor/src/editor/speech-send-log.ts (IndexedDB, "speech-send-log")`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`apps/debate-ai.com/app/speech-documents/SpeechSendLogPanel.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`Today's log is one global history, not grouped per speech-doc identity.`}),`
`,(0,t.jsx)(n.h2,{id:`linking-a-speech-to-an-editor-document`,children:`Linking a speech to an editor document`}),`
`,(0,t.jsxs)(n.p,{children:[`A speech's header can point at one of your recent editor documents, so its
word counts come from that file instead of the flow's own speech text. Links
are scoped to the round (or the flow, when it has no round) and are stored as
`,(0,t.jsx)(n.code,{children:`speechDocLinks`}),` records (`,(0,t.jsx)(n.code,{children:`id`}),` is `,(0,t.jsx)(n.code,{children:`ROUND-SCOPE:SPEECH`}),`, `,(0,t.jsx)(n.code,{children:`docId`}),` is the
document's account id). The store is in the account's synced tool records, so
a signed-in user's links follow them to other devices; a signed-out browser
keeps them in `,(0,t.jsx)(n.code,{children:`localStorage`}),`. Links saved under the old `,(0,t.jsx)(n.code,{children:`speech-doc-links`}),`
map are read once and folded into the new store on the next change.`]}),`
`,(0,t.jsx)(n.p,{children:`A link only resolves on another device once both the round and the document
it names have synced there too \u2014 until then the speech falls back to its own
text.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};