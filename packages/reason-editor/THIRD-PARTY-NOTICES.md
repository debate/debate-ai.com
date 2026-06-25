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
screen, Electron host, Learn/SRS, AI, voice, settings UI) was vendored.

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
