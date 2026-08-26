/**
 * Structural units and crude whole-unit movement (SPEC-mobile-view.md
 * Move mode; usable from desktop too).
 *
 * A "unit" is the smallest draggable container at a position — a
 * card / analytic_unit, or a heading line (pocket/hat/block) plus its
 * subtree. The doc is FLAT at the top level (headings are paragraph
 * nodes, not tree containers), so a heading's subtree is the run of
 * following top-level nodes up to the next equal-or-shallower heading
 * — the same definition the drag system and nav pane use.
 *
 * Movement executes through the drag system's `buildMoveTransaction`,
 * so a button-move and a drag-drop produce identical documents (and
 * identical single undo steps).
 */

import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { TYPE_TO_LEVEL, type HeadingEntry } from './headings.js';
import { buildMoveTransaction, type DragItem } from './drag-controller.js';

export interface UnitRange {
  from: number;
  to: number;
  type: string;
  /** 1–3 = heading subtree, 4 = card / analytic_unit. */
  level: number;
  label: string;
}

/** Smallest structural unit containing `pos` — a card/analytic_unit,
 *  else the enclosing heading's subtree. Null over plain doc-level
 *  paragraphs and empty space. (Position-based port of the editor
 *  drag surface's `findContainerAt` hit-test.) */
export function unitRangeAtPos(doc: PMNode, pos: number): UnitRange | null {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    const t = node.type.name;
    if (t === 'card' || t === 'analytic_unit') {
      const from = $pos.before(depth);
      return {
        from,
        to: from + node.nodeSize,
        type: t,
        level: 4,
        label: node.firstChild ? node.firstChild.textContent : '',
      };
    }
  }
  // Not inside a card — find the governing heading: the nearest
  // pocket/hat/block at or above the top-level node containing pos.
  const top = topLevelIndexAt(doc, $pos.pos);
  if (top === null) return null;
  const nodes = topLevelMap(doc);
  for (let i = top; i >= 0; i--) {
    const n = nodes[i]!;
    if (n.level !== null) {
      // pos must fall inside this heading's subtree to belong to it.
      const end = subtreeEnd(nodes, i, doc);
      if ($pos.pos <= end) {
        return {
          from: n.pos,
          to: end,
          type: n.type,
          level: n.level,
          label: doc.nodeAt(n.pos)?.textContent ?? '',
        };
      }
      return null;
    }
  }
  return null;
}

interface TopNode {
  pos: number;
  size: number;
  type: string;
  /** Outline level for pocket/hat/block heading LINES, else null
   *  (cards, analytic units, paragraphs, tables …). */
  level: number | null;
}

function topLevelMap(doc: PMNode): TopNode[] {
  const out: TopNode[] = [];
  doc.forEach((node, offset) => {
    const t = node.type.name;
    const lvl = t === 'pocket' || t === 'hat' || t === 'block' ? TYPE_TO_LEVEL[t]! : null;
    out.push({ pos: offset, size: node.nodeSize, type: t, level: lvl });
  });
  return out;
}

function topLevelIndexAt(doc: PMNode, pos: number): number | null {
  let idx: number | null = null;
  let offset = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const size = doc.child(i)!.nodeSize;
    if (pos >= offset && pos <= offset + size) {
      idx = i;
      break;
    }
    offset += size;
  }
  return idx;
}

/** End of the subtree of the heading at `nodes[i]` — the start of the
 *  next equal-or-shallower heading, else the doc end. */
function subtreeEnd(nodes: TopNode[], i: number, doc: PMNode): number {
  const level = nodes[i]!.level!;
  for (let j = i + 1; j < nodes.length; j++) {
    const n = nodes[j]!;
    if (n.level !== null && n.level <= level) return n.pos;
  }
  return doc.content.size;
}

/**
 * Where moving `unit` one step up/down inserts it (original-doc
 * coordinates, for `buildMoveTransaction`). Null = nowhere to go.
 *
 * One "step":
 * - Up over a whole previous unit when one ends exactly at ours — the
 *   OUTERMOST heading subtree ending at our start, else the single
 *   node immediately before (a loose card, a table, or a bare parent
 *   heading line, which steps us out above our section).
 * - Down: a same-level sibling heading is hopped as a whole subtree;
 *   any other heading line is entered (we land right after the line,
 *   as its first child); a non-heading node is hopped whole.
 */
export function moveInsertPos(doc: PMNode, unit: UnitRange, dir: -1 | 1): number | null {
  const nodes = topLevelMap(doc);
  if (dir === -1) {
    // Outermost heading whose subtree ends exactly at unit.from.
    let best: number | null = null;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]!;
      if (n.pos >= unit.from) break;
      if (n.level !== null && subtreeEnd(nodes, i, doc) === unit.from) {
        best = n.pos;
        break; // first (outermost) wins
      }
    }
    if (best !== null) return best;
    // Else: the node immediately before us.
    const prev = nodes.filter((n) => n.pos + n.size === unit.from).pop();
    return prev ? prev.pos : null;
  }
  // dir === 1 — the node immediately after us.
  const nextIdx = nodes.findIndex((n) => n.pos === unit.to);
  if (nextIdx === -1) return null;
  const next = nodes[nextIdx]!;
  if (next.level !== null) {
    if (unit.level <= 3 && next.level === unit.level) {
      // Same-level sibling: hop its whole subtree.
      return subtreeEnd(nodes, nextIdx, doc);
    }
    // Any other heading: step inside, right after its line.
    return next.pos + next.size;
  }
  // Non-heading neighbor: hop it whole.
  return next.pos + next.size;
}

/** The whole structural unit a nav entry denotes — the wrapping card
 *  for tag/analytic entries, the heading line + subtree for
 *  pocket/hat/block entries. "Send to…" places the moved unit ABOVE
 *  or BELOW this range, never inside it: inserting after a same-level
 *  heading's line would strand the target's own content under the
 *  moved unit. */
export function entryUnitRange(doc: PMNode, entry: HeadingEntry): UnitRange | null {
  return unitRangeAtPos(doc, entry.pos + 1);
}

function unitToDragItem(doc: PMNode, unit: UnitRange): DragItem {
  const node = doc.nodeAt(unit.from);
  const id =
    unit.level === 4
      ? ((node?.firstChild?.attrs?.['id'] as string | null | undefined) ?? null)
      : ((node?.attrs?.['id'] as string | null | undefined) ?? null);
  return {
    from: unit.from,
    to: unit.to,
    id,
    type: unit.type,
    level: unit.level,
    label: unit.label,
  };
}

/** Move `unit` to `insertPos` (original-doc coords) through the drag
 *  system's move builder — same result as a drag-drop, single undo
 *  step. Returns false on no-op/invalid. */
export function executeUnitMove(view: EditorView, unit: UnitRange, insertPos: number): boolean {
  if (insertPos === unit.from || insertPos === unit.to) return false;
  const tr = buildMoveTransaction(view.state, [unitToDragItem(view.state.doc, unit)], insertPos);
  if (!tr) return false;
  view.dispatch(tr);
  return true;
}
