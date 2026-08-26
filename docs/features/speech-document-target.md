# Speech Documents — a history of what CardMirror actually sent

`/speech-documents` shows a durable, listable history of everything the
live Reason Editor has sent into a designated "speech doc" pane — closing a
disconnect found by a "make sure every tool is well-integrated in the live
UI" audit: this page (and its own `/tools` card) described `Mod-Shift-S` /
a "→Speech" toolbar button sending text into a persisted, find-or-create-by-
title `SpeechDocument` record. That was true of the *prior*, TipTap-based
`reason-editor` package. `/reason-editor` now renders `debate-editor`'s
shim to `debate-editor-cardmirror` — the ported-in CardMirror ProseMirror
engine that replaced it (see that package's `src/index.tsx`) — whose
send-to-speech feature works completely differently (below), and never
wrote to the old package's store. Following the old UI copy in the live
app did nothing: the page was permanently empty no matter what a user did
in `/reason-editor`.

- **Route:** `/speech-documents` (view/manage history) — send from any
  CardMirror document (e.g. `/reason-editor`)
- **Package:** [`debate-editor-cardmirror`](../../packages/debate-editor-cardmirror)
  (the send mechanism and its history log); `apps/debate-ai.com/app/speech-documents`
  (the page)
- **Nav:** the Tools page's Prep & Practice group; the Reason Editor's
  Workspace menu (`t speech documents` in Ctrl/Cmd-Shift-Space's command
  palette)

## How sending actually works in the live editor

CardMirror's speech-doc feature is a **pane-designation** model, not a
named-document registry — there is no "create a speech document" dialog to
fill out a title into. Instead:

1. **Mark a pane as the speech doc** — File menu → Speech → "Mark /
   Unmark Active Doc as the Speech Doc" (`speech-doc-registry.ts`), or
   "New Speech Document" to start a fresh one already marked. (These
   commands also have a dedicated toolbar row, `#speech-stack`, but it's
   CSS-gated to CardMirror's multi-pane/multi-window shells — the plain
   single-doc `/reason-editor` route reaches them through the File menu
   instead.)
2. From any *other* open document, **send** the current selection (or,
   with no selection, the card/section the cursor is in) with the
   backtick key (` at cursor) or Alt-backtick (at the doc's end) —
   `speech-doc-send.ts`'s `sendToSpeech`. A live ProseMirror slice is
   inserted directly into the designated pane's document — same-window,
   or cross-tab via `BroadcastChannel` + a shared `localStorage` uid
   (`pmd-speech-uid`) when the speech doc is open in another tab.
3. **Select which pane is the speech doc** — File menu → Speech →
   "Select Speech Document," when more than one candidate is open.

The speech doc IS just an ordinary open Reason document — CardMirror keeps
no separate copy of it. That model has no natural "list every speech
document" view: asking it to enumerate documents makes no more sense than
asking `/reason-editor`'s own sidebar to.

## What this page actually shows

What the pane model *is* missing is a durable, glanceable record of what
got sent, independent of whichever pane happens to be open right now —
so rather than resurrecting a rival document-record concept, `/speech-
documents` shows exactly that: a **send log**, not a document list.

`insertSpeechSlice` (`speech-doc-send.ts`) is the single call point shared
by an in-window send, a cross-tab receive, and (were Electron wired up) a
cross-window receive, so recording there — right after a successful
dispatch — captures every path exactly once, with no separate "did this
already get logged" tracking needed. It logs the plain text of what
actually landed (from the same `rewritten` slice that gets inserted), not
a second copy of the document.

## Data flow

```
debate-editor-cardmirror/src/editor/speech-doc-registry.ts
  → getSpeechDocResolver() — designates one open pane's uid as the speech doc

debate-editor-cardmirror/src/editor/speech-doc-send.ts
  → sendToSpeech(view, atEnd)     — ` / Alt-` keys, ribbon buttons
  → insertSpeechSlice(...)        — shared landing path (in-window / cross-tab / Electron)
      → buildSpeechSendLogEntry(text, atEnd, id, sentAt)  — pure, null for blank text
      → speechSendLogStore.add(entry)                     — records the send

debate-editor-cardmirror/src/editor/speech-send-log.ts   (IndexedDB, "speech-send-log")
  → buildSpeechSendPreview / buildSpeechSendLogEntry      — pure
  → appendSpeechSendLogEntry / removeSpeechSendLogEntry   — pure, cap MAX_SPEECH_SEND_LOG_ENTRIES
  → sanitizeSpeechSendLog                                 — pure, tolerates malformed persisted data
  → speechSendLogStore                                    — WebSharedStore-backed, cross-tab synced

debate-editor-cardmirror's `/engine` entry point re-exports the above —
no ProseMirror or React in this module, so a plain page component can
import it without pulling in the editor bundle.

apps/debate-ai.com/app/speech-documents/SpeechSendLogPanel.tsx
  → reads/subscribes to speechSendLogStore, newest first
  → per-entry Remove, and a Clear history action
apps/debate-ai.com/app/speech-documents/page.tsx → mounts the panel
```

## Known gaps

The old `reason-editor` (TipTap) package's `SpeechDocumentsPanel` /
`state/speechDocuments.ts` find-or-create-by-title store is no longer used
anywhere in the app (`apps/debate-ai.com/package.json`'s `reason-editor`
dependency was dropped along with the only import of it) — the package
itself still exists in the monorepo as a standalone workspace package, not
yet deleted outright; a future slice could remove it entirely if nothing
else is found depending on it.

Out of scope for this slice (not started): grouping send-log entries by
which document they landed in (today's log is one global history, not
per-speech-doc — CardMirror's session uids aren't stable across reloads,
so there's no persisted "document identity" to group by yet), and
exporting the log as a read-ready script/`.docx`.

`legacy-verbatim-shortcuts.md` had the same "describes the old
`reason-editor` package as if it were live at `/reason-editor`" staleness
this doc had — out of scope for this slice (this one's gap was
specifically the speech-doc send target) — and has since been corrected
in its own slice to document CardMirror's real, live shortcut set.
