/**
 * Minimal XML emission helpers.
 *
 * We hand-roll OOXML output (per DECISIONS.md) because we control the
 * patterns fully and a heavy XML library adds friction. fast-xml-parser
 * handles parsing.
 *
 * Conventions:
 *   - Always emit `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` prolog.
 *   - Word's namespace declarations live on the document root.
 *   - Indentation is for human readability; whitespace inside text runs
 *     is *not* indented (Word respects xml:space="preserve" semantics
 *     and any literal whitespace in <w:t> is content).
 */

/** Characters XML 1.0 cannot represent AT ALL — not even entity-escaped:
 *  C0 controls other than tab/LF/CR, the noncharacters U+FFFE/U+FFFF, and
 *  lone surrogate halves. Word rejects the entire .docx over a single one
 *  (field report 2026-07-15: a U+001D — likely pasted from a PDF —
 *  corrupted a shared file). They are STRIPPED, not escaped: there is no
 *  legal spelling for them in XML 1.0.
 *
 *  The alternation captures VALID surrogate pairs first and keeps them
 *  (deliberately no lookbehind — some older engines reject lookbehind at
 *  parse time); everything else the pattern matches is illegal and
 *  dropped. */
const XML_ILLEGAL_OR_PAIR =
  /([\uD800-\uDBFF][\uDC00-\uDFFF])|[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF\uD800-\uDFFF]/g;

/** Exported for the paste converters (`import/html-paste.ts`): stripping
 *  these characters at CONTENT ENTRY keeps them out of the doc in the
 *  first place, instead of relying solely on this module's export-time
 *  chokepoint. One definition, both directions. */
export function stripXmlIllegal(s: string): string {
  return s.replace(XML_ILLEGAL_OR_PAIR, (_m, pair: string | undefined) => pair ?? '');
}

/** Escape text for inclusion in XML element content. */
export function escText(s: string): string {
  return stripXmlIllegal(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape text for inclusion in an XML attribute value (double-quoted). */
export function escAttr(s: string): string {
  return stripXmlIllegal(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

/** Format an element with no children: <name attr="..."/> */
export function emptyEl(name: string, attrs: Record<string, string | number | undefined> = {}): string {
  const a = formatAttrs(attrs);
  return a ? `<${name} ${a}/>` : `<${name}/>`;
}

/** Format an element with children. */
export function el(name: string, attrs: Record<string, string | number | undefined>, children: string): string {
  const a = formatAttrs(attrs);
  const open = a ? `<${name} ${a}>` : `<${name}>`;
  return `${open}${children}</${name}>`;
}

function formatAttrs(attrs: Record<string, string | number | undefined>): string {
  const pairs: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined) continue;
    pairs.push(`${k}="${escAttr(String(v))}"`);
  }
  return pairs.join(' ');
}

export const XML_PROLOG = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Word's standard root namespace declarations. */
export const W_NS = {
  xmlns: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  xmlnsR: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  xmlnsW: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  xmlnsW14: 'http://schemas.microsoft.com/office/word/2010/wordml',
} as const;
