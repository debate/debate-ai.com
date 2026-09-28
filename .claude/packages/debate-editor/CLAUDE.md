# CLAUDE.md — `debate-editor` (CardMirror)

Private. The CardMirror debate-card editor embedded across debate-ai.com.
Entry: `src/react/index.tsx` — consumed as source, no build step. Tests in
`test/`.

## Public surface — import from the subpath

| Export | What it is |
| --- | --- |
| `debate-editor` | The React editor shell |
| `debate-editor/engine` | The ProseMirror engine |
| `debate-editor/settings`, `/settings-ui`, `/settings-categories` | Settings model and UI |
| `debate-editor/collab-bridge` | Collaborative editing bridge |
| `debate-editor/styles.css` | Styles |

Never reach past these into `src/`.

## It is upstream CardMirror plus a patch

`src/` = upstream CardMirror (the `packages/debate-editor-cm` submodule, at the
commit in `upstream.json`) + `patches/debate-ai.patch` + files upstream doesn't
have (the React shell, ribbon tabs, sync clients). See the README's "Upstream
CardMirror" section.

- **Edited an upstream file?** Run `bun run sync-upstream:save` in this
  package and commit the patch with it. `test/upstream-sync.test.ts` fails CI
  otherwise. Never hand-edit the patch.
- **Taking upstream changes:** move the submodule, `bun run sync-upstream`,
  resolve `<<<<<<< src` conflicts, `sync-upstream:save`, then run the tests.
  Commit the submodule bump, `upstream.json`, `patches/` and `src/` together.
- Prefer putting new debate-ai.com logic in a file of our own over growing
  the patch. Every patched line is a future merge conflict.
- After a sync: a new `RIBBON_GROUPS` group must go on a tab in
  `editor/ribbon-tabs.ts` (its drift guard throws at module load, which kills
  the embed). A new element in upstream's `index.html` must be copied into
  `react/ribbon-template.ts`. `test/engine-boot.test.ts` catches both.

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
`/cards` and `/reason-editor` are the two routes that break together when this
package regresses — check both.

Document input arrives from `debate-card-parser`; treat it as untrusted.
