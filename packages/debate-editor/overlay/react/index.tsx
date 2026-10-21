"use client";

/**
 * @debate/editor — public React API.
 *
 * Exposes the same names the prior (TipTap/reason-editor) editor exposed,
 * so every call site (Flow's speech-doc panels, the /reason-editor route)
 * works unchanged:
 *
 *   import Editor, {
 *     EditorWithToolbar, EditorContent, LexicalEditorWrapper,
 *   } from "@debate/editor";
 *   import type { LexicalEditorHandle } from "@debate/editor";
 *
 * Under the hood every one of these is the same `DebateEditor`,
 * varying only in whether the dropdown menu bar is shown above the toolbar. The
 * headless engine (schema + .docx/.cmir codecs) is available at
 * `@debate/editor/engine`.
 */

import { forwardRef } from "react";
import type { RefAttributes } from "react";

import { DebateEditor } from "./DebateEditor.js";
import type { LexicalEditorHandle, ReasonEditorProps } from "./DebateEditor.js";

export { DebateEditor } from "./DebateEditor.js";
export type { LexicalEditorHandle, ReasonEditorProps } from "./DebateEditor.js";
export { MenuBar } from "./MenuBar.js";
export { ReadOnlyPreview } from "./ReadOnlyPreview.js";
export { DebateEditorSettingsSection } from "./DebateEditorSettingsSection.js";
export type { DebateEditorSettingsSectionProps } from "./DebateEditorSettingsSection.js";
export { DEBATE_EDITOR_SETTINGS_TABS } from "../editor/settings-tabs.js";
export type { DebateEditorSettingsTab } from "../editor/settings-tabs.js";
export { docToHtml, htmlToDoc } from "./html-bridge.js";

export type EditorProps = ReasonEditorProps;

type EditorComponent = React.ForwardRefExoticComponent<
  ReasonEditorProps & RefAttributes<LexicalEditorHandle>
>;

/** Full editor with the dropdown menu bar above Debate Editor's toolbar. */
export const EditorWithToolbar: EditorComponent = forwardRef<LexicalEditorHandle, ReasonEditorProps>(
  function EditorWithToolbar(props, ref) {
    return <DebateEditor ref={ref} showToolbar {...props} />;
  },
);

/** Editor without the dropdown menu bar — for embeds that supply their
 *  own command menus. Debate Editor's toolbar strip stays: its buttons back
 *  real functionality (undo/redo, save state, zoom, word count) beyond
 *  formatting. */
export const EditorContent: EditorComponent = forwardRef<LexicalEditorHandle, ReasonEditorProps>(
  function EditorContent(props, ref) {
    return <DebateEditor ref={ref} showToolbar={false} {...props} />;
  },
);

/** Drop-in replacement for the prior Lexical/TipTap wrapper used by the
 *  FIAT speech-doc panels: menu bar + toolbar, same `content`/`onChange`/
 *  `contentKey`/`title`/`live` contract. */
export const LexicalEditorWrapper: EditorComponent = forwardRef<LexicalEditorHandle, ReasonEditorProps>(
  function LexicalEditorWrapper(props, ref) {
    return <DebateEditor ref={ref} showToolbar {...props} />;
  },
);

export default EditorWithToolbar;
