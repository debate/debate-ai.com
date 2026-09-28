# Third-Party Notices

Debate AI (debate-ai.com) is licensed under the terms in [`LICENSE.md`](LICENSE.md).
It incorporates source code from the third-party projects below, each of which
remains under its own license. Those licenses govern the incorporated code, not
the PROSPER license.

| Project | Where it lives here | License |
| --- | --- | --- |
| [Tabroom.com](#tabroomcom) | `packages/debate-tournaments/vendor/tabroom` | Reciprocal Public License 1.5 (RPL-1.5) |
| [CardMirror](#cardmirror) | `packages/debate-editor` | PolyForm Noncommercial License 1.0.0 |
| [ebb](#ebb) | `packages/debate-flow` (`debate-flow-ebb`) | Mozilla Public License 2.0 (MPL-2.0) |

---

## Tabroom.com

- **Upstream:** <https://github.com/debate/debate-tournament-tabroom>
  (fork of `speechanddebate/Tabroomv4`; legacy code at
  <https://github.com/speechanddebate/tabroom>)
- **Pinned commit:** `75239a31cd8523d31dc119fe994b3fec488e77f3`
  (see `packages/debate-tournaments/upstream.json`)
- **Used in:** `packages/debate-tournaments/vendor/tabroom`, a subset of the
  `indexcards` API routes, database schema and types, vendored by
  `packages/debate-tournaments/scripts/sync-upstream.mjs` with local patches and overlays applied on top
  (listed in `vendor/tabroom/UPSTREAM.json`).
- **License:** Reciprocal Public License 1.5 —
  <https://opensource.org/licenses/RPL-1.5>

> Tabroom is copyrighted free software by the National Speech & Debate
> Association, https://www.speechanddebate.org.
>
> You can redistribute it and/or modify it under either the terms of the RPL
> 1.5, available at https://opensource.org/licenses/RPL-1.5 or see the text below.

The full license text is shipped alongside the vendored code in
[`packages/debate-tournaments/vendor/tabroom/LICENSE.md`](packages/debate-tournaments/vendor/tabroom/LICENSE.md).
Under the RPL, modifications to the vendored code, including the patches in
`packages/debate-tournaments/patches/`, must be made available in source form
when deployed.

---

## CardMirror

- **Upstream:** <https://github.com/ant981228/cardmirror>
- **Used in:** `packages/debate-editor`: the ProseMirror-based card editor
  engine (Verbatim `.docx` interop, `.cmir` format, AI editing tools), ported in
  and embedded across the app.
- **License:** PolyForm Noncommercial License 1.0.0 —
  <https://polyformproject.org/licenses/noncommercial/1.0.0/>

Required Notice: Copyright (c) 2026 Anthony Trufanov. CardMirror is
built on ProseMirror (<https://prosemirror.net/>), the rich-text
editor framework by Marijn Haverbeke (<https://marijnhaverbeke.nl/>),
used under the MIT License. ProseMirror's copyright notices are
preserved in the project's `node_modules/` and acknowledged in the
README. The application's interface icons are from the Untitled UI
free icons (<https://www.untitledui.com/free-icons>), © Untitled UI,
used under their free license. Third-party attributions and license
terms are collected in `THIRD-PARTY-NOTICES.md`.

The PolyForm Noncommercial License permits use only for noncommercial
purposes. The full license text is at the URL above and in the upstream
repository's `LICENSE` file.

---

## ebb

- **Upstream:** <https://github.com/shreerammodi/ebb>
- **Author:** Shreeram Modi (<https://github.com/shreerammodi>)
- **Used in:** `packages/debate-flow` (published as `debate-flow-ebb`): the
  local-first, keyboard-first flow editor, ported in as a workspace package and
  mounted as a column of the live round editor via `EbbFlowEmbed`.
- **License:** Mozilla Public License 2.0 — <https://mozilla.org/MPL/2.0/>

> This Source Code Form is subject to the terms of the Mozilla Public
> License, v. 2.0. If a copy of the MPL was not distributed with this
> file, You can obtain one at https://mozilla.org/MPL/2.0/.

MPL-2.0 is file-level copyleft: files derived from ebb, and any changes made to
them, remain under MPL-2.0 and their source must be made available. The
`debate-flow-ebb` package declares `"license": "MPL-2.0"` accordingly.
