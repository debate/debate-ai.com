# CLAUDE.md — `debate-editor` (CardMirror)

Public (`@debate/` scope). The CardMirror debate-card editor embedded across debate-ai.com.
Entry: `src/react/index.tsx` — consumed as source, no build step. Tests in
`test/`.

## Public surface — import from the subpath

| Export | What it is |
| --- | --- |
| `debate-editor` | The React editor shell |
| `debate-editor/engine` | The ProseMirror engine, plus the web `.docx` helpers (`importDocx`, `exportDocxBlob`, `outlineOf`, `cardsOf`) merged in from the former `debate-editor-cm-adapter` |
| `debate-editor/settings`, `/settings-ui`, `/settings-categories` | Settings model and UI |
| `debate-editor/settings-tabs`, `/settings-section` | CardMirror's settings tabs and the React section that renders one, for host Settings sidebars |
| `debate-editor/collab-bridge` | Collaborative editing bridge |
| `debate-editor/styles.css` | Styles |

Never reach past these into `src/`.

## It is an adapter — `src/` is generated

`src/` is git-ignored and assembled by `scripts/sync-upstream.mjs` from
upstream CardMirror (the `packages/debate-editor-cm` submodule, at the commit
in `upstream.json`) + `patches/debate-ai.patch` + `overlay/` (files upstream
doesn't have: the React shell, menu bar, sync clients). See the README's
"Upstream CardMirror" section.

- **Edited anything in `src/`?** Run `bun run sync-upstream:save` in this
  package — upstream files go into the patch, ours into `overlay/`. Otherwise
  the edit is never committed, and `test/upstream-sync.test.ts` fails CI.
  Never hand-edit the patch. Files of our own can also be edited in `overlay/`
  directly (then `bun run assemble`).
- Never put a file upstream also has in `overlay/`; the assemble refuses it.
- **Taking upstream changes:** move the submodule, `bun run sync-upstream`,
  resolve `<<<<<<< src` conflicts, `sync-upstream:save`, then run the tests.
  Commit the submodule bump, `upstream.json`, `patches/` and `overlay/` together.
- Prefer putting new debate-ai.com logic in a file of our own over growing
  the patch. Every patched line is a future merge conflict.
- After a sync: a new `RIBBON_GROUPS` group must go in a menu in
  `react/menu-bar-categories.ts` (its drift guard throws at module load). A
  new element in upstream's `index.html` must be copied into
  `react/ribbon-template.ts`; `test/engine-boot.test.ts` catches it and also
  checks every toolbar button is wired.
- The toolbar is upstream's single left↔right scrolling strip. Don't page it
  into tabs or split it into sections; commands without a button belong in
  the dropdown `MenuBar` above it.

## What must not regress

- **Lossless Verbatim `.docx` round-trip.** Open a Verbatim file, edit, save,
  reopen in Verbatim — nothing lost. This is the single most load-bearing claim
  the editor makes to debaters, and it is easy to break from the ProseMirror
  side without noticing. Round-trip fixtures are the test that matters.
- **Encrypted-file decryption** and the native **`.cmir`** format.
- **`cardmirror-read`**, the headless CLI / MCP server. It shares the engine,
  so an engine change that assumes a DOM breaks it. Keep `engine` free of
  browser-only assumptions.

## Where it is mounted

The site's speech-doc surfaces and `/reason-editor`. Recent history shows
`/research/cards` and `/reason-editor` are the two routes that break together when this
package regresses — check both.

Document input arrives from `debate-card-parser`; treat it as untrusted.

## Card hover actions

`overlay/editor/card-hover-actions.ts` (Summarize / Find flaws / Read aloud
beside a hovered card) is a host plugin registered in `react/singleton.ts`.
Its AI goes through `overlay/editor/card-ai-client.ts`: the user's own
CardMirror key when set, else the app's `/api/card-ai-analysis`. It has no
package dependency on `debate-search-evidence`; keep it that way. User doc:
`debate-help-docs/content/docs/features/research-evidence/card-hover-actions.mdx`.
