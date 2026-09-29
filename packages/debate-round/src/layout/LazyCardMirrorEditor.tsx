"use client"

/**
 * @fileoverview CardMirror's editor, loaded when a speech document first
 * renders rather than with the flow page.
 *
 * `debate-editor` is the whole CardMirror engine (ProseMirror, its OOXML
 * reader, the ribbon and their stylesheets). Importing it statically put all
 * of that into every bundle that reached `debate-round`, including ones that
 * never show a speech. The flow still paints its grid at once; the editor
 * pane shows a spinner until the engine arrives.
 *
 * @module layout/LazyCardMirrorEditor
 */

import { lazy, Suspense, type ComponentProps } from "react"
import { Loader2 } from "lucide-react"

const LexicalEditorWrapperImpl = lazy(() =>
  import("debate-editor").then((m) => ({ default: m.LexicalEditorWrapper })),
)

/** Spinner shown in an editor pane while CardMirror loads. */
function EditorLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center text-muted-foreground" aria-busy="true">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="sr-only">Loading editor…</span>
    </div>
  )
}

/** Drop-in for `debate-editor`'s `LexicalEditorWrapper` that loads it on first render. */
export function LexicalEditorWrapper(props: ComponentProps<typeof LexicalEditorWrapperImpl>) {
  return (
    <Suspense fallback={<EditorLoading />}>
      <LexicalEditorWrapperImpl {...props} />
    </Suspense>
  )
}
