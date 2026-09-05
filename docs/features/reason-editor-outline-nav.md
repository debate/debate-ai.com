# Expandable Heading Structure — outline nav panel + heading breadcrumb

Renders a heading nav/outline panel alongside the document, plus (as of
this slice) a sticky "current heading" breadcrumb — TODO.md's idea #9
("Expandable Heading Structure").

**Correction (2026-08-30):** this doc previously described a TipTap-based
`OutlineNavPanel`/`ReasonEditor` component in the `reason-editor` package.
That component is dead code: `/reason-editor` has rendered
`debate-editor`'s `CardMirrorEditor` since PR #338 (originally via a
`debate-editor` re-export shim to a separate `debate-editor-cardmirror`
workspace package, since merged into `debate-editor` itself), and
`CardMirrorEditor`'s own `showOutline`/
`documentId` props (declared on its prop type, passed unconditionally from
`app/reason-editor/page.tsx`) are never read anywhere in its
implementation — a vestigial no-op left over from the migration. The
outline nav panel this doc actually needs to describe is CardMirror's own,
native, considerably more capable implementation below; `reason-editor`'s
`OutlineNavPanel.tsx`/`ReasonEditor.tsx`'s `showOutline` prop and
`state/collapsedHeadings.ts` are unreachable from the shipped app and were
left as-is (deleting a whole legacy package is out of scope for this
slice; the package is unimported anywhere in `apps/debate-ai.com`, per the
"Round Workspace" idea #17 audit's dead-code search).

- **Route:** `/reason-editor` (and every other CardMirror-hosted surface —
  the nav panel and breadcrumb are core editor chrome, not opt-in)
- **Package:** [`debate-editor`](../../packages/debate-editor)

## What it shows

**Nav panel** (`editor/nav-panel.ts`'s `NavigationPanel`, mounted into the
static `#nav-panel` div `react/ribbon-template.ts` renders) — every
heading-anchored node (Pocket/Hat/Block/Tag/Analytic, in that
level-1-through-4 order) in the live document, indented by level, with:
chevron/double-click collapse per subtree, drag-and-drop reordering,
multi-select, a per-level "show levels 1 through N" filter, live
highlighting of the heading under the caret, and click-to-jump (via
`precise-scroll.ts`'s cv:auto-aware `scrollToHeadingId`). Shown/hidden by
the `toggleNavPane` ribbon command (menu bar, command palette, and the
`#nav-pane-toggle-btn` ribbon button all reach it — no default keybinding)
persisted as the `navPaneVisible` setting, which **defaults to visible**
— so idea #9's original "make the panel on-by-default instead of opt-in"
ask was already true of the live implementation before this slice; the
`reason-editor` doc above just never got updated to say so.

**Heading breadcrumb** (`editor/heading-breadcrumb-bar.ts`'s
`HeadingBreadcrumbBar`) — a sticky one-line trail showing the ancestor
chain — e.g. "Case › Advantage 1 › Uniqueness" — for whichever heading is
at the top of the current scroll position. Each segment is clickable and
jumps to that heading, reusing the same select-then-`scrollToHeadingId`
pattern `nav-panel.ts`'s own row clicks use. Hidden when scrolled above
every heading (nothing to show yet). Single-doc renders one instance
pinned to `#app`'s own scroll box (`#heading-breadcrumb-bar`); the
multi-pane workspace (`editor/multi-pane-shell.ts`) renders one
independent instance per pane — `slot1`/`slot2`/`slot3` each get their own
`HeadingBreadcrumbBar` pinned to that pane's own `.pmd-pane-body` scroller,
tracking whichever doc is currently visible in that slot and re-attaching
on every doc switch within the slot (idea #9's last open follow-up — see
Tracker Status). A separate OS-level window (the native wrapper, or a
second browser tab on the same doc) needs no extra wiring: it's a fully
independent module instance with its own `#app`-or-multi-pane DOM, so it
already gets a breadcrumb through whichever of the two paths above it's
running.

**Breadcrumb visibility toggle** — Settings → Appearance → "Show heading
breadcrumb bar" (`showHeadingBreadcrumb`, default on, persisted). Off hides
the bar unconditionally, even where a heading is in scope, independent of
`navPaneVisible` — a user can keep the nav pane and drop just the sticky
strip, or vice versa.

## Data flow

```
editor/headings.ts
  → collectHeadings(doc)             — flat, doc-order heading list (shared
                                        by the nav panel, drag/drop, and the
                                        breadcrumb)

editor/nav-panel.ts (NavigationPanel)
  → owns collapse state, drag/drop, multi-select, the per-level filter,
    and caret-follow highlighting
  → settings.ts's `navPaneVisible` (default true) + `toggleNavPane`
    ribbon command gate visibility; `formatNavPaneByType` controls the
    per-level styling

editor/heading-breadcrumb.ts
  → computeBreadcrumbPath(headings, pos) — pure: single forward pass over
    collectHeadings()'s flat list, maintaining a level-ordered ancestor
    stack (pop while the top of stack's level >= the next entry's level,
    then push) — no parent pointers needed, the same trick
    `sectionEndFromHeading` in headings.ts uses for sibling spans
  → shouldShowBreadcrumb(enabled, path) — pure: `showHeadingBreadcrumb` AND
    a non-empty path; `HeadingBreadcrumbBar.render` defers to this so the
    setting and the "nothing above the scroll position yet" case share one
    hide decision

editor/heading-breadcrumb-bar.ts (HeadingBreadcrumbBar)
  → on scroll (rAF-throttled) and on doc update, probes a few Y offsets
    below the bar via `view.posAtCoords` — not just one; the doc's own
    top padding right at scrollTop 0 can put a single close-in probe in a
    gap `posAtCoords` resolves as no hit, which left the bar showing a
    stale heading until this widened — then renders
    `computeBreadcrumbPath`'s result, clickable per segment to jump
  → setEnabled(enabled) — called from settings.ts's `showHeadingBreadcrumb`
    change handler (mirrors `applyFormatNavPaneByType`'s pattern): off
    hides the bar immediately via render([]); on re-runs refresh() so
    whatever the current scroll position would show reappears
  → one instance per surface: single-doc's `index.ts` owns one bound to
    `#app`; multi-pane's `multi-pane-shell.ts` gives each of its three
    `Slot`s its own, bound to that slot's `.pmd-pane-body`

react/ribbon-template.ts
  → static `#heading-breadcrumb-bar` div, sibling of `.pmd-editor-row`
    inside `#app`, so `position: sticky` pins it to `#app`'s own scroll
    box (single-doc's scroller — see `precise-scroll.ts`'s module doc)

editor/multi-pane-shell.ts (Slot)
  → constructs its own breadcrumb `<div class="pmd-heading-breadcrumb">`
    as a permanent first child of `bodyEl` (`.pmd-pane-body`), ahead of
    whichever `DocRecord.editorEl` is currently mounted, and wraps it in
    its own `HeadingBreadcrumbBar` bound to `bodyEl` as the scroller
  → `mountVisible()` calls `breadcrumbBar.attach(rec.view)` after
    restoring `rec.savedScrollTop`, so switching the slot's visible doc
    (opening a new one, or cycling the stack) re-points the bar at the
    newly-visible doc's headings and scroll position
  → the per-record `dispatchTransaction`'s existing 200ms debounced
    heavy-update timer (shared with `navPanel.update`/`refreshWordCount`)
    also calls `breadcrumbBar.update(doc)`, gated on
    `record.owner.visible === record` so a background stack member's
    headings never repaint the pane's currently-visible breadcrumb
  → the shell's settings subscriber propagates `showHeadingBreadcrumb`
    toggles to all three slots' bars, mirroring single-doc's own handler
```

## Known gaps

- No component-level test exists for `NavigationPanel`/
  `HeadingBreadcrumbBar` themselves, consistent with this repo's existing
  convention of Vitest-covering pure state/engine logic
  (`heading-breadcrumb.test.ts`'s 12 cases cover `computeBreadcrumbPath`'s
  ancestor-stack logic and `shouldShowBreadcrumb`'s visibility predicate
  directly) rather than DOM-wiring classes — verified
  instead via `bun run build:web` plus a manual Playwright pass against
  `wrangler dev` (a real local D1 is required for `/reason-editor`'s
  document create/list calls to succeed; `bun run dev:web`'s plain
  `vinext dev` has no D1 binding at all).
- Idea #9's other two follow-ups are already done, just not through the
  `reason-editor` package this doc used to point at: drag-to-reorder
  headings is `nav-panel.ts`'s existing drag/drop (`drag-controller.ts`),
  and "on by default" is `navPaneVisible`'s own default.
- The multi-pane breadcrumb tracks whichever doc is *visible* in a slot;
  a doc sitting in a slot's stack but not currently shown doesn't repaint
  the pane's bar until it's switched to (deliberate — see "Data flow"
  above), so there's no per-stacked-doc breadcrumb history, just the one
  currently on screen per pane. No further follow-up is currently tracked
  for this idea; a future run should pick a fresh next-step (e.g. a
  compact per-pane breadcrumb width budget so three narrow panes don't
  each need horizontal scrolling for a deep chain) if one becomes worth
  doing.
