/**
 * Post-clean XML fix-ups for .docx style cleaning, over the `Docx` (JSZip)
 * layer — no python-docx, no server.
 *
 *   - serializeXmlDoc: serialize a parsed part with exactly one XML declaration.
 *   - fixDanglingStyleRefs: strip references (pStyle/rStyle/tblStyle and
 *     basedOn/link/next) that point at a style id that no longer exists — the
 *     fix for Word's "found unreadable content" error after style removal.
 */

import { Docx } from '../docx.js';

const CONTENT_STYLE_TAGS = ['pStyle', 'rStyle', 'tblStyle'];
const STYLE_XREF_TAGS = ['basedOn', 'link', 'next'];

function isWordXml(path: string): boolean {
  return path.startsWith('word/') && path.endsWith('.xml');
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Serialize a document, guaranteeing exactly one XML declaration. Chromium's
 *  XMLSerializer emits the `<?xml?>` declaration itself; jsdom's does not. So
 *  only prepend one when it isn't already there — otherwise a duplicate
 *  declaration makes the re-parse fail ("XML declaration allowed only at the
 *  start of the document"). */
export function serializeXmlDoc(doc: Document): string {
  const out = new XMLSerializer().serializeToString(doc);
  return out.startsWith('<?xml') ? out : XML_DECL + out;
}

/** Remove style references that point at a style id no longer defined — both
 *  the content references (pStyle/rStyle/tblStyle in document.xml, headers,
 *  footers, …) and the cross-references inside styles.xml (basedOn/link/next).
 *  Always run after cleaning. */
export async function fixDanglingStyleRefs(fileBytes: Uint8Array): Promise<{ bytes: Uint8Array; removed: number }> {
  const docx = await Docx.load(fileBytes);
  const stylesXml = await docx.readText('word/styles.xml');
  if (stylesXml === null) return { bytes: fileBytes, removed: 0 };

  const definedIds = new Set<string>();
  for (const m of stylesXml.matchAll(/w:styleId="([^"]+)"/g)) definedIds.add(m[1]!);

  let totalRemoved = 0;
  const changed: string[] = [];

  const stripTags = (text: string, tags: string[]): string => {
    let out = text;
    for (const tag of tags) {
      const re = new RegExp(`<w:${tag}\\s+w:val="([^"]+)"\\s*/?>`, 'g');
      out = out.replace(re, (whole, val: string) => {
        if (!definedIds.has(val)) {
          totalRemoved++;
          return '';
        }
        return whole;
      });
    }
    return out;
  };

  // styles.xml internal cross-references (basedOn / link / next).
  const newStyles = stripTags(stylesXml, STYLE_XREF_TAGS);
  if (newStyles !== stylesXml) {
    docx.writeText('word/styles.xml', newStyles);
    changed.push('word/styles.xml');
  }

  // content files (pStyle / rStyle / tblStyle).
  for (const path of docx.paths()) {
    if (!isWordXml(path) || path === 'word/styles.xml') continue;
    const text = await docx.readText(path);
    if (text === null) continue;
    const newText = stripTags(text, CONTENT_STYLE_TAGS);
    if (newText !== text) {
      docx.writeText(path, newText);
      changed.push(path);
    }
  }

  if (changed.length === 0) return { bytes: fileBytes, removed: 0 };
  return { bytes: await docx.toBuffer(), removed: totalRemoved };
}
