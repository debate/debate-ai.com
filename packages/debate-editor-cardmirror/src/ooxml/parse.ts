/**
 * OOXML parsing helpers.
 *
 * Uses fast-xml-parser with preserveOrder so we maintain document order
 * (essential for paragraph and run sequences).
 */

import { XMLParser } from 'fast-xml-parser';

/**
 * Order-preserving parse output. fast-xml-parser with preserveOrder:true
 * returns arrays of single-keyed objects, with attributes under ':@'.
 *
 * Example: <w:p><w:r><w:t>hi</w:t></w:r></w:p> →
 *   [{ 'w:p': [{ 'w:r': [{ 'w:t': [{ '#text': 'hi' }] }] }] }]
 */
export type XmlNode = { [tag: string]: XmlNode[] | string } & {
  ':@'?: Record<string, string>;
  '#text'?: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
  preserveOrder: true,
  trimValues: false,
  parseAttributeValue: false,
  parseTagValue: false,
  // fast-xml-parser ships a "billion laughs" guard that caps the
  // total number of entity expansions per document at 1000. That
  // guard counts every ordinary standard entity (&amp; &lt; &gt;
  // &quot; &apos;) and numeric char-ref toward the budget, so a
  // large, legitimate debate file — which easily contains thousands
  // of ampersands / quotes across document.xml — trips it with
  // "Entity expansion limit exceeded: N > 1000" and fails to load.
  // Standard entities are 1:1, non-recursive replacements (no
  // exponential blow-up); the actual entity-bomb vector is
  // DOCTYPE-declared nested custom entities, which OOXML never uses.
  // We open trusted local files, so lift the cap rather than reject
  // real documents. (depth / entity-count / size guards still apply
  // to any DOCTYPE entities, which OOXML doesn't have anyway.)
  processEntities: {
    enabled: true,
    maxTotalExpansions: Infinity,
    maxExpandedLength: Infinity,
  },
});

export function parseXml(xml: string): XmlNode[] {
  return parser.parse(xml) as XmlNode[];
}

/**
 * From a list of order-preserved nodes, find the first child with the
 * given tag name. Returns null if not found.
 */
export function findChild(nodes: XmlNode[], tag: string): XmlNode | null {
  for (const node of nodes) {
    if (tag in node) return node;
  }
  return null;
}

/** Extract attributes from a node. */
export function attrs(node: XmlNode): Record<string, string> {
  return node[':@'] ?? {};
}

/** Get the children array of a tagged node. */
export function children(node: XmlNode, tag: string): XmlNode[] {
  const value = node[tag];
  if (Array.isArray(value)) return value;
  return [];
}

/** Re-serialize a parsed XmlNode list back to an XML fragment.
 *  Inverse of `parseXml` for the subset of OOXML we produce — preserves
 *  element order, attributes, and `#text` leaves. Used when we want to
 *  round-trip opaque sub-trees (e.g. `<w:tblPr>` extras) verbatim
 *  without modeling every child element in the schema. */
export function serializeXmlNodes(nodes: XmlNode[]): string {
  let out = '';
  for (const node of nodes) {
    out += serializeXmlNode(node);
  }
  return out;
}

function serializeXmlNode(node: XmlNode): string {
  for (const key of Object.keys(node)) {
    if (key === ':@') continue;
    if (key === '#text') {
      return escText(String(node[key] ?? ''));
    }
    // Tag node — single tag key per node in preserveOrder mode.
    const attrPart = serializeAttrs(node[':@'] ?? {});
    const value = node[key];
    if (Array.isArray(value) && value.length > 0) {
      return `<${key}${attrPart}>${serializeXmlNodes(value)}</${key}>`;
    }
    return `<${key}${attrPart}/>`;
  }
  return '';
}

function serializeAttrs(a: Record<string, string>): string {
  let out = '';
  for (const [k, v] of Object.entries(a)) {
    out += ` ${k}="${escAttr(String(v))}"`;
  }
  return out;
}

/** Minimal XML escape helpers inlined here so parse.ts has no
 *  upward dependency on `ooxml/xml.ts`. */
function escText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

/**
 * Body paragraphs in the exact order the importer visits them: document
 * order, descending into `<w:sdt>` content but NOT into `<w:tbl>` (heading
 * paragraphs never originate from table cells, so the importer's
 * `collectBlocks` doesn't descend into tables either — this must mirror it).
 *
 * The 0-based index into this list is the `srcPara` provenance the source-
 * anchor injector uses to locate a heading's paragraph. The importer builds
 * that index from THIS same helper, so the two views of "which paragraph is
 * the Nth" can never drift — see `ensureHeadingAnchor` in `src/anchor-docx.ts`.
 */
export function bodyParagraphsInOrder(bodyChildren: XmlNode[]): XmlNode[] {
  const out: XmlNode[] = [];
  const walk = (nodes: XmlNode[]): void => {
    for (const node of nodes) {
      if ('w:p' in node) {
        out.push(node);
      } else if ('w:sdt' in node) {
        const content = findChild(children(node, 'w:sdt'), 'w:sdtContent');
        if (content) walk(children(content, 'w:sdtContent'));
      }
      // <w:tbl>, <w:sectPr>, etc. — not a body paragraph; skip.
    }
  };
  walk(bodyChildren);
  return out;
}

/**
 * Get the text content of a node by recursively concatenating all
 * #text children.
 */
export function textContent(node: XmlNode | XmlNode[]): string {
  const nodes = Array.isArray(node) ? node : [node];
  let out = '';
  for (const n of nodes) {
    for (const [k, v] of Object.entries(n)) {
      if (k === ':@') continue;
      if (k === '#text') {
        out += String(v ?? '');
      } else if (Array.isArray(v)) {
        out += textContent(v);
      }
    }
  }
  return out;
}
