/**
 * cardmirror-read — library core.
 *
 * Turns a `.cmir` or `.docx` file's bytes into one of two READ-ONLY
 * representations for consumption by tools that can't open the app
 * (screen readers via AI assistants, agents indexing a Dropbox, …):
 *
 *   - `json`: the full-fidelity uncompressed CardMirror envelope. For
 *     `.cmir` this is literally the on-disk JSON with the gzip layer
 *     removed (works even on files the editor refuses as damaged —
 *     useful for forensics). For `.docx` the file is run through the
 *     app's real importer and re-serialized through the real save
 *     path, so the JSON matches what Save As `.cmir` would produce.
 *
 *   - `text`: a markdown-flavored plain-text rendering of the parsed
 *     document — outline headings, tags, cites, body text — with the
 *     debate-critical layers kept legible: ==highlight==,
 *     __underline__, *emphasis*.
 *
 * Deliberately reuses the app's parsers (`parseNative`, `fromDocxFull`)
 * rather than reimplementing the formats, so this tool can never drift
 * from what the editor actually reads. Everything here is DOM-free and
 * runs under plain Node (same constraint the native module already
 * documents for its own node-tooling consumers).
 */

import type { Node as PMNode } from 'prosemirror-model';
import { parseNative, serializeNative } from '../native/index.js';
import { isGzip, gunzip } from '../native/codec.js';
import { fromDocxFull } from '../import/index.js';
import { footnotePlainText, type FootnoteContent } from '../schema/footnotes.js';

export type ReadForm = 'json' | 'text';
export type FileKind = 'cmir' | 'docx';

/** The uncompressed envelope JSON, pretty-printed. */
export async function toUncompressedJson(bytes: Uint8Array, kind: FileKind): Promise<string> {
  if (kind === 'cmir') {
    // Pure byte-level transform: gunzip (legacy files are already
    // plaintext) + re-indent. No schema validation — this form must
    // work on damaged files too.
    const raw = isGzip(bytes) ? gunzip(bytes) : bytes;
    const text = new TextDecoder().decode(raw);
    return JSON.stringify(JSON.parse(text), null, 2) + '\n';
  }
  const { doc, threads, docId } = await fromDocxFull(bytes);
  const envelope = serializeNative(doc, {
    threads,
    docId: docId ?? undefined,
    appVersion: 'cardmirror-read',
  });
  return JSON.stringify(JSON.parse(new TextDecoder().decode(gunzip(envelope))), null, 2) + '\n';
}

/** Parse either format into a ProseMirror doc (the editor's own path,
 *  heals included). Throws NativeDamagedError for unhealable `.cmir`. */
export async function parseToDoc(bytes: Uint8Array, kind: FileKind): Promise<PMNode> {
  if (kind === 'cmir') return parseNative(bytes).doc;
  return (await fromDocxFull(bytes)).doc;
}

// ---- Plain-text rendering -------------------------------------------

type Wrap = 'highlight' | 'underline' | 'emphasis' | 'plain';

/** Inline content of a textblock as marked-up text. Adjacent runs with
 *  the same wrapper merge, so partial-word marks don't produce
 *  `==a====b==` seams. */
function inlineText(node: PMNode): string {
  const segs: Array<{ t: string; w: Wrap }> = [];
  node.forEach((child) => {
    if (child.isText) {
      const names = child.marks.map((m) => m.type.name);
      const w: Wrap =
        names.includes('highlight') || names.includes('shading')
          ? 'highlight'
          : names.includes('underline_mark')
            ? 'underline'
            : names.includes('emphasis_mark')
              ? 'emphasis'
              : 'plain';
      segs.push({ t: child.text ?? '', w });
    } else if (child.type.name === 'footnote') {
      const note = footnotePlainText((child.attrs['content'] ?? []) as FootnoteContent).trim();
      if (note) segs.push({ t: ` [note: ${note}]`, w: 'plain' });
    } else if (child.type.name === 'image') {
      segs.push({ t: '[image]', w: 'plain' });
    } else {
      const t = child.textContent;
      if (t) segs.push({ t, w: 'plain' });
    }
  });
  // Merge adjacent same-wrap segments, then wrap.
  const merged: Array<{ t: string; w: Wrap }> = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && last.w === s.w) last.t += s.t;
    else merged.push({ ...s });
  }
  const WRAPPERS: Record<Wrap, [string, string]> = {
    highlight: ['==', '=='],
    underline: ['__', '__'],
    emphasis: ['*', '*'],
    plain: ['', ''],
  };
  return merged
    .map(({ t, w }) => {
      if (w === 'plain' || t.trim() === '') return t;
      // Keep the wrappers tight against the text — leading/trailing
      // whitespace outside them, so `== word ==` seams don't appear.
      const lead = t.match(/^\s*/)![0];
      const trail = t.match(/\s*$/)![0];
      const core = t.slice(lead.length, t.length - trail.length);
      const [o, c] = WRAPPERS[w];
      return `${lead}${o}${core}${c}${trail}`;
    })
    .join('');
}

function renderTable(node: PMNode, out: string[]): void {
  node.forEach((row) => {
    const cells: string[] = [];
    row.forEach((cell) => {
      const parts: string[] = [];
      cell.forEach((p) => parts.push(inlineText(p)));
      cells.push(parts.join(' ').trim());
    });
    out.push(`| ${cells.join(' | ')} |`);
  });
  out.push('');
}

/** Render one top-level (or zone-nested) block. */
function renderBlock(node: PMNode, out: string[]): void {
  const name = node.type.name;
  switch (name) {
    case 'pocket':
      out.push(`# ${inlineText(node)}`, '');
      return;
    case 'hat':
      out.push(`## ${inlineText(node)}`, '');
      return;
    case 'block':
      out.push(`### ${inlineText(node)}`, '');
      return;
    case 'card':
    case 'analytic_unit': {
      node.forEach((child, _off, i) => {
        const cn = child.type.name;
        if (i === 0) {
          // Leading head: tag (card) or analytic (analytic_unit).
          const suffix = name === 'analytic_unit' ? ' _(analytic)_' : '';
          out.push(`#### ${inlineText(child)}${suffix}`);
        } else if (cn === 'cite_paragraph') {
          out.push(`Cite: ${inlineText(child)}`);
        } else if (cn === 'undertag') {
          out.push(`> ${inlineText(child)}`);
        } else if (cn === 'table') {
          renderTable(child, out);
        } else {
          // card_body lines
          const t = inlineText(child);
          if (t.trim() !== '') out.push(t);
        }
      });
      out.push('');
      return;
    }
    case 'paragraph':
    case 'card_body':
    case 'cite_paragraph':
    case 'undertag': {
      const t = inlineText(node);
      if (t.trim() !== '') out.push(t, '');
      return;
    }
    case 'table':
      renderTable(node, out);
      return;
    default: {
      // Live views / linked-copy zones and anything future: note the
      // wrapper, render the cached children (they're real cards).
      if (node.childCount > 0 && !node.isTextblock) {
        out.push(`[transcluded content (${name}) — cached copy of another document's cards:]`, '');
        node.forEach((child) => renderBlock(child, out));
        out.push('[end transcluded content]', '');
        return;
      }
      const t = node.textContent;
      if (t.trim() !== '') out.push(t, '');
    }
  }
}

/** Markdown-flavored plain text for a parsed doc. */
export function renderPlainText(doc: PMNode, sourceName: string): string {
  const out: string[] = [
    `> Read-only plain-text rendering of "${sourceName}" (via cardmirror-read).`,
    `> Layers: ==highlighted== (read aloud) · __underlined__ · *emphasis*.`,
    `> Structure: # Pocket · ## Hat · ### Block · #### Tag / analytic heading; "Cite:" lines carry the citation.`,
    '',
  ];
  doc.forEach((child) => renderBlock(child, out));
  // Collapse runs of blank lines the walker may have produced.
  const collapsed: string[] = [];
  for (const line of out) {
    if (line === '' && collapsed[collapsed.length - 1] === '') continue;
    collapsed.push(line);
  }
  return collapsed.join('\n').trimEnd() + '\n';
}
