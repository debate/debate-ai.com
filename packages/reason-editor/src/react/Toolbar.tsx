"use client";

/**
 * Toolbar — the editing surface for the Reason editor.
 *
 * Two groups of controls:
 *   - Rich-text (the "TipTap features"): undo/redo, bold/italic/
 *     underline/strike, highlight, links, and structural headings
 *     (Pocket/Hat/Block/Tag), all driven by TipTap's generic name-based
 *     commands (`toggleMark`, `toggleNode`) against the CardMirror schema.
 *   - Debate-card I/O: import/export Verbatim `.docx` and CardMirror
 *     `.cmir`, via the lazy-loaded engine bridge.
 *
 * Buttons can be hidden by id through the `hide` prop (see
 * ToolbarCustomization); extra controls can be appended via `children`.
 */

import { useEffect, useReducer, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { redo, undo } from "@tiptap/pm/history";

import {
  CMIR_MIME,
  DOCX_MIME,
  cmirToDocJSON,
  docJSONToCmir,
  docJSONToDocx,
  docxToDocJSON,
  downloadBytes,
} from "./bridge.js";
import { runAiCite } from "./ai/cite-creator.js";
import { runAiRepairText } from "./ai/repair-text.js";
import { runAiExplain } from "./ai/explain.js";
import { getSelectedImage, runAiAltText } from "./ai/image-alt-text.js";

export interface ToolbarCustomization {
  /** Button ids to hide (e.g. ["highlight", "import-docx"]). */
  hide?: string[];
  /** Reserved: explicit button order. Not yet honored in v1. */
  order?: string[];
  /** Extra controls appended to the right of the toolbar. */
  children?: React.ReactNode;
}

interface ToolbarProps extends ToolbarCustomization {
  editor: Editor | null;
  /** Show the `.docx` / `.cmir` import-export controls. */
  showCardTools?: boolean;
  /** Show the AI tools (cite formatting, OCR repair, explain, image
   *  alt text). Requires the host to have mounted the `/api/reason-ai`
   *  proxy route (see `configureReasonAi` in `ai/anthropic-client.ts`
   *  if it's mounted elsewhere). */
  showAiTools?: boolean;
  /** Base filename (no extension) for exports. */
  exportName?: string;
}

/** Re-render the toolbar whenever the editor's selection/state changes so
 *  `isActive(...)` reflects the live document. */
function useEditorTick(editor: Editor | null): void {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!editor) return;
    const update = () => tick();
    editor.on("transaction", update);
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("transaction", update);
      editor.off("selectionUpdate", update);
    };
  }, [editor]);
}

export function Toolbar({
  editor,
  showCardTools = false,
  showAiTools = false,
  exportName = "document",
  hide = [],
  children,
}: ToolbarProps) {
  useEditorTick(editor);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFormat = useRef<"docx" | "cmir">("docx");
  const [aiBusy, setAiBusy] = useState(false);

  if (!editor) {
    return <div className="reason-editor-toolbar" aria-hidden="true" />;
  }

  const hidden = new Set(hide);
  const visible = (id: string) => !hidden.has(id);

  const toggleMark = (name: string) =>
    editor.chain().focus().toggleMark(name).run();
  const markActive = (name: string) => editor.isActive(name);

  const toggleHeading = (name: string) =>
    editor.chain().focus().toggleNode(name, "paragraph").run();

  const Btn = ({
    id,
    label,
    title,
    active,
    disabled,
    onClick,
  }: {
    id: string;
    label: string;
    title: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
  }) =>
    visible(id) ? (
      <button
        type="button"
        title={title}
        disabled={disabled}
        data-active={active ? "true" : "false"}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
      >
        {label}
      </button>
    ) : null;

  const Sep = () => <span className="reason-editor-toolbar-sep" aria-hidden="true" />;

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      const json =
        pendingFormat.current === "cmir"
          ? await cmirToDocJSON(bytes)
          : await docxToDocJSON(bytes);
      editor.commands.setContent(json as never);
    } catch (err) {
      // Surface a minimal message; hosts can wrap with their own toast.
      console.error("[reason-editor] import failed:", err);
      if (typeof alert !== "undefined") {
        alert(`Could not import ${file.name}: ${(err as Error).message}`);
      }
    }
  }

  function openPicker(format: "docx" | "cmir") {
    pendingFormat.current = format;
    if (fileInputRef.current) {
      fileInputRef.current.accept = format === "cmir" ? ".cmir" : ".docx";
      fileInputRef.current.click();
    }
  }

  async function exportDocx() {
    if (!editor) return;
    const bytes = await docJSONToDocx(editor.getJSON());
    downloadBytes(bytes, `${exportName}.docx`, DOCX_MIME);
  }

  async function exportCmir() {
    if (!editor) return;
    const bytes = await docJSONToCmir(editor.getJSON());
    downloadBytes(bytes, `${exportName}.cmir`, CMIR_MIME);
  }

  /** Run an AI action with a shared busy flag (so the AI buttons can't
   *  be double-fired or overlap) and a minimal error surface. */
  async function runAi(label: string, fn: () => Promise<void>) {
    if (aiBusy) return;
    setAiBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error(`[reason-editor] ${label} failed:`, err);
      if (typeof alert !== "undefined") {
        alert(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setAiBusy(false);
    }
  }

  function aiCite() {
    if (!editor) return;
    void runAi("AI cite", async () => {
      await runAiCite(editor.view);
    });
  }

  function aiRepairText() {
    if (!editor) return;
    void runAi("AI repair", async () => {
      const result = await runAiRepairText(editor.view);
      const message =
        result.applied === 0
          ? "No OCR errors found."
          : `Repaired ${result.applied} ${result.applied === 1 ? "spot" : "spots"}` +
            (result.skipped > 0 ? ` (${result.skipped} couldn't be placed)` : "") +
            ".";
      if (typeof alert !== "undefined") alert(message);
    });
  }

  function aiExplain() {
    if (!editor) return;
    if (typeof prompt === "undefined") return;
    const question = prompt("What would you like to ask about the selection?");
    if (!question?.trim()) return;
    void runAi("AI explain", async () => {
      const answer = await runAiExplain(editor.state, question);
      if (typeof alert !== "undefined") alert(answer);
    });
  }

  function aiAltText() {
    if (!editor) return;
    const selected = getSelectedImage(editor.view);
    if (!selected) {
      if (typeof alert !== "undefined") alert("Select an image first.");
      return;
    }
    void runAi("AI alt text", async () => {
      await runAiAltText(editor.view, selected.pos, selected.node);
    });
  }

  return (
    <div className="reason-editor-toolbar" role="toolbar">
      <Btn id="undo" label="↶" title="Undo (Ctrl/Cmd+Z)" onClick={() => { undo(editor.state, editor.view.dispatch); editor.view.focus(); }} />
      <Btn id="redo" label="↷" title="Redo (Ctrl/Cmd+Y)" onClick={() => { redo(editor.state, editor.view.dispatch); editor.view.focus(); }} />
      <Sep />

      <Btn id="bold" label="B" title="Bold" active={markActive("bold")} onClick={() => toggleMark("bold")} />
      <Btn id="italic" label="I" title="Italic" active={markActive("italic")} onClick={() => toggleMark("italic")} />
      <Btn id="underline" label="U" title="Underline" active={markActive("underline_direct")} onClick={() => toggleMark("underline_direct")} />
      <Btn id="strike" label="S" title="Strikethrough" active={markActive("strikethrough")} onClick={() => toggleMark("strikethrough")} />
      <Sep />

      <Btn id="highlight" label="HL" title="Highlight" active={markActive("highlight")} onClick={() => toggleMark("highlight")} />
      <Btn id="cite" label="Cite" title="Cite (bold 13pt)" active={markActive("cite_mark")} onClick={() => toggleMark("cite_mark")} />
      <Btn id="emphasis" label="Emph" title="Emphasis" active={markActive("emphasis_mark")} onClick={() => toggleMark("emphasis_mark")} />
      <Btn id="read-underline" label="Rd" title="Reading underline (named style)" active={markActive("underline_mark")} onClick={() => toggleMark("underline_mark")} />
      <Sep />

      <Btn id="pocket" label="P" title="Pocket (Heading 1)" active={editor.isActive("pocket")} onClick={() => toggleHeading("pocket")} />
      <Btn id="hat" label="H" title="Hat (Heading 2)" active={editor.isActive("hat")} onClick={() => toggleHeading("hat")} />
      <Btn id="block" label="Bl" title="Block (Heading 3)" active={editor.isActive("block")} onClick={() => toggleHeading("block")} />
      <Btn id="tag" label="T" title="Tag (card label)" active={editor.isActive("tag")} onClick={() => toggleHeading("tag")} />
      <Btn id="body" label="¶" title="Body paragraph" active={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setNode("paragraph").run()} />

      {showCardTools && (
        <>
          <Sep />
          <Btn id="import-docx" label="⤓docx" title="Import Verbatim .docx" onClick={() => openPicker("docx")} />
          <Btn id="export-docx" label="⤒docx" title="Export Verbatim .docx" onClick={() => void exportDocx()} />
          <Btn id="import-cmir" label="⤓cmir" title="Open CardMirror .cmir" onClick={() => openPicker("cmir")} />
          <Btn id="export-cmir" label="⤒cmir" title="Save CardMirror .cmir" onClick={() => void exportCmir()} />
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            style={{ display: "none" }}
            onChange={onPickFile}
          />
        </>
      )}

      {showAiTools && (
        <>
          <Sep />
          <Btn id="ai-cite" label="AI Cite" title="Format the selection as a debate cite" disabled={aiBusy} onClick={aiCite} />
          <Btn id="ai-repair" label="AI Repair" title="Fix OCR/PDF text errors in the selection" disabled={aiBusy} onClick={aiRepairText} />
          <Btn id="ai-explain" label="AI Explain" title="Ask the AI research coach about the selection" disabled={aiBusy} onClick={aiExplain} />
          <Btn id="ai-alt-text" label="AI Alt Text" title="Generate alt text for the selected image" disabled={aiBusy} onClick={aiAltText} />
        </>
      )}

      {children ? (
        <>
          <span className="reason-editor-toolbar-spacer" />
          {children}
        </>
      ) : null}
    </div>
  );
}
