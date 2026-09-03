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
depended on by the app. `/reason-editor` renders `debate-editor` (the
ported-in CardMirror ProseMirror engine, formerly published as the
`debate-editor-cardmirror` workspace package),
which was built with — and ships — its own, considerably larger native
Verbatim-parity command set that predates this doc and makes three of the
four shortcuts above redundant rather than missing. This doc previously
described the dead package as if it were live; it now documents
CardMirror's real, shipped equivalents, closing the staleness flagged in
`speech-document-target.md`'s Known gaps. The fourth (`Mod-Shift-K`) had no
CardMirror equivalent at all until `insertShortCite` closed that gap (see
below) — TODO.md's Product Feature Ideas item 14's own bullet for it.

- **Route:** any CardMirror document (e.g. `/reason-editor`)
- **Package:** [`debate-editor`](../../packages/debate-editor)
  — `src/editor/ribbon-commands.ts` (command implementations and default
  keybindings), `src/editor/move-container.ts`, `src/editor/condense.ts`
- **Nav:** every command below is reachable three ways — its default
  keybinding, the `MenuBar.tsx` top bar (Format/Card/Edit/AI dropdowns,
  per the table), and by typing its name or an alias into
  Ctrl/Cmd-Shift-Space's command palette (`quick-card-search-ui.ts` also
  indexes every ribbon command, not just the `t`-prefixed Workspace links)
- The shortcuts reference itself (`openShortcutsReference`, Help menu /
  `reference-btn` / `?`-free command palette entry) now has **Print** and
  **Export…** actions in its header alongside search — see "Printable and
  exportable reference" below.

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

## Printable and exportable reference

Idea #14's tracked follow-up ("a printable/exportable version of the
shortcuts reference, since today it's view-only inside the editor") is
now closed. The reference modal's header (`reference-ui.ts`) carries two
new actions next to the search box, both built from the same
`collectGroups()` snapshot the on-screen list renders from — so the
printed/exported copy always matches exactly what's on screen (current
key overrides, available commands only, plugin section included when any
plugin has registered commands):

- **Print** builds a full, un-filtered copy of the reference (ignores
  any active search) into a `.pmd-reference-print-root` node appended to
  `<body>`, then calls `window.print()`. The node is kept in the render
  tree but pushed off-screen (`position: absolute; left: -9999px`) so it
  never appears during normal use; a `@media print` block in `style.css`
  hides everything else in the document via the standard
  `body * { visibility: hidden }` / re-reveal-the-target-subtree trick
  rather than naming CardMirror's own containers, since CardMirror can
  either own the whole page or be embedded inside a host panel. The node
  is removed again on `afterprint` (with a 5s timeout backstop for hosts
  that never fire it).
- **Export…** saves the same data as a `cardmirror-shortcuts.txt` file
  through `getHost().saveAs()` — the identical native-picker-or-download
  path Settings → "Export settings…" already uses, so it works the same
  way across the browser-tab, PWA, and Electron hosts.

The plain-text formatting itself (`reference-export.ts`'s
`formatShortcutsReferenceText`) is a pure function decoupled from the DOM
so it's covered directly by `test/reference-export.test.ts`, independent
of the modal's DOM-building/overlay-lifecycle code.

## Verbatim onboarding nudge

Idea #14's other tracked follow-up — "an in-app onboarding nudge (e.g.
from `ui-tour.ts`) pointing a Verbatim-trained user at the reference the
first time they open a CardMirror document" — is now closed too. The
existing UI tour (`ui-tour.ts`) already has its own "reference" step, but
it only reaches a fresh profile that lets the whole tour run, and it
never reaches an established profile at all: `maybeAutoStartUiTour`
marks any profile with customized settings as already-seen without
touring it. `verbatim-nudge.ts` fills exactly that gap with a one-time,
lightweight dialog (`promptForRouteChoice`, not another coach-mark
overlay) pointing at the shortcuts reference — for whoever the tour
doesn't walk through it: an established profile it auto-skips, or a
fresh one that started the tour and left (Esc, closed the tab) before
reaching the reference step.

- `shouldShowVerbatimNudge` (pure, directly tested) says yes once
  `hasSeenUiTour` is set — stamped the instant a tour *starts*, whether
  it's a real run or an established-profile auto-skip — and the
  reference hasn't already been opened by any route. It says no before
  that: a genuinely fresh profile still hasn't been offered the tour, so
  its own reference step gets first crack rather than being raced.
- `maybeShowVerbatimNudge` polls every 2s (up to ~5 minutes) rather than
  firing once on a timer, because `hasSeenUiTour` flips true the moment
  a tour *starts*, not when it *finishes* — a fixed delay could still
  land while a real tour is mid-run. Each tick also checks the new
  `ui-tour.ts#isUiTourRunning`, so the nudge waits out an in-progress
  tour instead of popping its dialog on top of it.
- `reference-ui.ts#openReference` stamps the new
  `hasOpenedShortcutsReference` setting the moment it's actually called
  — button, tour step, palette, or menu — so the nudge never re-asks
  once the reference has been found by any path.
- Wired in from `index.ts` next to `maybeAutoStartUiTour`, same
  desktop-only gate (the mobile UI has no ribbon reference button to
  point at).
- `hasSeenUiTour`'s existing `hasCustomizedSettings` ignore list grew the
  two new settings keys (`hasOpenedShortcutsReference`,
  `hasSeenVerbatimNudge`) so neither auto-set flag itself counts as
  "customization" — that would otherwise mark a genuinely fresh profile
  as established and skip its tour.
- Accepting the nudge ("Open the shortcuts reference") opens the same
  modal as every other entry point; "Not now" (or Esc) dismisses for
  good — there is no snooze/re-ask.

## Data flow

```
debate-editor/src/editor/ribbon-commands.ts
  → applyEmphasis() / applyUnderline() / applyCite()   — F10 / F9 / F8 body-mark toggles
  → condenseDefault / condenseNoIntegrity / uncondense  — F3 family, wraps condense.ts
  → copyPreviousCite()                                  — Alt-F8, findPreviousCites + computeCitePasteLocation
  → insertShortCite (RibbonContext.insertShortCite)      — Mod-Shift-k, calls insert-short-cite.ts
  → aiCreateCite (RibbonContext.aiCreateCite)            — Mod-Shift-x, calls ai/cite-creator.ts

debate-editor/src/editor/insert-short-cite.ts
  → runInsertShortCite() / buildInsertShortCiteTransaction() — prompts via text-prompt.ts,
    formats via debate-card-parser's formatShortCiteTag

debate-editor/src/editor/move-container.ts
  → moveContainerUp() / moveContainerDown()             — Mod-Alt-ArrowUp/Down

debate-editor/src/editor/ribbon-groups.ts     — RIBBON_GROUPS, thematic command grouping
debate-editor/src/react/menu-bar-categories.ts — re-buckets RIBBON_GROUPS into File/Edit/Card/Format/Insert/AI/View/Tools/Workspace/Plugins
debate-editor/src/react/MenuBar.tsx            — renders the top menu bar, dispatches via runRibbon(id)
debate-editor/src/editor/quick-card-search-ui.ts → Ctrl/Cmd-Shift-Space palette, indexes every ribbon command by label/alias

debate-editor/src/editor/reference-ui.ts        — openShortcutsReference's modal; collectGroups()
                                                               is the shared data source for the on-screen list,
                                                               print(), and exportAsText(); stamps
                                                               hasOpenedShortcutsReference on open
debate-editor/src/editor/reference-export.ts    — formatShortcutsReferenceText(), the pure
                                                               plain-text renderer used by exportAsText()

debate-editor/src/editor/verbatim-nudge.ts       — maybeShowVerbatimNudge(), wired from index.ts;
                                                               shouldShowVerbatimNudge() is the pure trigger check
debate-editor/src/editor/ui-tour.ts              — isUiTourRunning(), polled so the nudge never
                                                               stacks on top of an in-progress tour
```

## Known gaps

`insertShortCite` prompts with two sequential single-field dialogs
(author, then year) rather than one combined author+year form — matching
`text-prompt.ts`'s existing `promptForText` shape rather than adding a new
two-field dialog component for this one command. A user who cancels the
year prompt after already typing an author gets nothing inserted (by
design — either both fields commit or neither does), so they re-run the
command rather than only being asked for the year again.

Print and Export always render the full reference — neither respects the
modal's own search filter. Given the point of printing/exporting a
reference is usually to have the whole thing on hand, this is treated as
the right default rather than a gap, but a future run could add a "only
matching rows" toggle if that turns out to be wanted.

The Verbatim onboarding nudge has no "remind me later" — Not now/Esc marks
it seen for good, matching `hasSeenUiTour`'s own one-shot convention rather
than adding a new re-ask/snooze mechanic for a single low-stakes dialog.
It also can't actually detect that a visitor is Verbatim-trained (there's
no such signal anywhere in the app); it's addressed at the population most
likely to be, phrased for them, but shown to every profile that meets the
trigger condition.

The old `reason-editor` (TipTap) package's `verbatim-shortcuts.ts`,
`verbatim-shortcuts-extension.ts`, and `heading-move.ts` are no longer
used anywhere in the shipped app; the package remains in the monorepo as
an un-depended-on standalone workspace package (same status
`speech-document-target.md`'s Known gaps records for its sibling
`SpeechDocumentsPanel`/`state/speechDocuments.ts`) — a future slice could
delete the package outright if nothing else is found depending on it.
