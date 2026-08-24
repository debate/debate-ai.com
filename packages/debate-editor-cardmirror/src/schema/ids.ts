/**
 * Stable heading IDs.
 *
 * Per ARCHITECTURE.md §4, heading-level nodes (pocket, hat, block, tag,
 * analytic) carry a UUID `id` attr that survives edits and round-trips
 * to docx as a `pmd-heading-<uuid>` bookmark.
 */

import type { Node as PMNode } from 'prosemirror-model';

export const HEADING_BOOKMARK_PREFIX = 'pmd-heading-';

/** Schema node types that carry the heading-id attr (per
 *  `headingAttrs` in `./nodes.ts`). Centralised here so the
 *  id-walking helpers below stay in sync with the schema. */
export const HEADING_TYPE_NAMES: ReadonlySet<string> = new Set([
  'pocket',
  'hat',
  'block',
  'tag',
  'analytic',
]);

export function newHeadingId(): string {
  // Node ≥ 19 has crypto.randomUUID() globally.
  return crypto.randomUUID();
}

/** Walk a doc and reconstruct any heading-typed node missing its
 *  `id` attr with a fresh one. Returns the original node unchanged
 *  when nothing needed stamping, so callers can cheaply chain
 *  through hot paths.
 *
 *  The cmir loader runs this to repair pre-alpha.6 files: the F2
 *  schema-fitter could synthesize tag nodes from `attrs.default`
 *  (`id: null`), bypassing `newHeadingId()`. An id-less heading is
 *  functionally invisible — the nav pane skips it and the
 *  cursor→nav highlight falls back to the previous tag — so we
 *  stamp at load. This also catches any future code path that
 *  constructs a heading without `newHeadingId()`. */
export function stampMissingHeadingIds(doc: PMNode): PMNode {
  return walk(doc);
}

function walk(node: PMNode): PMNode {
  // Text is immutable + carries no attrs; skip the reconstruction
  // dance.
  if (node.isText) return node;
  // Recurse first so inner stamps land before we decide whether
  // to reconstruct this node.
  let inner = node.content;
  if (!node.isLeaf) {
    const newChildren: PMNode[] = [];
    let changed = false;
    node.forEach((child) => {
      const next = walk(child);
      if (next !== child) changed = true;
      newChildren.push(next);
    });
    if (changed) {
      // Construct via type.create to use the same Fragment.from
      // path Node.copy uses, but with our own array.
      inner = node.type.create(node.attrs, newChildren, node.marks).content;
    }
  }
  const needsStamp =
    HEADING_TYPE_NAMES.has(node.type.name) &&
    (node.attrs as Record<string, unknown>)['id'] == null;
  if (!needsStamp) {
    return inner === node.content ? node : node.type.create(node.attrs, inner, node.marks);
  }
  return node.type.create(
    { ...node.attrs, id: newHeadingId() },
    inner,
    node.marks,
  );
}

export function bookmarkNameForId(id: string): string {
  return `${HEADING_BOOKMARK_PREFIX}${id}`;
}

export function idFromBookmarkName(name: string): string | null {
  return name.startsWith(HEADING_BOOKMARK_PREFIX)
    ? name.slice(HEADING_BOOKMARK_PREFIX.length)
    : null;
}
