/**
 * @fileoverview Word-level diff between two conflicting `FlowEdit`s, for
 * TODO.md idea #16's ("Shared, Ai-Generated Debate Flow") side-by-side diff
 * follow-up: `shared-flow-sync.ts#mergeFlowEdits` already tells us *which*
 * edits conflict (`FlowEditConflict`), but only as a flat, unaligned list of
 * each author's full content — a reviewer has to read every version in full
 * to spot what actually changed. `buildFlowEditConflictDiff` picks the same
 * winner `mergeFlowEdits` would apply (latest edit, ties broken by id) and
 * diffs every other conflicting edit against it, so `SharedFlowSyncPanel`
 * can render two aligned columns per challenger with the actual word-level
 * changes highlighted instead of two independent paragraphs.
 */

import type { FlowEdit, FlowEditConflict } from "./shared-flow-sync";

/** One token of a diffed string, tagged with how it compares to the other side. */
export type DiffSegment = {
  text: string;
  /** `equal` appears on both sides unchanged; `removed`/`added` are this side's own change. */
  type: "equal" | "removed" | "added";
};

/** Splits on whitespace runs while keeping them as their own tokens, so diffed segments reconstruct spacing exactly. */
function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [];
}

type TokenOp = { type: "equal" | "delete" | "insert"; text: string };

/** Classic O(n*m) LCS-backtrack diff over two token arrays — small inputs only (see `MAX_EDIT_CONTENT_LENGTH`). */
function diffTokens(a: string[], b: string[]): TokenOp[] {
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops: TokenOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: "delete", text: a[i] });
      i++;
    } else {
      ops.push({ type: "insert", text: b[j] });
      j++;
    }
  }
  while (i < n) {
    ops.push({ type: "delete", text: a[i] });
    i++;
  }
  while (j < m) {
    ops.push({ type: "insert", text: b[j] });
    j++;
  }
  return ops;
}

/** Word-level diff of two strings, returned as each side's own aligned segment list. */
export function diffFlowEditContent(a: string, b: string): { left: DiffSegment[]; right: DiffSegment[] } {
  const ops = diffTokens(tokenize(a), tokenize(b));
  const left: DiffSegment[] = [];
  const right: DiffSegment[] = [];
  for (const op of ops) {
    if (op.type === "equal") {
      left.push({ text: op.text, type: "equal" });
      right.push({ text: op.text, type: "equal" });
    } else if (op.type === "delete") {
      left.push({ text: op.text, type: "removed" });
    } else {
      right.push({ text: op.text, type: "added" });
    }
  }
  return { left, right };
}

/** One other edit competing for the same box, diffed against the winner that would apply. */
export type FlowEditConflictChallenger = {
  edit: FlowEdit;
  /** The winner's content, with words this challenger dropped marked `removed`. */
  winnerDiff: DiffSegment[];
  /** This challenger's content, with words it added over the winner marked `added`. */
  challengerDiff: DiffSegment[];
};

/** A conflict's side-by-side diff: the edit `mergeFlowEdits` would apply, plus every other edit diffed against it. */
export type FlowEditConflictDiff = {
  boxPath: number[];
  winner: FlowEdit;
  challengers: FlowEditConflictChallenger[];
};

/**
 * Builds the side-by-side diff for one conflict. `conflict.edits` is
 * documented (see `shared-flow-sync.ts`) as oldest-first with the winner
 * `mergeFlowEdits` would apply always last — this trusts that order rather
 * than re-sorting, so the picked winner always matches what "Apply" applies.
 */
export function buildFlowEditConflictDiff(conflict: FlowEditConflict): FlowEditConflictDiff {
  const winner = conflict.edits[conflict.edits.length - 1];
  const challengers = conflict.edits
    .filter((edit) => edit.id !== winner.id)
    .map((edit): FlowEditConflictChallenger => {
      const { left, right } = diffFlowEditContent(winner.content, edit.content);
      return { edit, winnerDiff: left, challengerDiff: right };
    });
  return { boxPath: conflict.boxPath, winner, challengers };
}
