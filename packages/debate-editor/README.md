# debate-editor

CardMirror-based debate-card editor embedded in debate-ai.com. The package exposes the
ProseMirror engine, Verbatim `.docx` interop helpers, and React editor shell used by the
site's speech-doc and reason-editor surfaces.

## CardMirror features

CardMirror packs roughly 500 editing commands into ~30 thematic groups (see
[`src/editor/ribbon-groups.ts`](./src/editor/ribbon-groups.ts), the single source of truth
shared by the in-app Keyboard Shortcuts reference and the Settings → Keybindings editor).
The list below groups the same command set into feature highlights — 50+ in total.

### Document model

- **Structured outline** — pockets, hats, blocks, tags, cards, analytics, and undertags as
  first-class node types for organizing a debate case
- **Footnotes** with plain-text rendering for export and read-only tooling
- **Tables** as full ProseMirror nodes, not just pasted HTML
- **Live zones** — transcluded content that mirrors and can refresh from another document
- **Deterministic heading IDs** and Word-bookmark-compatible anchors for stable cross-document links
- **Versioned schema migration** so documents saved by older builds upgrade safely
- **Paste/drop integrity checks** ("slice check") that reject content that would corrupt the schema

### File formats & interop

- **Lossless Verbatim `.docx` round-trip** — import and export Word documents (styles,
  numbering, comments, footnotes) without losing fidelity
- **Native `.cmir` format** — a gzip-compressed native save format with no `.docx` round-trip needed
- **Encrypted `.docx` decryption** (AES + SHA-512 per the OOXML spec) so password-protected Word files still open
- **Damaged-file salvage** for corrupted `.cmir` documents, plus a dedicated doc-repair pass for common structural issues
- **Bulk document conversion** and **bulk compression** commands
- **Automatic `.docx` style cleanup** on import/save
- **`cardmirror-read`** — a headless CLI, MCP server, and mirror-mode tool giving AI
  assistants and scripts read-only JSON or markdown-flavored text access to `.cmir`/`.docx`
  files without opening the app

### Speech documents

- **Mark any open document as the speech doc** — the live send target
- **Send to speech doc at cursor or at document end**, each with its own keyboard shortcut
- **Speech-send history log** (capped, sanitized) viewable on `/speech-documents`
- **Speech-doc banner** so the active send target is always visible

### Dropzone & card exchange

- **Send to dropzone** or to a starred/favorites list
- **Insert received cards** at the cursor or at the document end

### Real-time collaboration

- **Start or join a live collaboration session**, CRDT-backed via [Loro](https://loro.dev)
- **Share codes and invite links**, plus direct invites to starred contacts
- **End a session** and **recover a previous version** after conflicting edits

### Quick Cards

- **Add a quick card** from the current selection
- **Manage, tag-filter, and search** quick cards from the command bar

### Structural & character styling

- **One-click structural styles** — Pocket, Hat, Block, Tag, Analytic, Undertag
- **Citation, underline, and emphasis marks**, including acronym-aware variants
- **Highlight and shading colors** with live pickers, standardization commands, and a paintbrush mode
- **Font color and font size pickers** with keyboard step controls
- **Highlight locking** to protect finished color-coding from accidental edits
- **Standard inline formatting** — bold, italic, strikethrough, superscript, subscript

### Card numbering

- **Number a card's role**, mark it as **substructure** (a, b, c…), **restart numbering**
  at a point, and **toggle number visibility**

### Condensing

- **Multiple condense modes** — default, no-integrity, no-integrity-with-pilcrows, with-warning — plus **uncondense**
- **Case toggle** and **paragraph-integrity toggle** for cleanup after condensing

### Editing utilities

- **Paste as plain text** or **paste-condensed**
- **Shrink, smart-shrink, and regrow** text to fit
- **Copy the previous citation**, **insert a short cite**, or **create a cross-document reference**
- **Extract an undertag** into its own block
- **Insert images, footnotes, and live zones** — with refresh-one, refresh-all, source-check, and detach commands
- **Select, delete, or copy** the current heading's whole section
- **Move a container up or down** in the document
- **Flip a quotation's direction** (curly-quote orientation)

### Find, search & select

- **Find**, **find & replace**, and **find by proximity**
- **Unified command-bar search** across cards, the dropzone, commands, settings, and files
  (a `t`-prefix jumps straight to any of ~50 other site tools)
- **Select-similar** to grab every run sharing the same formatting

### View & navigation

- **Read mode**, a collapsible **navigation pane**, and a **morph mode** view
- **Word count for the current selection**, with a read-aloud time estimate
- **Theme cycling**, an in-app **UI tour**, and a full **keyboard-shortcuts reference** modal
- **Heading breadcrumb bar** showing the current outline position

### Timers

- **Timer panel** with start/pause, three configurable presets, and one-key cycling
- Dedicated **Aff-prep** and **Neg-prep** timers with reset

### Zoom & scale

- **Independent document zoom** and **chrome (UI) scale** controls, each with its own reset

### Comments & notes

- **Threaded comments** on a selection, shown in a dedicated comments column
- **Private notes** visible only to their author

### Multi-pane workspace

- **Up to three focusable document slots** side by side
- **Send the active document to any slot**, expand a slot, and cycle or close open documents

### AI tools

- **Ask AI about the current selection**
- **AI-generated citations**, with a bulk "reformat all cites" pass
- **Translate** selected text
- **AI-assisted repair** of garbled text or formatting

### Flow integration

- **Send a card, or a whole heading's cards, to a Flow column or a specific Flow cell**
- **Pull content back from Flow** into the document
- **Create a new Flow** or **start a Flow host session** directly from the editor

### Voice, reading & learning

- **Voice dictation toggle**
- **Reading-marker mode** for tracking place while reading a card aloud
- **Flashcards** — create from a selection, manage the deck, and review due cards with spaced repetition

### Card Cutter

- **In-editor card cutter panel** with guidance, plus adding page context for cutting from a live source

### Cleanup tools

- **Convert analytics to tags** (optionally cited-only)
- **Fix formatting gaps** and **repair broken paragraph integrity** in bulk
- **Remove stray hyperlinks**

### Tables

- **Insert a table**; add/delete rows and columns; merge or split cells; delete the whole table

### Extensibility & chrome

- **Runtime plugin registry** — third-party commands surface automatically in their own
  Plugins menu section and in the command palette
- **12-category menu bar** (File, Speech, Card, Edit, Format, Color, Insert, AI, View,
  Panes, Tools, Flow, Workspace, Plugins) bucketing all ~500 ribbon commands for a compact
  embedded panel
- **Workspace menu** linking out to roughly 50 other app tools and pages
- **Customizable keybindings editor**, grouped by the same ~30 thematic command groups as
  the shortcuts reference
- **Per-user preferences** (general, appearance, accessibility) synced through the site's account settings
- **Autosave with journal-based crash recovery**, and a full **undo/redo** stack
- **CardMirror Lite** — a no-AI, no-network build variant for school environments with strict vendor-audit requirements
- **Legacy Verbatim keyboard-shortcut compatibility mode**
- **Runs identically inside the native desktop/mobile wrapper** ([Tauri](https://tauri.app)) — same editor, no browser chrome

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

```
debate-editor/
├── src/              # ProseMirror/CardMirror editor engine and React shell
└── test/             # Vitest suites for editor data-model helpers
```

## Tests

```bash
bun run test        # or: npx vitest run
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is merged
at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.

Current Codecov package coverage on `master` at commit `50322f5` is **1.75%** (tracked under
the `debate-editor` flag).
