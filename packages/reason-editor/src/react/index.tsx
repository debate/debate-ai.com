"use client";

/**
 * reason-editor — public React API.
 *
 * The debate-ai.com app consumes this package by the names the previous
 * (Lexical-based) editor exposed, so the FIAT speech-doc call sites work
 * unchanged:
 *
 *   import Editor, {
 *     EditorWithToolbar, EditorContent, LexicalEditorWrapper,
 *   } from "reason-editor";
 *   import type { LexicalEditorHandle } from "reason-editor";
 *
 * Under the hood every one of these is the same TipTap/CardMirror
 * `ReasonEditor`, varying only in which chrome is shown. The headless
 * engine (schema + .docx/.cmir codecs) is available at `reason-editor/engine`.
 */

import { forwardRef } from "react";
import type { RefAttributes } from "react";

import { ReasonEditor } from "./ReasonEditor.js";
import type { LexicalEditorHandle, ReasonEditorProps } from "./ReasonEditor.js";

import "./styles.css";

export { ReasonEditor } from "./ReasonEditor.js";
export type { LexicalEditorHandle, ReasonEditorProps } from "./ReasonEditor.js";
export { Toolbar } from "./Toolbar.js";
export type { ToolbarCustomization } from "./Toolbar.js";
export {
  buildSchemaExtensions,
  nodeExtensionFromSpec,
  markExtensionFromSpec,
  cardMirrorNodeNames,
  cardMirrorMarkNames,
} from "./schema-extensions.js";
export { ReasonCore } from "./reason-core-extension.js";
export {
  docxToDocJSON,
  docJSONToDocx,
  cmirToDocJSON,
  docJSONToCmir,
  downloadBytes,
} from "./bridge.js";

/** Props accepted by every exported editor component. Superset of the
 *  legacy `EditorProps` shape (`{ children?, toolbar? }`). */
export type EditorProps = ReasonEditorProps;

type EditorComponent = React.ForwardRefExoticComponent<
  ReasonEditorProps & RefAttributes<LexicalEditorHandle>
>;

/** Full editor with the formatting toolbar and debate-card import/export. */
export const EditorWithToolbar: EditorComponent = forwardRef<
  LexicalEditorHandle,
  ReasonEditorProps
>(function EditorWithToolbar(props, ref) {
  return <ReasonEditor ref={ref} showToolbar showCardTools {...props} />;
});

/** Content-only editor (no toolbar) — for embeds that supply their own chrome. */
export const EditorContent: EditorComponent = forwardRef<
  LexicalEditorHandle,
  ReasonEditorProps
>(function EditorContent(props, ref) {
  return <ReasonEditor ref={ref} showToolbar={false} {...props} />;
});

/** Drop-in replacement for the prior Lexical wrapper used by the FIAT
 *  speech-doc panels: toolbar + card tools, same `content`/`onChange`/
 *  `contentKey`/`title` contract. */
export const LexicalEditorWrapper: EditorComponent = forwardRef<
  LexicalEditorHandle,
  ReasonEditorProps
>(function LexicalEditorWrapper(props, ref) {
  return <ReasonEditor ref={ref} showToolbar showCardTools {...props} />;
});

export default EditorWithToolbar;
