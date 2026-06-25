/**
 * Pre-export transforms that strip / filter the doc based on the
 * Save As dialog's checkboxes. Runs BEFORE `toDocx` so the docx
 * output reflects the user's inclusion choices without the exporter
 * itself needing per-feature flags.
 *
 * Four user options drive this:
 *   - includeComments   (no-op until comments import lands)
 *   - includeAnalytics  (strip analytic_units + in-card analytic)
 *   - includeUndertags  (strip undertag nodes wherever they live)
 *   - readMode          (mutually exclusive — replaces the above
 *                        and saves only what's visible in read mode)
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

import type { Node as PMNode, Schema } from 'prosemirror-model';

export interface ExportTransformOptions {
  includeComments: boolean;
  includeAnalytics: boolean;
  includeUndertags: boolean;
  readMode: boolean;
}

export function transformForExport(
  doc: PMNode,
  opts: ExportTransformOptions,
): PMNode {
  if (opts.readMode) return applyReadModeTransform(doc);

  let out = doc;
  if (!opts.includeAnalytics) out = stripAnalytics(out);
  if (!opts.includeUndertags) out = stripUndertags(out);
  // includeComments is a no-op until comments import lands. The
  // exporter has no comment-emit logic yet; once it does, this is
  // where the gate plugs in.
  return out;
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
 *  `predicate` returns true. The container's required first child is
 *  preserved as long as `predicate` accepts it (the caller's
 *  responsibility — both filter-helpers above only drop
 *  optional-slot children). */
function filterChildren(node: PMNode, predicate: (child: PMNode) => boolean): PMNode {
  const kept: PMNode[] = [];
  node.forEach((child) => {
    if (predicate(child)) kept.push(child);
  });
  return node.type.create(node.attrs, kept);
}
