/**
 * Ragged-table guard for structural table commands.
 *
 * Concurrent collab edits merge to RAGGED tables: peer A's addRowAfter
 * (a 3-cell row) merges with peer B's addColumnAfter (other rows grow
 * to 4) and every peer legally holds a table whose rows have unequal
 * widths — the schema's content expressions can't constrain widths, so
 * this state is valid and reachable in any shared room.
 *
 * prosemirror-tables' TableMap misbehaves on ragged tables, and
 * `addRowAfter` from a short-row cell inserts an EMPTY table_row
 * INSIDE the trailing row — and ProseMirror's replace fitter accepts
 * the schema-invalid document (seed-51 soak find, 2026-08-15). Once
 * written to the CRDT, remote materializers drop the whole invalid
 * row while the originating peer keeps it: permanent divergence.
 *
 * The guard: before any structural table command runs, if the doc's
 * tables are ragged, fold prosemirror-tables' own `fixTables` padding
 * into the SAME dispatch, then run the command against the normalized
 * doc. One transaction, one undo step, no window where the command
 * sees a ragged map.
 */

import type { Command, EditorState, Transaction } from 'prosemirror-state';
import {
  fixTables,
  addRowAfter,
  addRowBefore,
  deleteRow,
  addColumnAfter,
  addColumnBefore,
  deleteColumn,
  mergeCells,
  splitCell,
  deleteTable,
} from 'prosemirror-tables';

/** The fixTables padding tr for `state`, or null when nothing needs
 *  fixing. fixTables itself throws on structurally-invalid tables
 *  (e.g. a row nested inside a row — the guarded commands can no
 *  longer produce that, but an old client in a mixed room can);
 *  swallow and return null so the command path never crashes —
 *  doc-repair's structural pass owns healing that state. */
function raggedFixTr(state: EditorState): Transaction | null {
  try {
    return fixTables(state) ?? null;
  } catch {
    return null;
  }
}

export function guardTableCommand(cmd: Command): Command {
  return (state, dispatch, view) => {
    const fix = raggedFixTr(state);
    if (!fix) return cmd(state, dispatch, view);
    const fixedState = state.apply(fix);
    if (!dispatch) return cmd(fixedState, undefined, view);
    let ran = false;
    const ok = cmd(
      fixedState,
      (cmdTr) => {
        ran = true;
        // Fold the command's steps onto the padding tr so the whole
        // thing lands as one dispatch / one undo step. The steps were
        // built against fixedState, which IS fix.doc, so they apply
        // in sequence.
        for (const step of cmdTr.steps) fix.step(step);
        fix.setSelection(cmdTr.selection.map(fix.doc, fix.mapping.slice(fix.steps.length)));
        if (cmdTr.scrolledIntoView) fix.scrollIntoView();
        dispatch(fix);
      },
      view,
    );
    // The command found nothing to do but the table was ragged —
    // still dispatch the padding; a normalized table is strictly
    // better and the user asked for a table edit.
    if (!ran && ok) dispatch(fix);
    return ok;
  };
}

export const guardedAddRowAfter: Command = guardTableCommand(addRowAfter);
export const guardedAddRowBefore: Command = guardTableCommand(addRowBefore);
export const guardedDeleteRow: Command = guardTableCommand(deleteRow);
export const guardedAddColumnAfter: Command = guardTableCommand(addColumnAfter);
export const guardedAddColumnBefore: Command = guardTableCommand(addColumnBefore);
export const guardedDeleteColumn: Command = guardTableCommand(deleteColumn);
export const guardedMergeCells: Command = guardTableCommand(mergeCells);
export const guardedSplitCell: Command = guardTableCommand(splitCell);
export const guardedDeleteTable: Command = guardTableCommand(deleteTable);
