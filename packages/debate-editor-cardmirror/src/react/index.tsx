"use client";

/**
 * debate-editor-cardmirror — public React API.
 *
 * Exposes the same names the prior (TipTap/reason-editor) editor exposed,
 * so `debate-editor`'s re-export shim — and every call site that imports
 * through it (Flow's speech-doc panels, the /reason-editor route) — works
 * unchanged:
 *
 *   import Editor, {
 *     EditorWithToolbar, EditorContent, LexicalEditorWrapper,
 *   } from "debate-editor-cardmirror";
 *   import type { LexicalEditorHandle } from "debate-editor-cardmirror";
 *
 * Under the hood every one of these is the same `CardMirrorEditor`,
 * varying only in whether the menu bar + ribbon chrome is shown. The
 * headless engine (schema + .docx/.cmir codecs) is available at
 * `debate-editor-cardmirror/engine`.
 */

import { forwardRef } from "react";
import type { RefAttributes } from "react";

import { CardMirrorEditor } from "./CardMirrorEditor.js";
import type { LexicalEditorHandle, ReasonEditorProps } from "./CardMirrorEditor.js";

export { CardMirrorEditor } from "./CardMirrorEditor.js";
export type { LexicalEditorHandle, ReasonEditorProps } from "./CardMirrorEditor.js";
export { MenuBar } from "./MenuBar.js";
export { ReadOnlyPreview } from "./ReadOnlyPreview.js";
export { docToHtml, htmlToDoc } from "./html-bridge.js";

export type EditorProps = ReasonEditorProps;

type EditorComponent = React.ForwardRefExoticComponent<
  ReasonEditorProps & RefAttributes<LexicalEditorHandle>
>;

/** Full editor with the menu bar + CardMirror ribbon. */
export const EditorWithToolbar: EditorComponent = forwardRef<LexicalEditorHandle, ReasonEditorProps>(
  function EditorWithToolbar(props, ref) {
    return <CardMirrorEditor ref={ref} showToolbar {...props} />;
  },
);

/** Content-only editor (no menu bar/ribbon) — for embeds that supply
 *  their own chrome. Note: unlike the TipTap shell this replaces,
 *  CardMirror's ribbon buttons back real functionality (undo/redo,
 *  save state, zoom, word count) beyond formatting — this mode only
 *  hides the chrome, it doesn't remove that functionality. */
export const EditorContent: EditorComponent = forwardRef<LexicalEditorHandle, ReasonEditorProps>(
  function EditorContent(props, ref) {
    return <CardMirrorEditor ref={ref} showToolbar={false} {...props} />;
  },
);

/** Drop-in replacement for the prior Lexical/TipTap wrapper used by the
 *  FIAT speech-doc panels: menu bar + ribbon, same `content`/`onChange`/
 *  `contentKey`/`title`/`live` contract. */
export const LexicalEditorWrapper: EditorComponent = forwardRef<LexicalEditorHandle, ReasonEditorProps>(
  function LexicalEditorWrapper(props, ref) {
    return <CardMirrorEditor ref={ref} showToolbar {...props} />;
  },
);

export default EditorWithToolbar;
