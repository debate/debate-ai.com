/**
 * Condense / Uncondense / Toggle Case — Verbatim parity for the F3
 * family. See `ARCHITECTURE.md §15 condense` for the full rule table;
 * docstring summary inline below.
 *
 * Three condense modes:
 *   - Branch C (paragraph integrity preserved): per-textblock
 *     whitespace cleanup, no merging.
 *   - Branch A (no integrity, no pilcrows): merge collapsible
 *     paragraphs with spaces at the original boundaries.
 *   - Branch B (no integrity, with pilcrows): merge with 6-pt ¶
 *     markers at the original boundaries — recoverable via Uncondense.
 *
 * `headingMode` modifies branches A and B for selection-based runs:
 * 'strict' no-ops when the selection touches a structural element;
 * 'respect' merges only `card_body` and doc-level `paragraph` runs
 * (headings, cites, undertags remain separate paragraphs);
 * 'demolish' merges every touched paragraph into one textblock typed
 * as the first touched paragraph, dissolving cards / analytic_units
 * whose head was touched and reconstituting containers around the
 * surviving tags / analytics.
 */

import { Fragment, type Node as PMNode, type Mark, type NodeType } from 'prosemirror-model';
import { TextSelection, type Command, type EditorState, type Transaction } from 'prosemirror-state';
import { canSplit } from 'prosemirror-transform';
import { schema } from '../schema/index.js';
import {
  isFoldableSpace,
  isStrippableInvisible,
  isUnicodeBreak,
} from './exotic-whitespace.js';

// ---------- Pilcrow primitives ----------

/** Unicode pilcrow (U+00B6). Verbatim's condensed-paragraph marker. */
export const PILCROW_CHAR = '¶';
/** Half-points value matching Verbatim's 6-pt sized pilcrow. */
export const PILCROW_HALF_POINTS = 12;

/** Create a single pilcrow text node carrying the non-inclusive
 *  `pilcrow_marker` mark. Non-inclusive so the cursor adjacent to a
 *  pilcrow doesn't inherit it — typing near a pilcrow stays at the
 *  surrounding text size, not 6pt. */
export function makePilcrowText(): PMNode {
  const marker = schema.marks['pilcrow_marker']!.create();
  return schema.text(PILCROW_CHAR, [marker]);
}

/** Whether a single text character at index `i` of `node` is a pilcrow
 *  marker — recognized by the `pilcrow_marker` mark, or by the legacy
 *  encoding of a `font_size` mark at 6 pt (older saved docs; Verbatim
 *  pilcrows the importer couldn't isolate into their own run). */
export function isPilcrowMarker(node: PMNode, i: number): boolean {
  if (!node.isText) return false;
  const text = node.text ?? '';
  if (text[i] !== PILCROW_CHAR) return false;
  if (node.marks.some((m) => m.type.name === 'pilcrow_marker')) return true;
  const fontSize = node.marks.find((m) => m.type.name === 'font_size');
  return !!fontSize && fontSize.attrs['halfPoints'] === PILCROW_HALF_POINTS;
}

// ---------- Node-type classification ----------

/** Body slots that participate in respect-mode collapse runs and in the
 *  no-selection in-card collapse. */
const COLLAPSIBLE_TYPES = new Set(['card_body', 'paragraph']);
/** Structural elements always preserved outside demolish mode. */
const HEADING_TYPES = new Set(['pocket', 'hat', 'block', 'tag', 'analytic']);
/** Body slots that stay separate in respect mode (in addition to
 *  headings). */
const PRESERVED_BODY_SLOTS = new Set(['cite_paragraph', 'undertag']);

function isCollapsible(node: PMNode): boolean {
  return COLLAPSIBLE_TYPES.has(node.type.name);
}

function isHeading(node: PMNode): boolean {
  return HEADING_TYPES.has(node.type.name);
}

function isPreserved(node: PMNode): boolean {
  return isHeading(node) || PRESERVED_BODY_SLOTS.has(node.type.name);
}

// ---------- Whitespace cleanup ----------

/**
 * Cleanup-eligible whitespace per Verbatim's `CondenseCard` (tab, NBSP)
 * plus the wider PDF-extraction artifact set from exotic-whitespace.ts:
 * every Unicode space separator folds to a plain space (U+2007 FIGURE
 * SPACE is the field case — non-breaking, so a card pasted with it
 * can't wrap at word gaps), in-text break characters fold like spaces
 * (the merge is flattening paragraphs anyway), and soft hyphens /
 * zero-widths are dropped outright. Page / section / column / soft-line
 * break characters aren't handled — those are docx-only artifacts our
 * schema can't contain.
 */
const TAB = '\t';

/**
 * Cleaned inline content for one textblock. Walks the textblock's
 * inline children as a flat sequence of (char, marks) entries plus
 * non-text inline leaves, applies whitespace normalization, and
 * rebuilds a Fragment that preserves marks per character.
 *
 * Rules:
 *   - Tabs, exotic Unicode spaces (NBSP, figure, thin, en/em, …), and
 *     in-text break characters → regular space; soft hyphens and
 *     zero-width characters are dropped (see exotic-whitespace.ts).
 *   - Runs of spaces (across mark boundaries) collapse to one space.
 *     The collapsed space inherits the marks of the *first* space in
 *     the run (this is what Word's Find/Replace effectively does and
 *     keeps inline formatting boundaries stable).
 *   - Leading spaces at the very start of the textblock are stripped.
 *   - Trailing single space is preserved (Verbatim's logic stops at
 *     "collapse multiple spaces", it doesn't trim trailing).
 *   - Non-text inline leaves (e.g., images) pass through untouched
 *     and break the whitespace run logically (a space immediately
 *     before/after a leaf is preserved verbatim).
 */
export function cleanTextblockContent(textblock: PMNode): Fragment {
  if (!textblock.isTextblock) return textblock.content;

  type Atom =
    | { kind: 'char'; ch: string; marks: readonly Mark[] }
    | { kind: 'leaf'; node: PMNode };

  // Flatten inline content to atoms.
  const atoms: Atom[] = [];
  textblock.content.forEach((child) => {
    if (child.isText) {
      const t = child.text ?? '';
      for (let i = 0; i < t.length; i++) {
        let ch = t[i]!;
        // Skipping without touching the run flags keeps stripping
        // transparent: a zero-width between two spaces must not stop
        // the run from collapsing.
        if (isStrippableInvisible(ch)) continue;
        if (ch === TAB || isFoldableSpace(ch) || isUnicodeBreak(ch)) ch = ' ';
        atoms.push({ kind: 'char', ch, marks: child.marks });
      }
    } else {
      atoms.push({ kind: 'leaf', node: child });
    }
  });

  // Collapse space runs in-place over the atoms array.
  // Drop leading spaces; collapse interior runs of >1 space.
  const cleaned: Atom[] = [];
  let sawNonSpaceOrLeaf = false;
  let prevWasSpace = false;
  for (const atom of atoms) {
    if (atom.kind === 'leaf') {
      cleaned.push(atom);
      sawNonSpaceOrLeaf = true;
      prevWasSpace = false;
      continue;
    }
    const isSpace = atom.ch === ' ';
    if (isSpace) {
      if (!sawNonSpaceOrLeaf) continue; // drop leading spaces
      if (prevWasSpace) continue; // collapse
      cleaned.push(atom);
      prevWasSpace = true;
    } else {
      cleaned.push(atom);
      sawNonSpaceOrLeaf = true;
      prevWasSpace = false;
    }
  }

  // Rebuild as a Fragment: contiguous chars with identical mark sets
  // group into a single text node; leaves stay separate.
  const nodes: PMNode[] = [];
  let buf = '';
  let bufMarks: readonly Mark[] = [];
  const flushText = () => {
    if (buf.length === 0) return;
    nodes.push(schema.text(buf, bufMarks));
    buf = '';
    bufMarks = [];
  };
  for (const atom of cleaned) {
    if (atom.kind === 'leaf') {
      flushText();
      nodes.push(atom.node);
      continue;
    }
    if (buf.length === 0) {
      buf = atom.ch;
      bufMarks = atom.marks;
    } else if (marksEqual(bufMarks, atom.marks)) {
      buf += atom.ch;
    } else {
      flushText();
      buf = atom.ch;
      bufMarks = atom.marks;
    }
  }
  flushText();

  return Fragment.fromArray(nodes);
}

function marksEqual(a: readonly Mark[], b: readonly Mark[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!a[i]!.eq(b[i]!)) return false;
  }
  return true;
}

// ---------- Branch C: paragraph integrity preserved ----------

interface ScopeResult {
  /** Textblocks (with positions) to apply the operation to. */
  textblocks: { node: PMNode; pos: number }[];
  /** True if no usable scope was found — caller should return false. */
  empty: boolean;
}

/**
 * Resolve the scope of a condense operation. With a non-empty selection,
 * scope = every textblock the selection touches. With an empty selection
 * inside a card or analytic_unit, scope = every textblock in that
 * container (tag included for whitespace cleanup; the caller decides
 * which subset to merge under no-integrity rules). Doc-level cursor
 * with no selection: empty scope.
 */
export function resolveCondenseScope(state: EditorState): ScopeResult {
  const { from, to, empty } = state.selection;
  const textblocks: { node: PMNode; pos: number }[] = [];

  if (!empty) {
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isTextblock) {
        textblocks.push({ node, pos });
        return false;
      }
      return true;
    });
    return { textblocks, empty: textblocks.length === 0 };
  }

  // Empty selection — look for the enclosing card or analytic_unit.
  const $from = state.selection.$from;
  for (let d = $from.depth; d >= 0; d--) {
    const ancestor = $from.node(d);
    if (ancestor.type.name === 'card' || ancestor.type.name === 'analytic_unit') {
      const containerStart = d === 0 ? 0 : $from.before(d);
      ancestor.forEach((child, offset) => {
        if (child.isTextblock) {
          textblocks.push({ node: child, pos: containerStart + 1 + offset });
        }
      });
      return { textblocks, empty: textblocks.length === 0 };
    }
  }
  // Cursor at doc-level — no-op.
  return { textblocks: [], empty: true };
}

/** Body slots that get removed by Branch C when they end up empty
 *  after whitespace cleanup. Mirrors Verbatim's `^p^p` collapse:
 *  "paragraph return return paragraph" becomes "paragraph return
 *  paragraph". Structural headings, cite_paragraphs and undertags
 *  are kept even if empty — they're intentional placeholders, and
 *  removing an empty tag would dissolve its card. */
const REMOVABLE_EMPTY_TYPES = new Set(['card_body', 'paragraph']);

/**
 * Branch C: clean intra-paragraph whitespace in each scoped textblock,
 * then remove any `card_body` / doc-level `paragraph` that ended up
 * empty. No merging, no node-type changes, no structural fixup —
 * structural elements (headings, cites, undertags) keep existing even
 * when empty.
 *
 * Mirrors Verbatim's `CondenseCard` Branch C, whose `^p^w` (paragraph
 * mark + whitespace) and `^p^p` (consecutive paragraph marks)
 * Find/Replace loops combine to "empty / whitespace-only paragraphs
 * between content paragraphs disappear".
 */
export function condenseBranchC(): Command {
  return (state, dispatch) => {
    const { textblocks } = resolveCondenseScope(state);
    if (textblocks.length === 0) return false;

    let tr: Transaction | null = null;
    // Process in reverse document order so earlier positions stay
    // valid through the loop (deleting a later textblock doesn't shift
    // earlier ones).
    for (let i = textblocks.length - 1; i >= 0; i--) {
      const { node, pos } = textblocks[i]!;
      const cleaned = cleanTextblockContent(node);
      const isEmpty = cleaned.size === 0;
      const removable = REMOVABLE_EMPTY_TYPES.has(node.type.name);

      if (isEmpty && removable) {
        // Drop the whole textblock — its container's content expression
        // allows 0+ body slots, so the result stays schema-valid.
        if (!tr) tr = state.tr;
        tr.delete(pos, pos + node.nodeSize);
        continue;
      }
      if (fragmentsEqual(cleaned, node.content)) continue;
      if (!tr) tr = state.tr;
      tr.replaceWith(pos + 1, pos + node.nodeSize - 1, cleaned);
    }
    if (!tr) return false;
    if (!dispatch) return true;
    dispatch(tr);
    return true;
  };
}

function fragmentsEqual(a: Fragment, b: Fragment): boolean {
  if (a.childCount !== b.childCount) return false;
  for (let i = 0; i < a.childCount; i++) {
    if (!a.child(i).eq(b.child(i))) return false;
  }
  return true;
}

// ---------- Branches A / B: merging logic ----------

export type HeadingMode = 'strict' | 'respect' | 'demolish';

interface MergeOptions {
  withPilcrows: boolean;
  headingMode: HeadingMode;
}

/**
 * Branches A (no pilcrows) and B (with pilcrows) — both go through
 * this dispatcher. `headingMode` picks among three algorithms for
 * selection-based merges:
 *   - 'strict'   → no-op if the selection touches any structural
 *                  element (heading / cite_paragraph / undertag).
 *                  Otherwise behaves like 'respect' for body-only
 *                  selections.
 *   - 'respect'  → preserve structural elements; merge consecutive
 *                  collapsible runs only.
 *   - 'demolish' → collapse everything in the selection into one
 *                  textblock; dissolve any container whose head was
 *                  touched; reconstitute leftover body slots.
 *
 * With no selection (cursor inside a container), the safe in-card
 * path runs unconditionally and implicitly respects headings; the
 * other paths require an actual selection.
 */
export function condenseMerge(opts: MergeOptions): Command {
  return (state, dispatch) => {
    const { empty } = state.selection;
    if (empty) {
      return condenseMergeInContainer(opts)(state, dispatch);
    }
    if (opts.headingMode === 'strict') {
      return condenseMergeSelectionStrict(opts)(state, dispatch);
    }
    if (opts.headingMode === 'demolish') {
      return condenseMergeSelectionDemolish(opts)(state, dispatch);
    }
    return condenseMergeSelectionPreserving(opts)(state, dispatch);
  };
}

/**
 * Strict mode: if the selection touches ANY structural element
 * (heading / cite_paragraph / undertag), no-op. Otherwise delegate
 * to the preserving path — which for a body-only selection collapses
 * the run normally.
 */
function condenseMergeSelectionStrict(opts: MergeOptions): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    let touchesStructural = false;
    state.doc.nodesBetween(from, to, (node) => {
      if (touchesStructural) return false;
      if (node.isTextblock && isPreserved(node)) {
        touchesStructural = true;
        return false;
      }
      return true;
    });
    if (touchesStructural) return false;
    return condenseMergeSelectionPreserving(opts)(state, dispatch);
  };
}

/**
 * No-selection variant: walk the enclosing card / analytic_unit's
 * children, build runs of consecutive collapsible-by-type body slots
 * (card_body — analytics inside cards don't occur in practice), and
 * merge each run into a single card_body. Tag, cite_paragraphs,
 * undertags stay as-is. Doc-level cursor: no-op.
 */
function condenseMergeInContainer(opts: MergeOptions): Command {
  return (state, dispatch) => {
    const $from = state.selection.$from;
    let containerDepth = -1;
    for (let d = $from.depth; d >= 0; d--) {
      const t = $from.node(d).type.name;
      if (t === 'card' || t === 'analytic_unit') {
        containerDepth = d;
        break;
      }
    }
    if (containerDepth < 0) return false;

    const container = $from.node(containerDepth);
    const containerStart = containerDepth === 0 ? 0 : $from.before(containerDepth);

    // Collect children with absolute positions so we can rebuild.
    const children: { node: PMNode; pos: number }[] = [];
    container.forEach((child, offset) => {
      children.push({ node: child, pos: containerStart + 1 + offset });
    });

    // Compute the new content for the container by walking children,
    // grouping consecutive collapsible nodes into runs, and merging
    // each run. Merge target type = type of the run's first source
    // (a run is always all-one-type because mixed types don't occur
    // as direct children of the same container).
    const newChildren: PMNode[] = [];
    let runBuffer: PMNode[] = [];
    const flushRun = () => {
      if (runBuffer.length === 0) return;
      if (runBuffer.length === 1) {
        newChildren.push(cleanedTextblock(runBuffer[0]!));
      } else {
        newChildren.push(mergeRun(runBuffer, opts.withPilcrows, runBuffer[0]!.type));
      }
      runBuffer = [];
    };
    for (const { node } of children) {
      if (isCollapsible(node)) {
        runBuffer.push(node);
      } else {
        flushRun();
        newChildren.push(cleanedTextblock(node));
      }
    }
    flushRun();

    if (newChildren.length === 0) return false;
    // Build new container; bail if unchanged.
    const newContainer = container.copy(Fragment.fromArray(newChildren));
    if (newContainer.eq(container)) return false;

    if (!dispatch) return true;
    const tr = state.tr.replaceWith(containerStart, containerStart + container.nodeSize, newContainer);
    // Map the selection forward into the new container.
    const newSel = TextSelection.near(tr.doc.resolve(Math.min($from.pos, tr.doc.content.size)));
    tr.setSelection(newSel);
    dispatch(tr);
    return true;
  };
}

/** Return the node with its inline content whitespace-cleaned; non-textblocks
 *  are passed through unchanged. */
function cleanedTextblock(node: PMNode): PMNode {
  if (!node.isTextblock) return node;
  const cleaned = cleanTextblockContent(node);
  if (fragmentsEqual(cleaned, node.content)) return node;
  return node.copy(cleaned);
}

/**
 * Merge a run of consecutive textblocks (all collapsible-by-type) into
 * a single textblock of `targetType`. Each source textblock's inline
 * content is whitespace-cleaned individually, then joined: with
 * pilcrows, a 6-pt ¶ text node between consecutive sources; without,
 * a single space (as a plain text node).
 *
 * Joiner marks: the space joiner inherits the marks of the trailing
 * text run of the preceding paragraph. Without this, a `schema.text(' ')`
 * with no marks defaults to the paragraph's base font-size (Normal),
 * so joining two 8-pt paragraphs would leave a literal 11-pt space at
 * each seam — the font-size-class plugin then sees a mixed-size
 * paragraph and bumps line-height to the larger strut, making the
 * merged paragraph look "11-pt-tall" even though most text is 8 pt.
 * Inheriting the trailing marks gives the joiner the same font-size /
 * highlight / bold / etc. as the run it's extending. Pilcrow joiners
 * keep their intrinsic 6-pt formatting and don't inherit.
 *
 * The first source's marks are preserved; later sources' content
 * keeps its own marks. No attempt to merge marks across boundaries
 * (each source contributes a discrete inline run).
 */
function mergeRun(sources: PMNode[], withPilcrows: boolean, targetType: NodeType): PMNode {
  const inlines: PMNode[] = [];
  let trailingMarks: readonly Mark[] = [];
  for (let i = 0; i < sources.length; i++) {
    if (i > 0) {
      if (withPilcrows) {
        inlines.push(makePilcrowText());
      } else {
        inlines.push(schema.text(' ', trailingMarks as Mark[]));
      }
    }
    const cleaned = cleanTextblockContent(sources[i]!);
    cleaned.forEach((child) => inlines.push(child));
    trailingMarks = trailingTextMarks(cleaned);
  }
  // Carry the first source's attributes that the target type supports —
  // notably `id`, which the nav pane keys on; a merged tag/heading
  // without it disappears from the outline.
  return targetType.create(inheritedAttrs(targetType, sources[0]!), Fragment.fromArray(inlines));
}

/** The subset of `source`'s attrs that `targetType` defines — so merging
 *  preserves `id` (and e.g. alignment) without passing attrs the target
 *  node spec doesn't accept. Defaults fill anything not carried over. */
function inheritedAttrs(targetType: NodeType, source: PMNode): Record<string, unknown> | null {
  const spec = targetType.spec.attrs;
  if (!spec) return null;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(spec)) {
    if (key in source.attrs) out[key] = source.attrs[key];
  }
  return out;
}

/** Marks of the last text node in `fragment`, walking backwards past
 *  any trailing inline leaves. Returns an empty array if the fragment
 *  has no text node. Used by `mergeRun` to give the joiner space the
 *  formatting of the run it extends. */
function trailingTextMarks(fragment: Fragment): readonly Mark[] {
  for (let i = fragment.childCount - 1; i >= 0; i--) {
    const child = fragment.child(i);
    if (child.isText) return child.marks;
  }
  return [];
}

// ---------- Selection-based merging: respect-headings path ----------

/**
 * Selection-based merge in 'respect' mode. Walk through every
 * doc-level container the selection intersects; for each container's
 * touched children, group consecutive collapsible-by-type touched
 * textblocks into runs and merge each run. Preserved-type touched
 * textblocks still get intra-paragraph whitespace cleanup.
 *
 * Implementation: we rebuild the document from the outermost level
 * that contains all touched content (doc), preserving everything
 * outside the selection range and applying run-merging within.
 */
function condenseMergeSelectionPreserving(opts: MergeOptions): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;

    // Find all textblocks the selection touches, with their parent
    // container path (so we can rebuild containers correctly).
    type Touched = { node: PMNode; pos: number; parent: PMNode; parentPos: number; indexInParent: number };
    const touched: Touched[] = [];
    state.doc.nodesBetween(from, to, (node, pos, parent, indexInParent) => {
      if (node.isTextblock && parent) {
        // Compute parent's pos: it's the position of `parent` in the doc.
        // pos is the position of `node` (the textblock). The parent's
        // position is pos - (offset within parent) - 1. We can derive it
        // by finding parent's start.
        const parentPos = findParentPos(state.doc, pos);
        touched.push({ node, pos, parent, parentPos, indexInParent });
        return false;
      }
      return true;
    });
    if (touched.length === 0) return false;

    // Group consecutive touched textblocks that share the same parent
    // AND are at consecutive indices. Each group is a "run candidate".
    type Group = { parent: PMNode; parentPos: number; items: Touched[] };
    const groups: Group[] = [];
    let currentGroup: Group | null = null;
    for (const t of touched) {
      if (
        currentGroup &&
        currentGroup.parent === t.parent &&
        currentGroup.items[currentGroup.items.length - 1]!.indexInParent + 1 === t.indexInParent
      ) {
        currentGroup.items.push(t);
      } else {
        currentGroup = { parent: t.parent, parentPos: t.parentPos, items: [t] };
        groups.push(currentGroup);
      }
    }

    let tr: Transaction | null = null;
    // Process groups in reverse so position changes don't invalidate earlier work.
    for (let gi = groups.length - 1; gi >= 0; gi--) {
      const group = groups[gi]!;
      // Inside this group, build runs of consecutive collapsible textblocks.
      const newChildren: PMNode[] = [];
      let runBuffer: PMNode[] = [];
      const flushRun = () => {
        if (runBuffer.length === 0) return;
        if (runBuffer.length === 1) {
          newChildren.push(cleanedTextblock(runBuffer[0]!));
        } else {
          newChildren.push(mergeRun(runBuffer, opts.withPilcrows, runBuffer[0]!.type));
        }
        runBuffer = [];
      };
      for (const item of group.items) {
        if (isCollapsible(item.node)) {
          runBuffer.push(item.node);
        } else {
          flushRun();
          newChildren.push(cleanedTextblock(item.node));
        }
      }
      flushRun();

      // Replace the group's textblocks in place. The replacement spans
      // from the first item's pos to the last item's pos + nodeSize.
      const first = group.items[0]!;
      const last = group.items[group.items.length - 1]!;
      const replaceFrom = first.pos;
      const replaceTo = last.pos + last.node.nodeSize;
      const oldFragment = Fragment.fromArray(group.items.map((i) => i.node));
      const newFragment = Fragment.fromArray(newChildren);
      if (fragmentsEqual(oldFragment, newFragment)) continue;
      if (!tr) tr = state.tr;
      tr.replaceWith(replaceFrom, replaceTo, newFragment);
    }

    if (!tr) return false;
    if (!dispatch) return true;
    dispatch(tr);
    return true;
  };
}

/** Find the position of the parent of a textblock at `pos`. The textblock's
 *  parent is the smallest node that wraps `pos`. */
function findParentPos(doc: PMNode, pos: number): number {
  const $pos = doc.resolve(pos);
  // Resolving at the boundary just before the textblock yields a depth
  // whose innermost node is the parent, so `before(depth)` is the
  // parent's position (-1 when the textblock sits at doc level).
  return $pos.depth === 0 ? -1 : $pos.before($pos.depth);
}

// ---------- Selection-based merging: demolish path ----------

/**
 * Selection-based merge in 'demolish' mode. The destructive
 * path: every touched textblock contributes its full text to a single
 * merged textblock of type = type of the first touched paragraph.
 * Containers (cards / analytic_units) whose head was touched dissolve;
 * leftover body slots absorb into a container restarted by a surviving
 * tag / analytic, or demote to doc-level paragraphs.
 */
function condenseMergeSelectionDemolish(opts: MergeOptions): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;

    // Walk doc-level children. Identify the doc-level range that
    // contains all touched content, then rebuild it.
    let docFromIndex = -1;
    let docToIndex = -1;
    let cursor = 0;
    state.doc.forEach((child, _offset, idx) => {
      const childStart = cursor;
      const childEnd = cursor + child.nodeSize;
      if (childEnd > from && childStart < to) {
        if (docFromIndex === -1) docFromIndex = idx;
        docToIndex = idx;
      }
      cursor = childEnd;
    });
    if (docFromIndex === -1) return false;

    // Flatten the affected doc-level children into a sequence of
    // textblocks (paragraphs at any depth), tracking the position of
    // each.
    type Flat = { node: PMNode; touched: boolean };
    const flat: Flat[] = [];
    cursor = 0;
    let replaceFrom = -1;
    let replaceTo = -1;
    state.doc.forEach((child, _offset, idx) => {
      const childStart = cursor;
      cursor += child.nodeSize;
      if (idx < docFromIndex || idx > docToIndex) return;
      if (idx === docFromIndex) replaceFrom = childStart;
      if (idx === docToIndex) replaceTo = cursor;
      flattenForDemolish(child, childStart, from, to, flat);
    });
    if (replaceFrom === -1 || replaceTo === -1) return false;

    // A table can't be merged into a flat textblock run without destroying
    // its rows/cells, and the demolish replacement has nowhere to put an
    // atomic block mid-merge. Bail (no-op) rather than flatten it — the
    // doc is left intact and the user can handle the table separately.
    let touchesTable = false;
    state.doc.nodesBetween(replaceFrom, replaceTo, (n) => {
      if (n.type.name === 'table') touchesTable = true;
      return !touchesTable;
    });
    if (touchesTable) return false;

    // Find first and last touched textblock indices in `flat`.
    let firstTouchedIdx = -1;
    let lastTouchedIdx = -1;
    for (let i = 0; i < flat.length; i++) {
      if (flat[i]!.touched) {
        if (firstTouchedIdx === -1) firstTouchedIdx = i;
        lastTouchedIdx = i;
      }
    }
    if (firstTouchedIdx === -1) return false;

    // Merge type = type of first touched textblock.
    const targetType = flat[firstTouchedIdx]!.node.type;

    // The merged textblock takes the type of the first touched node and
    // collects the FULL text of every touched textblock in between
    // (inclusive), with joiner spaces or pilcrows.
    const touchedNodes: PMNode[] = [];
    for (let i = firstTouchedIdx; i <= lastTouchedIdx; i++) {
      if (flat[i]!.touched) touchedNodes.push(flat[i]!.node);
    }
    const mergedNode = mergeRun(touchedNodes, opts.withPilcrows, targetType);

    // Build the replacement: untouched pre-touched items, the merged
    // node, untouched post-touched items. `flat` has lost container
    // structure, so `buildDemolishReplacement` emits everything at doc
    // level and `reconstituteContainers` rebuilds cards / analytic_units
    // around the surviving tags and analytics (orphan body slots demote
    // to paragraphs).

    const result = buildDemolishReplacement(
      state,
      flat,
      firstTouchedIdx,
      lastTouchedIdx,
      mergedNode,
      docFromIndex,
      docToIndex,
    );
    if (!result) return false;

    if (!dispatch) return true;
    const tr = state.tr.replaceWith(replaceFrom, replaceTo, result);
    dispatch(tr);
    return true;
  };
}

/**
 * Flatten a doc-level child (which may be a container) into a flat
 * sequence of textblocks with per-textblock touched flags.
 *
 * "Touched" = textblock range overlaps [from, to).
 */
function flattenForDemolish(
  child: PMNode,
  childStart: number,
  selFrom: number,
  selTo: number,
  out: { node: PMNode; touched: boolean }[],
): void {
  if (child.isTextblock) {
    const tbStart = childStart;
    const tbEnd = childStart + child.nodeSize;
    const touched = tbEnd > selFrom && tbStart < selTo;
    out.push({ node: child, touched });
    return;
  }
  // Container: walk children.
  let cursor = childStart + 1; // +1 for the container's opening token
  child.forEach((g) => {
    flattenForDemolish(g, cursor, selFrom, selTo, out);
    cursor += g.nodeSize;
  });
}

/**
 * Build the replacement fragment for the demolish path: untouched
 * nodes before the merged region (whitespace-cleaned), the merged
 * textblock at the cut point, then untouched nodes after. The
 * sequence is emitted flat, and `reconstituteContainers` rebuilds
 * container structure — a tag / analytic restarts a card /
 * analytic_unit and absorbs the body slots that follow it.
 */
function buildDemolishReplacement(
  state: EditorState,
  flat: { node: PMNode; touched: boolean }[],
  firstTouchedIdx: number,
  lastTouchedIdx: number,
  mergedNode: PMNode,
  _docFromIndex: number,
  _docToIndex: number,
): Fragment | null {
  void state;
  // Step 1: emit the sequence at doc level — pre-touched, merged, post-touched.
  const seq: PMNode[] = [];
  for (let i = 0; i < firstTouchedIdx; i++) {
    if (!flat[i]!.touched) seq.push(cleanedTextblock(flat[i]!.node));
  }
  seq.push(mergedNode);
  for (let i = lastTouchedIdx + 1; i < flat.length; i++) {
    if (!flat[i]!.touched) seq.push(cleanedTextblock(flat[i]!.node));
  }

  // Step 2: walk `seq` and reconstitute containers — body slots
  // (card_body, cite_paragraph, undertag) lift to doc level absorption
  // logic. A tag/analytic starts a new container.
  return reconstituteContainers(seq);
}

/**
 * Walk a flat sequence of would-be-doc-level nodes. For each:
 *   - tag → start a new card; subsequent body slots absorb into it
 *     until the next heading or non-body node.
 *   - analytic → start a new analytic_unit; absorb subsequent body slots.
 *   - card_body / cite_paragraph / undertag → absorb into the current
 *     surviving container if any; otherwise demote to a doc-level
 *     paragraph (matching the schema doc content expression).
 *   - Other doc-level nodes (pocket / hat / block / paragraph): just
 *     emit; container is broken.
 */
function reconstituteContainers(seq: PMNode[]): Fragment {
  type Pending =
    | { kind: 'card'; tag: PMNode; body: PMNode[] }
    | { kind: 'analytic_unit'; analytic: PMNode; body: PMNode[] };
  const out: PMNode[] = [];
  let pending: Pending | null = null;
  const flushPending = () => {
    if (!pending) return;
    if (pending.kind === 'card') {
      out.push(schema.nodes['card']!.create(null, [pending.tag, ...pending.body]));
    } else {
      out.push(schema.nodes['analytic_unit']!.create(null, [pending.analytic, ...pending.body]));
    }
    pending = null;
  };
  for (const node of seq) {
    const t = node.type.name;
    if (t === 'tag') {
      flushPending();
      pending = { kind: 'card', tag: node, body: [] };
      continue;
    }
    if (t === 'analytic') {
      flushPending();
      pending = { kind: 'analytic_unit', analytic: node, body: [] };
      continue;
    }
    if (t === 'card_body' || t === 'cite_paragraph' || t === 'undertag') {
      if (pending) {
        pending.body.push(node);
      } else {
        // Orphan body slot at doc level → demote to paragraph.
        const para = schema.nodes['paragraph']!.create(null, node.content);
        out.push(para);
      }
      continue;
    }
    // Anything else (pocket / hat / block / paragraph): emit as-is and
    // close any pending container.
    flushPending();
    out.push(node);
  }
  flushPending();
  return Fragment.fromArray(out);
}

// ---------- Uncondense ----------

/**
 * Reverse Branch B: find 6-pt ¶ markers in scope and split the
 * containing textblock at each marker, dropping the marker character
 * itself. Scope = selection if non-empty, else the current card /
 * analytic_unit. A doc-level cursor with no selection is a no-op
 * (Verbatim prompts and applies doc-wide; we don't).
 */
export function uncondense(): Command {
  return (state, dispatch) => {
    const { textblocks } = resolveCondenseScope(state);
    if (textblocks.length === 0) return false;

    // Scan textblocks for pilcrow markers. For each marker, plan a
    // split (record textblock pos + char index).
    type Split = { tbPos: number; tbNode: PMNode; charIndex: number };
    const splits: Split[] = [];
    for (const { node, pos } of textblocks) {
      let cursor = 0;
      node.content.forEach((child) => {
        if (child.isText) {
          for (let i = 0; i < (child.text ?? '').length; i++) {
            if (isPilcrowMarker(child, i)) {
              splits.push({ tbPos: pos, tbNode: node, charIndex: cursor + i });
            }
          }
        }
        cursor += child.nodeSize;
      });
    }
    if (splits.length === 0) return false;
    if (!dispatch) return true;

    const tr = state.tr;
    // Process splits in reverse position order so positions stay valid.
    splits.sort((a, b) => (b.tbPos + b.charIndex) - (a.tbPos + a.charIndex));
    for (const split of splits) {
      const charPos = split.tbPos + 1 + split.charIndex;
      // Delete the pilcrow char and split the textblock at that position.
      tr.delete(charPos, charPos + 1);
      // A pilcrow can land in a container head (e.g. a tag — demolish-mode
      // merge, or pasting condensed body into a tag): splitting there would
      // make two tags in one card, which the schema forbids, and `tr.split`
      // throws. Guard with canSplit and fall back to delete-marker-only so
      // the operation degrades instead of crashing the editor.
      if (canSplit(tr.doc, charPos)) {
        tr.split(charPos);
      }
    }
    dispatch(tr);
    return true;
  };
}

// ---------- Toggle case ----------

type CaseMode = 'lower' | 'upper' | 'title' | 'mixed';

function detectCase(text: string): CaseMode {
  if (text.length === 0) return 'mixed';
  const hasUpper = /[A-Z]/.test(text);
  const hasLower = /[a-z]/.test(text);
  if (!hasUpper && hasLower) return 'lower';
  if (hasUpper && !hasLower) return 'upper';
  // Title Case: every word starts uppercase, rest lowercase.
  const titleRe = /^(?:[A-Z][a-z]*\b\W*)+$/;
  if (titleRe.test(text)) return 'title';
  return 'mixed';
}

function toTitleCase(text: string): string {
  return text.replace(/\b\w[\w']*/g, (w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * 3-state cycle: lowercase → UPPERCASE → Title Case → lowercase.
 * Mixed-case selections start at lowercase (matches Word's "next
 * stop" heuristic).
 */
export function toggleCase(): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;

    const text = state.doc.textBetween(from, to, '', '');
    if (text.length === 0) return false;
    const current = detectCase(text);
    let next: string;
    switch (current) {
      case 'lower':
        next = text.toUpperCase();
        break;
      case 'upper':
        next = toTitleCase(text);
        break;
      case 'title':
        next = text.toLowerCase();
        break;
      case 'mixed':
        next = text.toLowerCase();
        break;
    }
    if (next === text) return false;

    if (!dispatch) return true;

    // Transform each text-node segment PER SEGMENT rather than slicing a
    // single globally-cased string by original lengths — length-changing
    // case maps (German ß→SS, Turkish İ→i̇) otherwise shift the slice
    // boundaries and eat the segment's last character(s). Title case
    // carries word state across segments so a word split across two text
    // nodes (e.g. a mark boundary) still capitalizes only its first letter.
    let inWord = false;
    const caseSeg = (seg: string): string => {
      switch (current) {
        case 'lower':
          return seg.toUpperCase();
        case 'title':
        case 'mixed':
          return seg.toLowerCase();
        case 'upper': {
          let out = '';
          for (const c of seg) {
            if (/[A-Za-z0-9_]/.test(c)) {
              out += inWord ? c.toLowerCase() : c.toUpperCase();
              inWord = true;
            } else if (c === "'" || c === '’') {
              out += c; // apostrophe stays inside the word
            } else {
              out += c;
              inWord = false;
            }
          }
          return out;
        }
      }
    };

    // Compute replacements left-to-right (word state flows forward)…
    const edits: Array<{ from: number; to: number; node: PMNode }> = [];
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isText) return true;
      const t = node.text ?? '';
      const nodeStart = pos;
      const nodeEnd = pos + node.nodeSize;
      const localFrom = Math.max(nodeStart, from) - nodeStart;
      const localTo = Math.min(nodeEnd, to) - nodeStart;
      if (localTo <= localFrom) return true;
      // Replace ONLY the cased slice, never the whole text node: a
      // ReplaceStep maps positions strictly INSIDE its range to the
      // range's edge, so any edit wider than the selection collapses
      // a mid-node selection end to the node boundary — which breaks
      // the re-select below, and repeat Shift-F3 needs the selection
      // to survive. Bounding the edit by the selection puts from/to
      // on edit boundaries, where mapping is exact. Marks are uniform
      // within a text node, so the slice carries them unchanged.
      edits.push({
        from: nodeStart + localFrom,
        to: nodeStart + localTo,
        node: schema.text(caseSeg(t.slice(localFrom, localTo)), node.marks),
      });
      return true;
    });

    // …then apply them back-to-front so an earlier edit's positions stay
    // valid even when a later one changed length.
    const tr = state.tr;
    for (let i = edits.length - 1; i >= 0; i--) {
      const e = edits[i]!;
      tr.replaceWith(e.from, e.to, e.node);
    }

    // Re-select the (possibly length-shifted) transformed range so the
    // user can cycle case again without re-selecting.
    tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(from), tr.mapping.map(to)));

    dispatch(tr);
    return true;
  };
}

// ---------- Condense with warning ----------

/**
 * "Condense with warning" — selection-only condense limited to a
 * single card. Parallels Create Reference in scope validation:
 *
 *   - Selection must be non-empty.
 *   - Every textblock the selection touches must be a `card_body`.
 *   - All touched paragraphs must share the same parent `card`.
 *
 * Behavior: merges the touched paragraphs into a single `card_body`
 * (Branch A — no paragraph integrity, no pilcrows) and wraps the
 * merged paragraph with two new `card_body` markers — the full
 * pause and resume text supplied by the caller. For the built-in
 * delimiter options this is the classic
 * `<open>PARAGRAPH INTEGRITY PAUSES<close>` pairing; for the
 * `'custom'` option the caller supplies whatever literal strings
 * the user typed.
 *
 * No-op on empty selection, non-card-body content, multiple cards,
 * or when no card_body is actually touched. Also no-ops with a
 * console warn when either marker is empty (a half-filled custom
 * setting).
 */
export function condenseWithWarning(
  getMarkers: () => { pause: string; resume: string },
): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;

    let parentCardPos: number | null = null;
    const paragraphs: { node: PMNode; pos: number }[] = [];
    let invalid = false;
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (invalid) return false;
      if (!node.isTextblock) return true;
      if (node.type.name !== 'card_body') {
        invalid = true;
        return false;
      }
      const $start = state.doc.resolve(pos + 1);
      if ($start.depth < 2) {
        invalid = true;
        return false;
      }
      const cardDepth = $start.depth - 1;
      const card = $start.node(cardDepth);
      const cardPos = $start.before(cardDepth);
      if (card.type.name !== 'card') {
        invalid = true;
        return false;
      }
      if (parentCardPos === null) {
        parentCardPos = cardPos;
      } else if (cardPos !== parentCardPos) {
        invalid = true;
        return false;
      }
      paragraphs.push({ node, pos });
      return false;
    });
    if (invalid || paragraphs.length === 0) return false;
    // Don't emit broken markers if the user picked Custom but left
    // a half-filled setting. No-op + console warn.
    const { pause, resume } = getMarkers();
    if (!pause || !resume) {
      console.warn(
        'condenseWithWarning: pause / resume marker is empty — skipping',
      );
      return false;
    }
    if (!dispatch) return true;

    const cardBodyType = schema.nodes['card_body']!;

    const pausePara = cardBodyType.create(null, schema.text(pause));
    const resumePara = cardBodyType.create(null, schema.text(resume));
    const mergedPara =
      paragraphs.length === 1
        ? cleanedTextblock(paragraphs[0]!.node)
        : mergeRun(paragraphs.map((p) => p.node), false, cardBodyType);

    const first = paragraphs[0]!;
    const last = paragraphs[paragraphs.length - 1]!;
    const tr = state.tr;
    tr.replaceWith(
      first.pos,
      last.pos + last.node.nodeSize,
      Fragment.fromArray([pausePara, mergedPara, resumePara]),
    );
    dispatch(tr);
    return true;
  };
}
