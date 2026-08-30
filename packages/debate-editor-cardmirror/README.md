# debate-editor-cardmirror

CardMirror-based debate-card editor embedded in debate-ai.com. The package exposes the
ProseMirror engine, Verbatim `.docx` interop helpers, and React editor shell used by the
site's speech-doc and reason-editor surfaces.

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

```
debate-editor-cardmirror/
├── src/              # ProseMirror/CardMirror editor engine and React shell
└── test/             # Vitest suites for editor data-model helpers
```

## Tests

```bash
bun run test        # or: npx vitest run
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.

Current Codecov package coverage on `master` at commit `5b69dad` is **0.14%**.
