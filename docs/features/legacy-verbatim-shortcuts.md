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
Verbatim-parity command set that predates this doc and makes three of the
four shortcuts above redundant rather than missing. This doc previously
described the dead package as if it were live; it now documents
CardMirror's real, shipped equivalents, closing the staleness flagged in
`speech-document-target.md`'s Known gaps. The fourth (`Mod-Shift-K`) had no
CardMirror equivalent at all until `insertShortCite` closed that gap (see
below) — TODO.md's Product Feature Ideas item 14's own bullet for it.

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
| `Mod-Shift-k` | Prompt for an author/year and insert a formatted short cite tag at the cursor (`insertShortCite`) | Edit → Editing utilities |
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
- **`Mod-Shift-K` insert a short cite tag** → `Mod-Shift-k`
  (`insertShortCite`) is a direct port: prompts for an author last name
  and a year (two sequential `promptForText` dialogs — the modal
  vocabulary every other prompt-driven CardMirror command already uses,
  in place of `reason-editor`'s old `window.prompt` calls, which Electron
  disables outright), then inserts the formatted "Smith 24" / "Smith ND"
  tag at the cursor with `cite_mark` applied — reusing
  `debate-card-parser`'s `formatShortCiteTag`, the same pure formatter
  the old command called. Distinct from the three tools that solve an
  adjacent need: `F8` marks already-typed text as cite-styled, `Alt-F8`
  (`copyPreviousCite`) reuses the nearest earlier cite instead of
  retyping one, and `Mod-Shift-x` (`aiCreateCite`) formats a full
  citation from a selection via the existing Anthropic proxy.

## Data flow

```
debate-editor-cardmirror/src/editor/ribbon-commands.ts
  → applyEmphasis() / applyUnderline() / applyCite()   — F10 / F9 / F8 body-mark toggles
  → condenseDefault / condenseNoIntegrity / uncondense  — F3 family, wraps condense.ts
  → copyPreviousCite()                                  — Alt-F8, findPreviousCites + computeCitePasteLocation
  → insertShortCite (RibbonContext.insertShortCite)      — Mod-Shift-k, calls insert-short-cite.ts
  → aiCreateCite (RibbonContext.aiCreateCite)            — Mod-Shift-x, calls ai/cite-creator.ts

debate-editor-cardmirror/src/editor/insert-short-cite.ts
  → runInsertShortCite() / buildInsertShortCiteTransaction() — prompts via text-prompt.ts,
    formats via debate-card-parser's formatShortCiteTag

debate-editor-cardmirror/src/editor/move-container.ts
  → moveContainerUp() / moveContainerDown()             — Mod-Alt-ArrowUp/Down

debate-editor-cardmirror/src/editor/ribbon-groups.ts     — RIBBON_GROUPS, thematic command grouping
debate-editor-cardmirror/src/react/menu-bar-categories.ts — re-buckets RIBBON_GROUPS into File/Edit/Card/Format/Insert/AI/View/Tools/Workspace/Plugins
debate-editor-cardmirror/src/react/MenuBar.tsx            — renders the top menu bar, dispatches via runRibbon(id)
debate-editor-cardmirror/src/editor/quick-card-search-ui.ts → Ctrl/Cmd-Shift-Space palette, indexes every ribbon command by label/alias
```

## Known gaps

`insertShortCite` prompts with two sequential single-field dialogs
(author, then year) rather than one combined author+year form — matching
`text-prompt.ts`'s existing `promptForText` shape rather than adding a new
two-field dialog component for this one command. A user who cancels the
year prompt after already typing an author gets nothing inserted (by
design — either both fields commit or neither does), so they re-run the
command rather than only being asked for the year again.

The old `reason-editor` (TipTap) package's `verbatim-shortcuts.ts`,
`verbatim-shortcuts-extension.ts`, and `heading-move.ts` are no longer
used anywhere in the shipped app; the package remains in the monorepo as
an un-depended-on standalone workspace package (same status
`speech-document-target.md`'s Known gaps records for its sibling
`SpeechDocumentsPanel`/`state/speechDocuments.ts`) — a future slice could
delete the package outright if nothing else is found depending on it.
