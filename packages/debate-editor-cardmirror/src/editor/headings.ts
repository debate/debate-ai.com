/**
 * Shared outline / heading utilities.
 *
 * Used by the navigation panel for rendering the outline tree, and by
 * the drag-and-drop subsystem (nav surface and editor surface) for
 * computing source ranges and drop slots.
 */

import type { Node as PMNode } from 'prosemirror-model';

export interface HeadingEntry {
  /** Schema node type name. */
  type: string;
  /** Heading text content (can be empty). */
  text: string;
  /** Document position of the heading-anchored node — for tag and
   *  in-card analytic this is the head's pos, not the wrapping
   *  card's pos. Use computeHeadingRange to get the wrapping range. */
  pos: number;
  /** Outline level (1 = Pocket, 2 = Hat, 3 = Block, 4 = Tag/Analytic). */
  level: number;
  /** Stable schema id (for keying / drag tracking / scroll target). */
  id: string | null;
  /** Cite-formatted text from the same card (only for tag entries). */
  cite: string | null;
  /** Position of the enclosing live zone (`transclusion_ref`), or null when this
   *  heading isn't transcluded. Entries sharing a `zonePos` form one transcluded
   *  run — used for the nav-pane rail, by the drag path to promote a transcluded
   *  heading's drag to the whole zone (`zoneRangeForEntry`), and by drop-slot
   *  rendering to keep every slot outside the zone (only the run's first slot
   *  survives, remapped to before the zone). */
  zonePos: number | null;
  /** True for a synthetic outline entry projected from an intra-doc live window
   *  (`self_ref`). Its content isn't in the doc, so it's a READ-ONLY nav row:
   *  `id` is null, `pos` points at the window, and drag/collapse/context-menu
   *  are disabled. Set only by the nav layer (collectHeadings never emits it). */
  windowed?: boolean;
  /** For a WINDOWED tag/analytic row that heads its card: the REAL document
   *  position of the self_ref's mirrored card/analytic_unit wrapper — the key
   *  `computeNumbering` files a live view's labels under (it numbers the
   *  window's real children host-positionally). Null for windowed rows that
   *  don't head a card; absent on base rows, which resolve their own wrapper
   *  from `pos`. Set only by the nav layer. */
  windowCardPos?: number | null;
}

export const TYPE_TO_LEVEL: Record<string, number> = {
  pocket: 1,
  hat: 2,
  block: 3,
  tag: 4,
  analytic: 4,
};

export const TYPE_LABEL: Record<string, string> = {
  pocket: 'Pocket',
  hat: 'Hat',
  block: 'Block',
  tag: 'Tag',
  analytic: 'Analytic',
};

/**
 * Walk the doc and produce a flat list of heading entries in document
 * order. Heading-anchored nodes (pocket/hat/block/tag/analytic) get
 * an entry; other content does not.
 *
 * `opts.skipCite` skips the per-tag `collectCiteText` walk, which is
 * the bulk of this function's cost on long docs (it descends every
 * card to find cite-marked text runs). The nav-pane shows cite text
 * next to each tag entry and so needs it; the drop-indicator path
 * doesn't read `entry.cite` at all, so it passes `skipCite: true` to
 * cut drag-start latency.
 */
export function collectHeadings(
  doc: PMNode,
  opts: { skipCite?: boolean } = {},
): HeadingEntry[] {
  const skipCite = opts.skipCite === true;
  const out: HeadingEntry[] = [];
  // Track the current live zone in document order (zones never nest), so each
  // heading knows its enclosing zone without a per-heading resolve.
  let zonePos: number | null = null;
  let zoneEnd = 0;
  doc.descendants((node, pos) => {
    const type = node.type.name;
    if (pos >= zoneEnd) zonePos = null; // walked past the current zone
    if (type === 'transclusion_ref') {
      zonePos = pos;
      zoneEnd = pos + node.nodeSize;
      return true; // recurse in to collect the transcluded headings
    }
    // A live view is an OPAQUE read-only unit here: its children are a derived
    // mirror, so they must not appear as real outline/drag entries. The nav
    // splices in its projected rows separately (`collectOutlineWithWindows`), and
    // no drop slot should land inside it. (It used to be a leaf atom, so
    // `descendants` skipped it for free; now it has content, so skip explicitly.)
    if (type === 'self_ref') return false;
    if (type in TYPE_TO_LEVEL) {
      const level = TYPE_TO_LEVEL[type]!;
      let cite: string | null = null;
      if (!skipCite && type === 'tag') {
        const $pos = doc.resolve(pos);
        const card = $pos.parent;
        if (card.type.name === 'card') {
          cite = collectCiteText(card);
        }
      }
      out.push({
        type,
        text: node.textContent,
        pos,
        level,
        id: typeof node.attrs['id'] === 'string' && node.attrs['id'] ? node.attrs['id'] : null,
        cite: cite && cite.trim() !== '' ? cite.trim() : null,
        zonePos,
      });
    }
    return true;
  });
  return out;
}

/**
 * Compute the doc range that should move as a unit when dragging this
 * entry — and the kind of selection that targets that range.
 *
 *  - Tag (always inside a card)        → the parent card.
 *  - Analytic inside an analytic_unit  → the unit.
 *  - Analytic inside a card            → the card (cite-position alt).
 *  - Pocket / Hat / Block              → from the heading to just
 *                                        before the next equal-or-
 *                                        shallower heading (or end of
 *                                        doc).
 *
 * Returns null if anything resolves unexpectedly.
 */
export function computeHeadingRange(
  doc: PMNode,
  entry: HeadingEntry,
): { from: number; to: number; useNodeSelection: boolean } | null {
  const $pos = doc.resolve(entry.pos);
  const node = doc.nodeAt(entry.pos);
  if (!node) return null;

  const parentName = $pos.parent.type.name;
  if (entry.type === 'tag') {
    const from = $pos.before();
    const card = doc.nodeAt(from);
    if (!card) return null;
    return { from, to: from + card.nodeSize, useNodeSelection: true };
  }
  if (entry.type === 'analytic' && (parentName === 'analytic_unit' || parentName === 'card')) {
    const from = $pos.before();
    const wrapper = doc.nodeAt(from);
    if (!wrapper) return null;
    return { from, to: from + wrapper.nodeSize, useNodeSelection: true };
  }
  // Pocket / Hat / Block: span heading → next equal-or-shallower sibling.
  const from = entry.pos;
  const to = sectionEndFromHeading($pos.parent, $pos.index(), from + node.nodeSize, entry.level);
  return { from, to, useNodeSelection: false };
}

/**
 * End position of the section that starts at a pocket/hat/block heading: the
 * start of the first FOLLOWING SIBLING (within `parent`) whose heading level
 * is equal-or-shallower, else the end of `parent`'s content.
 *
 * Sibling iteration is the whole trick (audit finding A-12/A-13, 2026-07-11):
 * the old idiom — `doc.nodesBetween(headingEnd, doc.content.size, …)` — could
 * neither stop at the boundary (nodesBetween has no abort; returning false
 * only skips descent) nor avoid descending into every text run before it, so
 * each call cost O(rest of doc) and the callers paid it per keypress or per
 * pointermove. Sections are sibling spans by construction, so type-checking
 * siblings answers the question in O(siblings to boundary) with no descent.
 *
 * Opacity for free: headings inside a live zone (`transclusion_ref`) or a
 * live view (`self_ref`) are not siblings of the heading, so they can never
 * be mistaken for its boundary. The old scan guarded zones explicitly but NOT
 * live views — a mirrored heading inside a view could truncate the enclosing
 * section mid-view (latent bug, fixed here by construction).
 *
 * `headingEndPos` is the position just after the heading node (its start +
 * nodeSize); `headingIndex` is its child index within `parent`.
 */
export function sectionEndFromHeading(
  parent: PMNode,
  headingIndex: number,
  headingEndPos: number,
  level: number,
): number {
  let pos = headingEndPos;
  for (let i = headingIndex + 1; i < parent.childCount; i++) {
    const child = parent.child(i);
    const lvl = TYPE_TO_LEVEL[child.type.name];
    if (lvl !== undefined && lvl <= level) return pos;
    pos += child.nodeSize;
  }
  return pos;
}

/**
 * The whole-zone range when `entry` is inside a live zone, else null. Used ONLY
 * by the drag path so a transcluded heading drags the whole zone as one unit
 * (with its visual indicator). Per-heading operations — nav delete / select /
 * copy — deliberately keep using `computeHeadingRange`, which returns just the
 * single heading, so they don't surprise-grab the entire zone.
 */
export function zoneRangeForEntry(
  doc: PMNode,
  entry: HeadingEntry,
): { from: number; to: number; useNodeSelection: boolean } | null {
  if (entry.zonePos == null) return null;
  const zone = doc.nodeAt(entry.zonePos);
  if (!zone || zone.type.name !== 'transclusion_ref') return null;
  return { from: entry.zonePos, to: entry.zonePos + zone.nodeSize, useNodeSelection: true };
}

/**
 * Cheap variant of `computeHeadingRange` that only returns the
 * insertion position (`range.from`). Drop-indicator rendering — both
 * the nav-pane and the editor surface — places indicators at each
 * heading's start position and never needs the heading's full end.
 * The full `computeHeadingRange` does a `nodesBetween(...)` forward
 * walk to find the next equal-or-shallower heading, which is O(doc)
 * per pocket / hat / block — running it for every entry in a long
 * doc adds up to a noticeable beat at drag start.
 */
export function headingInsertPos(doc: PMNode, entry: HeadingEntry): number | null {
  if (entry.type === 'tag' || entry.type === 'analytic') {
    // Inside a card (or analytic_unit) — drop slot is the wrapping
    // node's position, one step up from the heading.
    const $pos = doc.resolve(entry.pos);
    return $pos.before();
  }
  // Pocket / Hat / Block: the heading IS the boundary.
  return entry.pos;
}

/**
 * Concatenate the text of all runs carrying cite_mark. Whitespace-only
 * unmarked runs sitting between two cite-marked runs are kept too, so
 * "Stein 23" (where the user cited "Stein" and "23" but not the space
 * between them) renders as "Stein 23" in the preview, not "Stein23".
 * Non-whitespace unmarked text breaks the bridge.
 *
 * Exported so other surfaces (e.g., the "Create Reference" command)
 * can produce the exact same cite string the nav pane shows.
 */
export function collectCiteText(node: PMNode): string {
  type Run = { text: string; isCite: boolean };
  const runs: Run[] = [];
  node.descendants((descendant) => {
    if (!descendant.isText) return;
    runs.push({
      text: descendant.text ?? '',
      isCite: descendant.marks.some((m) => m.type.name === 'cite_mark'),
    });
  });

  const out: string[] = [];
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i]!;
    if (r.isCite) {
      out.push(r.text);
      continue;
    }
    if (out.length === 0) continue;
    if (!/^\s+$/.test(r.text)) continue;
    // Bridge only if a cite run comes later — avoids trailing whitespace.
    let hasLaterCite = false;
    for (let j = i + 1; j < runs.length; j++) {
      if (runs[j]!.isCite) { hasLaterCite = true; break; }
    }
    if (hasLaterCite) out.push(r.text);
  }
  return fixAmpersandSpacing(out.join(''));
}

function fixAmpersandSpacing(s: string): string {
  return s.replace(/(^|\s)&(\S)/g, '$1& $2');
}
