/**
 * Named-style normalizer plugin.
 *
 * Two invariants on every transaction (and at import time via the
 * pure helper below):
 *
 * 1. **Body vs structural underline representation.**
 *      - Body-like textblocks (`paragraph`, `card_body`,
 *        `cite_paragraph`) use `underline_mark` (the named
 *        "Underline" character style).
 *      - Structural textblocks (`tag`, `analytic`, `pocket`,
 *        `hat`, `block`, `undertag`) use `underline_direct` (plain
 *        `<w:u/>`, no rStyle on export).
 *    Visually identical; the distinction matters for round-trip
 *    and for Verbatim's semantic classification.
 *
 * 2. **Cite / emphasis precedence over underline (in body
 *    contexts).** A character carrying `cite_mark` or `emphasis_mark`
 *    plus an underline mark gets the underline mark stripped — the
 *    cite / emphasis style governs the visual underline (or lack of
 *    it). Active F8 / F9 / F10 commands use `tr.addMark`, which
 *    auto-strips via schema `excludes`, so this normalization is
 *    really a safety net for passive coexistence (legacy imports,
 *    pastes, and any future code path that doesn't go through a
 *    policy command).
 */

import { Plugin } from 'prosemirror-state';
import type { Transaction } from 'prosemirror-state';
import { Fragment, type Node as PMNode } from 'prosemirror-model';
import { schema } from './schema/index.js';
import { changedRange } from './transaction-utils.js';

const BODY_TEXTBLOCKS = new Set<string>(['paragraph', 'card_body', 'cite_paragraph']);
const STRUCTURAL_TEXTBLOCKS = new Set<string>([
  'tag', 'analytic', 'pocket', 'hat', 'block', 'undertag',
]);

export const namedStyleNormalizerPlugin: Plugin = new Plugin({
  appendTransaction(transactions, _oldState, newState) {
    // Scope to mapped change ranges so typing in a large doc
    // doesn't trigger a full-doc descendants walk per keystroke.
    const range = changedRange(transactions);
    if (!range) return null;

    const directMark = schema.marks['underline_direct']!;
    const namedMark = schema.marks['underline_mark']!;
    const citeMark = schema.marks['cite_mark']!;
    const emphasisMark = schema.marks['emphasis_mark']!;
    let tr: Transaction | null = null;

    newState.doc.nodesBetween(range.from, range.to, (node, pos, parent) => {
      if (!node.isText || !parent) return true;
      const parentName = parent.type.name;
      const hasDirect = node.marks.some((m) => m.type === directMark);
      const hasNamed = node.marks.some((m) => m.type === namedMark);
      const hasCiteOrEmph = node.marks.some(
        (m) => m.type === citeMark || m.type === emphasisMark,
      );
      const isBody = BODY_TEXTBLOCKS.has(parentName);
      const isStructural = STRUCTURAL_TEXTBLOCKS.has(parentName);

      if (isBody) {
        if (hasCiteOrEmph) {
          // Cite or emphasis present → strip any underline marks
          // (cite/emphasis wins over underline for body text).
          if (hasNamed) {
            if (!tr) tr = newState.tr;
            tr.removeMark(pos, pos + node.nodeSize, namedMark);
          }
          if (hasDirect) {
            if (!tr) tr = newState.tr;
            tr.removeMark(pos, pos + node.nodeSize, directMark);
          }
        } else if (hasDirect) {
          // No conflict — flip direct → named (body uses the named
          // style).
          if (!tr) tr = newState.tr;
          tr.removeMark(pos, pos + node.nodeSize, directMark);
          if (!hasNamed) tr.addMark(pos, pos + node.nodeSize, namedMark.create());
        }
      } else if (isStructural && hasNamed) {
        // Structural uses direct underline; flip named → direct.
        if (!tr) tr = newState.tr;
        tr.removeMark(pos, pos + node.nodeSize, namedMark);
        if (!hasDirect) tr.addMark(pos, pos + node.nodeSize, directMark.create());
      }
      return true;
    });

    return tr;
  },
});

export function isBodyTextblock(node: PMNode): boolean {
  return BODY_TEXTBLOCKS.has(node.type.name);
}

export function isStructuralTextblock(node: PMNode): boolean {
  return STRUCTURAL_TEXTBLOCKS.has(node.type.name);
}

/**
 * Apply the same body-vs-structural underline rule to a static doc
 * tree (no transactions involved). Used by the importer so freshly-
 * loaded docs are already in the canonical form before the editor's
 * first dispatch.
 */
export function normalizeUnderlineMarks(doc: PMNode): PMNode {
  const namedMark = schema.marks['underline_mark']!;
  const directMark = schema.marks['underline_direct']!;
  const citeMark = schema.marks['cite_mark']!;
  const emphasisMark = schema.marks['emphasis_mark']!;

  function walk(node: PMNode): PMNode {
    if (node.isText) return node;
    if (node.isTextblock) {
      const name = node.type.name;
      const isBody = BODY_TEXTBLOCKS.has(name);
      const isStructural = STRUCTURAL_TEXTBLOCKS.has(name);
      if (!isBody && !isStructural) return node;
      const children: PMNode[] = [];
      let changed = false;
      node.forEach((child) => {
        if (!child.isText) {
          children.push(child);
          return;
        }
        let marks = child.marks;
        const hasDirect = marks.some((m) => m.type === directMark);
        const hasNamed = marks.some((m) => m.type === namedMark);
        const hasCiteOrEmph = marks.some(
          (m) => m.type === citeMark || m.type === emphasisMark,
        );
        if (isBody) {
          if (hasCiteOrEmph && (hasDirect || hasNamed)) {
            // Cite / emphasis wins; drop both underline variants.
            marks = marks.filter(
              (m) => m.type !== directMark && m.type !== namedMark,
            );
            changed = true;
          } else if (hasDirect) {
            marks = marks.filter((m) => m.type !== directMark);
            if (!hasNamed) marks = namedMark.create().addToSet(marks);
            changed = true;
          }
        } else if (isStructural && hasNamed) {
          marks = marks.filter((m) => m.type !== namedMark);
          if (!hasDirect) marks = directMark.create().addToSet(marks);
          changed = true;
        }
        children.push(marks === child.marks ? child : child.mark(marks));
      });
      return changed ? node.copy(Fragment.fromArray(children)) : node;
    }
    // Container — recurse.
    const children: PMNode[] = [];
    let changed = false;
    node.forEach((child) => {
      const next = walk(child);
      if (next !== child) changed = true;
      children.push(next);
    });
    return changed ? node.copy(Fragment.fromArray(children)) : node;
  }

  return walk(doc);
}
