/**
 * Pre-export transforms that strip / filter the doc based on the
 * Save As dialog's checkboxes. Runs BEFORE `toDocx` so the docx
 * output reflects the user's inclusion choices without the exporter
 * itself needing per-feature flags.
 *
 * Five user options drive this:
 *   - includeComments   (no doc transform — gated at the export call
 *                        site, which withholds the doc's comment
 *                        threads from the exporter when off)
 *   - includeAnalytics  (strip analytic_units + in-card analytic)
 *   - includeUndertags  (strip undertag nodes wherever they live)
 *   - readMode          (mutually exclusive — replaces the above
 *                        and saves only what's visible in read mode)
 *   - markedCardsOnly   (mutually exclusive — keep only the cards that
 *                        contain a reading marker, flat)
 *
 * Read-mode export mirrors the read-mode plugin's keep/hide rules:
 *   - Headings (pocket / hat / block / tag / analytic): kept whole.
 *   - cite_paragraph: kept, inlines filtered to those carrying
 *     cite_mark.
 *   - card_body / paragraph / undertag: kept, inlines filtered to
 *     those carrying the `highlight` mark.
 *   - Cards / analytic_units: recursed; container kept iff at least
 *     one survivor child exists.
 *   - Tables: dropped (read mode plugin doesn't model them).
 */

import { Fragment, type Node as PMNode, type Schema } from 'prosemirror-model';
import { Transform } from 'prosemirror-transform';
import { isReadingMarkerColor, READING_MARKER_COLOR } from '../editor/reading-marker.js';
import { computeUnreadDecorations } from '../editor/mark-unread-plugin.js';

export interface ExportTransformOptions {
  includeComments: boolean;
  includeAnalytics: boolean;
  includeUndertags: boolean;
  readMode: boolean;
  /** Keep ONLY the cards that contain a reading marker, flat — no headings,
   *  no analytics. Mutually exclusive with the other options (like readMode).
   *  Optional / defaults off so existing callers don't have to opt in. */
  markedCardsOnly?: boolean;
  /** Bake the display-only "text after a reading marker is red"
   *  (`markUnreadAfterMarker`) into real `font_color` runs, so the export
   *  matches what's on screen. Mirror the live setting at the call site;
   *  off by default so unrelated callers don't have to opt in. */
  markUnreadAfterMarker?: boolean;
}

export function transformForExport(
  doc: PMNode,
  opts: ExportTransformOptions,
): PMNode {
  let out: PMNode;
  if (opts.readMode) out = applyReadModeTransform(doc);
  else if (opts.markedCardsOnly) out = extractMarkedCards(doc);
  else {
    out = doc;
    if (!opts.includeAnalytics) out = stripAnalytics(out);
    if (!opts.includeUndertags) out = stripUndertags(out);
    // includeComments needs no doc transform here: the export call site
    // gates it by withholding the doc's comment threads from the
    // exporter when off (notes / AI threads have their own flags there).
  }
  // Last, so it colors whatever survived the transforms above.
  if (opts.markUnreadAfterMarker) out = bakeUnreadRed(out);
  return out;
}

// ------------------- unread-after-marker red -------------------
//
// The `markUnreadAfterMarker` review aid tints body text after a reading
// marker red via a display-only `.pmd-unread` decoration (see
// `mark-unread-plugin.ts`) — it never touches the doc, so the exporter can't
// see it. To make red-on-screen stay red in Word, reuse the plugin's exact
// walk to get the same ranges, then bake them into real `font_color` FF0000
// runs. Reused (not re-implemented) so the two can't drift.

function bakeUnreadRed(doc: PMNode): PMNode {
  const fontColor = doc.type.schema.marks['font_color'];
  if (!fontColor) return doc;
  const decos = computeUnreadDecorations(doc);
  if (decos.length === 0) return doc;
  const tr = new Transform(doc);
  const mark = fontColor.create({ color: READING_MARKER_COLOR });
  for (const d of decos) tr.addMark(d.from, d.to, mark);
  return tr.doc;
}

// --------------------------- read mode ---------------------------
//
// Mirrors the read-mode CSS in `style.css` (search "pmd-read-mode"):
//   - Doc level: only pocket / hat / block / card / analytic_unit are
//     visible. Loose paragraphs, cite_paragraphs, card_bodies, etc.
//     at doc level are `display: none` and so drop on export too.
//   - Inside a card: tag / cite_paragraph / analytic stay block;
//     card_body uses `display: contents` so adjacent bodies flow
//     together as one stream. Undertags are not in the visible-
//     children allowlist → drop.
//   - Inline: every text node carrying the visibility-keep mark gets
//     a `::after { content: ' ' }` separator, so adjacent kept chunks
//     read as separate words. We synthesize the equivalent here as
//     literal space text nodes between consecutive kept inlines.

function applyReadModeTransform(doc: PMNode): PMNode {
  const schema = doc.type.schema;
  const out: PMNode[] = [];
  doc.forEach((child) => {
    const t = transformDocLevelForReadMode(child, schema);
    if (t) out.push(t);
  });
  return schema.nodes['doc']!.create(null, out);
}

function transformDocLevelForReadMode(node: PMNode, schema: Schema): PMNode | null {
  const name = node.type.name;
  if (name === 'pocket' || name === 'hat' || name === 'block') return node;
  if (name === 'card' || name === 'analytic_unit') {
    return transformContainerForReadMode(node, schema);
  }
  // Everything else at doc level is hidden in read mode display
  // (loose paragraphs, cite_paragraphs, card_bodies, undertags,
  // tables) so it drops on export.
  return null;
}

/** Card / analytic_unit children rebuilt for read mode. Block-level
 *  children (tag, analytic, cite_paragraph) keep their own paragraph
 *  position. card_body / paragraph children flow together — their
 *  kept inlines accumulate into a merge buffer that flushes to a
 *  single card_body whenever a real block separates them, or at the
 *  end of the container. Undertags and tables drop without breaking
 *  the merge run (they're invisible in read mode display, so
 *  surrounding bodies stay contiguous). */
function transformContainerForReadMode(container: PMNode, schema: Schema): PMNode | null {
  const out: PMNode[] = [];
  let mergeBuffer: PMNode[] = [];

  const flushMerge = (): void => {
    if (mergeBuffer.length === 0) return;
    out.push(schema.nodes['card_body']!.create(null, mergeBuffer));
    mergeBuffer = [];
  };

  container.forEach((child) => {
    const name = child.type.name;
    // Block-level children: flush the merge buffer first so their
    // position relative to surrounding bodies is preserved.
    if (name === 'tag' || name === 'analytic') {
      flushMerge();
      out.push(child); // structural headings keep all their content
    } else if (name === 'cite_paragraph') {
      flushMerge();
      const kept = filterInlinesByMark(child, 'cite_mark', schema);
      if (kept.length > 0) out.push(child.type.create(child.attrs, kept));
    } else if (name === 'card_body' || name === 'paragraph') {
      const kept = filterInlinesByMark(child, 'highlight', schema);
      for (const inline of kept) appendToMergeBuffer(mergeBuffer, inline, schema);
    }
    // Undertags + tables drop without flushing — bodies on either
    // side remain a single flowing run.
  });
  flushMerge();

  if (out.length === 0) return null;
  return container.type.create(container.attrs, out);
}

/** Walk a paragraph's inline children, keep the ones carrying the
 *  given mark, and stitch them with separator spaces wherever the
 *  CSS `::after { content: ' ' }` rule would have inserted one. */
function filterInlinesByMark(node: PMNode, markName: string, schema: Schema): PMNode[] {
  const kept: PMNode[] = [];
  node.forEach((child) => {
    if (child.isText && child.marks.some((m) => m.type.name === markName)) {
      appendToMergeBuffer(kept, child, schema);
    }
  });
  return kept;
}

/** Push `next` onto `buffer`, inserting a separator space first
 *  unless the boundary already has whitespace on either side. */
function appendToMergeBuffer(buffer: PMNode[], next: PMNode, schema: Schema): void {
  if (buffer.length > 0) {
    const last = buffer[buffer.length - 1]!;
    const lastText = last.isText ? (last.text ?? '') : '';
    const nextText = next.isText ? (next.text ?? '') : '';
    if (!/\s$/.test(lastText) && !/^\s/.test(nextText)) {
      buffer.push(schema.text(' '));
    }
  }
  buffer.push(next);
}

// --------------------------- marked cards ---------------------------
//
// A "marked" card is one whose subtree contains a reading-marker run — plain
// red text (the `font_color` mark at the marker red), per reading-marker.ts.
// Save Marked Cards extracts just those cards, flat (cards are doc-level
// siblings; the heading hierarchy is implied by order, so dropping the headings
// leaves a bare list of the cards the user marked). Analytics are never kept.

/** True iff any text node in `node`'s subtree carries the reading-marker run. */
function containsReadingMarker(node: PMNode): boolean {
  let found = false;
  node.descendants((n) => {
    if (found) return false;
    if (
      n.isText &&
      n.marks.some(
        (m) =>
          m.type.name === 'font_color' &&
          isReadingMarkerColor(m.attrs['color'] as string | undefined),
      )
    ) {
      found = true;
    }
    return !found;
  });
  return found;
}

/** Build a doc of just the doc-level `card` nodes containing a reading marker,
 *  in document order. Kept whole; everything else (headings, unmarked cards,
 *  analytics, loose blocks) drops. */
function extractMarkedCards(doc: PMNode): PMNode {
  const schema = doc.type.schema;
  const out: PMNode[] = [];
  doc.forEach((child) => {
    if (child.type.name === 'card' && containsReadingMarker(child)) out.push(child);
  });
  return schema.nodes['doc']!.create(null, out);
}

/** How many doc-level cards contain a reading marker — so callers can warn
 *  before a Save Marked Cards that would produce an empty document. */
export function countMarkedCards(doc: PMNode): number {
  let n = 0;
  doc.forEach((child) => {
    if (child.type.name === 'card' && containsReadingMarker(child)) n++;
  });
  return n;
}

// --------------------------- analytics ---------------------------

function stripAnalytics(doc: PMNode): PMNode {
  const schema = doc.type.schema;
  const out: PMNode[] = [];
  doc.forEach((child) => {
    if (child.type.name === 'analytic_unit') return; // drop wholesale
    if (child.type.name === 'card') {
      out.push(filterChildren(child, (c) => c.type.name !== 'analytic'));
      return;
    }
    out.push(child);
  });
  return schema.nodes['doc']!.create(null, out);
}

// --------------------------- undertags ---------------------------

function stripUndertags(doc: PMNode): PMNode {
  const schema = doc.type.schema;
  const out: PMNode[] = [];
  doc.forEach((child) => {
    if (child.type.name === 'undertag') return; // doc-level undertag
    if (child.type.name === 'card' || child.type.name === 'analytic_unit') {
      out.push(filterChildren(child, (c) => c.type.name !== 'undertag'));
      return;
    }
    out.push(child);
  });
  return schema.nodes['doc']!.create(null, out);
}

// --------------------------- helpers -----------------------------

/** Build a copy of a container node with only the children for which
 *  `predicate` returns true. Both current callers only drop
 *  optional-slot children, so the result is always valid — but this
 *  helper runs on the direct save path, so it verifies rather than
 *  trusts (audit tier 4): a future predicate that dropped a required
 *  head would otherwise export invalid structure silently. On an
 *  invalid filtered result the ORIGINAL node is kept (the un-stripped
 *  child appears in the export — a cosmetic miss, never corruption). */
function filterChildren(node: PMNode, predicate: (child: PMNode) => boolean): PMNode {
  const kept: PMNode[] = [];
  node.forEach((child) => {
    if (predicate(child)) kept.push(child);
  });
  const frag = Fragment.fromArray(kept);
  if (!node.type.validContent(frag)) {
    console.error(
      `[cardmirror export] filterChildren would make ${node.type.name} invalid — keeping it unfiltered`,
    );
    return node;
  }
  return node.type.create(node.attrs, frag);
}
