import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`REASON docs sidebar \u2014 files on the document routes, opened in CardMirror`},r=`# REASON docs sidebar \u2014 files on the document routes, opened in CardMirror [#reason-docs-sidebar--files-on-the-document-routes-opened-in-cardmirror]

The two collapsible sections, **Topic Starters** and **My Personal
Documents**, that sit above the Videos library tree, and the URL round trip that turns a click on one of them into "that
file, loaded in CardMirror, in the main column."

- **Routes:** \`/research/cards\` (and below it) and \`/reason-editor\` \u2014 the routes the
  documents are the subject of, per
  \`apps/debate-ai.com/lib/reason-docs/sidebar-routes.ts\`
- **Panels:** \`packages/debate-webview/src/components/reason-docs/\`
  (\`ReasonDocsSidebarPanels\`, \`FileTree\`, \`TopicStarterTree\`,
  \`FileManagerDialog\`), over \`ReasonDocsProvider\` in the
  root layout
- **URL rules:** \`apps/debate-ai.com/lib/reason-docs/route-selection.ts\`
- **Where they show:** \`apps/debate-ai.com/lib/reason-docs/sidebar-routes.ts\`
- **Editor:** \`/reason-editor\` (\`debate-editor\`'s CardMirror embed), with
  its tab strip in \`components/reason-editor/EditorTabStrip.tsx\` and the tab
  rules in \`lib/reason-docs/tab-actions.ts\`

## Where the panels mount [#where-the-panels-mount]

\`ReasonDocsSidebarPanels\` is one component mounted in two places:

1. \`AppSidebarShell\`'s \`<aside>\`, on the routes \`showsReasonDocsPanels\`
   admits \u2014 \`/research/cards\` (the dock's "Shared" destination, and any page below
   it) and \`/reason-editor\`, whose desktop file navigation *is* this
   sidebar, the editor route having no \`<aside>\` of its own.
2. \`/reason-editor\` itself, as a collapsible strip below \`md\`, since that
   sidebar is \`hidden md:flex\`.

They are deliberately absent everywhere else. The panels used to ride in
every sidebar, \`/videos\` included \u2014 which took a third mount, an app-owned
\`docsSlot\` on \`LecturesPage\`, since \`/videos\` renders its own sidebar rather
than the shell. That put a document tree above the video library's own nav
on a page that is not about documents; the slot is gone and the videos
sidebar is the dock plus the video nav. The trade is that
a file opened from \`/research/cards\` is no longer one click away after hopping to the
video library \u2014 the dock hop back is.

In the sidebar the sections sit under the dock and above the Videos tree:
the tree is long enough (a section auto-expands to show where you are) that
anything below it starts under the fold. Topic Starters comes first, then
My Personal Documents. There is no panel switcher and no Open Tabs list: the
open files are the tab strip above the editor (below).

Each section has a chevron header and is expanded by default. Collapsing one
sticks, per-device, in \`localStorage\` (\`reason-editor-sidebar-topics-open\`,
\`reason-editor-sidebar-files-open\`). Nothing is fetched until a section is
actually open, so a page that leaves both collapsed makes no document
request at all.

## Tabs above the editor [#tabs-above-the-editor]

Every file opened on \`/reason-editor\` gets a tab in the strip above
CardMirror. Click a tab to switch to it, or its \u00D7 to close it. Right-click a
tab for:

- **Close** that tab.
- **Close others**: every tab but this one, which becomes the open file.
- **Close to the right**: every tab after this one.
- **Close all**.
- **Undo close**: reopens the most recently closed tab. It walks back through
  the last 20 closed tabs, skipping files deleted since.

Closing the open tab moves to its neighbour, preferring the tab that slid
into its place.

## Opening a file [#opening-a-file]

Picking a file \u2014 an owned document or a public topic starter \u2014 does two
things:

- sets it active in \`ReasonDocsProvider\`, so a client-side hop switches the
  editor instantly; and
- routes to \`/reason-editor/<the file's name>\` \u2014 \`/reason-editor/cp-answer-to-states\`,
  not \`/reason-editor?topic=2\` \u2014 so the selection is addressable, and legible
  in a shared link.

Provider state alone covers the hop but not a reload, a pasted link, or a
hard navigation \u2014 \`/videos\` is its own layout branch and can boot the editor
with an empty provider. Carrying the file in the URL is what makes "click a
file, get *that* file in CardMirror" hold from every sidebar rather than
only from the ones that hop client-side.

The name is the title slugified (\`lib/reason-docs/doc-slug.ts\`): lowercased,
accents folded, apostrophes dropped, everything else non-alphanumeric
collapsed to single hyphens, capped at 80 characters on a word boundary, and
\`untitled\` when a title leaves nothing behind. Titles are not unique and ids
are, so two files that slugify the same are told apart by a \`~<id>\` suffix \u2014
\`impact-turns~d12\` for document 12, \`impact-turns~t7\` for topic starter 7.
No title can forge one: \`~\` is stripped out of titles by the same slugifier.

Already on the editor route, a pick routes nothing at all. \`/reason-editor\`
and \`/reason-editor/<slug>\` are separate Next routes, so routing between
them would remount CardMirror \u2014 and its undo history \u2014 on every tab switch;
the provider already has the file open, and \`ReasonDocsRouteSync\` renames
the address bar in place with \`history.replaceState\`. That same rewrite is
what upgrades an older \`?doc=<id>\` / \`?topic=<id>\` link (still read, and
still resolved) to the named path once the catalogue says what that file is
called, and what keeps the address on a file that is renamed while open. Any
other query parameter is kept \u2014 \`?share=\` and \`?shareWith=\` are read by the
same page.

\`ReasonDocsRouteSync\` (mounted once on \`/reason-editor\`, inside a
\`<Suspense>\` since it reads \`useSearchParams\`, renders nothing) reads it
back. The rules themselves are pure functions in
\`lib/reason-docs/route-selection.ts\`, shared with the sidebar so the two
ends of the round trip cannot drift, and unit-tested in
\`lib/reason-docs/__tests__/route-selection.test.ts\`.

Resolution order, per URL:

1. the path's name \u2014 an exact \`~<id>\` discriminator first, then the bare
   slug matched against topic starters and then the reader's own documents,
   then the segment read as an id;
2. the URL's \`topic\` id, if it names a live topic starter;
3. the URL's \`doc\` id, if it names one of the reader's own non-folder
   documents;
4. otherwise, and only when nothing is open, the first file \u2014 so the reader
   lands on something readable instead of an empty pane.

A name or id that matches nothing (a renamed file, a deleted one, someone
else's link) falls through to that same fallback rather than erroring \u2014 a
stale link is not a 404 \u2014 and a malformed id (\`?doc=abc\`, \`?doc=3.5\`) reads
as absent. The deep link applies once per URL: after it opens its file the
reader can pick another from the sidebar without the stale URL dragging them
back, and every pick rewrites the address, which re-arms it.

The deep-link rule and the first-file fallback are one function on purpose.
As two React effects they raced: the fallback's closure still saw no
selection in the commit where the deep link opened its file, and opened the
first file over the top of it.

## Read-only topic starters [#read-only-topic-starters]

A topic starter opens in the same CardMirror embed as an owned document, but
read-only: no toolbar, no AI tools, no \`onChange\`, a \`readOnly\` title, and a
"Public topic starter" label beside it. It gets its own \`contentKey\`
namespace (\`topic-<id>\`) so the engine treats it as a distinct claim from an
owned document that happens to share the id \u2014 the same reason \`?doc=7\` and
\`?topic=7\` are different URLs.

## Topic starters are stored as \`.cmir\` [#topic-starters-are-stored-as-cmir]

The admin importer on \`/admin\` takes a \`.docx\` (or a \`.zip\` of them) and
stores each one as a CardMirror native file \u2014 \`.cmir\`, gzipped JSON,
base64-encoded into the row's \`content\` column, with \`format\` set to
\`"cmir"\`.

The conversion is CardMirror's own OOXML importer (\`docxToCmir\` in
\`packages/debate-editor/src/native/convert.ts\` \u2014 \`fromDocxFull\` piped into
\`serializeNative\`, the same pair the desktop bulk converter runs), wrapped
for the route by \`apps/debate-ai.com/lib/topic-starters/import.ts\`. What that
buys over the card HTML the importer used to store is everything HTML has no
element for: the Verbatim outline (pocket / hat / block / tag / analytic) as
typed nodes rather than \`<h1>\`\u2026\`<h4>\`, comment threads, inline images, and
the named character styles that distinguish a cite from an emphasis from a
plain underline.

Reading it back is client-side: \`topicStarterHtml\`
(\`lib/topic-starters/content.ts\`) parses the file with \`parseNative\` and
serializes it through the schema's own \`toDOM\` specs for the embed's
\`content\` prop, memoized per file on \`/reason-editor\`. Doing it in the
browser keeps the catalogue endpoint \u2014 which returns up to 100 rows \u2014 from
converting files nobody opens.

Rows imported before this carry HTML and still open: \`format\` says which a
row is (\`lib/topic-starters/format.ts\`), and content that arrives without
its row falls back to sniffing the bytes for the gzip magic. A \`.cmir\` that
will not parse renders a notice naming the failure rather than a blank
document.

## Organising files [#organising-files]

Every file is a CardMirror file whatever it was uploaded as, so no row in
either tree carries a \`DOCX\` or \`CMIR\` badge; the name is the whole label.

Right-clicking a row opens the same menu as its "\u2026" button, so every action
on a file is one gesture from the file itself:

- **Files:** Open, Edit, Share\u2026, Rename, Duplicate, Move to (any folder, or
  the top level), Download as .docx, Add to Topic Starters, Delete. Folders
  get New File / New Folder in place of Open, Edit and Share.
- **Topic Starters:** Open, Edit a copy, Save to my files, Copy link,
  Download as .docx. The catalogue is read-only, so a topic starter is edited
  by editing your own copy of it.

**Share\u2026** opens the file in the editor with the share-with-contacts dialog
already up (\`?shareOpen=1\`, read and stripped by \`ShareWithContacts\`).
Sharing starts a live co-editing session in the editor, which is why the file
has to be open there first.

The **Sort** button in the My Personal Documents header orders the tree by name (A\u2013Z or Z\u2013A)
or by last modified (\`lib/reason-docs/file-sort.ts\`). Folders always come
before files. The choice is remembered per device.

## Moving files between Files and Topic Starters [#moving-files-between-files-and-topic-starters]

Rows drag both ways between the two trees, and each drop means what it can
(\`lib/reason-docs/drag-data.ts\`):

- **Topic Starters \u2192 Files:** saves your own copy into the folder you drop
  on. A folder comes with everything in it, and a \`.cmir\` stays a \`.cmir\`.
  "Save to my files" in the menu does the same.
- **Files \u2192 Topic Starters:** publishes the file to the public catalogue
  (\`POST /api/admin/topic-starters/items\`). Only admins can do this. Anyone
  else sees a message saying so.
- **Files \u2192 Files:** moves the row, as before. A folder can't be dropped into
  itself.
- **Desktop \u2192 either tree:** an upload, as before.

## File manager [#file-manager]

The File manager button in the My Personal Documents header opens a full-window file
manager over the same files: SVAR's \`@svar-ui/react-filemanager\`, the widget
quick search's REASON sidebar opens from its own file manager dialog. Every
action it offers is routed back to the real rows
(\`components/reason-docs/FileManagerView.tsx\`, with the path \u2194 row mapping
in \`lib/reason-docs/file-manager-data.ts\`):

- **Open** (double-click or Enter) opens the file in this app's editor.
- **Add file, add folder and upload** create rows in your folders.
- **Rename, delete, cut/paste and drag** rename, delete and move your rows.
  **Copy/paste** duplicates them.
- **Download** is the same \`.docx\` download as the sidebar menu.

Topic Starters appear under a read-only "Topic Starters" folder. Copying or
moving out of it saves your own copy. Copying or moving one of your files
into it publishes it (admins only). Renaming or deleting inside it is
refused. The widget is loaded only when the dialog first opens.

## Searching files from Ctrl/Cmd-K [#searching-files-from-ctrlcmd-k]

The app-wide search palette (Ctrl/Cmd-K) lists matching files under
**Files**, below the tools: your own files and the public Topic Starters,
matched by name, folder, **outline headings and contents**
(\`lib/reason-docs/file-search.ts\`). Every word you type has to appear
somewhere. Name matches rank first, then outline matches (a pocket, hat,
block or tag heading holding every word, shown as \`\u00A7 Heading\`), then contents
matches, which show the text around the match. Picking a file opens it in the
editor.

Below the files, **Videos & Lectures** lists up to eight matches from the
whole video library, rounds and lectures alike, most-viewed first. The
palette asks the Videos page's own feed (\`/api/videos?q=\u2026\`) once typing
pauses, so nothing about the library is downloaded until you search. Picking
one opens its watch page (\`lib/videos/video-palette-search.ts\`).

A \`.cmir\` file's text is read with CardMirror's engine, which is loaded the
first time a query needs it, so the first search over card files can take a
moment longer. On \`/reason-editor\` the palette answers Ctrl/Cmd-K, while
Ctrl/Cmd-P stays the editor's own palette.

## Known gaps [#known-gaps]

- ~~The docs section starts collapsed on \`/research/cards\`, so the files are
  one click away there rather than on screen.~~ **Fixed:** both sections start
  expanded everywhere; a reader's own collapse is remembered per device.
- Undo close lives in the tab strip's right-click menu, and the strip is
  hidden once every tab is closed, so after Close all there is no tab left to
  right-click. Reopen a file from the sidebar instead. There is no keyboard
  shortcut for it either: browsers keep Ctrl/Cmd-Shift-T for themselves.
- \`showsReasonDocsPanels\` is a hard-coded route list, not something derived
  from the nav data. A new documents route has to be added to it by hand.
- ~~\`SharedCardOpener\`'s \`?share=<id>\` flow replaces the URL with a bare
  \`/reason-editor\`, dropping any \`?doc=\`/\`?topic=\` alongside it.~~ **Fixed:**
  \`ShareWithContacts.tsx\`'s \`dropQueryParam\` (used by both the \`?share=\` and
  \`?shareWith=\` one-shot params) calls \`route-selection.ts#urlWithoutParam\`,
  which drops only the named parameter and keeps the rest of the URL \u2014
  \`?doc=\`/\`?topic=\` alongside a share link now survive being joined. Pinned
  by \`route-selection.test.ts\`'s \`urlWithoutParam\` cases.
- Conversion runs in the import request, so a 100-file ZIP converts 100
  documents inside one Worker invocation \u2014 heavier than the regex pass it
  replaces. A batch large enough to hit the CPU limit fails as a dead
  request, leaving the files converted before it in the library. Splitting
  the archive is the workaround; moving the conversion into the browser (as
  the Parquet card importer does) is the fix.
- ~~There is no way to download a topic starter's \`.cmir\`. The file is stored
  and opened in the editor, but the library exposes no file endpoint.~~
  **Fixed:** both the Files panel's and the Topic Starters panel's row menu
  now have a "Download as .docx" item \u2014 your own documents and public topic
  starters alike can be gotten out as a file without opening them in the
  editor first.
- ~~The Topic Starters catalogue sorted files before folders, so once it held
  more than its 100-row cap the folders were cut off and every file inside
  them vanished from the tree.~~ **Fixed:** \`/api/topic-starters\` sorts
  folders first, and both trees show a row whose folder is missing at the
  top level instead of dropping it.
- ~~Folders in both trees started collapsed whenever the files loaded after
  the panel mounted (the usual case), and the Topic Starters search matched
  words from a row's raw JSON, so searching "folder" matched everything.~~
  **Fixed:** folders start open, and the search matches names and tags only.
- Publishing to Topic Starters is admin-only and always publishes at once.
  There is no draft or review step for a reader's own file.
- Ctrl/Cmd-K's file search converts every \`.cmir\` file it searches on the
  reader's device. That is fine for the 100-row catalogue and a typical
  library, but a very large library would want a server-side text index.
- Choosing an outline match opens the file at the top, not at the heading
  that matched.
- The video rows show only the first eight matches; there is no "more
  videos" row that carries the query over to the Videos page.

## Save status above the editor [#save-status-above-the-editor]

The status line over the REASON editor (\`/reason-editor\`) says where the open
document stands: **Unsaved changes** (an edit is queued), **Saving\u2026**, or
**Couldn't save \u2014 retrying** (shown in red; your edits stay in the tab and the
queue retries with backoff). Once the document is saved the line disappears. A public topic starter
reads **Public topic starter** because it is read-only. The text comes from
\`describeDocSaveStatus\` (\`lib/reason-docs/doc-save-status.ts\`).
`,i={contents:[{heading:`reason-docs-sidebar--files-on-the-document-routes-opened-in-cardmirror`,content:`The two collapsible sections, **Topic Starters** and **My Personal
Documents**, that sit above the Videos library tree, and the URL round trip that turns a click on one of them into "that
file, loaded in CardMirror, in the main column."`},{heading:`reason-docs-sidebar--files-on-the-document-routes-opened-in-cardmirror`,content:"**Routes:** `/research/cards` (and below it) and `/reason-editor` \u2014 the routes the\ndocuments are the subject of, per\n`apps/debate-ai.com/lib/reason-docs/sidebar-routes.ts`"},{heading:`reason-docs-sidebar--files-on-the-document-routes-opened-in-cardmirror`,content:"**Panels:** `packages/debate-webview/src/components/reason-docs/`\n(`ReasonDocsSidebarPanels`, `FileTree`, `TopicStarterTree`,\n`FileManagerDialog`), over `ReasonDocsProvider` in the\nroot layout"},{heading:`reason-docs-sidebar--files-on-the-document-routes-opened-in-cardmirror`,content:"**URL rules:** `apps/debate-ai.com/lib/reason-docs/route-selection.ts`"},{heading:`reason-docs-sidebar--files-on-the-document-routes-opened-in-cardmirror`,content:"**Where they show:** `apps/debate-ai.com/lib/reason-docs/sidebar-routes.ts`"},{heading:`reason-docs-sidebar--files-on-the-document-routes-opened-in-cardmirror`,content:"**Editor:** `/reason-editor` (`debate-editor`'s CardMirror embed), with\nits tab strip in `components/reason-editor/EditorTabStrip.tsx` and the tab\nrules in `lib/reason-docs/tab-actions.ts`"},{heading:`where-the-panels-mount`,content:"`ReasonDocsSidebarPanels` is one component mounted in two places:"},{heading:`where-the-panels-mount`,content:"`AppSidebarShell`'s `<aside>`, on the routes `showsReasonDocsPanels`\nadmits \u2014 `/research/cards` (the dock's \"Shared\" destination, and any page below\nit) and `/reason-editor`, whose desktop file navigation *is* this\nsidebar, the editor route having no `<aside>` of its own."},{heading:`where-the-panels-mount`,content:"`/reason-editor` itself, as a collapsible strip below `md`, since that\nsidebar is `hidden md:flex`."},{heading:`where-the-panels-mount`,content:"They are deliberately absent everywhere else. The panels used to ride in\nevery sidebar, `/videos` included \u2014 which took a third mount, an app-owned\n`docsSlot` on `LecturesPage`, since `/videos` renders its own sidebar rather\nthan the shell. That put a document tree above the video library's own nav\non a page that is not about documents; the slot is gone and the videos\nsidebar is the dock plus the video nav. The trade is that\na file opened from `/research/cards` is no longer one click away after hopping to the\nvideo library \u2014 the dock hop back is."},{heading:`where-the-panels-mount`,content:`In the sidebar the sections sit under the dock and above the Videos tree:
the tree is long enough (a section auto-expands to show where you are) that
anything below it starts under the fold. Topic Starters comes first, then
My Personal Documents. There is no panel switcher and no Open Tabs list: the
open files are the tab strip above the editor (below).`},{heading:`where-the-panels-mount`,content:"Each section has a chevron header and is expanded by default. Collapsing one\nsticks, per-device, in `localStorage` (`reason-editor-sidebar-topics-open`,\n`reason-editor-sidebar-files-open`). Nothing is fetched until a section is\nactually open, so a page that leaves both collapsed makes no document\nrequest at all."},{heading:`tabs-above-the-editor`,content:`Every file opened on \`/reason-editor\` gets a tab in the strip above
CardMirror. Click a tab to switch to it, or its \u00D7 to close it. Right-click a
tab for:`},{heading:`tabs-above-the-editor`,content:`**Close** that tab.`},{heading:`tabs-above-the-editor`,content:`**Close others**: every tab but this one, which becomes the open file.`},{heading:`tabs-above-the-editor`,content:`**Close to the right**: every tab after this one.`},{heading:`tabs-above-the-editor`,content:`**Close all**.`},{heading:`tabs-above-the-editor`,content:`**Undo close**: reopens the most recently closed tab. It walks back through
the last 20 closed tabs, skipping files deleted since.`},{heading:`tabs-above-the-editor`,content:`Closing the open tab moves to its neighbour, preferring the tab that slid
into its place.`},{heading:`opening-a-file`,content:`Picking a file \u2014 an owned document or a public topic starter \u2014 does two
things:`},{heading:`opening-a-file`,content:"sets it active in `ReasonDocsProvider`, so a client-side hop switches the\neditor instantly; and"},{heading:`opening-a-file`,content:"routes to `/reason-editor/<the file's name>` \u2014 `/reason-editor/cp-answer-to-states`,\nnot `/reason-editor?topic=2` \u2014 so the selection is addressable, and legible\nin a shared link."},{heading:`opening-a-file`,content:`Provider state alone covers the hop but not a reload, a pasted link, or a
hard navigation \u2014 \`/videos\` is its own layout branch and can boot the editor
with an empty provider. Carrying the file in the URL is what makes "click a
file, get *that* file in CardMirror" hold from every sidebar rather than
only from the ones that hop client-side.`},{heading:`opening-a-file`,content:"The name is the title slugified (`lib/reason-docs/doc-slug.ts`): lowercased,\naccents folded, apostrophes dropped, everything else non-alphanumeric\ncollapsed to single hyphens, capped at 80 characters on a word boundary, and\n`untitled` when a title leaves nothing behind. Titles are not unique and ids\nare, so two files that slugify the same are told apart by a `~<id>` suffix \u2014\n`impact-turns~d12` for document 12, `impact-turns~t7` for topic starter 7.\nNo title can forge one: `~` is stripped out of titles by the same slugifier."},{heading:`opening-a-file`,content:"Already on the editor route, a pick routes nothing at all. `/reason-editor`\nand `/reason-editor/<slug>` are separate Next routes, so routing between\nthem would remount CardMirror \u2014 and its undo history \u2014 on every tab switch;\nthe provider already has the file open, and `ReasonDocsRouteSync` renames\nthe address bar in place with `history.replaceState`. That same rewrite is\nwhat upgrades an older `?doc=<id>` / `?topic=<id>` link (still read, and\nstill resolved) to the named path once the catalogue says what that file is\ncalled, and what keeps the address on a file that is renamed while open. Any\nother query parameter is kept \u2014 `?share=` and `?shareWith=` are read by the\nsame page."},{heading:`opening-a-file`,content:"`ReasonDocsRouteSync` (mounted once on `/reason-editor`, inside a\n`<Suspense>` since it reads `useSearchParams`, renders nothing) reads it\nback. The rules themselves are pure functions in\n`lib/reason-docs/route-selection.ts`, shared with the sidebar so the two\nends of the round trip cannot drift, and unit-tested in\n`lib/reason-docs/__tests__/route-selection.test.ts`."},{heading:`opening-a-file`,content:`Resolution order, per URL:`},{heading:`opening-a-file`,content:`the path's name \u2014 an exact \`~<id>\` discriminator first, then the bare
slug matched against topic starters and then the reader's own documents,
then the segment read as an id;`},{heading:`opening-a-file`,content:"the URL's `topic` id, if it names a live topic starter;"},{heading:`opening-a-file`,content:"the URL's `doc` id, if it names one of the reader's own non-folder\ndocuments;"},{heading:`opening-a-file`,content:`otherwise, and only when nothing is open, the first file \u2014 so the reader
lands on something readable instead of an empty pane.`},{heading:`opening-a-file`,content:`A name or id that matches nothing (a renamed file, a deleted one, someone
else's link) falls through to that same fallback rather than erroring \u2014 a
stale link is not a 404 \u2014 and a malformed id (\`?doc=abc\`, \`?doc=3.5\`) reads
as absent. The deep link applies once per URL: after it opens its file the
reader can pick another from the sidebar without the stale URL dragging them
back, and every pick rewrites the address, which re-arms it.`},{heading:`opening-a-file`,content:`The deep-link rule and the first-file fallback are one function on purpose.
As two React effects they raced: the fallback's closure still saw no
selection in the commit where the deep link opened its file, and opened the
first file over the top of it.`},{heading:`read-only-topic-starters`,content:'A topic starter opens in the same CardMirror embed as an owned document, but\nread-only: no toolbar, no AI tools, no `onChange`, a `readOnly` title, and a\n"Public topic starter" label beside it. It gets its own `contentKey`\nnamespace (`topic-<id>`) so the engine treats it as a distinct claim from an\nowned document that happens to share the id \u2014 the same reason `?doc=7` and\n`?topic=7` are different URLs.'},{heading:`topic-starters-are-stored-as-cmir`,content:'The admin importer on `/admin` takes a `.docx` (or a `.zip` of them) and\nstores each one as a CardMirror native file \u2014 `.cmir`, gzipped JSON,\nbase64-encoded into the row\'s `content` column, with `format` set to\n`"cmir"`.'},{heading:`topic-starters-are-stored-as-cmir`,content:"The conversion is CardMirror's own OOXML importer (`docxToCmir` in\n`packages/debate-editor/src/native/convert.ts` \u2014 `fromDocxFull` piped into\n`serializeNative`, the same pair the desktop bulk converter runs), wrapped\nfor the route by `apps/debate-ai.com/lib/topic-starters/import.ts`. What that\nbuys over the card HTML the importer used to store is everything HTML has no\nelement for: the Verbatim outline (pocket / hat / block / tag / analytic) as\ntyped nodes rather than `<h1>`\u2026`<h4>`, comment threads, inline images, and\nthe named character styles that distinguish a cite from an emphasis from a\nplain underline."},{heading:`topic-starters-are-stored-as-cmir`,content:"Reading it back is client-side: `topicStarterHtml`\n(`lib/topic-starters/content.ts`) parses the file with `parseNative` and\nserializes it through the schema's own `toDOM` specs for the embed's\n`content` prop, memoized per file on `/reason-editor`. Doing it in the\nbrowser keeps the catalogue endpoint \u2014 which returns up to 100 rows \u2014 from\nconverting files nobody opens."},{heading:`topic-starters-are-stored-as-cmir`,content:"Rows imported before this carry HTML and still open: `format` says which a\nrow is (`lib/topic-starters/format.ts`), and content that arrives without\nits row falls back to sniffing the bytes for the gzip magic. A `.cmir` that\nwill not parse renders a notice naming the failure rather than a blank\ndocument."},{heading:`organising-files`,content:"Every file is a CardMirror file whatever it was uploaded as, so no row in\neither tree carries a `DOCX` or `CMIR` badge; the name is the whole label."},{heading:`organising-files`,content:`Right-clicking a row opens the same menu as its "\u2026" button, so every action
on a file is one gesture from the file itself:`},{heading:`organising-files`,content:`**Files:** Open, Edit, Share\u2026, Rename, Duplicate, Move to (any folder, or
the top level), Download as .docx, Add to Topic Starters, Delete. Folders
get New File / New Folder in place of Open, Edit and Share.`},{heading:`organising-files`,content:`**Topic Starters:** Open, Edit a copy, Save to my files, Copy link,
Download as .docx. The catalogue is read-only, so a topic starter is edited
by editing your own copy of it.`},{heading:`organising-files`,content:"**Share\u2026** opens the file in the editor with the share-with-contacts dialog\nalready up (`?shareOpen=1`, read and stripped by `ShareWithContacts`).\nSharing starts a live co-editing session in the editor, which is why the file\nhas to be open there first."},{heading:`organising-files`,content:`The **Sort** button in the My Personal Documents header orders the tree by name (A\u2013Z or Z\u2013A)
or by last modified (\`lib/reason-docs/file-sort.ts\`). Folders always come
before files. The choice is remembered per device.`},{heading:`moving-files-between-files-and-topic-starters`,content:"Rows drag both ways between the two trees, and each drop means what it can\n(`lib/reason-docs/drag-data.ts`):"},{heading:`moving-files-between-files-and-topic-starters`,content:'**Topic Starters \u2192 Files:** saves your own copy into the folder you drop\non. A folder comes with everything in it, and a `.cmir` stays a `.cmir`.\n"Save to my files" in the menu does the same.'},{heading:`moving-files-between-files-and-topic-starters`,content:`**Files \u2192 Topic Starters:** publishes the file to the public catalogue
(\`POST /api/admin/topic-starters/items\`). Only admins can do this. Anyone
else sees a message saying so.`},{heading:`moving-files-between-files-and-topic-starters`,content:`**Files \u2192 Files:** moves the row, as before. A folder can't be dropped into
itself.`},{heading:`moving-files-between-files-and-topic-starters`,content:`**Desktop \u2192 either tree:** an upload, as before.`},{heading:`file-manager`,content:"The File manager button in the My Personal Documents header opens a full-window file\nmanager over the same files: SVAR's `@svar-ui/react-filemanager`, the widget\nquick search's REASON sidebar opens from its own file manager dialog. Every\naction it offers is routed back to the real rows\n(`components/reason-docs/FileManagerView.tsx`, with the path \u2194 row mapping\nin `lib/reason-docs/file-manager-data.ts`):"},{heading:`file-manager`,content:`**Open** (double-click or Enter) opens the file in this app's editor.`},{heading:`file-manager`,content:`**Add file, add folder and upload** create rows in your folders.`},{heading:`file-manager`,content:`**Rename, delete, cut/paste and drag** rename, delete and move your rows.
**Copy/paste** duplicates them.`},{heading:`file-manager`,content:"**Download** is the same `.docx` download as the sidebar menu."},{heading:`file-manager`,content:`Topic Starters appear under a read-only "Topic Starters" folder. Copying or
moving out of it saves your own copy. Copying or moving one of your files
into it publishes it (admins only). Renaming or deleting inside it is
refused. The widget is loaded only when the dialog first opens.`},{heading:`searching-files-from-ctrlcmd-k`,content:`The app-wide search palette (Ctrl/Cmd-K) lists matching files under
**Files**, below the tools: your own files and the public Topic Starters,
matched by name, folder, **outline headings and contents**
(\`lib/reason-docs/file-search.ts\`). Every word you type has to appear
somewhere. Name matches rank first, then outline matches (a pocket, hat,
block or tag heading holding every word, shown as \`\u00A7 Heading\`), then contents
matches, which show the text around the match. Picking a file opens it in the
editor.`},{heading:`searching-files-from-ctrlcmd-k`,content:`Below the files, **Videos & Lectures** lists up to eight matches from the
whole video library, rounds and lectures alike, most-viewed first. The
palette asks the Videos page's own feed (\`/api/videos?q=\u2026\`) once typing
pauses, so nothing about the library is downloaded until you search. Picking
one opens its watch page (\`lib/videos/video-palette-search.ts\`).`},{heading:`searching-files-from-ctrlcmd-k`,content:"A `.cmir` file's text is read with CardMirror's engine, which is loaded the\nfirst time a query needs it, so the first search over card files can take a\nmoment longer. On `/reason-editor` the palette answers Ctrl/Cmd-K, while\nCtrl/Cmd-P stays the editor's own palette."},{heading:`known-gaps`,content:`~~The docs section starts collapsed on \`/research/cards\`, so the files are
one click away there rather than on screen.~~ **Fixed:** both sections start
expanded everywhere; a reader's own collapse is remembered per device.`},{heading:`known-gaps`,content:`Undo close lives in the tab strip's right-click menu, and the strip is
hidden once every tab is closed, so after Close all there is no tab left to
right-click. Reopen a file from the sidebar instead. There is no keyboard
shortcut for it either: browsers keep Ctrl/Cmd-Shift-T for themselves.`},{heading:`known-gaps`,content:"`showsReasonDocsPanels` is a hard-coded route list, not something derived\nfrom the nav data. A new documents route has to be added to it by hand."},{heading:`known-gaps`,content:"~~`SharedCardOpener`'s `?share=<id>` flow replaces the URL with a bare\n`/reason-editor`, dropping any `?doc=`/`?topic=` alongside it.~~ **Fixed:**\n`ShareWithContacts.tsx`'s `dropQueryParam` (used by both the `?share=` and\n`?shareWith=` one-shot params) calls `route-selection.ts#urlWithoutParam`,\nwhich drops only the named parameter and keeps the rest of the URL \u2014\n`?doc=`/`?topic=` alongside a share link now survive being joined. Pinned\nby `route-selection.test.ts`'s `urlWithoutParam` cases."},{heading:`known-gaps`,content:`Conversion runs in the import request, so a 100-file ZIP converts 100
documents inside one Worker invocation \u2014 heavier than the regex pass it
replaces. A batch large enough to hit the CPU limit fails as a dead
request, leaving the files converted before it in the library. Splitting
the archive is the workaround; moving the conversion into the browser (as
the Parquet card importer does) is the fix.`},{heading:`known-gaps`,content:`~~There is no way to download a topic starter's \`.cmir\`. The file is stored
and opened in the editor, but the library exposes no file endpoint.~~
**Fixed:** both the Files panel's and the Topic Starters panel's row menu
now have a "Download as .docx" item \u2014 your own documents and public topic
starters alike can be gotten out as a file without opening them in the
editor first.`},{heading:`known-gaps`,content:`~~The Topic Starters catalogue sorted files before folders, so once it held
more than its 100-row cap the folders were cut off and every file inside
them vanished from the tree.~~ **Fixed:** \`/api/topic-starters\` sorts
folders first, and both trees show a row whose folder is missing at the
top level instead of dropping it.`},{heading:`known-gaps`,content:`~~Folders in both trees started collapsed whenever the files loaded after
the panel mounted (the usual case), and the Topic Starters search matched
words from a row's raw JSON, so searching "folder" matched everything.~~
**Fixed:** folders start open, and the search matches names and tags only.`},{heading:`known-gaps`,content:`Publishing to Topic Starters is admin-only and always publishes at once.
There is no draft or review step for a reader's own file.`},{heading:`known-gaps`,content:`Ctrl/Cmd-K's file search converts every \`.cmir\` file it searches on the
reader's device. That is fine for the 100-row catalogue and a typical
library, but a very large library would want a server-side text index.`},{heading:`known-gaps`,content:`Choosing an outline match opens the file at the top, not at the heading
that matched.`},{heading:`known-gaps`,content:`The video rows show only the first eight matches; there is no "more
videos" row that carries the query over to the Videos page.`},{heading:`save-status-above-the-editor`,content:"The status line over the REASON editor (`/reason-editor`) says where the open\ndocument stands: **Unsaved changes** (an edit is queued), **Saving\u2026**, or\n**Couldn't save \u2014 retrying** (shown in red; your edits stay in the tab and the\nqueue retries with backoff). Once the document is saved the line disappears. A public topic starter\nreads **Public topic starter** because it is read-only. The text comes from\n`describeDocSaveStatus` (`lib/reason-docs/doc-save-status.ts`)."}],headings:[{id:`reason-docs-sidebar--files-on-the-document-routes-opened-in-cardmirror`,content:`REASON docs sidebar \u2014 files on the document routes, opened in CardMirror`},{id:`where-the-panels-mount`,content:`Where the panels mount`},{id:`tabs-above-the-editor`,content:`Tabs above the editor`},{id:`opening-a-file`,content:`Opening a file`},{id:`read-only-topic-starters`,content:`Read-only topic starters`},{id:`topic-starters-are-stored-as-cmir`,content:"Topic starters are stored as `.cmir`"},{id:`organising-files`,content:`Organising files`},{id:`moving-files-between-files-and-topic-starters`,content:`Moving files between Files and Topic Starters`},{id:`file-manager`,content:`File manager`},{id:`searching-files-from-ctrlcmd-k`,content:`Searching files from Ctrl/Cmd-K`},{id:`known-gaps`,content:`Known gaps`},{id:`save-status-above-the-editor`,content:`Save status above the editor`}]},a=[{depth:1,url:`#reason-docs-sidebar--files-on-the-document-routes-opened-in-cardmirror`,title:(0,t.jsx)(t.Fragment,{children:`REASON docs sidebar \u2014 files on the document routes, opened in CardMirror`})},{depth:2,url:`#where-the-panels-mount`,title:(0,t.jsx)(t.Fragment,{children:`Where the panels mount`})},{depth:2,url:`#tabs-above-the-editor`,title:(0,t.jsx)(t.Fragment,{children:`Tabs above the editor`})},{depth:2,url:`#opening-a-file`,title:(0,t.jsx)(t.Fragment,{children:`Opening a file`})},{depth:2,url:`#read-only-topic-starters`,title:(0,t.jsx)(t.Fragment,{children:`Read-only topic starters`})},{depth:2,url:`#topic-starters-are-stored-as-cmir`,title:(0,t.jsxs)(t.Fragment,{children:[`Topic starters are stored as `,(0,t.jsx)(`code`,{children:`.cmir`})]})},{depth:2,url:`#organising-files`,title:(0,t.jsx)(t.Fragment,{children:`Organising files`})},{depth:2,url:`#moving-files-between-files-and-topic-starters`,title:(0,t.jsx)(t.Fragment,{children:`Moving files between Files and Topic Starters`})},{depth:2,url:`#file-manager`,title:(0,t.jsx)(t.Fragment,{children:`File manager`})},{depth:2,url:`#searching-files-from-ctrlcmd-k`,title:(0,t.jsx)(t.Fragment,{children:`Searching files from Ctrl/Cmd-K`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})},{depth:2,url:`#save-status-above-the-editor`,title:(0,t.jsx)(t.Fragment,{children:`Save status above the editor`})}];function o(e){let n={code:`code`,del:`del`,em:`em`,h1:`h1`,h2:`h2`,li:`li`,ol:`ol`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`reason-docs-sidebar--files-on-the-document-routes-opened-in-cardmirror`,children:`REASON docs sidebar \u2014 files on the document routes, opened in CardMirror`}),`
`,(0,t.jsxs)(n.p,{children:[`The two collapsible sections, `,(0,t.jsx)(n.strong,{children:`Topic Starters`}),` and `,(0,t.jsx)(n.strong,{children:`My Personal
Documents`}),`, that sit above the Videos library tree, and the URL round trip that turns a click on one of them into "that
file, loaded in CardMirror, in the main column."`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Routes:`}),` `,(0,t.jsx)(n.code,{children:`/research/cards`}),` (and below it) and `,(0,t.jsx)(n.code,{children:`/reason-editor`}),` \u2014 the routes the
documents are the subject of, per
`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/reason-docs/sidebar-routes.ts`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Panels:`}),` `,(0,t.jsx)(n.code,{children:`packages/debate-webview/src/components/reason-docs/`}),`
(`,(0,t.jsx)(n.code,{children:`ReasonDocsSidebarPanels`}),`, `,(0,t.jsx)(n.code,{children:`FileTree`}),`, `,(0,t.jsx)(n.code,{children:`TopicStarterTree`}),`,
`,(0,t.jsx)(n.code,{children:`FileManagerDialog`}),`), over `,(0,t.jsx)(n.code,{children:`ReasonDocsProvider`}),` in the
root layout`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`URL rules:`}),` `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/reason-docs/route-selection.ts`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Where they show:`}),` `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/reason-docs/sidebar-routes.ts`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Editor:`}),` `,(0,t.jsx)(n.code,{children:`/reason-editor`}),` (`,(0,t.jsx)(n.code,{children:`debate-editor`}),`'s CardMirror embed), with
its tab strip in `,(0,t.jsx)(n.code,{children:`components/reason-editor/EditorTabStrip.tsx`}),` and the tab
rules in `,(0,t.jsx)(n.code,{children:`lib/reason-docs/tab-actions.ts`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`where-the-panels-mount`,children:`Where the panels mount`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`ReasonDocsSidebarPanels`}),` is one component mounted in two places:`]}),`
`,(0,t.jsxs)(n.ol,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`AppSidebarShell`}),`'s `,(0,t.jsx)(n.code,{children:`<aside>`}),`, on the routes `,(0,t.jsx)(n.code,{children:`showsReasonDocsPanels`}),`
admits \u2014 `,(0,t.jsx)(n.code,{children:`/research/cards`}),` (the dock's "Shared" destination, and any page below
it) and `,(0,t.jsx)(n.code,{children:`/reason-editor`}),`, whose desktop file navigation `,(0,t.jsx)(n.em,{children:`is`}),` this
sidebar, the editor route having no `,(0,t.jsx)(n.code,{children:`<aside>`}),` of its own.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`/reason-editor`}),` itself, as a collapsible strip below `,(0,t.jsx)(n.code,{children:`md`}),`, since that
sidebar is `,(0,t.jsx)(n.code,{children:`hidden md:flex`}),`.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`They are deliberately absent everywhere else. The panels used to ride in
every sidebar, `,(0,t.jsx)(n.code,{children:`/videos`}),` included \u2014 which took a third mount, an app-owned
`,(0,t.jsx)(n.code,{children:`docsSlot`}),` on `,(0,t.jsx)(n.code,{children:`LecturesPage`}),`, since `,(0,t.jsx)(n.code,{children:`/videos`}),` renders its own sidebar rather
than the shell. That put a document tree above the video library's own nav
on a page that is not about documents; the slot is gone and the videos
sidebar is the dock plus the video nav. The trade is that
a file opened from `,(0,t.jsx)(n.code,{children:`/research/cards`}),` is no longer one click away after hopping to the
video library \u2014 the dock hop back is.`]}),`
`,(0,t.jsx)(n.p,{children:`In the sidebar the sections sit under the dock and above the Videos tree:
the tree is long enough (a section auto-expands to show where you are) that
anything below it starts under the fold. Topic Starters comes first, then
My Personal Documents. There is no panel switcher and no Open Tabs list: the
open files are the tab strip above the editor (below).`}),`
`,(0,t.jsxs)(n.p,{children:[`Each section has a chevron header and is expanded by default. Collapsing one
sticks, per-device, in `,(0,t.jsx)(n.code,{children:`localStorage`}),` (`,(0,t.jsx)(n.code,{children:`reason-editor-sidebar-topics-open`}),`,
`,(0,t.jsx)(n.code,{children:`reason-editor-sidebar-files-open`}),`). Nothing is fetched until a section is
actually open, so a page that leaves both collapsed makes no document
request at all.`]}),`
`,(0,t.jsx)(n.h2,{id:`tabs-above-the-editor`,children:`Tabs above the editor`}),`
`,(0,t.jsxs)(n.p,{children:[`Every file opened on `,(0,t.jsx)(n.code,{children:`/reason-editor`}),` gets a tab in the strip above
CardMirror. Click a tab to switch to it, or its \u00D7 to close it. Right-click a
tab for:`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Close`}),` that tab.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Close others`}),`: every tab but this one, which becomes the open file.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Close to the right`}),`: every tab after this one.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Close all`}),`.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Undo close`}),`: reopens the most recently closed tab. It walks back through
the last 20 closed tabs, skipping files deleted since.`]}),`
`]}),`
`,(0,t.jsx)(n.p,{children:`Closing the open tab moves to its neighbour, preferring the tab that slid
into its place.`}),`
`,(0,t.jsx)(n.h2,{id:`opening-a-file`,children:`Opening a file`}),`
`,(0,t.jsx)(n.p,{children:`Picking a file \u2014 an owned document or a public topic starter \u2014 does two
things:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`sets it active in `,(0,t.jsx)(n.code,{children:`ReasonDocsProvider`}),`, so a client-side hop switches the
editor instantly; and`]}),`
`,(0,t.jsxs)(n.li,{children:[`routes to `,(0,t.jsx)(n.code,{children:`/reason-editor/<the file's name>`}),` \u2014 `,(0,t.jsx)(n.code,{children:`/reason-editor/cp-answer-to-states`}),`,
not `,(0,t.jsx)(n.code,{children:`/reason-editor?topic=2`}),` \u2014 so the selection is addressable, and legible
in a shared link.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`Provider state alone covers the hop but not a reload, a pasted link, or a
hard navigation \u2014 `,(0,t.jsx)(n.code,{children:`/videos`}),` is its own layout branch and can boot the editor
with an empty provider. Carrying the file in the URL is what makes "click a
file, get `,(0,t.jsx)(n.em,{children:`that`}),` file in CardMirror" hold from every sidebar rather than
only from the ones that hop client-side.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The name is the title slugified (`,(0,t.jsx)(n.code,{children:`lib/reason-docs/doc-slug.ts`}),`): lowercased,
accents folded, apostrophes dropped, everything else non-alphanumeric
collapsed to single hyphens, capped at 80 characters on a word boundary, and
`,(0,t.jsx)(n.code,{children:`untitled`}),` when a title leaves nothing behind. Titles are not unique and ids
are, so two files that slugify the same are told apart by a `,(0,t.jsx)(n.code,{children:`~<id>`}),` suffix \u2014
`,(0,t.jsx)(n.code,{children:`impact-turns~d12`}),` for document 12, `,(0,t.jsx)(n.code,{children:`impact-turns~t7`}),` for topic starter 7.
No title can forge one: `,(0,t.jsx)(n.code,{children:`~`}),` is stripped out of titles by the same slugifier.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Already on the editor route, a pick routes nothing at all. `,(0,t.jsx)(n.code,{children:`/reason-editor`}),`
and `,(0,t.jsx)(n.code,{children:`/reason-editor/<slug>`}),` are separate Next routes, so routing between
them would remount CardMirror \u2014 and its undo history \u2014 on every tab switch;
the provider already has the file open, and `,(0,t.jsx)(n.code,{children:`ReasonDocsRouteSync`}),` renames
the address bar in place with `,(0,t.jsx)(n.code,{children:`history.replaceState`}),`. That same rewrite is
what upgrades an older `,(0,t.jsx)(n.code,{children:`?doc=<id>`}),` / `,(0,t.jsx)(n.code,{children:`?topic=<id>`}),` link (still read, and
still resolved) to the named path once the catalogue says what that file is
called, and what keeps the address on a file that is renamed while open. Any
other query parameter is kept \u2014 `,(0,t.jsx)(n.code,{children:`?share=`}),` and `,(0,t.jsx)(n.code,{children:`?shareWith=`}),` are read by the
same page.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`ReasonDocsRouteSync`}),` (mounted once on `,(0,t.jsx)(n.code,{children:`/reason-editor`}),`, inside a
`,(0,t.jsx)(n.code,{children:`<Suspense>`}),` since it reads `,(0,t.jsx)(n.code,{children:`useSearchParams`}),`, renders nothing) reads it
back. The rules themselves are pure functions in
`,(0,t.jsx)(n.code,{children:`lib/reason-docs/route-selection.ts`}),`, shared with the sidebar so the two
ends of the round trip cannot drift, and unit-tested in
`,(0,t.jsx)(n.code,{children:`lib/reason-docs/__tests__/route-selection.test.ts`}),`.`]}),`
`,(0,t.jsx)(n.p,{children:`Resolution order, per URL:`}),`
`,(0,t.jsxs)(n.ol,{children:[`
`,(0,t.jsxs)(n.li,{children:[`the path's name \u2014 an exact `,(0,t.jsx)(n.code,{children:`~<id>`}),` discriminator first, then the bare
slug matched against topic starters and then the reader's own documents,
then the segment read as an id;`]}),`
`,(0,t.jsxs)(n.li,{children:[`the URL's `,(0,t.jsx)(n.code,{children:`topic`}),` id, if it names a live topic starter;`]}),`
`,(0,t.jsxs)(n.li,{children:[`the URL's `,(0,t.jsx)(n.code,{children:`doc`}),` id, if it names one of the reader's own non-folder
documents;`]}),`
`,(0,t.jsx)(n.li,{children:`otherwise, and only when nothing is open, the first file \u2014 so the reader
lands on something readable instead of an empty pane.`}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`A name or id that matches nothing (a renamed file, a deleted one, someone
else's link) falls through to that same fallback rather than erroring \u2014 a
stale link is not a 404 \u2014 and a malformed id (`,(0,t.jsx)(n.code,{children:`?doc=abc`}),`, `,(0,t.jsx)(n.code,{children:`?doc=3.5`}),`) reads
as absent. The deep link applies once per URL: after it opens its file the
reader can pick another from the sidebar without the stale URL dragging them
back, and every pick rewrites the address, which re-arms it.`]}),`
`,(0,t.jsx)(n.p,{children:`The deep-link rule and the first-file fallback are one function on purpose.
As two React effects they raced: the fallback's closure still saw no
selection in the commit where the deep link opened its file, and opened the
first file over the top of it.`}),`
`,(0,t.jsx)(n.h2,{id:`read-only-topic-starters`,children:`Read-only topic starters`}),`
`,(0,t.jsxs)(n.p,{children:[`A topic starter opens in the same CardMirror embed as an owned document, but
read-only: no toolbar, no AI tools, no `,(0,t.jsx)(n.code,{children:`onChange`}),`, a `,(0,t.jsx)(n.code,{children:`readOnly`}),` title, and a
"Public topic starter" label beside it. It gets its own `,(0,t.jsx)(n.code,{children:`contentKey`}),`
namespace (`,(0,t.jsx)(n.code,{children:`topic-<id>`}),`) so the engine treats it as a distinct claim from an
owned document that happens to share the id \u2014 the same reason `,(0,t.jsx)(n.code,{children:`?doc=7`}),` and
`,(0,t.jsx)(n.code,{children:`?topic=7`}),` are different URLs.`]}),`
`,(0,t.jsxs)(n.h2,{id:`topic-starters-are-stored-as-cmir`,children:[`Topic starters are stored as `,(0,t.jsx)(n.code,{children:`.cmir`})]}),`
`,(0,t.jsxs)(n.p,{children:[`The admin importer on `,(0,t.jsx)(n.code,{children:`/admin`}),` takes a `,(0,t.jsx)(n.code,{children:`.docx`}),` (or a `,(0,t.jsx)(n.code,{children:`.zip`}),` of them) and
stores each one as a CardMirror native file \u2014 `,(0,t.jsx)(n.code,{children:`.cmir`}),`, gzipped JSON,
base64-encoded into the row's `,(0,t.jsx)(n.code,{children:`content`}),` column, with `,(0,t.jsx)(n.code,{children:`format`}),` set to
`,(0,t.jsx)(n.code,{children:`"cmir"`}),`.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The conversion is CardMirror's own OOXML importer (`,(0,t.jsx)(n.code,{children:`docxToCmir`}),` in
`,(0,t.jsx)(n.code,{children:`packages/debate-editor/src/native/convert.ts`}),` \u2014 `,(0,t.jsx)(n.code,{children:`fromDocxFull`}),` piped into
`,(0,t.jsx)(n.code,{children:`serializeNative`}),`, the same pair the desktop bulk converter runs), wrapped
for the route by `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/topic-starters/import.ts`}),`. What that
buys over the card HTML the importer used to store is everything HTML has no
element for: the Verbatim outline (pocket / hat / block / tag / analytic) as
typed nodes rather than `,(0,t.jsx)(n.code,{children:`<h1>`}),`\u2026`,(0,t.jsx)(n.code,{children:`<h4>`}),`, comment threads, inline images, and
the named character styles that distinguish a cite from an emphasis from a
plain underline.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Reading it back is client-side: `,(0,t.jsx)(n.code,{children:`topicStarterHtml`}),`
(`,(0,t.jsx)(n.code,{children:`lib/topic-starters/content.ts`}),`) parses the file with `,(0,t.jsx)(n.code,{children:`parseNative`}),` and
serializes it through the schema's own `,(0,t.jsx)(n.code,{children:`toDOM`}),` specs for the embed's
`,(0,t.jsx)(n.code,{children:`content`}),` prop, memoized per file on `,(0,t.jsx)(n.code,{children:`/reason-editor`}),`. Doing it in the
browser keeps the catalogue endpoint \u2014 which returns up to 100 rows \u2014 from
converting files nobody opens.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Rows imported before this carry HTML and still open: `,(0,t.jsx)(n.code,{children:`format`}),` says which a
row is (`,(0,t.jsx)(n.code,{children:`lib/topic-starters/format.ts`}),`), and content that arrives without
its row falls back to sniffing the bytes for the gzip magic. A `,(0,t.jsx)(n.code,{children:`.cmir`}),` that
will not parse renders a notice naming the failure rather than a blank
document.`]}),`
`,(0,t.jsx)(n.h2,{id:`organising-files`,children:`Organising files`}),`
`,(0,t.jsxs)(n.p,{children:[`Every file is a CardMirror file whatever it was uploaded as, so no row in
either tree carries a `,(0,t.jsx)(n.code,{children:`DOCX`}),` or `,(0,t.jsx)(n.code,{children:`CMIR`}),` badge; the name is the whole label.`]}),`
`,(0,t.jsx)(n.p,{children:`Right-clicking a row opens the same menu as its "\u2026" button, so every action
on a file is one gesture from the file itself:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Files:`}),` Open, Edit, Share\u2026, Rename, Duplicate, Move to (any folder, or
the top level), Download as .docx, Add to Topic Starters, Delete. Folders
get New File / New Folder in place of Open, Edit and Share.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Topic Starters:`}),` Open, Edit a copy, Save to my files, Copy link,
Download as .docx. The catalogue is read-only, so a topic starter is edited
by editing your own copy of it.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Share\u2026`}),` opens the file in the editor with the share-with-contacts dialog
already up (`,(0,t.jsx)(n.code,{children:`?shareOpen=1`}),`, read and stripped by `,(0,t.jsx)(n.code,{children:`ShareWithContacts`}),`).
Sharing starts a live co-editing session in the editor, which is why the file
has to be open there first.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.strong,{children:`Sort`}),` button in the My Personal Documents header orders the tree by name (A\u2013Z or Z\u2013A)
or by last modified (`,(0,t.jsx)(n.code,{children:`lib/reason-docs/file-sort.ts`}),`). Folders always come
before files. The choice is remembered per device.`]}),`
`,(0,t.jsx)(n.h2,{id:`moving-files-between-files-and-topic-starters`,children:`Moving files between Files and Topic Starters`}),`
`,(0,t.jsxs)(n.p,{children:[`Rows drag both ways between the two trees, and each drop means what it can
(`,(0,t.jsx)(n.code,{children:`lib/reason-docs/drag-data.ts`}),`):`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Topic Starters \u2192 Files:`}),` saves your own copy into the folder you drop
on. A folder comes with everything in it, and a `,(0,t.jsx)(n.code,{children:`.cmir`}),` stays a `,(0,t.jsx)(n.code,{children:`.cmir`}),`.
"Save to my files" in the menu does the same.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Files \u2192 Topic Starters:`}),` publishes the file to the public catalogue
(`,(0,t.jsx)(n.code,{children:`POST /api/admin/topic-starters/items`}),`). Only admins can do this. Anyone
else sees a message saying so.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Files \u2192 Files:`}),` moves the row, as before. A folder can't be dropped into
itself.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Desktop \u2192 either tree:`}),` an upload, as before.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`file-manager`,children:`File manager`}),`
`,(0,t.jsxs)(n.p,{children:[`The File manager button in the My Personal Documents header opens a full-window file
manager over the same files: SVAR's `,(0,t.jsx)(n.code,{children:`@svar-ui/react-filemanager`}),`, the widget
quick search's REASON sidebar opens from its own file manager dialog. Every
action it offers is routed back to the real rows
(`,(0,t.jsx)(n.code,{children:`components/reason-docs/FileManagerView.tsx`}),`, with the path \u2194 row mapping
in `,(0,t.jsx)(n.code,{children:`lib/reason-docs/file-manager-data.ts`}),`):`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Open`}),` (double-click or Enter) opens the file in this app's editor.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Add file, add folder and upload`}),` create rows in your folders.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Rename, delete, cut/paste and drag`}),` rename, delete and move your rows.
`,(0,t.jsx)(n.strong,{children:`Copy/paste`}),` duplicates them.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Download`}),` is the same `,(0,t.jsx)(n.code,{children:`.docx`}),` download as the sidebar menu.`]}),`
`]}),`
`,(0,t.jsx)(n.p,{children:`Topic Starters appear under a read-only "Topic Starters" folder. Copying or
moving out of it saves your own copy. Copying or moving one of your files
into it publishes it (admins only). Renaming or deleting inside it is
refused. The widget is loaded only when the dialog first opens.`}),`
`,(0,t.jsx)(n.h2,{id:`searching-files-from-ctrlcmd-k`,children:`Searching files from Ctrl/Cmd-K`}),`
`,(0,t.jsxs)(n.p,{children:[`The app-wide search palette (Ctrl/Cmd-K) lists matching files under
`,(0,t.jsx)(n.strong,{children:`Files`}),`, below the tools: your own files and the public Topic Starters,
matched by name, folder, `,(0,t.jsx)(n.strong,{children:`outline headings and contents`}),`
(`,(0,t.jsx)(n.code,{children:`lib/reason-docs/file-search.ts`}),`). Every word you type has to appear
somewhere. Name matches rank first, then outline matches (a pocket, hat,
block or tag heading holding every word, shown as `,(0,t.jsx)(n.code,{children:`\u00A7 Heading`}),`), then contents
matches, which show the text around the match. Picking a file opens it in the
editor.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Below the files, `,(0,t.jsx)(n.strong,{children:`Videos & Lectures`}),` lists up to eight matches from the
whole video library, rounds and lectures alike, most-viewed first. The
palette asks the Videos page's own feed (`,(0,t.jsx)(n.code,{children:`/api/videos?q=\u2026`}),`) once typing
pauses, so nothing about the library is downloaded until you search. Picking
one opens its watch page (`,(0,t.jsx)(n.code,{children:`lib/videos/video-palette-search.ts`}),`).`]}),`
`,(0,t.jsxs)(n.p,{children:[`A `,(0,t.jsx)(n.code,{children:`.cmir`}),` file's text is read with CardMirror's engine, which is loaded the
first time a query needs it, so the first search over card files can take a
moment longer. On `,(0,t.jsx)(n.code,{children:`/reason-editor`}),` the palette answers Ctrl/Cmd-K, while
Ctrl/Cmd-P stays the editor's own palette.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsxs)(n.del,{children:[`The docs section starts collapsed on `,(0,t.jsx)(n.code,{children:`/research/cards`}),`, so the files are
one click away there rather than on screen.`]}),` `,(0,t.jsx)(n.strong,{children:`Fixed:`}),` both sections start
expanded everywhere; a reader's own collapse is remembered per device.`]}),`
`,(0,t.jsx)(n.li,{children:`Undo close lives in the tab strip's right-click menu, and the strip is
hidden once every tab is closed, so after Close all there is no tab left to
right-click. Reopen a file from the sidebar instead. There is no keyboard
shortcut for it either: browsers keep Ctrl/Cmd-Shift-T for themselves.`}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.code,{children:`showsReasonDocsPanels`}),` is a hard-coded route list, not something derived
from the nav data. A new documents route has to be added to it by hand.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsxs)(n.del,{children:[(0,t.jsx)(n.code,{children:`SharedCardOpener`}),`'s `,(0,t.jsx)(n.code,{children:`?share=<id>`}),` flow replaces the URL with a bare
`,(0,t.jsx)(n.code,{children:`/reason-editor`}),`, dropping any `,(0,t.jsx)(n.code,{children:`?doc=`}),`/`,(0,t.jsx)(n.code,{children:`?topic=`}),` alongside it.`]}),` `,(0,t.jsx)(n.strong,{children:`Fixed:`}),`
`,(0,t.jsx)(n.code,{children:`ShareWithContacts.tsx`}),`'s `,(0,t.jsx)(n.code,{children:`dropQueryParam`}),` (used by both the `,(0,t.jsx)(n.code,{children:`?share=`}),` and
`,(0,t.jsx)(n.code,{children:`?shareWith=`}),` one-shot params) calls `,(0,t.jsx)(n.code,{children:`route-selection.ts#urlWithoutParam`}),`,
which drops only the named parameter and keeps the rest of the URL \u2014
`,(0,t.jsx)(n.code,{children:`?doc=`}),`/`,(0,t.jsx)(n.code,{children:`?topic=`}),` alongside a share link now survive being joined. Pinned
by `,(0,t.jsx)(n.code,{children:`route-selection.test.ts`}),`'s `,(0,t.jsx)(n.code,{children:`urlWithoutParam`}),` cases.`]}),`
`,(0,t.jsx)(n.li,{children:`Conversion runs in the import request, so a 100-file ZIP converts 100
documents inside one Worker invocation \u2014 heavier than the regex pass it
replaces. A batch large enough to hit the CPU limit fails as a dead
request, leaving the files converted before it in the library. Splitting
the archive is the workaround; moving the conversion into the browser (as
the Parquet card importer does) is the fix.`}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsxs)(n.del,{children:[`There is no way to download a topic starter's `,(0,t.jsx)(n.code,{children:`.cmir`}),`. The file is stored
and opened in the editor, but the library exposes no file endpoint.`]}),`
`,(0,t.jsx)(n.strong,{children:`Fixed:`}),` both the Files panel's and the Topic Starters panel's row menu
now have a "Download as .docx" item \u2014 your own documents and public topic
starters alike can be gotten out as a file without opening them in the
editor first.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.del,{children:`The Topic Starters catalogue sorted files before folders, so once it held
more than its 100-row cap the folders were cut off and every file inside
them vanished from the tree.`}),` `,(0,t.jsx)(n.strong,{children:`Fixed:`}),` `,(0,t.jsx)(n.code,{children:`/api/topic-starters`}),` sorts
folders first, and both trees show a row whose folder is missing at the
top level instead of dropping it.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.del,{children:`Folders in both trees started collapsed whenever the files loaded after
the panel mounted (the usual case), and the Topic Starters search matched
words from a row's raw JSON, so searching "folder" matched everything.`}),`
`,(0,t.jsx)(n.strong,{children:`Fixed:`}),` folders start open, and the search matches names and tags only.`]}),`
`,(0,t.jsx)(n.li,{children:`Publishing to Topic Starters is admin-only and always publishes at once.
There is no draft or review step for a reader's own file.`}),`
`,(0,t.jsxs)(n.li,{children:[`Ctrl/Cmd-K's file search converts every `,(0,t.jsx)(n.code,{children:`.cmir`}),` file it searches on the
reader's device. That is fine for the 100-row catalogue and a typical
library, but a very large library would want a server-side text index.`]}),`
`,(0,t.jsx)(n.li,{children:`Choosing an outline match opens the file at the top, not at the heading
that matched.`}),`
`,(0,t.jsx)(n.li,{children:`The video rows show only the first eight matches; there is no "more
videos" row that carries the query over to the Videos page.`}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`save-status-above-the-editor`,children:`Save status above the editor`}),`
`,(0,t.jsxs)(n.p,{children:[`The status line over the REASON editor (`,(0,t.jsx)(n.code,{children:`/reason-editor`}),`) says where the open
document stands: `,(0,t.jsx)(n.strong,{children:`Unsaved changes`}),` (an edit is queued), `,(0,t.jsx)(n.strong,{children:`Saving\u2026`}),`, or
`,(0,t.jsx)(n.strong,{children:`Couldn't save \u2014 retrying`}),` (shown in red; your edits stay in the tab and the
queue retries with backoff). Once the document is saved the line disappears. A public topic starter
reads `,(0,t.jsx)(n.strong,{children:`Public topic starter`}),` because it is read-only. The text comes from
`,(0,t.jsx)(n.code,{children:`describeDocSaveStatus`}),` (`,(0,t.jsx)(n.code,{children:`lib/reason-docs/doc-save-status.ts`}),`).`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};