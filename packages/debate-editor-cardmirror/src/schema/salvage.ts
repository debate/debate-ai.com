/**
 * Last-resort document salvage (structural-integrity audit follow-on).
 *
 * When a `.cmir` fails `doc.check()` even after the lossless heal
 * chain, the only options used to be a backup or a manual rescue.
 * Salvage isolates the malformed components at the DEEPEST level and
 * drops the minimum: a card that is invalid only because one illegal
 * child sits inside it loses that child, not the card.
 *
 * Bottom-up and deterministic:
 *   1. children are salvaged first;
 *   2. the parent's content is refit with a greedy content-match walk —
 *      children that can't extend the match (wrong type, or marks the
 *      parent disallows) are dropped and recorded;
 *   3. missing REQUIRED content is generated via `fillBefore` (the
 *      `createAndFill` mechanism — e.g. a bare required head), so a
 *      container isn't discarded when an empty filler completes it;
 *   4. a node whose own attrs are invalid, or that still can't be
 *      completed, is dropped whole (recorded with a text preview).
 *
 * The result is re-verified with a full `check()`; anything that still
 * fails yields null and the caller keeps refusing the file. Every
 * dropped subtree is reported with its type and a text preview so the
 * user's "content may be lost" warning is concrete.
 */

import { Fragment, type Node as PMNode, type NodeType } from 'prosemirror-model';

export interface DroppedNode {
  /** Node type name, e.g. 'card', 'paragraph'. */
  type: string;
  /** First ~80 chars of the subtree's text; '' when it held none. */
  textPreview: string;
}

export interface SalvageResult {
  doc: PMNode;
  dropped: DroppedNode[];
}

function preview(node: PMNode): DroppedNode {
  const text = node.textContent.replace(/\s+/g, ' ').trim();
  return { type: node.type.name, textPreview: text.slice(0, 80) };
}

function attrsValid(node: PMNode): boolean {
  const t = node.type as unknown as { checkAttrs?: (attrs: unknown) => void };
  if (typeof t.checkAttrs !== 'function') return true;
  try {
    t.checkAttrs(node.attrs);
    return true;
  } catch {
    return false;
  }
}

function marksAllowed(child: PMNode, parent: NodeType): boolean {
  return child.marks.every((m) => parent.allowsMarkType(m.type));
}

/** Salvage one node. Returns the (possibly rebuilt) node, or null when
 *  it must be dropped entirely; appends every dropped subtree to
 *  `dropped`. */
function salvageNode(node: PMNode, dropped: DroppedNode[]): PMNode | null {
  if (node.isText) return node; // marks are judged by the parent

  if (!attrsValid(node)) {
    dropped.push(preview(node));
    return null;
  }

  // Entries recorded below this point describe losses INSIDE this
  // node; if the whole node ends up dropped they're subsumed by its
  // own entry, so remember where to truncate.
  const reportMark = dropped.length;

  // Children first — deepest damage resolves before the parent refits.
  const kids: PMNode[] = [];
  node.forEach((child) => {
    const s = salvageNode(child, dropped);
    if (s) kids.push(s);
  });

  // Greedy refit against the content expression: keep every child the
  // match (and mark rules) can accept. When a child doesn't fit where
  // it stands, first try GENERATING the missing required content
  // before it (`fillBefore` — the createAndFill mechanism): a body
  // where a head belongs then keeps the body behind an empty generated
  // head instead of losing it. Only a child that can't fit even with
  // filling is dropped.
  let match = node.type.contentMatch;
  const kept: PMNode[] = [];
  for (const child of kids) {
    if (!marksAllowed(child, node.type)) {
      dropped.push(preview(child));
      continue;
    }
    let next = match.matchType(child.type);
    if (!next) {
      const fill = match.fillBefore(Fragment.from(child));
      if (fill && fill.childCount > 0) {
        fill.forEach((f) => {
          kept.push(f);
          match = match.matchType(f.type) ?? match;
        });
        next = match.matchType(child.type);
      }
    }
    if (next) {
      match = next;
      kept.push(child);
    } else {
      dropped.push(preview(child));
    }
  }

  // Complete required content with empty fillers where possible
  // (e.g. a container needing its head, a cell needing a paragraph).
  if (!match.validEnd) {
    const fill = match.fillBefore(Fragment.empty, true);
    if (!fill) {
      // The whole node goes: subsume the inner entries under its own.
      dropped.length = reportMark;
      dropped.push(preview(node));
      return null;
    }
    fill.forEach((n) => kept.push(n));
  }

  return node.type.create(node.attrs, Fragment.fromArray(kept), node.marks);
}

/** Salvage a full document. Null when even salvage can't produce a
 *  valid doc (the caller should keep refusing the file). */
export function salvageDoc(doc: PMNode): SalvageResult | null {
  const dropped: DroppedNode[] = [];
  const out = salvageNode(doc, dropped);
  if (!out) return null;
  try {
    out.check();
  } catch {
    return null; // belt-and-braces: never hand back an invalid doc
  }
  return { doc: out, dropped };
}
