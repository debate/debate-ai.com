/**
 * Verbatim/Cardmirror-style editing shortcuts — the "condense" and
 * "insert short cite" half of follow-up (a) under idea #14 ("Legacy
 * Verbatim / Cardmirror Compatibility") in TODO.md's Product Feature
 * Ideas list: "wiring these commands into actual keyboard-shortcut
 * handlers in reason-editor's toolbar/editor view".
 *
 * `formatShortCiteTag` is reused directly from `debate-card-parser` — a
 * pure string formatter with no HTML/document dependency, so it applies
 * unchanged to a live editor selection.
 *
 * `condenseCardHtml` (also `debate-card-parser`) is HTML-string based: it
 * regex-scans a card's already-serialized HTML for `<u>` runs. That's the
 * right tool for a *parsed* card (e.g. cardcutter/import output), but a
 * live TipTap document is edited as a ProseMirror tree, not a string —
 * `Editor.getHTML()` is itself just a serialization of that tree. Rather
 * than round-tripping through it on every keystroke-bound command, this
 * module reuses `condenseCardHtml` directly against that same
 * `getHTML()` output, applied once per invocation (see
 * `applyCondenseToHtml`), matching the live editor's own
 * `underline_mark`/`underline_direct` "read text" marks (see
 * `../react/schema-extensions.js`) to Verbatim's `<u>` convention.
 *
 * Imported from `debate-card-parser`'s specific source files rather than
 * its package barrel (`debate-card-parser/src/index.js`): the barrel
 * re-exports parser modules that predate this engine's
 * `noUncheckedIndexedAccess` typecheck setting and aren't clean under it,
 * which would otherwise fail `reason-editor`'s typecheck for code this
 * module never uses.
 */
import { condenseCardHtml, formatShortCiteTag } from "debate-card-parser/src/utils/verbatim-shortcuts.js";
import type { CardYear } from "debate-card-parser/src/types/types.js";
import type { EditorState, Transaction } from "prosemirror-state";

/**
 * Condenses a document's HTML down to its underlined ("read") runs, the
 * way Verbatim's condense shortcut hides everything a debater wouldn't
 * read aloud. Returns `html` unchanged when nothing is underlined, so a
 * caller can always compare the result against the input to decide
 * whether anything changed.
 */
export function applyCondenseToHtml(html: string): string {
  const condensed = condenseCardHtml(html);
  return condensed || html;
}

/**
 * Builds the transaction that inserts a Verbatim-style short cite tag
 * ("Smith 24", "Smith ND") at the current selection, replacing it, and
 * marks the inserted text `cite_mark` when the schema has it. Returns
 * `null` when there's no author to cite (mirrors `formatShortCiteTag`) or
 * when the schema has no `cite_mark` mark.
 */
export function buildInsertShortCiteTransaction(
  state: EditorState,
  author: string,
  year: CardYear,
): Transaction | null {
  const tag = formatShortCiteTag({ author, year });
  if (!tag) return null;

  const { from, to } = state.selection;
  const tr = state.tr.insertText(tag, from, to);

  const citeType = state.schema.marks["cite_mark"];
  if (citeType) {
    tr.addMark(from, from + tag.length, citeType.create());
  }
  return tr;
}
