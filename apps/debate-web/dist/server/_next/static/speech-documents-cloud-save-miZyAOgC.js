import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Speech Documents Cloud Save`},r=`# Speech Documents Cloud Save [#speech-documents-cloud-save]

Syncs \`/speech-documents\`' send-log history to a signed-in user's account,
closing the last account-linking gap for debate preferences (flows,
rounds, word-count history, judge decisions, and Reason Editor documents
were already synced).

- **Package:** \`debate-editor\` (validator), \`apps/debate-ai.com\`
  (\`/api/speech-send-log\`, \`saved_speech_send_log\` D1 table)

## What it does [#what-it-does]

\`useSpeechSendLogSync\` layers a one-time account merge plus ongoing sync
on top of the existing IndexedDB \`speechSendLogStore\`. It subscribes to
the store directly and diffs every fired entry list against a known-synced
set, pushing anything new \u2014 so a send made in any tab gets synced, not
just the panel's own tab.

## Linked speech documents [#linked-speech-documents]

Separate from the send log: the speech header's link picker (which Reason
Editor document a speech reads its word counts from) is stored as id-keyed
records under \`speech-doc-links\` and syncs through the \`speechDocLinks\`
tool-record collection, so a link follows a signed-in user to a second
device. The link is keyed by the round's or flow's client id, and resolves
once that round and the linked document have synced as well; until then the
speech falls back to the flow's own speech doc. Links saved before this
change (a \`{ key: link }\` map) are still read and rewritten as records on
the next change.

## Known gaps [#known-gaps]

No optimistic-concurrency handling (not reachable in practice \u2014 an entry
is generated once and never edited). Entries adopted during merge are
re-sorted by \`sentAt\` (\`SpeechSendLogStore.mergeRemote\`), so an entry sent
earlier from another device lands in its correct chronological position
instead of showing as the newest.
`,i={contents:[{heading:`speech-documents-cloud-save`,content:`Syncs \`/speech-documents\`' send-log history to a signed-in user's account,
closing the last account-linking gap for debate preferences (flows,
rounds, word-count history, judge decisions, and Reason Editor documents
were already synced).`},{heading:`speech-documents-cloud-save`,content:"**Package:** `debate-editor` (validator), `apps/debate-ai.com`\n(`/api/speech-send-log`, `saved_speech_send_log` D1 table)"},{heading:`what-it-does`,content:`\`useSpeechSendLogSync\` layers a one-time account merge plus ongoing sync
on top of the existing IndexedDB \`speechSendLogStore\`. It subscribes to
the store directly and diffs every fired entry list against a known-synced
set, pushing anything new \u2014 so a send made in any tab gets synced, not
just the panel's own tab.`},{heading:`linked-speech-documents`,content:`Separate from the send log: the speech header's link picker (which Reason
Editor document a speech reads its word counts from) is stored as id-keyed
records under \`speech-doc-links\` and syncs through the \`speechDocLinks\`
tool-record collection, so a link follows a signed-in user to a second
device. The link is keyed by the round's or flow's client id, and resolves
once that round and the linked document have synced as well; until then the
speech falls back to the flow's own speech doc. Links saved before this
change (a \`{ key: link }\` map) are still read and rewritten as records on
the next change.`},{heading:`known-gaps`,content:`No optimistic-concurrency handling (not reachable in practice \u2014 an entry
is generated once and never edited). Entries adopted during merge are
re-sorted by \`sentAt\` (\`SpeechSendLogStore.mergeRemote\`), so an entry sent
earlier from another device lands in its correct chronological position
instead of showing as the newest.`}],headings:[{id:`speech-documents-cloud-save`,content:`Speech Documents Cloud Save`},{id:`what-it-does`,content:`What it does`},{id:`linked-speech-documents`,content:`Linked speech documents`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#speech-documents-cloud-save`,title:(0,t.jsx)(t.Fragment,{children:`Speech Documents Cloud Save`})},{depth:2,url:`#what-it-does`,title:(0,t.jsx)(t.Fragment,{children:`What it does`})},{depth:2,url:`#linked-speech-documents`,title:(0,t.jsx)(t.Fragment,{children:`Linked speech documents`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`speech-documents-cloud-save`,children:`Speech Documents Cloud Save`}),`
`,(0,t.jsxs)(n.p,{children:[`Syncs `,(0,t.jsx)(n.code,{children:`/speech-documents`}),`' send-log history to a signed-in user's account,
closing the last account-linking gap for debate preferences (flows,
rounds, word-count history, judge decisions, and Reason Editor documents
were already synced).`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-editor`}),` (validator), `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com`}),`
(`,(0,t.jsx)(n.code,{children:`/api/speech-send-log`}),`, `,(0,t.jsx)(n.code,{children:`saved_speech_send_log`}),` D1 table)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-does`,children:`What it does`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`useSpeechSendLogSync`}),` layers a one-time account merge plus ongoing sync
on top of the existing IndexedDB `,(0,t.jsx)(n.code,{children:`speechSendLogStore`}),`. It subscribes to
the store directly and diffs every fired entry list against a known-synced
set, pushing anything new \u2014 so a send made in any tab gets synced, not
just the panel's own tab.`]}),`
`,(0,t.jsx)(n.h2,{id:`linked-speech-documents`,children:`Linked speech documents`}),`
`,(0,t.jsxs)(n.p,{children:[`Separate from the send log: the speech header's link picker (which Reason
Editor document a speech reads its word counts from) is stored as id-keyed
records under `,(0,t.jsx)(n.code,{children:`speech-doc-links`}),` and syncs through the `,(0,t.jsx)(n.code,{children:`speechDocLinks`}),`
tool-record collection, so a link follows a signed-in user to a second
device. The link is keyed by the round's or flow's client id, and resolves
once that round and the linked document have synced as well; until then the
speech falls back to the flow's own speech doc. Links saved before this
change (a `,(0,t.jsx)(n.code,{children:`{ key: link }`}),` map) are still read and rewritten as records on
the next change.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[`No optimistic-concurrency handling (not reachable in practice \u2014 an entry
is generated once and never edited). Entries adopted during merge are
re-sorted by `,(0,t.jsx)(n.code,{children:`sentAt`}),` (`,(0,t.jsx)(n.code,{children:`SpeechSendLogStore.mergeRemote`}),`), so an entry sent
earlier from another device lands in its correct chronological position
instead of showing as the newest.`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};