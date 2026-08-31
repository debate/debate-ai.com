# Expandable Heading Structure — outline nav panel + heading breadcrumb

Renders a heading nav/outline panel alongside the document, plus (as of
this slice) a sticky "current heading" breadcrumb — TODO.md's idea #9
("Expandable Heading Structure").

**Correction (2026-08-30):** this doc previously described a TipTap-based
`OutlineNavPanel`/`ReasonEditor` component in the `reason-editor` package.
That component is dead code: `/reason-editor` has rendered
`debate-editor-cardmirror`'s `CardMirrorEditor` (via the `debate-editor`
re-export shim) since PR #338, and `CardMirrorEditor`'s own `showOutline`/
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
- **Package:** [`debate-editor-cardmirror`](../../packages/debate-editor-cardmirror)

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
`HeadingBreadcrumbBar`, new in this slice) — a sticky one-line trail
(`#heading-breadcrumb-bar`, pinned to the top of `#app`'s own scroll box)
showing the ancestor chain — e.g. "Case › Advantage 1 › Uniqueness" — for
whichever heading is at the top of the current scroll position. Each
segment is clickable and jumps to that heading, reusing the same
select-then-`scrollToHeadingId` pattern `nav-panel.ts`'s own row clicks
use. Hidden when scrolled above every heading (nothing to show yet).
Single-doc only — multi-pane/multi-window each have their own
`.pmd-pane-body` scroller and view and aren't wired up (a follow-up, not a
regression: neither had a breadcrumb before this file existed).

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

react/ribbon-template.ts
  → static `#heading-breadcrumb-bar` div, sibling of `.pmd-editor-row`
    inside `#app`, so `position: sticky` pins it to `#app`'s own scroll
    box (single-doc's scroller — see `precise-scroll.ts`'s module doc)
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
- The breadcrumb is single-doc only; multi-pane and multi-window don't
  have one yet (see "What it shows" above).
- Idea #9's other two follow-ups are already done, just not through the
  `reason-editor` package this doc used to point at: drag-to-reorder
  headings is `nav-panel.ts`'s existing drag/drop (`drag-controller.ts`),
  and "on by default" is `navPaneVisible`'s own default. Only the sticky
  breadcrumb follow-up was genuinely missing before this slice.
