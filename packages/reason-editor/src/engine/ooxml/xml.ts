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

/** Escape text for inclusion in XML element content. */
export function escText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape text for inclusion in an XML attribute value (double-quoted). */
export function escAttr(s: string): string {
  return s
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

/** Format an element with text content only. */
export function textEl(name: string, attrs: Record<string, string | number | undefined>, text: string): string {
  return el(name, attrs, escText(text));
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

/** Format the namespace attrs for the document root element. */
export function rootNamespaces(): string {
  return [
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
    'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"',
    'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"',
    'mc:Ignorable="w14"',
  ].join(' ');
}
