"use client";

/**
 * OutlineNavPanel — the "(a) a React nav/outline panel in `reason-editor`
 * that renders the outline and toggles collapsed ids, reading/writing
 * through the persistence store" follow-up named under idea #9
 * ("Expandable Heading Structure") in TODO.md's Product Feature Ideas
 * list.
 *
 * Renders the live document's H1-H4 heading outline (via
 * `buildHeadingOutline`/`getVisibleHeadingIds`), lets a user expand or
 * collapse a heading's subtree, persists the collapsed-id selection
 * through `state/collapsedHeadings.ts` keyed by `documentId`, and moves
 * the editor's selection to a heading when its label is clicked.
 *
 * Also syncs the collapsed-id selection into the live editor's
 * `collapsedHeadingsPlugin` (follow-up (b)), so collapsing a heading here
 * also hides its content in the ProseMirror view itself, not just the nav
 * list.
 */

import { useEffect, useReducer, useState } from "react";
import type { Editor } from "@tiptap/core";

import {
  buildHeadingOutline,
  getVisibleHeadingIds,
  toggleCollapsedHeadingId,
  type OutlineHeading,
} from "../engine/outline/heading-outline.js";
import {
  collapsedHeadingsKey,
  setCollapsedHeadingIdsMeta,
} from "../engine/outline/collapsed-headings-plugin.js";
import {
  getCollapsedHeadingSelection,
  saveCollapsedHeadingSelection,
} from "../state/collapsedHeadings.js";

export interface OutlineNavPanelProps {
  editor: Editor | null;
  /** Identity of the current document — the key the collapsed-heading
   *  selection is persisted under. */
  documentId: string;
  className?: string;
}

/** Re-render whenever the editor's document changes so the outline stays live. */
function useEditorDocTick(editor: Editor | null): void {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!editor) return;
    const update = () => tick();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);
}

export function OutlineNavPanel({ editor, documentId, className }: OutlineNavPanelProps) {
  useEditorDocTick(editor);

  const [collapsedIds, setCollapsedIds] = useState<string[]>(
    () => getCollapsedHeadingSelection(documentId)?.collapsedIds ?? [],
  );

  // Reload the persisted selection when the document identity changes.
  useEffect(() => {
    setCollapsedIds(getCollapsedHeadingSelection(documentId)?.collapsedIds ?? []);
  }, [documentId]);

  // Push the current collapse selection into the live editor's decoration
  // plugin — on mount/document-identity change (initial sync) and on every
  // toggle (collapsedIds change) — so collapsed sections actually hide in
  // the ProseMirror view, not just the nav list.
  useEffect(() => {
    if (!editor) return;
    const tr = editor.state.tr
      .setMeta(collapsedHeadingsKey, setCollapsedHeadingIdsMeta(collapsedIds))
      .setMeta("addToHistory", false);
    editor.view.dispatch(tr);
  }, [editor, collapsedIds]);

  if (!editor) return null;

  const outline: OutlineHeading[] = buildHeadingOutline(editor.state.doc);
  const visibleIds = getVisibleHeadingIds(outline, collapsedIds);
  const collapsedSet = new Set(collapsedIds);

  function toggle(id: string) {
    const next = toggleCollapsedHeadingId(collapsedIds, id);
    setCollapsedIds(next);
    saveCollapsedHeadingSelection({ documentId, collapsedIds: next });
  }

  function jumpTo(heading: OutlineHeading) {
    if (!editor) return;
    editor.chain().focus().setTextSelection(heading.pos + 1).scrollIntoView().run();
  }

  const hasChildLevels = (heading: OutlineHeading, index: number): boolean => {
    const next = outline[index + 1];
    return next !== undefined && next.level > heading.level;
  };

  return (
    <nav
      className={className ? `reason-editor-outline-nav ${className}` : "reason-editor-outline-nav"}
      aria-label="Document outline"
    >
      {outline.length === 0 ? (
        <p className="reason-editor-outline-nav-empty">No headings yet.</p>
      ) : (
        <ul className="reason-editor-outline-nav-list">
          {outline.map((heading, index) => {
            if (!visibleIds.has(heading.id)) return null;
            const collapsed = collapsedSet.has(heading.id);
            const canCollapse = hasChildLevels(heading, index);
            return (
              <li
                key={heading.id}
                className="reason-editor-outline-nav-item"
                style={{ paddingLeft: `${(heading.level - 1) * 0.75}rem` }}
              >
                <button
                  type="button"
                  className="reason-editor-outline-nav-toggle"
                  onClick={() => toggle(heading.id)}
                  disabled={!canCollapse}
                  aria-expanded={!collapsed}
                  aria-label={collapsed ? "Expand section" : "Collapse section"}
                >
                  {canCollapse ? (collapsed ? "▸" : "▾") : " "}
                </button>
                <button
                  type="button"
                  className="reason-editor-outline-nav-label"
                  onClick={() => jumpTo(heading)}
                  title={heading.text}
                >
                  {heading.text || "Untitled"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
