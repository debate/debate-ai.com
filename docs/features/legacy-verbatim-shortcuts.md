# Legacy Verbatim / Cardmirror Compatibility — editor keyboard shortcuts

Idea #14 in `TODO.md`'s Product Feature Ideas asked for keyboard shortcuts
that mirror familiar Verbatim/paperless-debate workflows — condensing
cards, applying citation/emphasis styling, and moving sections — "wired
into actual keyboard-shortcut handlers in `reason-editor`'s toolbar/editor
view." The commands originally built for that ask live in
`reason-editor/src/engine/verbatim-shortcuts.ts` and
`reason-editor/src/react/verbatim-shortcuts-extension.ts`, bound to
`Mod-Shift-E` / `Mod-Shift-K` / `Mod-Shift-D` / `Alt-ArrowUp` /
`Alt-ArrowDown` — but `reason-editor` (the TipTap package) is no longer
depended on by the app. `/reason-editor` renders `debate-editor`'s shim to
`debate-editor-cardmirror` (the ported-in CardMirror ProseMirror engine),
which was built with — and ships — its own, considerably larger native
Verbatim-parity command set that predates this doc and makes the four
shortcuts above redundant rather than missing. This doc previously
described the dead package as if it were live; it now documents
CardMirror's real, shipped equivalents, closing the staleness flagged in
`speech-document-target.md`'s Known gaps.

- **Route:** any CardMirror document (e.g. `/reason-editor`)
- **Package:** [`debate-editor-cardmirror`](../../packages/debate-editor-cardmirror)
  — `src/editor/ribbon-commands.ts` (command implementations and default
  keybindings), `src/editor/move-container.ts`, `src/editor/condense.ts`
- **Nav:** every command below is reachable three ways — its default
  keybinding, the `MenuBar.tsx` top bar (Format/Card/Edit/AI dropdowns,
  per the table), and by typing its name or an alias into
  Ctrl/Cmd-Shift-Space's command palette (`quick-card-search-ui.ts` also
  indexes every ribbon command, not just the `t`-prefixed Workspace links)

## Shortcuts

CardMirror's F-key-based bindings are themselves a direct port of
Verbatim's own hotkey scheme (F8 Cite / F9 Underline / F10 Emphasis, F3
family for condense), so — unlike the never-shipped `Mod-Shift-*` set
below — these are the shortcuts a Verbatim-trained user already expects.

| Shortcut | Command | Menu bar location |
| --- | --- | --- |
| `F10` | Apply Emphasis style to the selection (`applyEmphasis`) | Format → Character styles |
| `F8` | Apply Cite style to the selection (`applyCite`) | Format → Character styles |
| `F9` / `Mod-u` | Toggle Underline style (`applyUnderline` / `toggleUnderlineTyping`) | Format → Character styles |
| `F3` | Condense the document/selection to its "read" text (`condenseDefault`) | Card → Condense |
| `Alt-F3` / `Mod-Alt-F3` | Condense without paragraph integrity, with/without pilcrows (`condenseNoIntegrity*`) | Card → Condense |
| `Mod-Alt-Shift-F3` | Uncondense (`uncondense`) | Card → Condense |
| `Mod-Alt-ArrowUp` / `Mod-Alt-ArrowDown` | Move the current card/section up or down (`moveContainerUp` / `moveContainerDown`) | Edit → Editing utilities |
| `Alt-F8` | Copy the nearest preceding cite to the cursor (`copyPreviousCite`) | Edit → Editing utilities |
| `Mod-Shift-x` | Format a citation from the selection via AI (`aiCreateCite`) | AI |

`Mod` is Ctrl on Windows/Linux, Cmd on macOS. Every binding is
user-remappable in CardMirror's own keybindings editor (`settings-ui.ts`),
so the table above is the *default*, not a fixed contract.

## How the four never-shipped shortcuts map onto these

- **`Mod-Shift-E` toggle emphasis** → `F10` (`applyEmphasis`) does the
  same job against the schema's real `emphasis_mark`, with the same
  "expand to the word at a collapsed cursor" fallback the old command had.
- **`Mod-Shift-D` condense to read text** → `F3` (`condenseDefault`), plus
  three further condense variants (`Alt-F3`, `Mod-Alt-F3`,
  `Mod-Alt-Shift-F3` uncondense) the old single-command version never had.
- **`Alt-ArrowUp` / `Alt-ArrowDown` move heading section** →
  `Mod-Alt-ArrowUp` / `Mod-Alt-ArrowDown` (`moveContainerUp` /
  `moveContainerDown`) reorder the card/section the cursor is in — the
  same move, aliased in the command palette as "move section up/down".
- **`Mod-Shift-K` insert a short cite tag** has no direct one-to-one
  equivalent — CardMirror never grew a pure "format `Smith 24` and insert
  it at the cursor" command. The nearest real tools solve the same
  underlying need differently: `F8` marks already-typed text as
  cite-styled, `Alt-F8` (`copyPreviousCite`) reuses the nearest earlier
  cite instead of retyping one, and `Mod-Shift-x` (`aiCreateCite`) formats
  a full citation from a selection via the existing Anthropic proxy.
  Recorded below as the one genuine (not just doc-staleness) gap this
  audit found.

## Data flow

```
debate-editor-cardmirror/src/editor/ribbon-commands.ts
  → applyEmphasis() / applyUnderline() / applyCite()   — F10 / F9 / F8 body-mark toggles
  → condenseDefault / condenseNoIntegrity / uncondense  — F3 family, wraps condense.ts
  → copyPreviousCite()                                  — Alt-F8, findPreviousCites + computeCitePasteLocation
  → aiCreateCite (RibbonContext.aiCreateCite)            — Mod-Shift-x, calls ai/cite-creator.ts

debate-editor-cardmirror/src/editor/move-container.ts
  → moveContainerUp() / moveContainerDown()             — Mod-Alt-ArrowUp/Down

debate-editor-cardmirror/src/editor/ribbon-groups.ts     — RIBBON_GROUPS, thematic command grouping
debate-editor-cardmirror/src/react/menu-bar-categories.ts — re-buckets RIBBON_GROUPS into File/Edit/Card/Format/Insert/AI/View/Tools/Workspace/Plugins
debate-editor-cardmirror/src/react/MenuBar.tsx            — renders the top menu bar, dispatches via runRibbon(id)
debate-editor-cardmirror/src/editor/quick-card-search-ui.ts → Ctrl/Cmd-Shift-Space palette, indexes every ribbon command by label/alias
```

## Known gaps

No pure "insert a short cite tag at the cursor" command exists in the live
editor (see above) — a user who wants that exact old behavior has to pick
among `F8`, `Alt-F8`, or `Mod-Shift-x` depending on whether they're
styling existing text, reusing a prior cite, or generating one from a
selection. Not started: a literal port of the old prompt-for-author/year,
format-and-insert flow.

The old `reason-editor` (TipTap) package's `verbatim-shortcuts.ts`,
`verbatim-shortcuts-extension.ts`, and `heading-move.ts` are no longer
used anywhere in the shipped app; the package remains in the monorepo as
an un-depended-on standalone workspace package (same status
`speech-document-target.md`'s Known gaps records for its sibling
`SpeechDocumentsPanel`/`state/speechDocuments.ts`) — a future slice could
delete the package outright if nothing else is found depending on it.
