"use client";

/**
 * VerbatimShortcuts — real keyboard-shortcut handlers for Verbatim/
 * Cardmirror-style card-editing commands, closing follow-up (a) under
 * idea #14 ("Legacy Verbatim / Cardmirror Compatibility") in TODO.md's
 * Product Feature Ideas list: "wiring these commands into actual
 * keyboard-shortcut handlers in reason-editor's toolbar/editor view".
 *
 * Four shortcuts:
 *   - Mod-Shift-E  Toggle emphasis on the selection. The schema already
 *     models "emphasis" as a real mark (`emphasis_mark`, same one the
 *     toolbar's "Emph" button toggles) rather than raw `<mark>` HTML, so
 *     this binds the schema-native `toggleMark` command instead of
 *     `debate-card-parser`'s HTML-string `toggleEmphasisHtml` — the same
 *     Verbatim behavior, at the correct layer for a live document.
 *   - Mod-Shift-K  Insert a short cite tag ("Smith 24") at the cursor,
 *     via `buildInsertShortCiteTransaction` (reuses `formatShortCiteTag`).
 *   - Mod-Shift-D  Condense the document to its underlined "read" text,
 *     via `applyCondenseToHtml` (reuses `condenseCardHtml`).
 *   - Alt-ArrowUp / Alt-ArrowDown  Move the current heading's section up
 *     or down, via `buildMoveHeadingSectionTransaction` (reuses
 *     `moveOutlineNode`).
 *   - Mod-Shift-S  Send the current selection to a speech document (by
 *     title, existing or new), via `sendSelectionToSpeechDocument` — the
 *     "send selected evidence to a speech document" command named as
 *     follow-up (b) under idea #14, closing this package's last open gap
 *     on that idea (see `docs/features/legacy-verbatim-shortcuts.md`).
 */
import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import type { CardYear } from "debate-card-parser/src/types/types.js";

import {
  applyCondenseToHtml,
  buildInsertShortCiteTransaction,
} from "../engine/verbatim-shortcuts.js";
import {
  buildMoveHeadingSectionTransaction,
  findHeadingAtPos,
} from "../engine/outline/heading-move.js";
import { buildHeadingOutline } from "../engine/outline/heading-outline.js";
import type { SpeechDocument } from "../engine/speech-document.js";
import { sendSelectionToSpeechDocument } from "../state/speechDocuments.js";

/** Moves the section containing the current selection up or down.
 *  Returns false (a no-op) when the cursor isn't inside any heading's
 *  section, or the move would go out of bounds. */
export function moveCurrentHeadingSection(editor: Editor, direction: "up" | "down"): boolean {
  const outline = buildHeadingOutline(editor.state.doc);
  const heading = findHeadingAtPos(outline, editor.state.selection.from);
  if (!heading) return false;

  const tr = buildMoveHeadingSectionTransaction(editor.state, outline, heading.id, direction);
  if (!tr) return false;

  editor.view.dispatch(tr);
  return true;
}

/** Prompts for an author/year and inserts the formatted short cite tag
 *  at the current selection. Returns false when the prompt is
 *  unavailable, cancelled, or left blank. */
export function insertShortCiteViaPrompt(editor: Editor): boolean {
  if (typeof prompt === "undefined") return false;

  const author = prompt("Short cite — author last name?")?.trim();
  if (!author) return false;

  const yearInput = prompt("Short cite — year (blank for ND)?")?.trim();
  const parsedYear = yearInput ? Number(yearInput) : NaN;
  const year: CardYear = Number.isFinite(parsedYear) ? parsedYear : "ND";

  const tr = buildInsertShortCiteTransaction(editor.state, author, year);
  if (!tr) return false;

  editor.view.dispatch(tr);
  editor.commands.focus();
  return true;
}

/** Condenses the whole document to its underlined "read" text. Returns
 *  false (a no-op) when nothing is underlined. */
export function condenseDocument(editor: Editor): boolean {
  const html = editor.getHTML();
  const condensed = applyCondenseToHtml(html);
  if (condensed === html) return false;

  editor.commands.setContent(condensed as never);
  return true;
}

/**
 * Prompts for a target speech document's title and sends the current
 * selection's text to it (finding an existing document with a matching
 * title or creating one). Returns the updated document, or `null` when
 * the prompt is unavailable, the selection is blank, or the title prompt
 * is cancelled/left blank. Alerts a short confirmation on success, since
 * (unlike condense/insert-cite) the result isn't otherwise visible in the
 * editor itself.
 */
export function sendSelectionToSpeechDocumentViaPrompt(
  editor: Editor,
  sourceLabel?: string,
): SpeechDocument | null {
  if (typeof prompt === "undefined") return null;

  const { from, to } = editor.state.selection;
  const text = editor.state.doc.textBetween(from, to, "\n");
  if (!text.trim()) return null;

  const title = prompt("Send to speech document — title (existing or new)?")?.trim();
  if (!title) return null;

  const result = sendSelectionToSpeechDocument(
    title,
    text,
    sourceLabel,
    () => crypto.randomUUID(),
    Date.now(),
  );
  if (result && typeof alert !== "undefined") {
    const count = result.blocks.length;
    alert(`Sent to speech document "${result.title}" (${count} block${count === 1 ? "" : "s"}).`);
  }
  return result;
}

export const VerbatimShortcuts = Extension.create({
  name: "verbatimShortcuts",

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-e": () => this.editor.commands.toggleMark("emphasis_mark"),
      "Mod-Shift-k": () => insertShortCiteViaPrompt(this.editor),
      "Mod-Shift-d": () => condenseDocument(this.editor),
      "Alt-ArrowUp": () => moveCurrentHeadingSection(this.editor, "up"),
      "Alt-ArrowDown": () => moveCurrentHeadingSection(this.editor, "down"),
      "Mod-Shift-s": () => !!sendSelectionToSpeechDocumentViaPrompt(this.editor),
    };
  },
});
