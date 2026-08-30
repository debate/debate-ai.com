"use client"

/**
 * Thin re-export shim for the REASON editor.
 *
 * The editor itself lives in the `debate-editor-cardmirror` workspace
 * package (packages/debate-editor-cardmirror): the full CardMirror
 * ProseMirror debate-card engine and its own React shell (menu bar +
 * ribbon), ported in to replace the prior TipTap-based `reason-editor`
 * package. The FIAT speech-doc panels import from here so the call sites
 * stay stable regardless of where the editor implementation lives.
 */

export {
  default,
  EditorWithToolbar,
  EditorContent,
  LexicalEditorWrapper,
} from "debate-editor-cardmirror"
export type { LexicalEditorHandle, ReasonEditorProps } from "debate-editor-cardmirror"
