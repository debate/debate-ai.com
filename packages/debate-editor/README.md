# debate-editor

REASON — the app-facing speech-doc editor. It is a thin shell over the `reason-editor`
workspace package (a TipTap/React front end for the CardMirror ProseMirror engine with
Verbatim .docx interop) plus a read-only markdown renderer for speech views.

```tsx
import { LexicalEditorWrapper, EditorWithToolbar } from "debate-editor"
import { UnifiedMarkdown } from "debate-editor/src/markdown/unified-markdown"
```

Keeping the shell here means call sites stay stable if the underlying editor engine changes.

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

```
debate-editor/
├── src/
│   ├── markdown/     # unified markdown renderer + pure link helpers
│   ├── env.d.ts      # ambient Next.js and stylesheet declarations
│   └── index.tsx     # public entry point
└── test/             # Vitest suites for the link helpers
```

## Tests

```bash
bun run test        # or: npx vitest run
bun run coverage    # writes ./coverage for this package alone
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.
