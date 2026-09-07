# App nav dock and tool sidebar

The macOS-style icon dock that carries the app's top-level destinations, and
the sidebar column that hosts it on every tool route.

- **Component:** `apps/debate-ai.com/components/layout/CategoryDock.tsx`
- **Sidebar shell:** `apps/debate-ai.com/components/layout/AppSidebarShell.tsx`
- **Route predicates:** `packages/debate-videos/src/components/category-gallery/sidebar-routes.ts`
  (re-exported for app code as `apps/debate-ai.com/lib/sidebar-routes.ts`)
- **Dock primitive:** `packages/debate-ui/src/layout/dock.tsx`
  (`apps/debate-ai.com/lib/ui/layout/dock.tsx` is the app's copy)

## What it shows

Five destinations — Videos, Shared, Debate, Practice vs AI, Docs — plus a
gear-icon Settings menu, each with a hover label and `Alt+1`…`Alt+5`
shortcuts in dock order.

**Tools are not dock icons.** The tools catalog is reached three other ways:
the sidebar nav tree's "Apps" heading and its "All Tools" entry, the tree's
Coaching / Research / Practice sections, and the dock's own Settings menu
("All Tools", plus a Tools submenu grouped the same way `/tools` is). Holding
the dock to five destinations is what lets it fit inside the sidebar column
it is hosted in — see below.

## Where it renders

The dock has two forms, and which one a route gets is decided by
`hasEmbeddedDock`:

**Sidebar-hosted (`<CategoryDock embedded />`).** On `/videos` (whose own
`<aside>` takes it through `LecturesVideoGridView`'s `dockSlot`) and on every
route the tool-nav tree links to (where `AppSidebarShell` wraps the page in
the generic sidebar), the dock sits at the top of that 300px column.

**Fixed fallback.** Everywhere else — the home page, `/login`, `/legal/*` —
it renders fixed in the top-left corner on desktop and as a bottom bar on
mobile. The two never show at once.

Route matching is by path *prefix*, so a nested route under a tree entry
(`/cards/awards` under `/cards`, a document route under `/doc`) keeps the
sidebar rather than dropping to the fixed dock. The trailing `/` in the
comparison keeps `/docs` from matching `/doc`.

## Staying inside the sidebar

A dock sized to its own contents (`w-max`, the default `fluid: false` form)
is wider than the 300px sidebar at the `md` breakpoint. Hosted there it
either forced the sidebar to scroll sideways or reached over its border onto
the page beside it — which on `/reason-editor` and `/doc` is a CardMirror
editor.

The sidebar-hosted form passes `fluid` to `Dock`, which:

- takes its width from the column (`w-full max-w-full min-w-0`) instead of
  from the item count, and
- wraps an overflowing row onto a second line (`flex-wrap`) instead of
  growing past the column, so a future sixth or seventh destination still
  cannot escape it.

`CategoryDock` also shrinks the icons for that form: `EMBEDDED_ICON_SIZE`
(34px) at rest and `EMBEDDED_MAGNIFICATION` (46px) hovered. Six items at 34px
with `gap-1.5` and `p-2` come to 250px against 276px of usable column width,
and a magnified icon adds 12px more — so the row fits without wrapping at
every breakpoint, and the wrapping above is the backstop rather than the
normal case.

Hover labels stay `overflow-visible`: the sidebar column is the clipping
boundary, and clipping at the dock would hide every tooltip.

## Tests

- `packages/debate-ui/test/dock.test.tsx` — the `fluid` variant's classes,
  host-set icon sizing, and that magnification never shrinks an icon below
  its resting size.
- `packages/debate-videos/test/sidebar-routes.test.ts` — that `/tools` is no
  longer a dock destination but is still a sidebar one, and the prefix
  matching (including `/docs` not matching `/doc`).
