# REASON docs sidebar — files in every sidebar, opened in CardMirror

The Files / Topic Starters / Open Tabs panels that sit above the tool nav
tree, and the URL round trip that turns a click on one of them into "that
file, loaded in CardMirror, in the main column."

- **Routes:** every route with a sidebar — the tool routes wrapped by
  `AppSidebarShell`, plus `/videos` and `/videos/:category`, which render
  their own sidebar
- **Panels:** `apps/debate-ai.com/components/reason-docs/`
  (`ReasonDocsSidebarPanels`, `FileTree`, `TopicStarterTree`,
  `OpenTabsPanel`), over `ReasonDocsProvider` in the root layout
- **URL rules:** `apps/debate-ai.com/lib/reason-docs/route-selection.ts`
- **Editor:** `/reason-editor` (`debate-editor`'s CardMirror embed)

## Where the panels mount

`ReasonDocsSidebarPanels` is one component mounted in three places:

1. `AppSidebarShell`'s `<aside>` — every tool route the nav tree links to.
2. `LecturesPage`'s `docsSlot` — `/videos` and `/videos/:category`, which
   render their own sidebar rather than that shell. The panels arrive as a
   slot for the same reason the app dock does (`dockSlot`): they read
   app-level document state and route into `/reason-editor`, neither of
   which `debate-videos` can reach. Before this slot `/videos` was the one
   route with a sidebar but no files in it — following a file from anywhere
   else in the app and then hopping to the video library lost the tree.
3. `/reason-editor` itself, as a collapsible strip below `md`, since both
   sidebars above are `hidden md:flex`.

In the sidebar the panels sit under the dock and above the nav tree, the
same order in both sidebars: the tree is long enough (a section auto-expands
to show where you are) that anything below it starts under the fold.
`packages/debate-videos/test/lectures-sidebar-docs-slot.test.tsx` pins that
placement for the videos sidebar.

The section is expanded by default on `/reason-editor`, where the docs are
the page's subject, and collapsed elsewhere until the reader says otherwise
— which sticks, per-device, in `localStorage`. Nothing is fetched until it
is actually open, so a tool page that leaves it collapsed makes no document
request at all.

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

## Known gaps

- The docs section starts collapsed everywhere except `/reason-editor`, so
  on `/videos` the files are one click away rather than on screen. That
  follows the other tool routes deliberately; a reader who opens it there
  has their choice remembered.
- `SharedCardOpener`'s `?share=<id>` flow replaces the URL with a bare
  `/reason-editor`, dropping any `?doc=`/`?topic=` alongside it. The two
  never travel together in practice (a share link comes from `/contacts`),
  but nothing enforces that.
