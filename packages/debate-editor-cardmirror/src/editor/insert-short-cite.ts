/**
 * "Insert short cite" — Mod-Shift-k. The one Verbatim shortcut with no
 * direct CardMirror equivalent (see `docs/features/legacy-verbatim-
 * shortcuts.md`'s Known gaps): a pure "format `Smith 24` and insert it at
 * the cursor" command, distinct from the three tools that solve an
 * adjacent need — F8 (`applyCite`, styles already-typed text), Alt-F8
 * (`copyPreviousCite`, reuses the nearest earlier cite instead of
 * retyping one), and Mod-Shift-x (`aiCreateCite`, formats a full citation
 * from a selection via the AI proxy).
 *
 * `formatShortCiteTag` is reused directly from `debate-card-parser` — the
 * same pure formatter `reason-editor`'s now-dead equivalent
 * (`engine/verbatim-shortcuts.ts`) used before that package stopped being
 * depended on by the app (see `docs/features/legacy-verbatim-
 * shortcuts.md`).
 */
import type { EditorState, Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { CardYear } from 'debate-card-parser/src/types/types';
import { formatShortCiteTag } from 'debate-card-parser/src/utils/verbatim-shortcuts';
import { schema } from '../schema/index.js';
import { promptForText } from './text-prompt.js';

/**
 * Builds the transaction that replaces the current selection (or inserts
 * at a collapsed cursor) with a formatted short cite tag ("Smith 24",
 * "Smith ND"), marking the inserted text `cite_mark`. Returns `null` when
 * there's no author to cite (mirrors `formatShortCiteTag`) — the caller
 * never dispatches an empty insert.
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

  const citeType = schema.marks['cite_mark'];
  if (citeType) tr.addMark(from, from + tag.length, citeType.create());
  return tr;
}

/** Parses the year prompt's raw input into `formatShortCiteTag`'s
 *  `CardYear`: a finite number when the input parses as one, `"ND"`
 *  (no date) for a blank or non-numeric input. */
export function parseCiteYearInput(raw: string): CardYear {
  const trimmed = raw.trim();
  if (!trimmed) return 'ND';
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 'ND';
}

/**
 * Prompts for an author last name and a year, then inserts the formatted
 * short cite tag at the cursor. Two sequential `promptForText` calls
 * (rather than one two-field dialog) to stay in the shared modal
 * vocabulary every other prompt-driven ribbon command already uses.
 * Cancelling (Esc / Cancel button) either prompt, or leaving the author
 * blank, aborts without touching the document.
 */
export async function runInsertShortCite(view: EditorView): Promise<void> {
  const author = await promptForText({
    message: 'Insert short cite — author last name?',
    placeholder: 'Smith',
  });
  if (author === null || author === '') return;

  const yearInput = await promptForText({
    message: 'Insert short cite — year (blank for ND)?',
    placeholder: 'e.g. 24',
  });
  if (yearInput === null) return;

  const tr = buildInsertShortCiteTransaction(view.state, author, parseCiteYearInput(yearInput));
  if (!tr) return;

  view.dispatch(tr);
  view.focus();
}
