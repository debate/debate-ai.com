"use client";

/**
 * ReasonEditor — the React/TipTap shell over the CardMirror schema.
 *
 * A single TipTap editor whose schema *is* CardMirror's debate-card
 * model (via schema-extensions.ts) plus baseline editing behavior (via
 * ReasonCore). It speaks the host app's existing contract — an HTML
 * string `content` in, `onChange(html)` out — so it drops into the
 * debate-ai.com FIAT speech-doc panels where the old (removed) Lexical
 * editor used to sit, while additionally exposing the debate-card power
 * features (Verbatim .docx / .cmir round-trip) through the toolbar and
 * the imperative handle.
 *
 * SSR/RSC: this is a Client Component. `immediatelyRender: false` keeps
 * TipTap from touching the DOM during the server pass; the editor mounts
 * on the client.
 */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { Editor } from "@tiptap/core";
import { EditorContent as TiptapEditorContent, useEditor } from "@tiptap/react";

import { buildSchemaExtensions } from "./schema-extensions.js";
import { ReasonCore } from "./reason-core-extension.js";
import { Toolbar, type ToolbarCustomization } from "./Toolbar.js";
import {
  cmirToDocJSON,
  docJSONToCmir,
  docJSONToDocx,
  docxToDocJSON,
} from "./bridge.js";

/** Imperative handle exposed via ref. Named `LexicalEditorHandle` for
 *  drop-in compatibility with the call sites that imported the prior
 *  (Lexical-based) editor's handle type. */
export interface LexicalEditorHandle {
  /** The underlying TipTap editor, or null before mount. */
  editor: Editor | null;
  getHTML(): string;
  getJSON(): unknown;
  setHTML(html: string): void;
  focus(): void;
  /** Load Verbatim `.docx` bytes into the editor. */
  importDocx(bytes: Uint8Array): Promise<void>;
  /** Serialize the current document to Verbatim `.docx` bytes. */
  exportDocx(): Promise<Uint8Array | null>;
  /** Load CardMirror native `.cmir` bytes into the editor. */
  importCmir(bytes: Uint8Array): Promise<void>;
  /** Serialize the current document to CardMirror native `.cmir` bytes. */
  exportCmir(): Promise<Uint8Array | null>;
}

export interface ReasonEditorProps {
  /** Document content as an HTML string. */
  content?: string;
  /** Identity of the current document. When it changes, the editor
   *  resets to the new `content` (and clears undo history). Parents may
   *  alternatively pass a React `key` to force a full remount. */
  contentKey?: string;
  /** Called with the serialized HTML whenever the document changes. */
  onChange?: (html: string) => void;
  /** Document title — used as the default export filename. */
  title?: string;
  /** Accepted for call-site compatibility; the host renders its own
   *  title UI, so this editor does not. */
  onTitleChange?: (title: string) => void;
  /** Accepted for call-site compatibility; the host renders its own
   *  share affordance. */
  onShareClick?: () => void;
  /** Whether the document is editable. Default true. */
  editable?: boolean;
  /** Show the formatting toolbar. Default true. */
  showToolbar?: boolean;
  /** Show the `.docx` / `.cmir` import-export controls in the toolbar. */
  showCardTools?: boolean;
  /** Toolbar customization (hidden buttons, extra controls). */
  toolbar?: ToolbarCustomization;
  /** Extra class on the editor root. */
  className?: string;
  /** Focus the editor on mount. */
  autoFocus?: boolean;
}

export const ReasonEditor = forwardRef<LexicalEditorHandle, ReasonEditorProps>(
  function ReasonEditor(
    {
      content = "",
      contentKey,
      onChange,
      title,
      editable = true,
      showToolbar = true,
      showCardTools = false,
      toolbar,
      className,
      autoFocus = false,
    },
    ref,
  ) {
    // Build the schema once. CardMirror nodes/marks + editing essentials.
    const extensions = useMemo(() => [...buildSchemaExtensions(), ReasonCore], []);

    // Tracks the last HTML we emitted so external `content` updates don't
    // echo back into a setContent loop.
    const lastEmitted = useRef<string | null>(null);

    const editor = useEditor({
      extensions,
      content,
      editable,
      autofocus: autoFocus ? "end" : false,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: "reason-editor-prosemirror" },
      },
      onUpdate: ({ editor: ed }) => {
        const html = ed.getHTML();
        lastEmitted.current = html;
        onChange?.(html);
      },
    });

    // Keep `editable` in sync.
    useEffect(() => {
      editor?.setEditable(editable);
    }, [editor, editable]);

    // Reset to the new document when the identity key changes.
    useEffect(() => {
      if (!editor) return;
      const next = content ?? "";
      if (next !== editor.getHTML()) {
        editor.commands.setContent(next as never);
      }
      lastEmitted.current = editor.getHTML();
      // contentKey is the reset trigger; content is read fresh above.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, contentKey]);

    // Apply external `content` changes that did not originate here.
    useEffect(() => {
      if (!editor) return;
      const next = content ?? "";
      if (next === lastEmitted.current) return;
      if (next === editor.getHTML()) return;
      editor.commands.setContent(next as never);
      lastEmitted.current = next;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, content]);

    useImperativeHandle(
      ref,
      (): LexicalEditorHandle => ({
        editor: editor ?? null,
        getHTML: () => editor?.getHTML() ?? "",
        getJSON: () => editor?.getJSON() ?? null,
        setHTML: (html: string) => {
          editor?.commands.setContent(html as never);
        },
        focus: () => {
          editor?.commands.focus();
        },
        importDocx: async (bytes: Uint8Array) => {
          if (!editor) return;
          editor.commands.setContent((await docxToDocJSON(bytes)) as never);
        },
        exportDocx: async () => (editor ? docJSONToDocx(editor.getJSON()) : null),
        importCmir: async (bytes: Uint8Array) => {
          if (!editor) return;
          editor.commands.setContent((await cmirToDocJSON(bytes)) as never);
        },
        exportCmir: async () => (editor ? docJSONToCmir(editor.getJSON()) : null),
      }),
      [editor],
    );

    return (
      <div className={className ? `reason-editor ${className}` : "reason-editor"}>
        {showToolbar && (
          <Toolbar
            editor={editor}
            showCardTools={showCardTools}
            exportName={title || "document"}
            hide={toolbar?.hide}
            order={toolbar?.order}
          >
            {toolbar?.children}
          </Toolbar>
        )}
        <TiptapEditorContent editor={editor} className="reason-editor-content" />
      </div>
    );
  },
);
