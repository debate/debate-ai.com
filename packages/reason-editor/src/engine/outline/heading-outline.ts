/**
 * Heading outline + collapse/expand computation.
 *
 * Headings are flat paragraphs in document order (see ../schema/nodes.ts);
 * there is no schema-level nesting. This module derives the outline
 * implied by heading levels and computes which document ranges a
 * collapsed heading should hide, so a nav panel / editor view can
 * implement expandable H1-H4 sections without changing the schema.
 */

import type { Node as PMNode } from 'prosemirror-model';
import { HEADING_TYPE_NAMES } from '../schema/ids.js';

/** Outline depth: pocket=H1, hat=H2, block=H3, tag/analytic=H4 (see
 *  nodes.ts toDOM, which renders each as the matching `<hN>` tag). */
export type HeadingLevel = 1 | 2 | 3 | 4;

export const HEADING_LEVELS: Readonly<Record<string, HeadingLevel>> = {
  pocket: 1,
  hat: 2,
  block: 3,
  tag: 4,
  analytic: 4,
};

export type OutlineHeading = {
  /** Stable heading id (see ../schema/ids.ts); synthetic fallback keyed
   *  by position for headings that haven't been stamped with one yet. */
  id: string;
  type: string;
  level: HeadingLevel;
  text: string;
  /** Position of the heading node itself. */
  pos: number;
  /** Position immediately after the heading node's content. */
  endPos: number;
};

/** Walks a doc and returns every heading-typed node in document order. */
export function buildHeadingOutline(doc: PMNode): OutlineHeading[] {
  const outline: OutlineHeading[] = [];

  doc.descendants((node, pos) => {
    if (!HEADING_TYPE_NAMES.has(node.type.name)) return true;

    const level = HEADING_LEVELS[node.type.name];
    if (level === undefined) return true;

    const rawId = node.attrs['id'];
    const id = typeof rawId === 'string' && rawId ? rawId : `pos-${pos}`;

    outline.push({
      id,
      type: node.type.name,
      level,
      text: node.textContent,
      pos,
      endPos: pos + node.nodeSize,
    });

    return true;
  });

  return outline;
}

/**
 * Given the outline and a set of collapsed heading ids, returns the ids of
 * headings that remain visible in a nav panel — every heading except those
 * nested (by level) under a collapsed ancestor. A collapsed heading itself
 * stays visible; only its descendants are hidden. Collapses compose, so a
 * heading nested under two collapsed ancestors is still hidden exactly
 * once its nearest collapsed ancestor is expanded.
 */
export function getVisibleHeadingIds(
  outline: readonly OutlineHeading[],
  collapsedIds: ReadonlySet<string> | readonly string[],
): Set<string> {
  const collapsed = collapsedIds instanceof Set ? collapsedIds : new Set(collapsedIds);
  const visible = new Set<string>();
  let hiddenBelowLevel: HeadingLevel | null = null;

  for (const heading of outline) {
    if (hiddenBelowLevel !== null && heading.level > hiddenBelowLevel) {
      continue;
    }
    hiddenBelowLevel = null;
    visible.add(heading.id);
    if (collapsed.has(heading.id)) {
      hiddenBelowLevel = heading.level;
    }
  }

  return visible;
}

export type CollapsedRange = {
  headingId: string;
  /** Start of hidden content — immediately after the collapsed heading. */
  from: number;
  /** End of hidden content — exclusive. */
  to: number;
};

/**
 * Computes the document ranges that should be hidden when the given
 * headings are collapsed. Each range spans from the end of a collapsed
 * heading to the next heading at the same or shallower level (or the end
 * of the document) — the same "section" a nav panel would fold away.
 */
export function getCollapsedRanges(
  doc: PMNode,
  outline: readonly OutlineHeading[],
  collapsedIds: ReadonlySet<string> | readonly string[],
): CollapsedRange[] {
  const collapsed = collapsedIds instanceof Set ? collapsedIds : new Set(collapsedIds);
  const ranges: CollapsedRange[] = [];

  for (let i = 0; i < outline.length; i++) {
    const heading = outline[i];
    if (!heading || !collapsed.has(heading.id)) continue;

    let to = doc.content.size;
    for (let j = i + 1; j < outline.length; j++) {
      const next = outline[j];
      if (next && next.level <= heading.level) {
        to = next.pos;
        break;
      }
    }

    if (to > heading.endPos) {
      ranges.push({ headingId: heading.id, from: heading.endPos, to });
    }
  }

  return ranges;
}

/** Whether a document position falls inside any collapsed range. */
export function isPositionCollapsed(
  pos: number,
  ranges: readonly CollapsedRange[],
): boolean {
  return ranges.some((range) => pos >= range.from && pos < range.to);
}

/**
 * Toggles a heading id's membership in a collapsed-id list, returning a new
 * array — present ids are removed, absent ids are appended. Used by
 * `OutlineNavPanel` to flip a heading's collapse state before persisting
 * through `state/collapsedHeadings.ts`.
 */
export function toggleCollapsedHeadingId(
  collapsedIds: readonly string[],
  id: string,
): string[] {
  return collapsedIds.includes(id)
    ? collapsedIds.filter((existing) => existing !== id)
    : [...collapsedIds, id];
}
