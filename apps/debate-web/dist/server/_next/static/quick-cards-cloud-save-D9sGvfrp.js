import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Quick Cards Cloud Save`},r=`# Quick Cards Cloud Save [#quick-cards-cloud-save]

Syncs the CardMirror Quick Cards reusable-snippet library to a signed-in
user's account, closing the same account-linking gap flows, rounds,
word-count history, judge decisions, Reason Editor documents, and the
Speech Documents send log already closed \u2014 the library was device-local
(IndexedDB) only.

- **Package:** \`debate-editor\` (\`quickCardsStore\`, validator),
  \`apps/debate-ai.com\` (\`/api/quick-cards\`, \`saved_quick_cards\` D1 table)

## What it does [#what-it-does]

On boot, \`quickCardsStore.init()\` merges once against the account: any
card synced from another device but missing from this browser's IndexedDB
library is adopted, and any card that exists only here (saved offline, or
before this feature shipped) is best-effort pushed up \u2014 neither side ever
overwrites the other, it only fills gaps. Every later add, edit, or bulk
import mirrors itself to the account per-record; a single-card delete mirrors
as one \`DELETE /api/quick-cards/[cardId]\` call, and a full-library "clear"
mirrors as one \`DELETE /api/quick-cards\` bulk call instead of one request per
card. Signed out, the library keeps working exactly as before, purely
on-device.

Every per-record push carries optimistic concurrency: \`PUT
/api/quick-cards/[cardId]\` compares the incoming card's own \`updatedAt\`
against whatever's already saved for that id, and rejects (409) instead of
overwriting when the saved version is newer \u2014 an edit made on another
device that hasn't reached this browser yet. On that rejection, this
browser adopts the newer version into its own local library instead of
losing it, the same "never overwrite, only reconcile" rule \`init()\`'s merge
already follows.

## Known gaps [#known-gaps]

None open.
`,i={contents:[{heading:`quick-cards-cloud-save`,content:`Syncs the CardMirror Quick Cards reusable-snippet library to a signed-in
user's account, closing the same account-linking gap flows, rounds,
word-count history, judge decisions, Reason Editor documents, and the
Speech Documents send log already closed \u2014 the library was device-local
(IndexedDB) only.`},{heading:`quick-cards-cloud-save`,content:"**Package:** `debate-editor` (`quickCardsStore`, validator),\n`apps/debate-ai.com` (`/api/quick-cards`, `saved_quick_cards` D1 table)"},{heading:`what-it-does`,content:`On boot, \`quickCardsStore.init()\` merges once against the account: any
card synced from another device but missing from this browser's IndexedDB
library is adopted, and any card that exists only here (saved offline, or
before this feature shipped) is best-effort pushed up \u2014 neither side ever
overwrites the other, it only fills gaps. Every later add, edit, or bulk
import mirrors itself to the account per-record; a single-card delete mirrors
as one \`DELETE /api/quick-cards/[cardId]\` call, and a full-library "clear"
mirrors as one \`DELETE /api/quick-cards\` bulk call instead of one request per
card. Signed out, the library keeps working exactly as before, purely
on-device.`},{heading:`what-it-does`,content:`Every per-record push carries optimistic concurrency: \`PUT
/api/quick-cards/[cardId]\` compares the incoming card's own \`updatedAt\`
against whatever's already saved for that id, and rejects (409) instead of
overwriting when the saved version is newer \u2014 an edit made on another
device that hasn't reached this browser yet. On that rejection, this
browser adopts the newer version into its own local library instead of
losing it, the same "never overwrite, only reconcile" rule \`init()\`'s merge
already follows.`},{heading:`known-gaps`,content:`None open.`}],headings:[{id:`quick-cards-cloud-save`,content:`Quick Cards Cloud Save`},{id:`what-it-does`,content:`What it does`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#quick-cards-cloud-save`,title:(0,t.jsx)(t.Fragment,{children:`Quick Cards Cloud Save`})},{depth:2,url:`#what-it-does`,title:(0,t.jsx)(t.Fragment,{children:`What it does`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`quick-cards-cloud-save`,children:`Quick Cards Cloud Save`}),`
`,(0,t.jsx)(n.p,{children:`Syncs the CardMirror Quick Cards reusable-snippet library to a signed-in
user's account, closing the same account-linking gap flows, rounds,
word-count history, judge decisions, Reason Editor documents, and the
Speech Documents send log already closed \u2014 the library was device-local
(IndexedDB) only.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-editor`}),` (`,(0,t.jsx)(n.code,{children:`quickCardsStore`}),`, validator),
`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com`}),` (`,(0,t.jsx)(n.code,{children:`/api/quick-cards`}),`, `,(0,t.jsx)(n.code,{children:`saved_quick_cards`}),` D1 table)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-does`,children:`What it does`}),`
`,(0,t.jsxs)(n.p,{children:[`On boot, `,(0,t.jsx)(n.code,{children:`quickCardsStore.init()`}),` merges once against the account: any
card synced from another device but missing from this browser's IndexedDB
library is adopted, and any card that exists only here (saved offline, or
before this feature shipped) is best-effort pushed up \u2014 neither side ever
overwrites the other, it only fills gaps. Every later add, edit, or bulk
import mirrors itself to the account per-record; a single-card delete mirrors
as one `,(0,t.jsx)(n.code,{children:`DELETE /api/quick-cards/[cardId]`}),` call, and a full-library "clear"
mirrors as one `,(0,t.jsx)(n.code,{children:`DELETE /api/quick-cards`}),` bulk call instead of one request per
card. Signed out, the library keeps working exactly as before, purely
on-device.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Every per-record push carries optimistic concurrency: `,(0,t.jsx)(n.code,{children:`PUT /api/quick-cards/[cardId]`}),` compares the incoming card's own `,(0,t.jsx)(n.code,{children:`updatedAt`}),`
against whatever's already saved for that id, and rejects (409) instead of
overwriting when the saved version is newer \u2014 an edit made on another
device that hasn't reached this browser yet. On that rejection, this
browser adopts the newer version into its own local library instead of
losing it, the same "never overwrite, only reconcile" rule `,(0,t.jsx)(n.code,{children:`init()`}),`'s merge
already follows.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`None open.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};