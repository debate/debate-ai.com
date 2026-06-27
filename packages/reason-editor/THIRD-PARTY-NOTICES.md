# Third-Party Notices — reason-editor

This package vendors and builds on third-party materials. Each is used
under its own license, summarized below.

---

## CardMirror (engine)

Everything under [`src/engine/`](./src/engine) — the ProseMirror schema
(the debate-card document model), the `.docx` importer/exporter
(Verbatim interoperability), the `.cmir` native format, the OOXML
layer, and the supporting comment / normalizer / transaction utilities —
is vendored from **CardMirror** by Anthony Trufanov
(<https://github.com/ant981228/cardmirror>, mirrored at
<https://github.com/debate/cardmirror>).

CardMirror is licensed under the **PolyForm Noncommercial License
1.0.0**. The full text is in [`LICENSE`](./LICENSE); the canonical
version lives at
<https://polyformproject.org/licenses/noncommercial/1.0.0/>.

> **Required Notice:** Copyright (c) 2026 Anthony Trufanov. CardMirror is
> built on ProseMirror (<https://prosemirror.net/>), the rich-text editor
> framework by Marijn Haverbeke (<https://marijnhaverbeke.nl/>), used
> under the MIT License.

> ⚠️ **License boundary.** The PolyForm Noncommercial License permits use
> only for noncommercial purposes. Because the vendored engine governs
> the licensing of this package, `reason-editor` inherits that
> noncommercial restriction. Keep this in mind before using it in a
> commercial context; if commercial use is intended, obtain a separate
> grant from the CardMirror author or replace the engine.

### Local modifications

The engine source is used essentially verbatim. The only changes are
mechanical, to make the headless core build standalone outside the
CardMirror app:

- Files were relocated from `cardmirror/src/{schema,import,export,native,
  ooxml}` and `cardmirror/src/docid.ts` into `src/engine/`.
- Three editor-layer support modules the core depends on
  (`comments-plugin.ts`, `named-style-normalizer-plugin.ts`,
  `transaction-utils.ts`) were vendored alongside the core, and the
  corresponding `../editor/…` import specifiers were rewritten to point
  at their new locations.
- A new `src/engine/index.ts` re-exports the same public surface as
  CardMirror's original `src/index.ts`, plus the comment-thread types.

No application chrome (multi-pane shell, ribbon, mobile shell, home
screen, Electron host, Learn/SRS, voice, settings UI) was vendored. The
AI features (cite formatting, OCR/PDF text repair, image alt text,
explain) WERE ported in a reduced form — see the next section.

---

## CardMirror (AI features)

[`src/react/ai/`](./src/react/ai) ports four of CardMirror's AI-powered
editing commands — cite formatting (`cite-creator.ts`), OCR/PDF text
repair (`repair-text.ts`), image alt-text generation
(`image-alt-text.ts`), and a research-coach "explain" command
(`explain.ts`) — adapted from CardMirror's `src/editor/ai/` modules
(same author and license as above).

Unlike the engine, these are NOT used verbatim: CardMirror's AI
features are written against app infrastructure that doesn't exist in
`reason-editor` — a `settings` store holding a user-pasted Anthropic API
key, `toast` notifications, an `AiActivity` loading overlay, an
edit-coordinator region-lease system for concurrency safety, a
repair-highlight flash plugin, and `promptForChoice` dialogs. Each
ported module keeps CardMirror's pure algorithmic core (prompt text,
response parsing, ProseMirror transaction-building) and replaces the
surrounding infrastructure with reason-editor equivalents:

- API access: CardMirror calls Anthropic directly from the browser with
  a user-supplied key (a single-user desktop-app pattern). Because
  debate-ai.com is multi-tenant, `anthropic-client.ts` instead posts to
  a server-side proxy route (`/api/reason-ai` in the host app) that
  holds one shared key, gated on an authenticated session and capped on
  request size / token usage.
- Concurrency safety: instead of CardMirror's edit-coordinator region
  lease (which keeps an AI op anchored to its target even as the doc
  shifts elsewhere mid-request), each v1 command snapshots the text it's
  about to touch and re-checks it's unchanged immediately before
  applying, refusing the edit otherwise.
- UI: toasts/dialogs/loading overlays are replaced with `window.alert` /
  `window.confirm` / `window.prompt`, wired up in `Toolbar.tsx`'s
  "AI Cite" / "AI Repair" / "AI Explain" / "AI Alt Text" buttons (shown
  when the host passes `showAiTools`).
- Repair text runs a single pass (CardMirror runs two, to catch
  single-read misses) and skips the flash-highlight animation; the
  matching/locating algorithm itself (verbatim search → folded-character
  fallback → trimmed-context last resort) is unchanged.
- Image alt-text omits CardMirror's table-from-image extraction
  (`runGenerateTable`) — a separate, sizeable feature (JSON table
  schema, two-pass repair prompt, building a real table/row/cell tree)
  not needed for alt-text parity. The omission-bracket style is
  hardcoded to `[...]` rather than following a per-document delimiter
  setting reason-editor doesn't have.
- Explain answers a single question against the current selection and
  returns plain text to the caller, rather than posting into a
  comment-thread UI with `@AI`-mention follow-ups — reason-editor has no
  comments panel yet.

---

## ProseMirror

The editing core is [ProseMirror](https://prosemirror.net/) by Marijn
Haverbeke, used under the **MIT License** (via the `prosemirror-*`
packages and `@tiptap/pm`).

---

## TipTap

The React editor shell is built with [TipTap](https://tiptap.dev/)
(`@tiptap/core`, `@tiptap/react`, `@tiptap/pm`), used under the **MIT
License**.
