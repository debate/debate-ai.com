# Legacy Verbatim / Cardmirror Compatibility — editor keyboard shortcuts

Wires the Verbatim/Cardmirror-style card-editing commands built in
`debate-card-parser`'s `verbatim-shortcuts.ts` into real keyboard-shortcut
handlers (and matching toolbar/panel buttons) in the live `reason-editor`
document — closing follow-up (a) under idea #14 ("Legacy Verbatim /
Cardmirror Compatibility") in `TODO.md`'s Product Feature Ideas list:
"wiring these commands into actual keyboard-shortcut handlers in
`reason-editor`'s toolbar/editor view".

- **Route:** any `reason-editor` document (e.g. `/reason-editor`)
- **Package:** [`reason-editor`](../../packages/reason-editor/README.md)

## Shortcuts

| Shortcut | Command | Toolbar/panel button |
| --- | --- | --- |
| `Mod-Shift-E` | Toggle emphasis on the selection | "Emph" (existing) |
| `Mod-Shift-K` | Insert a short cite tag ("Smith 24") at the cursor | "+Cite" |
| `Mod-Shift-D` | Condense the document to its underlined "read" text | "Condense" |
| `Alt-ArrowUp` / `Alt-ArrowDown` | Move the current heading's section up/down | Outline nav panel's ↑/↓ |

`Mod` is Ctrl on Windows/Linux, Cmd on macOS.

## Which commands are reused directly, and which aren't

`debate-card-parser`'s `formatShortCiteTag` (a pure string formatter) and
`moveOutlineNode` (a generic, bounds-checked array swap — genericized in
this slice so a caller's own outline shape, not just this module's
`OutlineNode`, can reuse it) are reused directly against the live editor:

- **Insert short cite** (`engine/verbatim-shortcuts.ts`'s
  `buildInsertShortCiteTransaction`) prompts for an author/year, formats
  the tag via `formatShortCiteTag`, and inserts it at the selection marked
  `cite_mark` — a fast, local complement to the existing AI-cite toolbar
  action (`ai/cite-creator.ts`), which reformats a longer, already-typed
  citation via an Anthropic call instead.
- **Move heading section** (`engine/outline/heading-move.ts`'s
  `buildMoveHeadingSectionTransaction`) reuses `moveOutlineNode` to
  validate/resolve the swap target against the live document's
  `OutlineHeading[]` (from `heading-outline.ts`), then swaps the two
  headings' document ranges (heading through the next heading, of any
  level, in document order) via a ProseMirror transaction.

`condenseCardHtml` and `toggleEmphasisHtml` are HTML-string based — the
right tool for a *parsed* card (e.g. cardcutter/import output), not a live
ProseMirror document. Rather than round-tripping through
`editor.getHTML()`/`setContent()` for emphasis (which the schema already
models as a real mark), the emphasis shortcut binds the schema-native
`toggleMark('emphasis_mark')` command directly — the same command the
existing "Emph" toolbar button uses. Condense *is* still reused directly
(`applyCondenseToHtml`, wrapping `condenseCardHtml`) against the editor's
own `getHTML()` output, since condensing genuinely is an HTML-level,
once-per-invocation transform, not a per-keystroke one.

`debate-card-parser`'s exports used here are imported from their specific
source files rather than the package barrel (`debate-card-parser`'s
`index.ts`): the barrel re-exports parser modules that predate
`reason-editor`'s `noUncheckedIndexedAccess` typecheck setting and aren't
clean under it, which would otherwise fail `reason-editor`'s typecheck for
code this feature never uses.

## Data flow

```
debate-card-parser/src/utils/verbatim-shortcuts.ts
  → formatShortCiteTag(card)                — pure "Smith 24"/"Smith ND" formatter
  → moveOutlineNode(outline, index, dir)     — generic bounds-checked swap

reason-editor/src/engine/verbatim-shortcuts.ts
  → applyCondenseToHtml(html)                          — condenseCardHtml, no-op fallback
  → buildInsertShortCiteTransaction(state, author, year) — PM transaction, cite_mark applied

reason-editor/src/engine/outline/heading-move.ts
  → buildMoveHeadingSectionTransaction(state, outline, headingId, dir)
  → findHeadingAtPos(outline, pos)           — which section the cursor is in

reason-editor/src/react/verbatim-shortcuts-extension.ts (VerbatimShortcuts TipTap extension)
  → binds the four keyboard shortcuts above to the engine functions

react/Toolbar.tsx        → "+Cite" / "Condense" buttons
react/OutlineNavPanel.tsx → per-heading ↑/↓ move buttons
react/ReasonEditor.tsx   → VerbatimShortcuts added to the editor's extensions
```

## Known gaps

None. Follow-up (b) on idea #14 — a "send selected evidence to a speech
document" command — is now closed: `Mod-Shift-S` / the "→Speech" toolbar
button sends the current selection to a persisted `SpeechDocument`. See
[`speech-document-target.md`](./speech-document-target.md).
