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

## AI tools

Pass `showAiTools` to add four AI-powered buttons to the toolbar:

- **AI Cite** — reformats the selected raw citation info (URL, byline,
  abstract, …) into a debate-style cite and applies cite-mark
  highlighting to the author/date.
- **AI Repair** — fixes OCR/PDF text-extraction errors (ligatures,
  stray line breaks, fused/split words) in the selection, leaving
  everything else untouched.
- **AI Explain** — asks a research-coach question about the selection;
  answers point to relevant authors/concepts rather than the
  substantive answer outright.
- **AI Alt Text** — generates alt text for a selected image and inserts
  it as a bracketed `[ALT TEXT: …]` paragraph below it.

```tsx
<LexicalEditorWrapper content={html} onChange={setHtml} showAiTools />
```

These call a relative `/api/reason-ai` endpoint by default; the host
app must mount a server-side proxy route there that holds an
`ANTHROPIC_API_KEY` and forwards to the Anthropic Messages API (see
`apps/debate-ai.com/app/api/reason-ai/route.ts` for the reference
implementation — it gates on an authenticated session and caps request
size / token usage). Point at a different path with
`configureReasonAi({ endpoint })` from `reason-editor/ai` if the host
mounts it elsewhere. See
[`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md) for how these
commands relate to CardMirror's upstream AI features and what's
simplified or omitted in this v1 port.

## Styling

`reason-editor` auto-imports `styles.css` (scoped to `.reason-editor`).
Override the `--pmd-*` CSS variables on `.reason-editor` to retheme.

## License

This package vendors the CardMirror engine, which is under the
**PolyForm Noncommercial License 1.0.0**. See
[`LICENSE`](./LICENSE) and [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md).
`reason-editor` inherits the noncommercial restriction.
