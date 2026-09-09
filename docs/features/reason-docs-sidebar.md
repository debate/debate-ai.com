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
- **URL rules:** `apps/debate-ai.com/lib/reason-docs/route-selection.ts`
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

The section is expanded by default on `/reason-editor`, where the docs are
the page's subject, and collapsed on `/cards` until the reader says
otherwise — which sticks, per-device, in `localStorage`. Nothing is fetched
until it is actually open, so a page that leaves it collapsed makes no
document request at all.

## Opening a file

Picking a file — an owned document, a public topic starter, or an open tab —
does two things:

- sets it active in `ReasonDocsProvider`, so a client-side hop switches the
  editor instantly; and
- routes to `/reason-editor?doc=<id>` (or `?topic=<id>`), so the selection
  is addressable.

Provider state alone covers the hop but not a reload, a pasted link, or a
hard navigation — `/videos` is its own layout branch and can boot the editor
with an empty provider. Carrying the id in the query is what makes "click a
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

1. the URL's `topic` id, if it names a live topic starter;
2. the URL's `doc` id, if it names one of the reader's own non-folder
   documents;
3. otherwise, and only when nothing is open, the first file — so the reader
   lands on something readable instead of an empty pane.

An id that matches nothing (a deleted file, someone else's link) falls
through to that same fallback rather than erroring, and a malformed one
(`?doc=abc`, `?doc=3.5`) reads as absent. The deep link applies once per
URL: after it opens its file the reader can pick another from the sidebar
without the stale query dragging them back, and the sidebar rewrites the
query on every pick, which re-arms it.

The deep-link rule and the first-file fallback are one function on purpose.
As two React effects they raced: the fallback's closure still saw no
selection in the commit where the deep link opened its file, and opened the
first file over the top of it.

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

Reading it back is client-side: `topicStarterHtml`
(`lib/topic-starters/content.ts`) parses the file with `parseNative` and
serializes it through the schema's own `toDOM` specs for the embed's
`content` prop, memoized per file on `/reason-editor`. Doing it in the
browser keeps the catalogue endpoint — which returns up to 100 rows — from
converting files nobody opens.

Rows imported before this carry HTML and still open: `format` says which a
row is (`lib/topic-starters/format.ts`), and content that arrives without
its row falls back to sniffing the bytes for the gzip magic. A `.cmir` that
will not parse renders a notice naming the failure rather than a blank
document.

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
  and opened in the editor, but the library exposes no file endpoint.
