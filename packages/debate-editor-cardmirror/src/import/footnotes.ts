/**
 * Parse `word/footnotes.xml` / `word/endnotes.xml` into a map of
 * note id → FootnoteContent (paragraphs of simplified runs), for the
 * importer to attach to `footnote` nodes when it meets
 * `<w:footnoteReference w:id>` / `<w:endnoteReference w:id>` in runs.
 *
 * Word's separator machinery (`w:type="separator"` /
 * `"continuationSeparator"`, ids -1 and 0) is skipped — those are
 * rendering furniture, not notes. Hyperlinks inside notes resolve
 * their targets through the part's own rels file
 * (`word/_rels/footnotes.xml.rels`), captured as `link` on the runs.
 */

import {
  attrs as attrsOf,
  children as childrenOf,
  findChild,
  parseXml,
  textContent,
  type XmlNode,
} from '../ooxml/parse.js';
import type { FootnoteContent, FootnoteRun } from '../schema/footnotes.js';

/** rId → external target from a rels part. */
function parseRelTargets(relsXml: string | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!relsXml) return out;
  const root = parseXml(relsXml);
  const rels = findChild(root, 'Relationships');
  if (!rels) return out;
  for (const child of childrenOf(rels, 'Relationships')) {
    if (!('Relationship' in child)) continue;
    const a = attrsOf(child);
    const id = a['Id'];
    const target = a['Target'];
    if (id && target) out.set(id, target);
  }
  return out;
}

/** Flatten one `<w:r>` into a FootnoteRun (text + basic flags). */
function flattenRun(rNode: XmlNode, link: string | undefined): FootnoteRun | null {
  const children = childrenOf(rNode, 'w:r');
  let text = '';
  let bold = false;
  let italic = false;
  let underline = false;
  for (const c of children) {
    if ('w:t' in c) {
      text += textContent(c);
    } else if ('w:tab' in c) {
      text += '\t';
    } else if ('w:br' in c) {
      text += '\n';
    } else if ('w:rPr' in c) {
      for (const p of childrenOf(c, 'w:rPr')) {
        if ('w:b' in p && attrsOf(p)['w:val'] !== '0' && attrsOf(p)['w:val'] !== 'false') bold = true;
        if ('w:i' in p && attrsOf(p)['w:val'] !== '0' && attrsOf(p)['w:val'] !== 'false') italic = true;
        if ('w:u' in p && attrsOf(p)['w:val'] !== 'none') underline = true;
      }
    }
    // w:footnoteRef / w:endnoteRef (the number inside the note body)
    // and everything else is dropped — the number is recomputed.
  }
  if (text.length === 0) return null;
  const run: FootnoteRun = { text };
  if (bold) run.bold = true;
  if (italic) run.italic = true;
  if (underline) run.underline = true;
  if (link) run.link = link;
  return run;
}

/** One note paragraph → runs (hyperlinks unwrapped with link attr).
 *  Word opens each note body with a marker run (`w:footnoteRef` /
 *  `w:endnoteRef`) followed by a spacer — both furniture (the number
 *  is recomputed on display), so when a marker is present the leading
 *  whitespace it drags along is stripped too. */
function flattenParagraph(pNode: XmlNode, rels: Map<string, string>): FootnoteRun[] {
  const runs: FootnoteRun[] = [];
  let sawMarker = false;
  const walkInline = (nodes: XmlNode[], link: string | undefined): void => {
    for (const c of nodes) {
      if ('w:r' in c) {
        for (const rc of childrenOf(c, 'w:r')) {
          if ('w:footnoteRef' in rc || 'w:endnoteRef' in rc) sawMarker = true;
        }
        const run = flattenRun(c, link);
        if (run) runs.push(run);
      } else if ('w:hyperlink' in c) {
        const rId = attrsOf(c)['r:id'];
        const target = rId ? rels.get(rId) : undefined;
        walkInline(childrenOf(c, 'w:hyperlink'), target ?? link);
      }
    }
  };
  walkInline(childrenOf(pNode, 'w:p'), undefined);
  if (sawMarker) {
    while (runs.length > 0 && runs[0]!.text.trim().length === 0) runs.shift();
    if (runs.length > 0) {
      const first = runs[0]!;
      runs[0] = { ...first, text: first.text.replace(/^\s+/, '') };
    }
  }
  return runs;
}

/**
 * Parse a footnotes/endnotes part. `rootTag` and `noteTag` are
 * `w:footnotes`/`w:footnote` or `w:endnotes`/`w:endnote`.
 */
export function importNotes(
  notesXml: string | null,
  notesRelsXml: string | null,
  rootTag: 'w:footnotes' | 'w:endnotes',
  noteTag: 'w:footnote' | 'w:endnote',
): Map<string, FootnoteContent> {
  const out = new Map<string, FootnoteContent>();
  if (!notesXml) return out;
  const rels = parseRelTargets(notesRelsXml);
  const root = parseXml(notesXml);
  const notesEl = findChild(root, rootTag);
  if (!notesEl) return out;
  for (const child of childrenOf(notesEl, rootTag)) {
    if (!(noteTag in child)) continue;
    const a = attrsOf(child);
    // Separator / continuation entries are rendering furniture.
    const type = a['w:type'];
    if (type === 'separator' || type === 'continuationSeparator' || type === 'continuationNotice') {
      continue;
    }
    const id = a['w:id'];
    if (!id) continue;
    const paragraphs: FootnoteContent = [];
    for (const inner of childrenOf(child, noteTag)) {
      if ('w:p' in inner) {
        const runs = flattenParagraph(inner, rels);
        if (runs.length > 0) paragraphs.push(runs);
      }
    }
    out.set(id, paragraphs);
  }
  return out;
}
