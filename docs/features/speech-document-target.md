# Legacy Verbatim / Cardmirror Compatibility — send-to-speech-document command

Gives `reason-editor` a real "speech document" send target and wires a
"send selected evidence" command into the live editor — closing follow-up
(b) under idea #14 ("Legacy Verbatim / Cardmirror Compatibility") in
`TODO.md`'s Product Feature Ideas list: "a 'send selected evidence to a
speech document' command", the last open gap noted in
[`legacy-verbatim-shortcuts.md`](./legacy-verbatim-shortcuts.md#known-gaps).

- **Route:** `/speech-documents` (view/manage) — send from any
  `reason-editor` document (e.g. `/reason-editor`)
- **Package:** [`reason-editor`](../../packages/reason-editor/README.md)
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t speech documents` in Ctrl/Cmd-Shift-Space's command
  palette)

## What a "speech document" is

A `SpeechDocument` is a lightweight, ordered collection of evidence
`SpeechDocumentBlock`s a debater has sent from a source document (a card,
a research note, a condensed "read" selection) toward the speech they're
building — a staging area, not a replacement for the full CardMirror
document model, and not the same thing as the app's separate, DB-backed
`/api/doc/documents` document store used by `/reason-editor` and `/doc`.
Each block records its trimmed text, when it was added, and (optionally)
a `sourceLabel` — the document it was sent from.

## Sending a selection

- **Keyboard shortcut:** `Mod-Shift-S` with a text selection active.
- **Toolbar button:** "→Speech".

Both call `sendSelectionToSpeechDocumentViaPrompt`, which:

1. Reads the selected text (`editor.state.doc.textBetween`); a blank
   selection is a no-op.
2. Prompts for a target document title.
3. Finds an existing speech document with a matching title
   (case-insensitive) or creates one, appends the selection as a new
   block (tagged with the editor's `exportName` as `sourceLabel`), and
   persists the result.
4. Confirms with a short alert (`Sent to speech document "<title>" (<n>
   blocks).`) — the result isn't otherwise visible from the editor.

`Mod` is Ctrl on Windows/Linux, Cmd on macOS.

## Viewing and managing speech documents

`SpeechDocumentsPanel` (mounted at `/speech-documents`) lists every
persisted speech document, its blocks (with source label and a per-block
"Remove" action), a plain-text preview (`buildSpeechDocumentText` — blocks
joined by a blank line, each prefixed `[source]` when tagged), and a
per-document "Delete" action.

## Data flow

```
reason-editor/src/engine/speech-document.ts
  → createSpeechDocument(id, title)
  → buildSpeechDocumentBlock(id, text, addedAt, sourceLabel?)  — null for blank text
  → appendSpeechDocumentBlock(doc, block)   — pure
  → removeSpeechDocumentBlock(doc, blockId) — pure
  → buildSpeechDocumentText(doc)            — plain-text render

reason-editor/src/state/speechDocuments.ts   (localStorage, "reasonEditorSpeechDocuments")
  → listSpeechDocuments / getSpeechDocument / findSpeechDocumentByTitle
  → saveSpeechDocument / deleteSpeechDocument / removeSpeechDocumentBlockAndSave
  → sendSelectionToSpeechDocument(title, text, sourceLabel, idFactory, now)
      — find-or-create by title, then build+append+save a block

reason-editor/src/react/verbatim-shortcuts-extension.ts
  → sendSelectionToSpeechDocumentViaPrompt(editor, sourceLabel?)
      — the Mod-Shift-S handler + "→Speech" toolbar action

reason-editor/src/react/Toolbar.tsx        → "→Speech" button
reason-editor/src/react/SpeechDocumentsPanel.tsx → the panel above
apps/debate-ai.com/app/speech-documents/page.tsx → mounts the panel
```

## Known gaps

None open on idea #14 — this closes its last named follow-up. Out of
scope for this slice (not started): exporting a speech document as a
read-ready script/`.docx`, and wiring it into the app's DB-backed document
store instead of localStorage.
