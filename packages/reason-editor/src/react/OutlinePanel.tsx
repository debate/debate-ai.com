"use client";

/**
 * OutlinePanel — the navigation surface over the document's heading outline.
 *
 * Renders the Pocket/Hat/Block/Tag outline that
 * `engine/outline/heading-outline.ts` derives from the document, lets a
 * heading be collapsed or expanded, and persists which headings are
 * collapsed per document through `state/collapsedHeadings.ts` so the
 * document reopens the way it was left.
 *
 * Clicking a heading scrolls the editor to it and puts the cursor there; the
 * collapsed set is also handed back through `onCollapsedChange` so a host can
 * feed it into a decoration plugin that hides the collapsed ranges in the
 * editor view.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/core";

import {
  buildHeadingOutline,
  getCollapsedRanges,
  getVisibleHeadingIds,
  type OutlineHeading,
} from "../engine/outline/heading-outline.js";
import {
  deleteCollapsedHeadingSelection,
  getCollapsedHeadingSelection,
  saveCollapsedHeadingSelection,
} from "../state/collapsedHeadings.js";

export interface OutlinePanelProps {
  /** The live editor. The panel re-reads the outline as the document changes. */
  editor: Editor | null;
  /**
   * Identifies the document for persistence. Omit to keep the collapsed set
   * in component state only.
   */
  documentId?: string;
  /**
   * Notified whenever the collapsed set changes, with the ranges those
   * collapsed headings cover — the input a hiding decoration plugin needs.
   */
  onCollapsedChange?: (
    collapsedIds: string[],
    ranges: ReturnType<typeof getCollapsedRanges>,
  ) => void;
  /** Extra class for the panel root. */
  className?: string;
}

/** Re-renders whenever the editor's document or selection changes. */
function useEditorDocTick(editor: Editor | null): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const bump = () => setTick((value) => value + 1);
    editor.on("update", bump);
    editor.on("selectionUpdate", bump);
    return () => {
      editor.off("update", bump);
      editor.off("selectionUpdate", bump);
    };
  }, [editor]);
  return tick;
}

/**
 * Heading outline navigator with per-document collapse persistence.
 *
 * @param props - See {@link OutlinePanelProps}.
 * @returns The outline panel element.
 *
 * @example
 * ```tsx
 * <OutlinePanel editor={editor} documentId={docId} />
 * ```
 */
export function OutlinePanel({
  editor,
  documentId,
  onCollapsedChange,
  className,
}: OutlinePanelProps) {
  const tick = useEditorDocTick(editor);
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);

  // Restore the document's collapsed set after mount, so the server render
  // and the first client render agree before storage is consulted.
  useEffect(() => {
    if (!documentId) return;
    const saved = getCollapsedHeadingSelection(documentId);
    setCollapsedIds(saved ? saved.collapsedIds : []);
  }, [documentId]);

  const outline = useMemo<OutlineHeading[]>(
    () => (editor ? buildHeadingOutline(editor.state.doc) : []),
    // `tick` is the signal that the document changed under us.
    [editor, tick],
  );

  const visibleIds = useMemo(
    () => getVisibleHeadingIds(outline, collapsedIds),
    [outline, collapsedIds],
  );

  const ranges = useMemo(
    () => (editor ? getCollapsedRanges(editor.state.doc, outline, collapsedIds) : []),
    [editor, outline, collapsedIds, tick],
  );

  useEffect(() => {
    onCollapsedChange?.(collapsedIds, ranges);
  }, [collapsedIds, ranges, onCollapsedChange]);

  const persist = useCallback(
    (next: string[]) => {
      setCollapsedIds(next);
      if (!documentId) return;
      if (next.length === 0) deleteCollapsedHeadingSelection(documentId);
      else saveCollapsedHeadingSelection({ documentId, collapsedIds: next });
    },
    [documentId],
  );

  const toggle = useCallback(
    (headingId: string) => {
      persist(
        collapsedIds.includes(headingId)
          ? collapsedIds.filter((id) => id !== headingId)
          : [...collapsedIds, headingId],
      );
    },
    [collapsedIds, persist],
  );

  const goTo = useCallback(
    (heading: OutlineHeading) => {
      if (!editor) return;
      editor.chain().focus().setTextSelection(heading.pos + 1).scrollIntoView().run();
    },
    [editor],
  );

  const visible = outline.filter((heading) => visibleIds.has(heading.id));

  return (
    <nav className={`reason-outline${className ? ` ${className}` : ""}`} aria-label="Document outline">
      <div className="reason-outline-header">
        <span className="reason-outline-title">Outline</span>
        <span className="reason-outline-count">
          {outline.length} heading{outline.length === 1 ? "" : "s"}
        </span>
        {collapsedIds.length > 0 ? (
          <button type="button" className="reason-outline-action" onClick={() => persist([])}>
            Expand all
          </button>
        ) : (
          <button
            type="button"
            className="reason-outline-action"
            disabled={outline.length === 0}
            onClick={() => persist(outline.map((heading) => heading.id))}
          >
            Collapse all
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="reason-outline-empty">
          {outline.length === 0
            ? "No headings yet — add a Pocket, Hat, Block or Tag."
            : "Every heading is inside a collapsed section."}
        </p>
      ) : (
        <ul className="reason-outline-list">
          {visible.map((heading) => {
            const isCollapsed = collapsedIds.includes(heading.id);
            return (
              <li
                key={heading.id}
                className={`reason-outline-item reason-outline-level-${heading.level}`}
                style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
              >
                <button
                  type="button"
                  className="reason-outline-toggle"
                  aria-expanded={!isCollapsed}
                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${heading.text || heading.type}`}
                  onClick={() => toggle(heading.id)}
                >
                  {isCollapsed ? "▸" : "▾"}
                </button>
                <button
                  type="button"
                  className="reason-outline-link"
                  onClick={() => goTo(heading)}
                >
                  {heading.text || `(empty ${heading.type})`}
                </button>
                <span className="reason-outline-type">{heading.type}</span>
              </li>
            );
          })}
        </ul>
      )}

      {ranges.length > 0 ? (
        <p className="reason-outline-status">
          {ranges.length} section{ranges.length === 1 ? "" : "s"} collapsed
        </p>
      ) : null}
    </nav>
  );
}
