"use client"

/**
 * Thin re-export shim for the REASON editor.
 *
 * The editor itself lives in the `reason-editor` workspace package
 * (packages/reason-editor): a TipTap/React shell over the CardMirror
 * ProseMirror debate-card engine. The FIAT speech-doc panels import
 * from here so the call sites stay stable regardless of where the
 * editor implementation lives.
 */

export {
  default,
  EditorWithToolbar,
  EditorContent,
  LexicalEditorWrapper,
} from "reason-editor"
export type { LexicalEditorHandle, ReasonEditorProps } from "reason-editor"
