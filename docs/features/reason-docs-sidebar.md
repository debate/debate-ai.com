# REASON docs sidebar — files on the document routes, opened in CardMirror

The Files / Topic Starters / Open Tabs panels that sit above the tool nav
tree, and the URL round trip that turns a click on one of them into "that
file, loaded in CardMirror, in the main column."

- **Routes:** `/cards` (and below it) and `/reason-editor` — the routes the
  documents are the subject of, per
  `apps/debate-ai.com/lib/reason-docs/sidebar-routes.ts`
- **Panels:** `apps/debate-ai.com/components/reason-docs/`
  (`ReasonDocsSidebarPanels`, `FileTree`, `TopicStarterTree`,
  `OpenTabsPanel`), over `ReasonDocsProvider` in the root layout
- **URL rules:** `apps/debate-ai.com/lib/reason-docs/route-selection.ts`,
  over the filename paths in `apps/debate-ai.com/lib/reason-docs/doc-path.ts`
- **Stored file format:** `apps/debate-ai.com/lib/cardmirror/` (`format.ts`,
  `content-format.ts`, `stored-cmir.ts`)
- **Public lookup by name:** `/api/topic-starters/by-path`
- **Where they show:** `apps/debate-ai.com/lib/reason-docs/sidebar-routes.ts`
- **Editor:** `/reason-editor` (`debate-editor`'s CardMirror embed)

## Where the panels mount

`ReasonDocsSidebarPanels` is one component mounted in two places:

1. `AppSidebarShell`'s `<aside>`, on the routes `showsReasonDocsPanels`
   admits — `/cards` (the dock's "Shared" destination, and any page below
   it) and `/reason-editor`, whose desktop file navigation *is* this
   sidebar, the editor route having no `<aside>` of its own.
2. `/reason-editor` itself, as a collapsible strip below `md`, since that
   sidebar is `hidden md:flex`.

They are deliberately absent everywhere else. The panels used to ride in
every sidebar, `/videos` included — which took a third mount, an app-owned
`docsSlot` on `LecturesPage`, since `/videos` renders its own sidebar rather
than the shell. That put a document tree above the video library's own nav
on a page that is not about documents; the slot is gone and the videos
sidebar is the dock plus the video nav
(`packages/debate-videos/test/lectures-sidebar.test.tsx`). The trade is that
a file opened from `/cards` is no longer one click away after hopping to the
video library — the dock hop back is.

In the sidebar the panels sit under the dock and above the nav tree: the
tree is long enough (a section auto-expands to show where you are) that
anything below it starts under the fold.

## What else the `/cards` sidebar carries

Nothing but the Research tool list. Clicking "Shared" in the dock used to
land on a column holding four navigations at once — the document panels, the
whole Apps / Coaching / Research / Practice tree, the glossary and rankings
links, and the site footer — on a page that is about the first of them.
`showsCardsOnlySidebar` (same module) marks the `/cards` subtree, and there
`AppSidebarShell` renders the tree as `ToolNavTree sectionIds={[…]}`: only
the named sections, no "Apps" node above them and no reference pair below,
and no footer.

Research is the section that lists the cards pages themselves (Evidence
Library, Argument Library, Topic Coverage, the prep room, the review queue),
so it is the one kept — and because `/cards` matches the *Apps* node by
route, `ToolNavTree` falls back to opening the first section it was given
rather than leaving a heading with nothing under it. The dock stays: it is
the control the reader clicked "Shared" in, and the way back to `/videos`.

`/reason-editor` keeps the full tree — it is reached *from* those other
sections rather than being one of them.

The section is expanded by default on both routes — they are the only two it
mounts on, and on `/cards` the sidebar is now these panels plus the Research
tool list, so a collapsed "Documents" row would leave that column with no
file tree in it. A reader's own collapse still wins and sticks, per-device,
in `localStorage`. Nothing is fetched until the section is actually open, so
collapsing it costs no document request.

## Opening a file

Picking a file — an owned document, a public topic starter, or an open tab —
does two things:

- sets it active in `ReasonDocsProvider`, so a client-side hop switches the
  editor instantly; and
- routes to `/reason-editor?doc=<file name>` (or `?topic=<file name>`), so
  the selection is addressable.

Provider state alone covers the hop but not a reload, a pasted link, or a
hard navigation — `/videos` is its own layout branch and can boot the editor
with an empty provider. Carrying the file in the query is what makes "click a
file, get *that* file in CardMirror" hold from every sidebar rather than
only from the ones that hop client-side. Already on the editor route the URL
is replaced rather than pushed, so opening ten files in a row doesn't cost
ten Back presses to leave.

`ReasonDocsRouteSync` (mounted once on `/reason-editor`, inside a
`<Suspense>` since it reads `useSearchParams`, renders nothing) reads it
back. The rules themselves are pure functions in
`lib/reason-docs/route-selection.ts`, shared with the sidebar so the two
ends of the round trip cannot drift, and unit-tested in
`lib/reason-docs/__tests__/route-selection.test.ts`.

Resolution order, per URL:

1. the URL's `topic` name, if it names a live topic starter;
2. the URL's `doc` name, against the reader's own tree and then the public
   one — a shared link names a file, not a table, so the same URL has to work
   for the person who owns the file and the person who only has the public
   copy;
3. a server lookup for a name neither tree placed (below);
4. otherwise, and only when nothing is open, the first file — so the reader
   lands on something readable instead of an empty pane.

A name that matches nothing anywhere (a deleted file, someone else's private
document) falls through to that same fallback rather than erroring. The deep
link applies once per URL: after it opens its file the reader can pick
another from the sidebar without the stale query dragging them back, and the
sidebar rewrites the query on every pick, which re-arms it.

The deep-link rule and the first-file fallback are one function on purpose.
As two React effects they raced: the fallback's closure still saw no
selection in the commit where the deep link opened its file, and opened the
first file over the top of it.

## The URL is the file's name

`?doc=impacts/warming-1ac`, not `?doc=34`. `lib/reason-docs/doc-path.ts`
builds a path from the row's own title and the folders above it, and reads
one back; the sidebar and the public lookup route both go through it, so the
two ends cannot drift. It owes callers three things:

- **Stable.** The file extension is dropped before slugging, so the `.docx` a
  reader uploaded and the `.cmir` it is stored as address the same file.
  Accents fold (`Réchauffement` → `rechauffement`) rather than collapsing to
  a row of dashes.
- **Unique.** Two files can share a name; two URLs cannot. Duplicates are
  disambiguated by row id, and the *lower* id keeps the bare path, so a link
  in someone's history doesn't start opening a different file because a newer
  file was uploaded or the sidebar re-sorted.
- **Forgiving.** A URL that names only the file (`?doc=warming-1ac`) resolves
  when exactly one file ends that way — two candidates fall through to the
  fallback rather than a coin flip. A folder resolves to the first file
  inside it (descending into subfolders), so a folder link lands on something
  readable. And a numeric ref still resolves as a row id, so links minted
  before paths keep working.

## A public file's URL works for anyone

The browsable catalogue (`/api/topic-starters`) is capped at 100 rows for the
sidebar's sake, so it cannot be what a link resolves against: a reader
following a shared link may be signed out, with no documents of their own and
a catalogue that never held the file. When neither tree places the name,
`ReasonDocsRouteSync` asks `/api/topic-starters/by-path?path=<name>` once,
which searches every published row (using the same `findItemByRef`) and
returns the one file, content included, so the editor opens it in the same
trip. Published rows only, in both the match and the ancestry. A lookup that
comes back empty is remembered for that URL, so the link falls through to the
normal fallback instead of asking again on every render.

## Uploading a file

The Documents header has an Upload button, and the file tree takes a drop
from the desktop — onto a folder to import there, anywhere else to import at
the root. Both go through `importFiles` on the provider.

Every upload is stored as a CardMirror native file, whatever it arrived as
(`lib/cardmirror/stored-cmir.ts`): a `.docx` through `docxToCmir`, a `.cmir`
kept byte-for-byte (parsed first, so a mislabelled file is refused now rather
than on open), and `.html` / `.md` / `.txt` parsed through the schema. The
card parser is not in this path at all — `.cmir` is the only shape that holds
what CardMirror's OOXML reader gets out of a Verbatim document, and the HTML
the app would otherwise keep flattens the outline, comments, images and marks
away.

The row keeps the name it was uploaded under, extension included, so the
`.docx` you dropped is the `.docx` you see in the sidebar (with its type on a
badge); clicking it opens it in CardMirror, decoded from the stored `.cmir`.
The first file of an upload is opened and routed to, which makes uploading
and clicking one file the same gesture. One file that cannot be converted
doesn't lose the rest of a drop: it comes back as a message under the tree,
naming the file and the remedy.

Editing an imported file keeps it a `.cmir`. The editor reports HTML, so the
live copy of an open file is held as HTML in a ref and re-encoded on its own
600ms debounce in front of the save queue's — gzipping a card document on
every keystroke would be felt. An edit still waiting to be encoded when the
page goes away is encoded synchronously by the same `pagehide` /
tab-hidden handler that flushes the save queue, so the last half-second of
typing isn't lost. A re-encode that fails leaves the stored file alone rather
than overwriting a readable `.cmir` with a failure.

`documents.format` records which shape a row holds, exactly as
`topic_starter_items.format` does (`drizzle/0038_document_cmir.sql`);
documents written in the editor stay HTML and are untouched by any of this.

## Read-only topic starters

A topic starter opens in the same CardMirror embed as an owned document, but
read-only: no toolbar, no AI tools, no `onChange`, a `readOnly` title, and a
"Public topic starter" label beside it. It gets its own `contentKey`
namespace (`topic-<id>`) so the engine treats it as a distinct claim from an
owned document that happens to share the id — the same reason `?doc=7` and
`?topic=7` are different URLs.

## Topic starters are stored as `.cmir`

The admin importer on `/admin` takes a `.docx` (or a `.zip` of them) and
stores each one as a CardMirror native file — `.cmir`, gzipped JSON,
base64-encoded into the row's `content` column, with `format` set to
`"cmir"`.

The conversion is CardMirror's own OOXML importer (`docxToCmir` in
`packages/debate-editor/src/native/convert.ts` — `fromDocxFull` piped into
`serializeNative`, the same pair the desktop bulk converter runs), wrapped
for the route by `apps/debate-ai.com/lib/topic-starters/import.ts`. What that
buys over the card HTML the importer used to store is everything HTML has no
element for: the Verbatim outline (pocket / hat / block / tag / analytic) as
typed nodes rather than `<h1>`…`<h4>`, comment threads, inline images, and
the named character styles that distinguish a cite from an emphasis from a
plain underline.

Reading it back is client-side: `storedContentToHtml`
(`lib/cardmirror/stored-cmir.ts`, aliased for this table as
`topicStarterHtml`) parses the file with `parseNative` and serializes it
through the schema's own `toDOM` specs for the embed's `content` prop,
memoized per file on `/reason-editor`. Doing it in the browser keeps the
catalogue endpoint — which returns up to 100 rows — from converting files
nobody opens.

The rules are the app's rather than this table's — the reader's own uploads
are stored the same way — so they live in `lib/cardmirror/` and
`lib/topic-starters/format.ts` is the Topic Starter names for them.

Rows imported before this carry HTML and still open: `format` says which a
row is, and content that arrives without its row falls back to sniffing the
bytes for the gzip magic. A `.cmir` that will not parse renders a notice
naming the failure rather than a blank document.

## Known gaps

- The docs section starts collapsed on `/cards`, so the files are one click
  away there rather than on screen. A reader who opens it has that choice
  remembered per-device.
- `showsReasonDocsPanels` is a hard-coded route list, not something derived
  from the nav data. A new documents route has to be added to it by hand.
- `SharedCardOpener`'s `?share=<id>` flow replaces the URL with a bare
  `/reason-editor`, dropping any `?doc=`/`?topic=` alongside it. The two
  never travel together in practice (a share link comes from `/contacts`),
  but nothing enforces that.
- Conversion runs in the import request, so a 100-file ZIP converts 100
  documents inside one Worker invocation — heavier than the regex pass it
  replaces. A batch large enough to hit the CPU limit fails as a dead
  request, leaving the files converted before it in the library. Splitting
  the archive is the workaround; moving the conversion into the browser (as
  the Parquet card importer does) is the fix.
- There is no way to download a topic starter's `.cmir`. The file is stored
  and opened in the editor, but the library exposes no file endpoint. The
  same holds for an uploaded document: it goes in as a `.docx` and can only
  come back out through the editor.
- Renaming a file changes its URL, and nothing redirects the old one — it
  falls through to the first-file fallback like any other name that no longer
  resolves.
- Upload converts one file at a time in the browser and has no `.zip`
  expansion, so a squad file set arrives as a multi-select rather than an
  archive. The admin Topic Starter importer is the one that unpacks a ZIP.
- `?doc=` reaching into the public library means a reader with no file by
  that name silently gets the public one. That is the point for a shared
  link, but it also means a private file deleted mid-session can be replaced
  in the pane by a public file that happens to share its name.
