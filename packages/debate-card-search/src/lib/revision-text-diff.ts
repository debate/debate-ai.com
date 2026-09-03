/**
 * @fileoverview Word-level before/after text diff for a recorded card
 * revision — the "before/after revision diff viewer" follow-up named under
 * the "🔁 Revision Incentives" bullet in TODO.md's Research Crowdsourcing
 * Organizer Features list. `state/revisionHistory.ts` already persists
 * every edit as a `CardRevisionRecord`, but only as scored `CardSnapshot`
 * metrics (quality/citation/evidence-year numbers) — there was no captured
 * text to show a reader *what* changed, only *how much* it scored. This
 * module adds a plain `EvidenceEntryTextSnapshot` (the human-readable
 * `argBlock`/`text`/`cite` fields) captured alongside the existing scored
 * snapshot, plus a pure word-level diff over it, mirroring
 * `debate-round`'s `flow/flow-edit-diff.ts` LCS-backtrack algorithm
 * (reimplemented here rather than imported — these are separate packages
 * with no shared dependency between them).
 *
 * @module lib/revision-text-diff
 */

import type { EvidenceLibraryEntry } from "./shared-evidence-library";

/** One token of a diffed string, tagged with how it compares to the other side. */
export type DiffSegment = {
  text: string;
  /** `equal` appears on both sides unchanged; `removed`/`added` are this side's own change. */
  type: "equal" | "removed" | "added";
};

/** The human-readable fields of an `EvidenceLibraryEntry` worth diffing on revision — everything but tags/topic/case-area metadata. */
export interface EvidenceEntryTextSnapshot {
  argBlock: string;
  text: string;
  cite: string;
}

/** Captures the diffable text fields of an evidence-library entry at a point in time. */
export function buildEvidenceEntryTextSnapshot(entry: EvidenceLibraryEntry): EvidenceEntryTextSnapshot {
  return { argBlock: entry.argBlock, text: entry.text, cite: entry.cite };
}

function tokenize(text: string): string[] {
  return text.match(/\s+|\S+/g) ?? [];
}

type TokenOp = { type: "equal" | "delete" | "insert"; text: string };

/** Classic O(n*m) LCS-backtrack diff over two token arrays — bounded by `MAX_DIFF_TOKENS`. */
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

/**
 * Token count above which `diffText` skips the O(n*m) LCS diff and falls
 * back to a coarse whole-field removed/added pair — an evidence card's cut
 * text has no length cap (unlike `shared-flow-sync.ts`'s 2000-char-capped
 * flow boxes), so a very long card must degrade gracefully instead of
 * risking a multi-million-cell comparison table.
 */
const MAX_DIFF_TOKENS = 6000;

/** Word-level diff of two strings, returned as each side's own aligned segment list. */
export function diffText(a: string, b: string): { before: DiffSegment[]; after: DiffSegment[] } {
  if (a === b) {
    const equal: DiffSegment[] = a.length === 0 ? [] : [{ text: a, type: "equal" }];
    return { before: equal, after: equal };
  }

  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length > MAX_DIFF_TOKENS || tokensB.length > MAX_DIFF_TOKENS) {
    return {
      before: a.length === 0 ? [] : [{ text: a, type: "removed" }],
      after: b.length === 0 ? [] : [{ text: b, type: "added" }],
    };
  }

  const ops = diffTokens(tokensA, tokensB);
  const before: DiffSegment[] = [];
  const after: DiffSegment[] = [];
  for (const op of ops) {
    if (op.type === "equal") {
      before.push({ text: op.text, type: "equal" });
      after.push({ text: op.text, type: "equal" });
    } else if (op.type === "delete") {
      before.push({ text: op.text, type: "removed" });
    } else {
      after.push({ text: op.text, type: "added" });
    }
  }
  return { before, after };
}

/** One diffed field of a card revision. */
export interface CardRevisionFieldDiff {
  field: "argBlock" | "text" | "cite";
  changed: boolean;
  before: DiffSegment[];
  after: DiffSegment[];
}

/** The full before/after diff of a card revision, one entry per diffable field. */
export type CardRevisionTextDiff = CardRevisionFieldDiff[];

const DIFF_FIELDS: Array<CardRevisionFieldDiff["field"]> = ["argBlock", "text", "cite"];

/**
 * Builds the word-level before/after diff for a revised card, one field at
 * a time (`argBlock`, `text`, `cite`) so a reader can see exactly what
 * changed rather than only the scored quality/citation/evidence-year
 * deltas `evaluateRevision` already reports.
 */
export function buildCardRevisionTextDiff(
  before: EvidenceEntryTextSnapshot,
  after: EvidenceEntryTextSnapshot,
): CardRevisionTextDiff {
  return DIFF_FIELDS.map((field) => {
    const { before: beforeSegments, after: afterSegments } = diffText(before[field], after[field]);
    return {
      field,
      changed: before[field] !== after[field],
      before: beforeSegments,
      after: afterSegments,
    };
  });
}
