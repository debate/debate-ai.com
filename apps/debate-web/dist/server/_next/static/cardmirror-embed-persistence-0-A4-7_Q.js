import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`CardMirror embed persistence \u2014 why a loaded file can't go blank`},r=`# CardMirror embed persistence \u2014 why a loaded file can't go blank [#cardmirror-embed-persistence--why-a-loaded-file-cant-go-blank]

The rules that decide when an edit in the CardMirror embed becomes a write to
the cloud, and what happens when a document can't be loaded. This is the fix
for "after a file is loaded it sometimes disappears and goes blank" \u2014 which
was never only a display bug: the blank was reported as the document's new
content and saved over the file.

- **Routes:** \`/reason-editor\`, and Flow's speech-doc panels (same embed)
- **Packages:** \`debate-editor\`
  (\`src/react/change-reporter.ts\`, \`src/react/singleton.ts\`,
  \`src/react/html-bridge.ts\`), \`apps/debate-ai.com\`
  (\`lib/reason-docs/save-queue.ts\`, \`components/reason-docs/ReasonDocsProvider.tsx\`)
- **Storage:** the \`documents\` D1 table, through \`/api/doc/documents/:id\`

## The shape of the problem [#the-shape-of-the-problem]

CardMirror's engine (\`packages/debate-editor/src/editor/index.ts\`) is a
page-level singleton that assumes it owns the window: one \`EditorView\`, one
current document, its own file/recovery machinery. The React embed hands the
host app's document to that same view and treats what comes back out as the
document's content \u2014 \`onChange(html)\` in, \`PUT /api/doc/documents/:id\` out.

Everything below follows from those two facts meeting: the engine replaces
its editor state on its own initiative, and whatever is in the view when it
does gets saved as the user's file.

The engine itself is upstream CardMirror (the \`packages/debate-editor-cm\`
submodule), assembled with debate-ai.com's patch into \`packages/debate-editor/src/\` at install time. The two seams the
embed leans on \u2014 \`adoptEmbeddedDoc\` (tells the engine which document the host
mounted) and the \`hostPlugins()\` slot in \`buildEditorPlugins\` (keeps the
change reporter across every plugin rebuild) \u2014 are debate-ai.com edits to
upstream's \`editor/index.ts\`, recorded in \`packages/debate-editor/patches/debate-ai.patch\`
and carried forward by \`scripts/sync-upstream.mjs --rebase\` on each upstream bump. An
upstream sync that moved or dropped either one breaks this page's guarantees,
so check both after resolving a conflict in \`index.ts\`.

## An edit is a transaction, nothing else [#an-edit-is-a-transaction-nothing-else]

\`change-reporter.ts\` sorts every doc change into three kinds and only the
first reaches the host:

| Change | Reported? |
| --- | --- |
| A transaction that changed the doc | Yes \u2014 a real edit |
| A transaction tagged \`LOAD_META\` | No \u2014 the singleton loading host content |
| The whole editor state (or view) replaced | No \u2014 and see below |

Plugin \`state.apply\` runs for **transactions only**, so an edit counter kept
there rises on a real edit and resets to \`init\` when the state is replaced
wholesale. That is the whole discrimination. And because ProseMirror does
*not* call a plugin view's \`update\` when the state is replaced \u2014 it destroys
the plugin views and builds new ones, and the engine's \`mountView\` builds a
whole new \`EditorView\` besides \u2014 the plugin's \`view()\` factory running again
is the signal that the state underneath was swapped out.

Deleting everything in a document is still a transaction, so a user who
empties a file still empties it in the cloud. What can no longer do that is
the engine mounting its blank starter doc.

## A blank the user didn't ask for is put back [#a-blank-the-user-didnt-ask-for-is-put-back]

When the state is replaced by something other than the singleton's own load
and what landed is blank while the host's document wasn't, the singleton
re-loads the host's document into the new view (\`restoreIfEngineBlankedTheDoc\`).
A replacement carrying real content \u2014 the ribbon's own Open, a joined
collaboration session \u2014 is left alone.

The engine also gets told which document is mounted
(\`adoptEmbeddedDoc\`). Its \`currentDoc\` is the fallback content for any
remount it does on its own, and in an embed it otherwise still held the blank
starter from boot \u2014 so \`mountView(currentDoc)\` on a spawned-session mount or
a damaged-file fallback remounted that blank over the host's file. That is
one concrete way the pane used to go blank; declaring the mounted doc removes
it at the source, and the restore above covers the paths that don't consult
\`currentDoc\` at all.

## Content that doesn't parse is not content [#content-that-doesnt-parse-is-not-content]

\`html-bridge.ts\` used to answer "this didn't parse" and "this document is
empty" with the same blank doc. For a host whose stored document IS that HTML
string, the difference is everything: the blank mounted, got reported as the
new content, and the file was gone.

\`parseHtml\` now reports which it was. Non-empty input that comes out blank \u2014
foreign markup from a previous editor, a truncated fragment \u2014 is a failed
load: the singleton keeps whatever is already on screen rather than blanking
it, files a durable status notice, and **stops reporting that document
entirely**, so nothing typed into the pane can overwrite the intact copy on
the server. A later load of the same document that parses cleanly lifts the
block.

Footnotes were also being dropped by every round trip: a footnote ref
serializes to an empty \`<sup>\` carrying its text in \`data-content\`, and
ProseMirror collects mark rules before node rules, so the generic
\`superscript\` mark rule matched first and the footnote came back as a mark on
no text. The node's \`parseDOM\` rule now carries \`priority: 60\`. Ordinary
superscript text is unaffected \u2014 that rule only matches \`.pmd-footnote-ref\`.

## Edits are filed under the document they were made in [#edits-are-filed-under-the-document-they-were-made-in]

Change reporting is debounced ~400 ms. The debounce is flushed before the
live binding changes (\`claim\` of a different key, \`release\` on pane close)
and when the page is hidden or unloaded. Without that flush, switching
documents inside the window either dropped the last edits or reported them
under the document you switched *to*.

The \`content\` prop coming back from the host is matched against a bounded
ring of recently emitted strings, not just the last one: the host's state
round-trips through React, so a stale echo can arrive after a newer one, and
re-applying it would throw away whatever was typed in between.

## Reaching the cloud [#reaching-the-cloud]

\`lib/reason-docs/save-queue.ts\` owns the write side. One debounce **per
document**, with merged patches \u2014 the previous single shared timer meant the
next edit cancelled whatever was still waiting, so renaming a file and then
typing in another one silently dropped the rename, and switching documents
inside the debounce dropped the edits to the one you left.

- \`flushAll({ keepalive: true })\` on \`pagehide\` and on the tab going hidden,
  so closing a tab mid-sentence doesn't lose the sentence.
- A failed write stays queued and retries with backoff, merging any newer
  edit over the failed patch so a retry never resurrects stale content.
- \`onStateChange\` drives the editor's header: \`Saving\u2026\`, \`Unsaved changes\`,
  or \`Couldn't save \u2014 retrying\u2026\` \u2014 the last of which used to show as a
  \`Saving\u2026\` that never resolved.
- A document being deleted has its queued writes cancelled, so no PUT lands
  after the DELETE.
- \`moveDocument\` (dragging a file to a new folder) queues its \`parentId\`
  patch through the same queue as title/content edits, so a re-parent gets
  the same retry-with-backoff and \`pagehide\`/tab-hide flush.

## What the embed doesn't pop up on open [#what-the-embed-doesnt-pop-up-on-open]

The site mounts CardMirror on nearly every visit, so the engine's
first-launch and crash-recovery surfaces are switched off in the embed
(debate-ai.com edits to upstream, in \`patches/debate-ai.patch\`):

- **Recover drafts sidebar** \u2014 \`runStartupRecoveryInner\` returns before
  \`openRecoverySidebar\` when \`BOOT_EMBEDDED\`. Journals are left on disk,
  untouched; the mode-switch auto-reopen above that check still runs.
- **UI tour and Verbatim nudge** \u2014 not auto-started when \`detectEmbedded()\`.
  Help \u2192 UI tour still starts the tour by hand.
- **"Receiving cards in-browser needs your account" notice** \u2014 shown once per
  browser (\`localStorage\` key \`cardmirror.pairingAccountRequiredSeen\`) instead
  of on every mount.

The outline nav pane still opens beside the document as before.

## \`.cmir\` files open in read mode [#cmir-files-open-in-read-mode]

Opening any \`.cmir\` document turns read mode on, the same state the
ribbon's Read mode button toggles:

- **REASON editor** \u2014 \`ReasonEditorScreen\` passes \`defaultReadMode\` for
  Topic Starters and uploaded documents (stored as \`.cmir\`); HTML rows
  written in the editor still open editable.
- **\`importCmir\`** on the embed's imperative handle claims with
  \`readMode: true\`.
- **Engine file open** \u2014 \`loadFileInPlace\` sets \`readMode\` after mounting a
  \`.cmir\` (Open, recents, drag-and-drop, command-palette file search).

It's applied once, when a document is mounted (\`claim\`'s new-key branch),
so turning read mode off sticks for that document until another one opens.

## Tests [#tests]

- \`packages/debate-editor/test/singleton-read-mode.test.ts\` \u2014 read mode
  carries across doc switches, and a claim with \`readMode\` (a \`.cmir\` open)
  turns it on without re-forcing it on a re-claim of the live doc
- \`packages/debate-editor/test/change-reporter.test.ts\` \u2014 edit vs. load vs.
  state replacement, including a whole new \`EditorView\`
- \`packages/debate-editor/test/html-bridge.test.ts\` \u2014 card/footnote round
  trip, and \`parseHtml\`'s empty-vs-lost distinction
- \`apps/debate-ai.com/lib/reason-docs/__tests__/save-queue.test.ts\` \u2014 every
  way the old shared timer lost work
- \`packages/debate-editor/test/status-notices.test.ts\` \u2014 the unreadable-doc
  notice's Download button (rendered only when a payload is attached,
  survives a coalesced repeat, Blob/anchor download fires on click)
- \`packages/debate-editor/test/singleton.test.ts\` \u2014 \`sanitizeForFilename\`'s
  handling of path separators and other filename-unsafe characters
- \`packages/debate-editor/test/engine-boot.test.ts\` \u2014 boots the real engine
  inside \`RIBBON_HTML\` the way the singleton does, so an upstream sync that
  needs a new element the embed markup lacks fails in CI instead of at load
- \`packages/debate-editor/test/upstream-sync.test.ts\` \u2014 the patch applies to the
  pinned upstream commit and no edit under the generated \`src/\` went unrecorded

## Known gaps [#known-gaps]

- ~~The singleton refuses to save a document it couldn't read, which also
  means work typed into that pane is discarded.~~ Closed: \`markUnreadable\`
  now attaches the raw HTML that failed to parse to the notice as a
  \`download\` payload, and the notice panel renders a "Download" button next
  to Copy/Dismiss that saves it as \`unreadable-<key>.html\` (\`<key>\` run
  through \`sanitizeForFilename\`, since it's a free-form document title, not
  already filename-safe). The server's stored copy is still untouched and
  still the one thing to trust \u2014 this only rescues whatever was in the pane
  that would otherwise just be discarded when the user navigates away.
- Flow's speech docs ride the same embed and so inherit every guard here, but
  their own persistence (inside the \`Flow\` object, via \`/api/flows\`) has no
  equivalent per-document queue.
`,i={contents:[{heading:`cardmirror-embed-persistence--why-a-loaded-file-cant-go-blank`,content:`The rules that decide when an edit in the CardMirror embed becomes a write to
the cloud, and what happens when a document can't be loaded. This is the fix
for "after a file is loaded it sometimes disappears and goes blank" \u2014 which
was never only a display bug: the blank was reported as the document's new
content and saved over the file.`},{heading:`cardmirror-embed-persistence--why-a-loaded-file-cant-go-blank`,content:"**Routes:** `/reason-editor`, and Flow's speech-doc panels (same embed)"},{heading:`cardmirror-embed-persistence--why-a-loaded-file-cant-go-blank`,content:"**Packages:** `debate-editor`\n(`src/react/change-reporter.ts`, `src/react/singleton.ts`,\n`src/react/html-bridge.ts`), `apps/debate-ai.com`\n(`lib/reason-docs/save-queue.ts`, `components/reason-docs/ReasonDocsProvider.tsx`)"},{heading:`cardmirror-embed-persistence--why-a-loaded-file-cant-go-blank`,content:"**Storage:** the `documents` D1 table, through `/api/doc/documents/:id`"},{heading:`the-shape-of-the-problem`,content:"CardMirror's engine (`packages/debate-editor/src/editor/index.ts`) is a\npage-level singleton that assumes it owns the window: one `EditorView`, one\ncurrent document, its own file/recovery machinery. The React embed hands the\nhost app's document to that same view and treats what comes back out as the\ndocument's content \u2014 `onChange(html)` in, `PUT /api/doc/documents/:id` out."},{heading:`the-shape-of-the-problem`,content:`Everything below follows from those two facts meeting: the engine replaces
its editor state on its own initiative, and whatever is in the view when it
does gets saved as the user's file.`},{heading:`the-shape-of-the-problem`,content:"The engine itself is upstream CardMirror (the `packages/debate-editor-cm`\nsubmodule), assembled with debate-ai.com's patch into `packages/debate-editor/src/` at install time. The two seams the\nembed leans on \u2014 `adoptEmbeddedDoc` (tells the engine which document the host\nmounted) and the `hostPlugins()` slot in `buildEditorPlugins` (keeps the\nchange reporter across every plugin rebuild) \u2014 are debate-ai.com edits to\nupstream's `editor/index.ts`, recorded in `packages/debate-editor/patches/debate-ai.patch`\nand carried forward by `scripts/sync-upstream.mjs --rebase` on each upstream bump. An\nupstream sync that moved or dropped either one breaks this page's guarantees,\nso check both after resolving a conflict in `index.ts`."},{heading:`an-edit-is-a-transaction-nothing-else`,content:"`change-reporter.ts` sorts every doc change into three kinds and only the\nfirst reaches the host:"},{heading:`an-edit-is-a-transaction-nothing-else`,content:`| Change                             | Reported?         |
| ---------------------------------- | ----------------- |
| A transaction that changed the doc | Yes \u2014 a real edit |`,table:`table-0`},{heading:`an-edit-is-a-transaction-nothing-else`,content:`| Change                           | Reported?                               |
| -------------------------------- | --------------------------------------- |
| A transaction tagged \`LOAD_META\` | No \u2014 the singleton loading host content |`,table:`table-0`},{heading:`an-edit-is-a-transaction-nothing-else`,content:`| Change                                    | Reported?          |
| ----------------------------------------- | ------------------ |
| The whole editor state (or view) replaced | No \u2014 and see below |`,table:`table-0`},{heading:`an-edit-is-a-transaction-nothing-else`,content:"Plugin `state.apply` runs for **transactions only**, so an edit counter kept\nthere rises on a real edit and resets to `init` when the state is replaced\nwholesale. That is the whole discrimination. And because ProseMirror does\n*not* call a plugin view's `update` when the state is replaced \u2014 it destroys\nthe plugin views and builds new ones, and the engine's `mountView` builds a\nwhole new `EditorView` besides \u2014 the plugin's `view()` factory running again\nis the signal that the state underneath was swapped out."},{heading:`an-edit-is-a-transaction-nothing-else`,content:`Deleting everything in a document is still a transaction, so a user who
empties a file still empties it in the cloud. What can no longer do that is
the engine mounting its blank starter doc.`},{heading:`a-blank-the-user-didnt-ask-for-is-put-back`,content:`When the state is replaced by something other than the singleton's own load
and what landed is blank while the host's document wasn't, the singleton
re-loads the host's document into the new view (\`restoreIfEngineBlankedTheDoc\`).
A replacement carrying real content \u2014 the ribbon's own Open, a joined
collaboration session \u2014 is left alone.`},{heading:`a-blank-the-user-didnt-ask-for-is-put-back`,content:"The engine also gets told which document is mounted\n(`adoptEmbeddedDoc`). Its `currentDoc` is the fallback content for any\nremount it does on its own, and in an embed it otherwise still held the blank\nstarter from boot \u2014 so `mountView(currentDoc)` on a spawned-session mount or\na damaged-file fallback remounted that blank over the host's file. That is\none concrete way the pane used to go blank; declaring the mounted doc removes\nit at the source, and the restore above covers the paths that don't consult\n`currentDoc` at all."},{heading:`content-that-doesnt-parse-is-not-content`,content:`\`html-bridge.ts\` used to answer "this didn't parse" and "this document is
empty" with the same blank doc. For a host whose stored document IS that HTML
string, the difference is everything: the blank mounted, got reported as the
new content, and the file was gone.`},{heading:`content-that-doesnt-parse-is-not-content`,content:`\`parseHtml\` now reports which it was. Non-empty input that comes out blank \u2014
foreign markup from a previous editor, a truncated fragment \u2014 is a failed
load: the singleton keeps whatever is already on screen rather than blanking
it, files a durable status notice, and **stops reporting that document
entirely**, so nothing typed into the pane can overwrite the intact copy on
the server. A later load of the same document that parses cleanly lifts the
block.`},{heading:`content-that-doesnt-parse-is-not-content`,content:"Footnotes were also being dropped by every round trip: a footnote ref\nserializes to an empty `<sup>` carrying its text in `data-content`, and\nProseMirror collects mark rules before node rules, so the generic\n`superscript` mark rule matched first and the footnote came back as a mark on\nno text. The node's `parseDOM` rule now carries `priority: 60`. Ordinary\nsuperscript text is unaffected \u2014 that rule only matches `.pmd-footnote-ref`."},{heading:`edits-are-filed-under-the-document-they-were-made-in`,content:`Change reporting is debounced ~400 ms. The debounce is flushed before the
live binding changes (\`claim\` of a different key, \`release\` on pane close)
and when the page is hidden or unloaded. Without that flush, switching
documents inside the window either dropped the last edits or reported them
under the document you switched *to*.`},{heading:`edits-are-filed-under-the-document-they-were-made-in`,content:`The \`content\` prop coming back from the host is matched against a bounded
ring of recently emitted strings, not just the last one: the host's state
round-trips through React, so a stale echo can arrive after a newer one, and
re-applying it would throw away whatever was typed in between.`},{heading:`reaching-the-cloud`,content:`\`lib/reason-docs/save-queue.ts\` owns the write side. One debounce **per
document**, with merged patches \u2014 the previous single shared timer meant the
next edit cancelled whatever was still waiting, so renaming a file and then
typing in another one silently dropped the rename, and switching documents
inside the debounce dropped the edits to the one you left.`},{heading:`reaching-the-cloud`,content:"`flushAll({ keepalive: true })` on `pagehide` and on the tab going hidden,\nso closing a tab mid-sentence doesn't lose the sentence."},{heading:`reaching-the-cloud`,content:`A failed write stays queued and retries with backoff, merging any newer
edit over the failed patch so a retry never resurrects stale content.`},{heading:`reaching-the-cloud`,content:"`onStateChange` drives the editor's header: `Saving\u2026`, `Unsaved changes`,\nor `Couldn't save \u2014 retrying\u2026` \u2014 the last of which used to show as a\n`Saving\u2026` that never resolved."},{heading:`reaching-the-cloud`,content:`A document being deleted has its queued writes cancelled, so no PUT lands
after the DELETE.`},{heading:`reaching-the-cloud`,content:"`moveDocument` (dragging a file to a new folder) queues its `parentId`\npatch through the same queue as title/content edits, so a re-parent gets\nthe same retry-with-backoff and `pagehide`/tab-hide flush."},{heading:`what-the-embed-doesnt-pop-up-on-open`,content:`The site mounts CardMirror on nearly every visit, so the engine's
first-launch and crash-recovery surfaces are switched off in the embed
(debate-ai.com edits to upstream, in \`patches/debate-ai.patch\`):`},{heading:`what-the-embed-doesnt-pop-up-on-open`,content:"**Recover drafts sidebar** \u2014 `runStartupRecoveryInner` returns before\n`openRecoverySidebar` when `BOOT_EMBEDDED`. Journals are left on disk,\nuntouched; the mode-switch auto-reopen above that check still runs."},{heading:`what-the-embed-doesnt-pop-up-on-open`,content:"**UI tour and Verbatim nudge** \u2014 not auto-started when `detectEmbedded()`.\nHelp \u2192 UI tour still starts the tour by hand."},{heading:`what-the-embed-doesnt-pop-up-on-open`,content:'**"Receiving cards in-browser needs your account" notice** \u2014 shown once per\nbrowser (`localStorage` key `cardmirror.pairingAccountRequiredSeen`) instead\nof on every mount.'},{heading:`what-the-embed-doesnt-pop-up-on-open`,content:`The outline nav pane still opens beside the document as before.`},{heading:`cmir-files-open-in-read-mode`,content:"Opening any `.cmir` document turns read mode on, the same state the\nribbon's Read mode button toggles:"},{heading:`cmir-files-open-in-read-mode`,content:"**REASON editor** \u2014 `ReasonEditorScreen` passes `defaultReadMode` for\nTopic Starters and uploaded documents (stored as `.cmir`); HTML rows\nwritten in the editor still open editable."},{heading:`cmir-files-open-in-read-mode`,content:"**`importCmir`** on the embed's imperative handle claims with\n`readMode: true`."},{heading:`cmir-files-open-in-read-mode`,content:"**Engine file open** \u2014 `loadFileInPlace` sets `readMode` after mounting a\n`.cmir` (Open, recents, drag-and-drop, command-palette file search)."},{heading:`cmir-files-open-in-read-mode`,content:"It's applied once, when a document is mounted (`claim`'s new-key branch),\nso turning read mode off sticks for that document until another one opens."},{heading:`tests`,content:"`packages/debate-editor/test/singleton-read-mode.test.ts` \u2014 read mode\ncarries across doc switches, and a claim with `readMode` (a `.cmir` open)\nturns it on without re-forcing it on a re-claim of the live doc"},{heading:`tests`,content:"`packages/debate-editor/test/change-reporter.test.ts` \u2014 edit vs. load vs.\nstate replacement, including a whole new `EditorView`"},{heading:`tests`,content:"`packages/debate-editor/test/html-bridge.test.ts` \u2014 card/footnote round\ntrip, and `parseHtml`'s empty-vs-lost distinction"},{heading:`tests`,content:"`apps/debate-ai.com/lib/reason-docs/__tests__/save-queue.test.ts` \u2014 every\nway the old shared timer lost work"},{heading:`tests`,content:`\`packages/debate-editor/test/status-notices.test.ts\` \u2014 the unreadable-doc
notice's Download button (rendered only when a payload is attached,
survives a coalesced repeat, Blob/anchor download fires on click)`},{heading:`tests`,content:"`packages/debate-editor/test/singleton.test.ts` \u2014 `sanitizeForFilename`'s\nhandling of path separators and other filename-unsafe characters"},{heading:`tests`,content:"`packages/debate-editor/test/engine-boot.test.ts` \u2014 boots the real engine\ninside `RIBBON_HTML` the way the singleton does, so an upstream sync that\nneeds a new element the embed markup lacks fails in CI instead of at load"},{heading:`tests`,content:"`packages/debate-editor/test/upstream-sync.test.ts` \u2014 the patch applies to the\npinned upstream commit and no edit under the generated `src/` went unrecorded"},{heading:`known-gaps`,content:`~~The singleton refuses to save a document it couldn't read, which also
means work typed into that pane is discarded.~~ Closed: \`markUnreadable\`
now attaches the raw HTML that failed to parse to the notice as a
\`download\` payload, and the notice panel renders a "Download" button next
to Copy/Dismiss that saves it as \`unreadable-<key>.html\` (\`<key>\` run
through \`sanitizeForFilename\`, since it's a free-form document title, not
already filename-safe). The server's stored copy is still untouched and
still the one thing to trust \u2014 this only rescues whatever was in the pane
that would otherwise just be discarded when the user navigates away.`},{heading:`known-gaps`,content:"Flow's speech docs ride the same embed and so inherit every guard here, but\ntheir own persistence (inside the `Flow` object, via `/api/flows`) has no\nequivalent per-document queue."}],headings:[{id:`cardmirror-embed-persistence--why-a-loaded-file-cant-go-blank`,content:`CardMirror embed persistence \u2014 why a loaded file can't go blank`},{id:`the-shape-of-the-problem`,content:`The shape of the problem`},{id:`an-edit-is-a-transaction-nothing-else`,content:`An edit is a transaction, nothing else`},{id:`a-blank-the-user-didnt-ask-for-is-put-back`,content:`A blank the user didn't ask for is put back`},{id:`content-that-doesnt-parse-is-not-content`,content:`Content that doesn't parse is not content`},{id:`edits-are-filed-under-the-document-they-were-made-in`,content:`Edits are filed under the document they were made in`},{id:`reaching-the-cloud`,content:`Reaching the cloud`},{id:`what-the-embed-doesnt-pop-up-on-open`,content:`What the embed doesn't pop up on open`},{id:`cmir-files-open-in-read-mode`,content:"`.cmir` files open in read mode"},{id:`tests`,content:`Tests`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#cardmirror-embed-persistence--why-a-loaded-file-cant-go-blank`,title:(0,t.jsx)(t.Fragment,{children:`CardMirror embed persistence \u2014 why a loaded file can't go blank`})},{depth:2,url:`#the-shape-of-the-problem`,title:(0,t.jsx)(t.Fragment,{children:`The shape of the problem`})},{depth:2,url:`#an-edit-is-a-transaction-nothing-else`,title:(0,t.jsx)(t.Fragment,{children:`An edit is a transaction, nothing else`})},{depth:2,url:`#a-blank-the-user-didnt-ask-for-is-put-back`,title:(0,t.jsx)(t.Fragment,{children:`A blank the user didn't ask for is put back`})},{depth:2,url:`#content-that-doesnt-parse-is-not-content`,title:(0,t.jsx)(t.Fragment,{children:`Content that doesn't parse is not content`})},{depth:2,url:`#edits-are-filed-under-the-document-they-were-made-in`,title:(0,t.jsx)(t.Fragment,{children:`Edits are filed under the document they were made in`})},{depth:2,url:`#reaching-the-cloud`,title:(0,t.jsx)(t.Fragment,{children:`Reaching the cloud`})},{depth:2,url:`#what-the-embed-doesnt-pop-up-on-open`,title:(0,t.jsx)(t.Fragment,{children:`What the embed doesn't pop up on open`})},{depth:2,url:`#cmir-files-open-in-read-mode`,title:(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(`code`,{children:`.cmir`}),` files open in read mode`]})},{depth:2,url:`#tests`,title:(0,t.jsx)(t.Fragment,{children:`Tests`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,del:`del`,em:`em`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`cardmirror-embed-persistence--why-a-loaded-file-cant-go-blank`,children:`CardMirror embed persistence \u2014 why a loaded file can't go blank`}),`
`,(0,t.jsx)(n.p,{children:`The rules that decide when an edit in the CardMirror embed becomes a write to
the cloud, and what happens when a document can't be loaded. This is the fix
for "after a file is loaded it sometimes disappears and goes blank" \u2014 which
was never only a display bug: the blank was reported as the document's new
content and saved over the file.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Routes:`}),` `,(0,t.jsx)(n.code,{children:`/reason-editor`}),`, and Flow's speech-doc panels (same embed)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Packages:`}),` `,(0,t.jsx)(n.code,{children:`debate-editor`}),`
(`,(0,t.jsx)(n.code,{children:`src/react/change-reporter.ts`}),`, `,(0,t.jsx)(n.code,{children:`src/react/singleton.ts`}),`,
`,(0,t.jsx)(n.code,{children:`src/react/html-bridge.ts`}),`), `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com`}),`
(`,(0,t.jsx)(n.code,{children:`lib/reason-docs/save-queue.ts`}),`, `,(0,t.jsx)(n.code,{children:`components/reason-docs/ReasonDocsProvider.tsx`}),`)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Storage:`}),` the `,(0,t.jsx)(n.code,{children:`documents`}),` D1 table, through `,(0,t.jsx)(n.code,{children:`/api/doc/documents/:id`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`the-shape-of-the-problem`,children:`The shape of the problem`}),`
`,(0,t.jsxs)(n.p,{children:[`CardMirror's engine (`,(0,t.jsx)(n.code,{children:`packages/debate-editor/src/editor/index.ts`}),`) is a
page-level singleton that assumes it owns the window: one `,(0,t.jsx)(n.code,{children:`EditorView`}),`, one
current document, its own file/recovery machinery. The React embed hands the
host app's document to that same view and treats what comes back out as the
document's content \u2014 `,(0,t.jsx)(n.code,{children:`onChange(html)`}),` in, `,(0,t.jsx)(n.code,{children:`PUT /api/doc/documents/:id`}),` out.`]}),`
`,(0,t.jsx)(n.p,{children:`Everything below follows from those two facts meeting: the engine replaces
its editor state on its own initiative, and whatever is in the view when it
does gets saved as the user's file.`}),`
`,(0,t.jsxs)(n.p,{children:[`The engine itself is upstream CardMirror (the `,(0,t.jsx)(n.code,{children:`packages/debate-editor-cm`}),`
submodule), assembled with debate-ai.com's patch into `,(0,t.jsx)(n.code,{children:`packages/debate-editor/src/`}),` at install time. The two seams the
embed leans on \u2014 `,(0,t.jsx)(n.code,{children:`adoptEmbeddedDoc`}),` (tells the engine which document the host
mounted) and the `,(0,t.jsx)(n.code,{children:`hostPlugins()`}),` slot in `,(0,t.jsx)(n.code,{children:`buildEditorPlugins`}),` (keeps the
change reporter across every plugin rebuild) \u2014 are debate-ai.com edits to
upstream's `,(0,t.jsx)(n.code,{children:`editor/index.ts`}),`, recorded in `,(0,t.jsx)(n.code,{children:`packages/debate-editor/patches/debate-ai.patch`}),`
and carried forward by `,(0,t.jsx)(n.code,{children:`scripts/sync-upstream.mjs --rebase`}),` on each upstream bump. An
upstream sync that moved or dropped either one breaks this page's guarantees,
so check both after resolving a conflict in `,(0,t.jsx)(n.code,{children:`index.ts`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`an-edit-is-a-transaction-nothing-else`,children:`An edit is a transaction, nothing else`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`change-reporter.ts`}),` sorts every doc change into three kinds and only the
first reaches the host:`]}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Change`}),(0,t.jsx)(n.th,{children:`Reported?`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`A transaction that changed the doc`}),(0,t.jsx)(n.td,{children:`Yes \u2014 a real edit`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsxs)(n.td,{children:[`A transaction tagged `,(0,t.jsx)(n.code,{children:`LOAD_META`})]}),(0,t.jsx)(n.td,{children:`No \u2014 the singleton loading host content`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`The whole editor state (or view) replaced`}),(0,t.jsx)(n.td,{children:`No \u2014 and see below`})]})]})]}),`
`,(0,t.jsxs)(n.p,{children:[`Plugin `,(0,t.jsx)(n.code,{children:`state.apply`}),` runs for `,(0,t.jsx)(n.strong,{children:`transactions only`}),`, so an edit counter kept
there rises on a real edit and resets to `,(0,t.jsx)(n.code,{children:`init`}),` when the state is replaced
wholesale. That is the whole discrimination. And because ProseMirror does
`,(0,t.jsx)(n.em,{children:`not`}),` call a plugin view's `,(0,t.jsx)(n.code,{children:`update`}),` when the state is replaced \u2014 it destroys
the plugin views and builds new ones, and the engine's `,(0,t.jsx)(n.code,{children:`mountView`}),` builds a
whole new `,(0,t.jsx)(n.code,{children:`EditorView`}),` besides \u2014 the plugin's `,(0,t.jsx)(n.code,{children:`view()`}),` factory running again
is the signal that the state underneath was swapped out.`]}),`
`,(0,t.jsx)(n.p,{children:`Deleting everything in a document is still a transaction, so a user who
empties a file still empties it in the cloud. What can no longer do that is
the engine mounting its blank starter doc.`}),`
`,(0,t.jsx)(n.h2,{id:`a-blank-the-user-didnt-ask-for-is-put-back`,children:`A blank the user didn't ask for is put back`}),`
`,(0,t.jsxs)(n.p,{children:[`When the state is replaced by something other than the singleton's own load
and what landed is blank while the host's document wasn't, the singleton
re-loads the host's document into the new view (`,(0,t.jsx)(n.code,{children:`restoreIfEngineBlankedTheDoc`}),`).
A replacement carrying real content \u2014 the ribbon's own Open, a joined
collaboration session \u2014 is left alone.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The engine also gets told which document is mounted
(`,(0,t.jsx)(n.code,{children:`adoptEmbeddedDoc`}),`). Its `,(0,t.jsx)(n.code,{children:`currentDoc`}),` is the fallback content for any
remount it does on its own, and in an embed it otherwise still held the blank
starter from boot \u2014 so `,(0,t.jsx)(n.code,{children:`mountView(currentDoc)`}),` on a spawned-session mount or
a damaged-file fallback remounted that blank over the host's file. That is
one concrete way the pane used to go blank; declaring the mounted doc removes
it at the source, and the restore above covers the paths that don't consult
`,(0,t.jsx)(n.code,{children:`currentDoc`}),` at all.`]}),`
`,(0,t.jsx)(n.h2,{id:`content-that-doesnt-parse-is-not-content`,children:`Content that doesn't parse is not content`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`html-bridge.ts`}),` used to answer "this didn't parse" and "this document is
empty" with the same blank doc. For a host whose stored document IS that HTML
string, the difference is everything: the blank mounted, got reported as the
new content, and the file was gone.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`parseHtml`}),` now reports which it was. Non-empty input that comes out blank \u2014
foreign markup from a previous editor, a truncated fragment \u2014 is a failed
load: the singleton keeps whatever is already on screen rather than blanking
it, files a durable status notice, and `,(0,t.jsx)(n.strong,{children:`stops reporting that document
entirely`}),`, so nothing typed into the pane can overwrite the intact copy on
the server. A later load of the same document that parses cleanly lifts the
block.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Footnotes were also being dropped by every round trip: a footnote ref
serializes to an empty `,(0,t.jsx)(n.code,{children:`<sup>`}),` carrying its text in `,(0,t.jsx)(n.code,{children:`data-content`}),`, and
ProseMirror collects mark rules before node rules, so the generic
`,(0,t.jsx)(n.code,{children:`superscript`}),` mark rule matched first and the footnote came back as a mark on
no text. The node's `,(0,t.jsx)(n.code,{children:`parseDOM`}),` rule now carries `,(0,t.jsx)(n.code,{children:`priority: 60`}),`. Ordinary
superscript text is unaffected \u2014 that rule only matches `,(0,t.jsx)(n.code,{children:`.pmd-footnote-ref`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`edits-are-filed-under-the-document-they-were-made-in`,children:`Edits are filed under the document they were made in`}),`
`,(0,t.jsxs)(n.p,{children:[`Change reporting is debounced ~400 ms. The debounce is flushed before the
live binding changes (`,(0,t.jsx)(n.code,{children:`claim`}),` of a different key, `,(0,t.jsx)(n.code,{children:`release`}),` on pane close)
and when the page is hidden or unloaded. Without that flush, switching
documents inside the window either dropped the last edits or reported them
under the document you switched `,(0,t.jsx)(n.em,{children:`to`}),`.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.code,{children:`content`}),` prop coming back from the host is matched against a bounded
ring of recently emitted strings, not just the last one: the host's state
round-trips through React, so a stale echo can arrive after a newer one, and
re-applying it would throw away whatever was typed in between.`]}),`
`,(0,t.jsx)(n.h2,{id:`reaching-the-cloud`,children:`Reaching the cloud`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`lib/reason-docs/save-queue.ts`}),` owns the write side. One debounce `,(0,t.jsx)(n.strong,{children:`per
document`}),`, with merged patches \u2014 the previous single shared timer meant the
next edit cancelled whatever was still waiting, so renaming a file and then
typing in another one silently dropped the rename, and switching documents
inside the debounce dropped the edits to the one you left.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`flushAll({ keepalive: true })`}),` on `,(0,t.jsx)(n.code,{children:`pagehide`}),` and on the tab going hidden,
so closing a tab mid-sentence doesn't lose the sentence.`]}),`
`,(0,t.jsx)(n.li,{children:`A failed write stays queued and retries with backoff, merging any newer
edit over the failed patch so a retry never resurrects stale content.`}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`onStateChange`}),` drives the editor's header: `,(0,t.jsx)(n.code,{children:`Saving\u2026`}),`, `,(0,t.jsx)(n.code,{children:`Unsaved changes`}),`,
or `,(0,t.jsx)(n.code,{children:`Couldn't save \u2014 retrying\u2026`}),` \u2014 the last of which used to show as a
`,(0,t.jsx)(n.code,{children:`Saving\u2026`}),` that never resolved.`]}),`
`,(0,t.jsx)(n.li,{children:`A document being deleted has its queued writes cancelled, so no PUT lands
after the DELETE.`}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`moveDocument`}),` (dragging a file to a new folder) queues its `,(0,t.jsx)(n.code,{children:`parentId`}),`
patch through the same queue as title/content edits, so a re-parent gets
the same retry-with-backoff and `,(0,t.jsx)(n.code,{children:`pagehide`}),`/tab-hide flush.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-the-embed-doesnt-pop-up-on-open`,children:`What the embed doesn't pop up on open`}),`
`,(0,t.jsxs)(n.p,{children:[`The site mounts CardMirror on nearly every visit, so the engine's
first-launch and crash-recovery surfaces are switched off in the embed
(debate-ai.com edits to upstream, in `,(0,t.jsx)(n.code,{children:`patches/debate-ai.patch`}),`):`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Recover drafts sidebar`}),` \u2014 `,(0,t.jsx)(n.code,{children:`runStartupRecoveryInner`}),` returns before
`,(0,t.jsx)(n.code,{children:`openRecoverySidebar`}),` when `,(0,t.jsx)(n.code,{children:`BOOT_EMBEDDED`}),`. Journals are left on disk,
untouched; the mode-switch auto-reopen above that check still runs.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`UI tour and Verbatim nudge`}),` \u2014 not auto-started when `,(0,t.jsx)(n.code,{children:`detectEmbedded()`}),`.
Help \u2192 UI tour still starts the tour by hand.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`"Receiving cards in-browser needs your account" notice`}),` \u2014 shown once per
browser (`,(0,t.jsx)(n.code,{children:`localStorage`}),` key `,(0,t.jsx)(n.code,{children:`cardmirror.pairingAccountRequiredSeen`}),`) instead
of on every mount.`]}),`
`]}),`
`,(0,t.jsx)(n.p,{children:`The outline nav pane still opens beside the document as before.`}),`
`,(0,t.jsxs)(n.h2,{id:`cmir-files-open-in-read-mode`,children:[(0,t.jsx)(n.code,{children:`.cmir`}),` files open in read mode`]}),`
`,(0,t.jsxs)(n.p,{children:[`Opening any `,(0,t.jsx)(n.code,{children:`.cmir`}),` document turns read mode on, the same state the
ribbon's Read mode button toggles:`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`REASON editor`}),` \u2014 `,(0,t.jsx)(n.code,{children:`ReasonEditorScreen`}),` passes `,(0,t.jsx)(n.code,{children:`defaultReadMode`}),` for
Topic Starters and uploaded documents (stored as `,(0,t.jsx)(n.code,{children:`.cmir`}),`); HTML rows
written in the editor still open editable.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.code,{children:`importCmir`})}),` on the embed's imperative handle claims with
`,(0,t.jsx)(n.code,{children:`readMode: true`}),`.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Engine file open`}),` \u2014 `,(0,t.jsx)(n.code,{children:`loadFileInPlace`}),` sets `,(0,t.jsx)(n.code,{children:`readMode`}),` after mounting a
`,(0,t.jsx)(n.code,{children:`.cmir`}),` (Open, recents, drag-and-drop, command-palette file search).`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`It's applied once, when a document is mounted (`,(0,t.jsx)(n.code,{children:`claim`}),`'s new-key branch),
so turning read mode off sticks for that document until another one opens.`]}),`
`,(0,t.jsx)(n.h2,{id:`tests`,children:`Tests`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-editor/test/singleton-read-mode.test.ts`}),` \u2014 read mode
carries across doc switches, and a claim with `,(0,t.jsx)(n.code,{children:`readMode`}),` (a `,(0,t.jsx)(n.code,{children:`.cmir`}),` open)
turns it on without re-forcing it on a re-claim of the live doc`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-editor/test/change-reporter.test.ts`}),` \u2014 edit vs. load vs.
state replacement, including a whole new `,(0,t.jsx)(n.code,{children:`EditorView`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-editor/test/html-bridge.test.ts`}),` \u2014 card/footnote round
trip, and `,(0,t.jsx)(n.code,{children:`parseHtml`}),`'s empty-vs-lost distinction`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/reason-docs/__tests__/save-queue.test.ts`}),` \u2014 every
way the old shared timer lost work`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-editor/test/status-notices.test.ts`}),` \u2014 the unreadable-doc
notice's Download button (rendered only when a payload is attached,
survives a coalesced repeat, Blob/anchor download fires on click)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-editor/test/singleton.test.ts`}),` \u2014 `,(0,t.jsx)(n.code,{children:`sanitizeForFilename`}),`'s
handling of path separators and other filename-unsafe characters`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-editor/test/engine-boot.test.ts`}),` \u2014 boots the real engine
inside `,(0,t.jsx)(n.code,{children:`RIBBON_HTML`}),` the way the singleton does, so an upstream sync that
needs a new element the embed markup lacks fails in CI instead of at load`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`packages/debate-editor/test/upstream-sync.test.ts`}),` \u2014 the patch applies to the
pinned upstream commit and no edit under the generated `,(0,t.jsx)(n.code,{children:`src/`}),` went unrecorded`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.del,{children:`The singleton refuses to save a document it couldn't read, which also
means work typed into that pane is discarded.`}),` Closed: `,(0,t.jsx)(n.code,{children:`markUnreadable`}),`
now attaches the raw HTML that failed to parse to the notice as a
`,(0,t.jsx)(n.code,{children:`download`}),` payload, and the notice panel renders a "Download" button next
to Copy/Dismiss that saves it as `,(0,t.jsx)(n.code,{children:`unreadable-<key>.html`}),` (`,(0,t.jsx)(n.code,{children:`<key>`}),` run
through `,(0,t.jsx)(n.code,{children:`sanitizeForFilename`}),`, since it's a free-form document title, not
already filename-safe). The server's stored copy is still untouched and
still the one thing to trust \u2014 this only rescues whatever was in the pane
that would otherwise just be discarded when the user navigates away.`]}),`
`,(0,t.jsxs)(n.li,{children:[`Flow's speech docs ride the same embed and so inherit every guard here, but
their own persistence (inside the `,(0,t.jsx)(n.code,{children:`Flow`}),` object, via `,(0,t.jsx)(n.code,{children:`/api/flows`}),`) has no
equivalent per-document queue.`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};