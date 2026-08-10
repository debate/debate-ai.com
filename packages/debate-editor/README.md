# debate-editor

REASON — the app-facing speech-doc editor. It is a thin shell over the `reason-editor`
workspace package (a TipTap/React front end for the CardMirror ProseMirror engine with
Verbatim .docx interop) plus a read-only markdown renderer for speech views.

```tsx
import { LexicalEditorWrapper, EditorWithToolbar } from "debate-editor"
import { UnifiedMarkdown } from "debate-editor/unified-markdown"
```

Keeping the shell here means call sites stay stable if the underlying editor engine changes.
