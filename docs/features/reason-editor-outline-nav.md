# Expandable Heading Structure — outline nav panel

Renders a heading nav/outline panel alongside the `reason-editor` document —
the "(a) a React nav/outline panel in `reason-editor` that renders the
outline and toggles collapsed ids, reading/writing through the persistence
store" follow-up named under idea #9 ("Expandable Heading Structure") in
`TODO.md`'s Product Feature Ideas list.

- **Route:** `/reason-editor` (opt-in `showOutline` prop on `ReasonEditor`)
- **Package:** [`reason-editor`](../../packages/reason-editor/README.md)

## What it shows

Every heading (H1-H4: pocket/hat/block/tag-analytic) in the live document,
indented by level. A chevron toggle next to any heading that has nested
subheadings collapses or expands that heading's subtree — collapsing hides
descendant headings from the list (the heading itself stays visible),
mirroring the existing `getVisibleHeadingIds` semantics used by
`getCollapsedRanges`. Clicking a heading's label moves the editor's text
selection to just inside that heading and scrolls it into view. The
collapsed-id selection is persisted per `documentId` through the existing
`state/collapsedHeadings.ts` store, so it's restored the next time the same
document is opened.

## Data flow

```
engine/outline/heading-outline.ts
  → buildHeadingOutline(doc)                    — derives heading list from the live ProseMirror doc
  → getVisibleHeadingIds(outline, collapsedIds)  — which headings the panel lists
  → toggleCollapsedHeadingId(collapsedIds, id)   — flips one heading's collapse state

state/collapsedHeadings.ts (localStorage: reasonEditorCollapsedHeadings)
  → getCollapsedHeadingSelection(documentId)   — restores a document's selection on mount
  → saveCollapsedHeadingSelection(selection)   — persists after every toggle

react/OutlineNavPanel.tsx
  → subscribes to the TipTap editor's "update" event to re-derive the
    outline whenever the document changes
  → renders the indented, toggleable heading list
  → editor.chain().setTextSelection(...).scrollIntoView().run() on click

react/ReasonEditor.tsx
  → new `showOutline`/`documentId` props render OutlineNavPanel next to the
    document content

apps/debate-ai.com/app/reason-editor/page.tsx
  → passes `showOutline` to `EditorWithToolbar` (documentId defaults to the
    existing `contentKey`, i.e. the document's row id)
```

This closes follow-up (a) on the "Expandable Heading Structure" idea. The
outline/collapse-range derivation and the collapsed-heading persistence
store already existed and were Vitest-covered
(`packages/reason-editor/test/heading-outline.test.ts`,
`packages/reason-editor/test/collapsedHeadings.test.ts`); this slice adds
the `toggleCollapsedHeadingId` pure helper (also Vitest-covered) and the
`OutlineNavPanel` component that wires the two together.

## Known gaps

- Follow-up (b), a ProseMirror decoration plugin that actually hides
  collapsed ranges in the live editor view using `getCollapsedRanges`, is
  not part of this slice — collapsing a heading here only affects what the
  nav panel *lists*, not what the document itself renders.
- No component-level test exists for `OutlineNavPanel` itself, consistent
  with this repo's existing convention of Vitest-covering pure state/engine
  logic rather than `.tsx` panel components (verified instead via
  `bun run build:web`).
