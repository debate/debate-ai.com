# reason-editor

The **REASON** research editor for debate-ai.com: a single
[TipTap](https://tiptap.dev/) / React editor whose schema is the
[CardMirror](https://github.com/debate/cardmirror) debate-card document
model, wired for the FIAT speech-doc panels.

It combines two things the app needs in one editor:

- **TipTap features** — a real React editor: toolbar, undo/redo, marks
  and structural headings, the whole TipTap command/extension ecosystem.
- **Debate / Verbatim features** — CardMirror's ProseMirror schema
  (pockets → hats → blocks → cards → tags/cites/body, with highlight /
  underline / emphasis marks) and lossless `.docx` (Verbatim interop) and
  `.cmir` round-trip.

## Scope

This package vendors CardMirror's **headless engine** (schema,
`.docx`/`.cmir` codecs, ProseMirror plugins) and wraps it in a fresh
React/TipTap shell built for this app. It deliberately does not vendor
CardMirror's own app shell — the multi-pane layout, ribbon toolbar,
mobile shell, Electron desktop host, Learn/SRS flashcard system, AI
assistant, or voice features. Those are CardMirror-the-application's UI
around the engine; debate-ai.com already has its own app shell (FIAT
speech-doc panels, navigation, account/AI features), so reusing
CardMirror's would mean running two competing app frameworks side by
side. The engine — the actual debate-card data model and document
fidelity — is the part that's shared and vendored here in full.

## How it fits together

```
            ┌─────────────────── reason-editor ───────────────────┐
            │                                                      │
  .docx ⇄  │  engine/  ── ProseMirror schema + import/export/native │
  .cmir    │     │                                                  │
            │     │  schema-extensions.ts  (NodeSpec/MarkSpec → TipTap)
            │     ▼                                                  │
  React app │  react/  ── one TipTap editor over that schema        │
  (FIAT)  ⇄ │            ReasonEditor + Toolbar + JSON/HTML bridge   │
            └──────────────────────────────────────────────────────┘
```

The editor's schema is generated from the very same specs the engine
uses, so node/mark names match and ProseMirror JSON round-trips
losslessly between the live editor and the `.docx`/`.cmir` codecs (see
`react/bridge.ts`).

## Usage

```tsx
import Editor, {
  EditorWithToolbar,
  EditorContent,
  LexicalEditorWrapper,
} from "reason-editor";
import type { LexicalEditorHandle } from "reason-editor";

<LexicalEditorWrapper
  content={html}
  contentKey={speechId}
  onChange={setHtml}
  title={speechId}
/>;
```

Components (all the same `ReasonEditor`, differing only in chrome):

| Export                 | Toolbar | Card import/export |
| ---------------------- | :-----: | :----------------: |
| `default` / `EditorWithToolbar` |   ✓    |         ✓          |
| `LexicalEditorWrapper` |   ✓    |         ✓          |
| `EditorContent`        |   —    |         —          |

Content is exchanged as an **HTML string** (`content` / `onChange`), the
same contract the app's speech-doc panels already used. The imperative
handle (`ref`) additionally exposes `importDocx` / `exportDocx` /
`importCmir` / `exportCmir` and the underlying TipTap `editor`.

The headless engine is available without React at:

```ts
import { schema, fromDocx, toDocx, parseNative, serializeNative } from "reason-editor/engine";
```

## Styling

`reason-editor` auto-imports `styles.css` (scoped to `.reason-editor`).
Override the `--pmd-*` CSS variables on `.reason-editor` to retheme.

## License

This package vendors the CardMirror engine, which is under the
**PolyForm Noncommercial License 1.0.0**. See
[`LICENSE`](./LICENSE) and [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md).
`reason-editor` inherits the noncommercial restriction.
