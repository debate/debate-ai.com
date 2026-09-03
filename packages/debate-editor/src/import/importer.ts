/**
 * OOXML → schema importer.
 *
 * Reads `word/document.xml` (and rels for hyperlinks) and produces a
 * ProseMirror doc.
 *
 * Strategy:
 *   1. Parse document.xml with order preservation.
 *   2. Walk <w:body>'s children.
 *   3. For each paragraph: extract pStyle, walk runs (and hyperlinks),
 *      collect text + marks per run, classify the paragraph by pStyle.
 *   4. Group consecutive paragraphs into cards: a Tag-styled paragraph
 *      starts a card; following Normal-styled paragraphs (until the next
 *      heading-level paragraph) become its body.
 *   5. Wrap everything in a `doc` node.
 *
 * Per ARCHITECTURE.md §3 (round-trip contract / fungibility), aggressive
 * normalization on import is fine — we preserve only what Verbatim and
 * Advanced Verbatim treat as semantic.
 */

import type { Mark, Node as PMNode, NodeType } from 'prosemirror-model';
import type { FootnoteContent } from '../schema/footnotes.js';
import { schema } from '../schema/index.js';
import { idFromBookmarkName, newHeadingId, HEADING_TYPE_NAMES } from '../schema/ids.js';
import { normalizeUnderlineMarks } from '../editor/named-style-normalizer-plugin.js';
import { bytesToBase64 } from '../ooxml/base64.js';
import {
  attrs as attrsOf,
  children as childrenOf,
  findChild,
  parseXml,
  serializeXmlNodes,
  textContent,
  bodyParagraphsInOrder,
  type XmlNode,
} from '../ooxml/parse.js';
import {
  PSTYLE_TO_NODE,
  RSTYLE_TO_MARK,
  fallbackNodeType,
  type StyleInfo,
  type StyleMap,
} from '../ooxml/styles.js';
import { buildLegacyHeadingMap, isUnambiguousLegacy, legacyRole } from '../ooxml/legacy-styles.js';

/**
 * The importer's paragraph-level intermediate: phase (a) turns docx
 * XML into `ParaInfo[]`; phase (b) (`assembleDoc`) turns `ParaInfo[]`
 * into a PM doc (card grouping, cite slotting, numbering
 * reconstruction). Exported because the smart-paste converters (Word
 * clipboard HTML, haku.cards HTML) are alternative phase-(a)
 * front-ends emitting this same shape and reusing `assembleDoc`.
 */
export interface ParaInfo {
  /** Schema node type to use for this paragraph (resolved from pStyle). */
  nodeType: string;
  /** Parsed inline content (text nodes + marks). */
  inlines: PMNode[];
  /** Heading id if pmd-heading-* bookmark detected. */
  headingId: string | null;
  /** Original pStyle, for diagnostics. */
  pStyle: string | null;
  /** Left indent in OOXML dxa from `<w:ind w:left="…"/>` (or
   *  `w:start`, RTL fallback). 0 when absent. */
  indent: number;
  /** `<w:spacing>` attributes captured verbatim (before / after /
   *  line / lineRule / etc.) for round-trip. Null when the source
   *  paragraph had no `<w:spacing>` element. */
  spacing: Record<string, string> | null;
  /** Word numbering from `<w:numPr>`: the list instance (`w:numId`) and level
   *  (`w:ilvl`). Set only on a paragraph that carries live-list membership
   *  (numId > 0). Reconstructed into card `numRole`/`numRestart` — NUMBERING_PLAN
   *  §5. */
  numId?: number;
  ilvl?: number;
  /** When set, the assembler emits this PMNode verbatim at this
   *  position in the doc instead of treating it as a paragraph.
   *  Used for `<w:tbl>` → `table` nodes, which are pre-assembled
   *  into PM form during the body walk. */
  rawNode?: PMNode;
  /** 0-based index of this paragraph's source `<w:p>` in body-paragraph order
   *  (via `bodyParagraphsInOrder`). Set only when the caller requested heading
   *  provenance (see `importDoc`'s `provenanceOut`); used to bookmark a raw
   *  `.docx` heading so a live zone can refresh from it. Undefined otherwise
   *  and on `__rawNode__` (table) entries, which never carry headings. */
  srcPara?: number;
}

/** rId → relationship target map from word/_rels/document.xml.rels. */
type RelMap = Record<string, string>;

/** A media part loaded from the source docx, keyed by full zip path. */
export interface MediaPart {
  bytes: Uint8Array;
  contentType: string;
}

/** Map of zip paths (e.g. 'word/media/image1.png') to image data. */
export type MediaPartsMap = Map<string, MediaPart>;

/** State for a single Word field code region delimited by
 *  `<w:fldChar w:fldCharType="begin"/>` … `<w:fldChar
 *  w:fldCharType="separate"/>` … `<w:fldChar w:fldCharType="end"/>`.
 *  Fields can nest, so we keep a stack. The only field type we
 *  preserve semantically is HYPERLINK; others fall through and
 *  their result runs render as plain text. */
interface FieldState {
  /** `instr` while between begin and separate; `result` after. */
  phase: 'instr' | 'result';
  /** Accumulated `<w:instrText>` content during the instr phase. */
  instr: string;
  /** Parsed href if `instr` matched `HYPERLINK "..."`. */
  hyperlinkHref: string | null;
}

interface ImportContext {
  rels: RelMap;
  /** Track active hyperlink rId stack while walking inline content. */
  hyperlinkStack: string[];
  /** Active Word field-code regions while walking runs. */
  fieldStack: FieldState[];
  /** Active `<w:commentRangeStart w:id="…">` brackets. Pushed on
   *  `w:commentRangeStart`, popped on `w:commentRangeEnd`. Every
   *  text node emitted while the stack is non-empty receives a
   *  `comment_range` mark for each active id. */
  commentRangeStack: string[];
  /** Media parts from the source zip; null if not provided (drawings drop). */
  mediaParts: MediaPartsMap | null;
  /** Note id → flattened body, from word/footnotes.xml / endnotes.xml.
   *  Null when the parts weren't provided — references then import as
   *  empty-bodied footnote nodes (marker survives, body lost). */
  footnotes: Map<string, FootnoteContent> | null;
  endnotes: Map<string, FootnoteContent> | null;
  /** styleId → style metadata from word/styles.xml. Empty when styles.xml
   *  wasn't provided. Used to classify paragraphs whose pStyle isn't a
   *  canonical styleId (e.g. analytics authored under other templates). */
  styles: StyleMap;
  /** Legacy-style plan for this document, or null when it doesn't use the
   *  classic pre-Verbatim paragraph styles. Decides how legacy paragraph
   *  styles map to schema nodes (see planLegacy / resolveNodeType). */
  legacy: LegacyPlan | null;
}

/** How a legacy (pre-Verbatim) document's paragraph styles map to schema nodes.
 *  Mirrors the cleaner's legacy-remap so an imported legacy doc and a cleaned
 *  one land on the same structure. */
interface LegacyPlan {
  /** Schema node type for a legacy heading-role style at the given effective
   *  outline level (pocket / hat / block / tag). */
  headingNode: (outline: number) => string;
}

/** Public entry: parse document.xml + rels into a schema doc. */
export function importDoc(
  documentXml: string,
  relsXml: string | null = null,
  mediaParts: MediaPartsMap | null = null,
  stylesXml: string | null = null,
  notes: {
    footnotes?: Map<string, FootnoteContent>;
    endnotes?: Map<string, FootnoteContent>;
  } | null = null,
  /** When provided, is filled with `headingId → srcPara` (0-based source
   *  paragraph index) for every heading — the provenance the source-anchor
   *  injector needs to bookmark a raw `.docx` heading. Omitted on the normal
   *  open/import path so it stays zero-cost. */
  provenanceOut?: Map<string, number>,
): PMNode {
  const rels = relsXml ? parseRels(relsXml) : {};
  const ctx: ImportContext = {
    rels,
    hyperlinkStack: [],
    fieldStack: [],
    commentRangeStack: [],
    mediaParts,
    footnotes: notes?.footnotes ?? null,
    endnotes: notes?.endnotes ?? null,
    styles: stylesXml ? parseStyles(stylesXml) : new Map(),
    legacy: null,
  };

  const root = parseXml(documentXml);
  const docEl = findChild(root, 'w:document');
  if (!docEl) throw new Error('Missing <w:document> root');

  const body = findChild(childrenOf(docEl, 'w:document'), 'w:body');
  if (!body) throw new Error('Missing <w:body>');

  const bodyChildren = childrenOf(body, 'w:body');
  ctx.legacy = planLegacy(bodyChildren, ctx.styles);
  // Only when provenance is requested: map each source <w:p> to its body-order
  // index, built from the SAME helper the injector uses so the two agree on
  // "which paragraph is the Nth". Keyed by object identity of the parsed node.
  const paraIndex = provenanceOut
    ? new Map<XmlNode, number>(bodyParagraphsInOrder(bodyChildren).map((n, i) => [n, i]))
    : null;
  const paragraphs: ParaInfo[] = [];
  const collectBlocks = (children: ReturnType<typeof childrenOf>): void => {
    for (const node of children) {
      if ('w:p' in node) {
        const info = parseParagraph(node, ctx);
        if (paraIndex) info.srcPara = paraIndex.get(node) ?? -1;
        paragraphs.push(info);
      } else if ('w:tbl' in node) {
        const tableNode = parseTable(node, ctx);
        if (tableNode) {
          paragraphs.push({
            nodeType: '__rawNode__',
            inlines: [],
            headingId: null,
            pStyle: null,
            indent: 0,
            spacing: null,
            rawNode: tableNode,
          });
        }
      } else if ('w:sdt' in node) {
        // Block-level content control: unwrap and import its inner
        // content — the wrapper carries no document content of its own.
        const content = findChild(childrenOf(node, 'w:sdt'), 'w:sdtContent');
        if (content) collectBlocks(childrenOf(content, 'w:sdtContent'));
      }
      // <w:sectPr>, etc. — skip.
    }
  };
  collectBlocks(bodyChildren);

  return normalizeUnderlineMarks(assembleDoc(paragraphs, provenanceOut));
}

function parseRels(relsXml: string): RelMap {
  const root = parseXml(relsXml);
  const relsEl = findChild(root, 'Relationships');
  if (!relsEl) return {};
  const map: RelMap = {};
  for (const rel of childrenOf(relsEl, 'Relationships')) {
    if (!('Relationship' in rel)) continue;
    const a = attrsOf(rel);
    const id = a['Id'];
    const target = a['Target'];
    if (id && target) map[id] = target;
  }
  return map;
}

/** Parse word/styles.xml into a styleId → {name, type, outlineLevel, bold} map.
 *  `outlineLevel` and `bold` are the EFFECTIVE values — resolved once here through
 *  each style's `basedOn` chain (cycle-guarded), so a style that inherits its
 *  outline level / bold from a base style carries them too, and the per-paragraph
 *  classification stays a plain property read (no chain walking). */
function parseStyles(stylesXml: string): StyleMap {
  const map: StyleMap = new Map();
  // Per-style OWN outline / bold (tri-state) + basedOn parent, used to resolve
  // the effective values below.
  const raw = new Map<string, { ownOutline: number | null; ownBold: boolean | null; basedOn: string | null }>();
  const root = parseXml(stylesXml);
  const stylesEl = findChild(root, 'w:styles');
  if (!stylesEl) return map;
  for (const st of childrenOf(stylesEl, 'w:styles')) {
    if (!('w:style' in st)) continue;
    const a = attrsOf(st);
    const id = a['w:styleId'];
    if (!id) continue;
    const type = a['w:type'] ?? null;
    const stChildren = childrenOf(st, 'w:style');
    const nameEl = findChild(stChildren, 'w:name');
    const name = nameEl ? (attrsOf(nameEl)['w:val'] ?? null) : null;
    // Own outline level (legacy heading styles carry it here, not on the paragraph).
    let ownOutline: number | null = null;
    const pPrEl = findChild(stChildren, 'w:pPr');
    if (pPrEl) {
      const olEl = findChild(childrenOf(pPrEl, 'w:pPr'), 'w:outlineLvl');
      if (olEl) {
        const n = parseInt(attrsOf(olEl)['w:val'] ?? '', 10);
        if (Number.isFinite(n)) ownOutline = n;
      }
    }
    // Own bold (tri-state) from the style's run properties.
    let ownBold: boolean | null = null;
    const rPrEl = findChild(stChildren, 'w:rPr');
    if (rPrEl) {
      const bEl = findChild(childrenOf(rPrEl, 'w:rPr'), 'w:b');
      if (bEl) {
        const v = attrsOf(bEl)['w:val'];
        ownBold = v !== '0' && v !== 'false';
      }
    }
    const basedOnEl = findChild(stChildren, 'w:basedOn');
    const basedOn = basedOnEl ? (attrsOf(basedOnEl)['w:val'] ?? null) : null;
    map.set(id, { id, name, type, outlineLevel: ownOutline, bold: ownBold });
    raw.set(id, { ownOutline, ownBold, basedOn });
  }
  // Resolve effective outline level + bold through `basedOn`. Memoized; the stack
  // guards against malformed cycles. Own value wins; else inherit from the base.
  const memo = new Map<string, { outline: number | null; bold: boolean | null }>();
  const resolve = (
    id: string,
    stack: Set<string>,
  ): { outline: number | null; bold: boolean | null } => {
    const cached = memo.get(id);
    if (cached) return cached;
    const r = raw.get(id);
    if (!r || stack.has(id)) return { outline: null, bold: null };
    stack.add(id);
    const parent = r.basedOn ? resolve(r.basedOn, stack) : { outline: null, bold: null };
    stack.delete(id);
    const out = { outline: r.ownOutline ?? parent.outline, bold: r.ownBold ?? parent.bold };
    memo.set(id, out);
    return out;
  };
  for (const [id, info] of map) {
    const eff = resolve(id, new Set());
    info.outlineLevel = eff.outline;
    info.bold = eff.bold;
  }
  return map;
}

function parseParagraph(pNode: XmlNode, ctx: ImportContext): ParaInfo {
  const pChildren = childrenOf(pNode, 'w:p');

  // Look for <w:pPr>/<w:pStyle> for the paragraph style.
  // <w:pPr>/<w:rPr> describes the paragraph-mark glyph's formatting
  // per OOXML spec 17.7.5.10 — it does NOT propagate to runs in the
  // paragraph. Runs are formatted by their own rPr plus the pStyle's
  // linked character style. We deliberately do not parse pPr/rPr.
  const pPr = findChild(pChildren, 'w:pPr');
  let pStyle: string | null = null;
  let indent = 0;
  let spacing: Record<string, string> | null = null;
  let numId: number | undefined;
  let ilvl: number | undefined;
  if (pPr) {
    const pPrChildren = childrenOf(pPr, 'w:pPr');
    const pStyleEl = findChild(pPrChildren, 'w:pStyle');
    if (pStyleEl) {
      pStyle = attrsOf(pStyleEl)['w:val'] ?? null;
    }
    const indEl = findChild(pPrChildren, 'w:ind');
    if (indEl) {
      // Prefer `w:left` (LTR); fall back to `w:start` (modern/RTL-aware).
      // Negative indents (hanging-into-margin) are clamped to 0 — we
      // don't have visual support for them and OOXML's required-positive
      // schema makes them rare anyway.
      const ia = attrsOf(indEl);
      const v = ia['w:left'] ?? ia['w:start'];
      const n = v ? parseInt(v, 10) : NaN;
      if (Number.isFinite(n) && n > 0) indent = n;
    }
    // `<w:spacing>` — capture all attribute values verbatim for
    // round-trip. We don't apply them visually in the editor; per-
    // type CSS governs paragraph rhythm, and the captured data is
    // re-emitted on export so Word sees the original values.
    const spEl = findChild(pPrChildren, 'w:spacing');
    if (spEl) {
      const captured: Record<string, string> = {};
      for (const [k, v] of Object.entries(attrsOf(spEl))) {
        if (typeof v === 'string') captured[k] = v;
      }
      if (Object.keys(captured).length > 0) spacing = captured;
    }
    // `<w:numPr>` — list membership (numId) + level (ilvl). numId 0 means "no
    // numbering", so only a positive numId counts as live.
    const numPrEl = findChild(pPrChildren, 'w:numPr');
    if (numPrEl) {
      const numPrChildren = childrenOf(numPrEl, 'w:numPr');
      const numIdEl = findChild(numPrChildren, 'w:numId');
      const idv = numIdEl ? attrsOf(numIdEl)['w:val'] : undefined;
      const idn = idv ? parseInt(idv, 10) : NaN;
      if (Number.isFinite(idn) && idn > 0) {
        numId = idn;
        const ilvlEl = findChild(numPrChildren, 'w:ilvl');
        const lv = ilvlEl ? attrsOf(ilvlEl)['w:val'] : undefined;
        const ln = lv ? parseInt(lv, 10) : 0;
        ilvl = Number.isFinite(ln) && ln > 0 ? ln : 0;
      }
    }
  }

  // Heading id from pmd-heading-* bookmark (if present).
  let headingId: string | null = null;
  for (const c of pChildren) {
    if ('w:bookmarkStart' in c) {
      const name = attrsOf(c)['w:name'];
      if (name) {
        const id = idFromBookmarkName(name);
        if (id) {
          headingId = id;
          break;
        }
      }
    }
  }

  // Walk inline content: <w:r>, <w:hyperlink>, etc.
  const inlines: PMNode[] = [];
  for (const c of pChildren) {
    collectInlines(c, ctx, inlines);
  }

  let nodeType = resolveNodeType(pStyle, ctx, pPr);
  // A style-less / non-structural paragraph that nonetheless carries an outline
  // level + the matching Verbatim heading formatting (e.g. a tag typed as plain
  // "Normal" with a direct <w:outlineLvl w:val="3"/> + 13pt bold) is promoted to
  // its structural node — see `outlineHeadingNode`.
  if (nodeType === 'paragraph') {
    const promoted = outlineHeadingNode(
      pPr,
      pChildren,
      pStyle ? ctx.styles.get(pStyle) : undefined,
      ctx.styles,
    );
    if (promoted) nodeType = promoted;
  }

  return { nodeType, inlines, headingId, pStyle, indent, spacing, numId, ilvl };
}

/**
 * Parse a `<w:tbl>` into a `table` PMNode. Supports:
 *   - `<w:gridSpan>` → `colspan` on the cell.
 *   - `<w:vMerge w:val="restart"/>` + `<w:vMerge/>` continuations →
 *     `rowspan` on the restart cell; continuation cells dropped
 *     from PM rows.
 *   - `<w:p>` cell content → generic `paragraph` nodes (with the
 *     paragraph's `<w:jc>` preserved as the `alignment` attr).
 *
 * Out of scope (preserved structurally but not visually): cell
 * widths, borders, shading, table styles.
 */
/** Children of `<w:tcPr>` that the exporter regenerates from the
 *  cell's structural attrs (colspan, rowspan, colwidth). Stripped
 *  from `rawTcPr` so they don't double on round-trip. The change-
 *  tracking markers (`tcPrChange`, `cellIns`, `cellDel`, `cellMerge`)
 *  are also stripped — accepting track changes means dropping
 *  change records and keeping the post-change state. */
const TCPR_GENERATED_CHILDREN: ReadonlySet<string> = new Set([
  'w:gridSpan',
  'w:vMerge',
  'w:tcW',
  'w:tcPrChange',
  'w:cellIns',
  'w:cellDel',
  'w:cellMerge',
]);

/** Children of `<w:tblPr>` to strip from the captured `rawTblPr`
 *  for the same reason as `tcPrChange` above: track-changes records
 *  should not survive an "accept on import". */
const TBLPR_STRIPPED_CHILDREN: ReadonlySet<string> = new Set([
  'w:tblPrChange',
]);

function parseTable(tblNode: XmlNode, ctx: ImportContext): PMNode | null {
  type CellData = {
    colspan: number;
    rowspan: number;
    colPos: number;
    rawTcPr: string | null;
    content: PMNode[];
  };
  const rowCells: CellData[][] = [];
  const vmergeRestarts: Map<number, CellData> = new Map();

  // Capture `<w:tblPr>` extras so table-level borders / shading /
  // tblStyle round-trip verbatim. Children we don't want to preserve
  // (tblPrChange — accept-on-import) get stripped.
  let rawTblPr: string | null = null;
  const tblPrEl = findChild(childrenOf(tblNode, 'w:tbl'), 'w:tblPr');
  if (tblPrEl) {
    const keep = childrenOf(tblPrEl, 'w:tblPr').filter((child) => {
      for (const k of Object.keys(child)) {
        if (k === ':@' || k === '#text') continue;
        return !TBLPR_STRIPPED_CHILDREN.has(k);
      }
      return false;
    });
    if (keep.length > 0) rawTblPr = serializeXmlNodes(keep);
  }

  // Parse <w:tblGrid><w:gridCol w:w="…"/> column widths so the
  // rendered table reflects Word's actual column sizing. OOXML width
  // is in dxa (twentieths of a point); convert to CSS px at 96 DPI:
  // 1 inch = 1440 dxa = 96 px, so px = dxa / 15.
  const gridColWidthsPx: number[] = [];
  const tblGrid = findChild(childrenOf(tblNode, 'w:tbl'), 'w:tblGrid');
  if (tblGrid) {
    for (const gc of childrenOf(tblGrid, 'w:tblGrid')) {
      if (!('w:gridCol' in gc)) continue;
      const w = Number(attrsOf(gc)['w:w']);
      if (Number.isFinite(w) && w > 0) {
        gridColWidthsPx.push(Math.round(w / 15));
      } else {
        gridColWidthsPx.push(0);
      }
    }
  }

  for (const child of childrenOf(tblNode, 'w:tbl')) {
    if (!('w:tr' in child)) continue;
    const cells: CellData[] = [];
    let colPos = 0;
    for (const tcChild of childrenOf(child, 'w:tr')) {
      if (!('w:tc' in tcChild)) continue;
      const tcChildren = childrenOf(tcChild, 'w:tc');
      const tcPr = findChild(tcChildren, 'w:tcPr');
      let colspan = 1;
      let vMergeMode: 'none' | 'restart' | 'continue' = 'none';
      let rawTcPr: string | null = null;
      if (tcPr) {
        const tcPrChildren = childrenOf(tcPr, 'w:tcPr');
        for (const prop of tcPrChildren) {
          if ('w:gridSpan' in prop) {
            const v = Number(attrsOf(prop)['w:val'] || 1);
            if (Number.isFinite(v) && v > 1) colspan = v;
          } else if ('w:vMerge' in prop) {
            const val = attrsOf(prop)['w:val'];
            vMergeMode = val === 'restart' ? 'restart' : 'continue';
          }
        }
        // Capture everything except the structurally-regenerated
        // properties (gridSpan, vMerge, tcW, tcPrChange) for verbatim
        // re-emission on export. tcBorders, shd, tcMar, vAlign, etc.
        // all land here and survive round-trip.
        const keep = tcPrChildren.filter((child) => {
          for (const k of Object.keys(child)) {
            if (k === ':@' || k === '#text') continue;
            return !TCPR_GENERATED_CHILDREN.has(k);
          }
          return false;
        });
        if (keep.length > 0) rawTcPr = serializeXmlNodes(keep);
      }
      if (vMergeMode === 'continue') {
        const active = vmergeRestarts.get(colPos);
        if (active) active.rowspan += 1;
        colPos += colspan;
        continue;
      }
      const cellParas: PMNode[] = [];
      for (const cellChild of tcChildren) {
        if ('w:p' in cellChild) {
          const para = parseCellParagraph(cellChild, ctx);
          if (para) cellParas.push(para);
        }
      }
      if (cellParas.length === 0) {
        const fallback = schema.nodes['paragraph']!.createAndFill();
        if (fallback) cellParas.push(fallback);
      }
      const data: CellData = { colspan, rowspan: 1, colPos, rawTcPr, content: cellParas };
      cells.push(data);
      if (vMergeMode === 'restart') {
        vmergeRestarts.set(colPos, data);
      } else {
        vmergeRestarts.delete(colPos);
      }
      colPos += colspan;
    }
    if (cells.length > 0) rowCells.push(cells);
  }

  if (rowCells.length === 0) return null;

  const tableType = schema.nodes['table'];
  const rowType = schema.nodes['table_row'];
  const cellType = schema.nodes['table_cell'];
  if (!tableType || !rowType || !cellType) return null;

  const rows = rowCells.map((cells) =>
    rowType.create(
      null,
      cells.map((c) => {
        // Slice the gridCol widths covered by this cell. If any width
        // in the slice is missing/zero we drop the whole array so PM-
        // tables falls back to default sizing rather than rendering
        // a half-sized column.
        let colwidth: number[] | null = null;
        if (gridColWidthsPx.length > 0) {
          const slice = gridColWidthsPx.slice(c.colPos, c.colPos + c.colspan);
          if (slice.length === c.colspan && slice.every((w) => w > 0)) {
            colwidth = slice;
          }
        }
        return cellType.create(
          {
            colspan: c.colspan,
            rowspan: c.rowspan,
            colwidth,
            rawTcPr: c.rawTcPr,
          },
          c.content,
        );
      }),
    ),
  );
  return tableType.create({ rawTblPr }, rows);
}

/** Parse a `<w:p>` as a cell paragraph: plain `paragraph` nodeType,
 *  preserve `<w:pPr>/<w:jc>` as the `alignment` attr, and reuse
 *  the standard inline-content walk so marks (font_size, bold,
 *  highlight, etc.) survive into the cell. */
function parseCellParagraph(pNode: XmlNode, ctx: ImportContext): PMNode | null {
  const pChildren = childrenOf(pNode, 'w:p');
  const pPr = findChild(pChildren, 'w:pPr');
  let alignment: 'left' | 'center' | 'right' | 'justify' | null = null;
  if (pPr) {
    const jc = findChild(childrenOf(pPr, 'w:pPr'), 'w:jc');
    if (jc) {
      const v = attrsOf(jc)['w:val'];
      if (v === 'center' || v === 'right' || v === 'left' || v === 'justify') {
        alignment = v;
      } else if (v === 'start') {
        alignment = 'left';
      } else if (v === 'end') {
        alignment = 'right';
      }
    }
  }
  const inlines: PMNode[] = [];
  for (const c of pChildren) {
    collectInlines(c, ctx, inlines);
  }
  const paragraph = schema.nodes['paragraph'];
  if (!paragraph) return null;
  return paragraph.create({ alignment }, inlines);
}

function collectInlines(node: XmlNode, ctx: ImportContext, out: PMNode[]): void {
  if ('w:r' in node) {
    parseRun(node, ctx, out);
  } else if ('w:hyperlink' in node) {
    const a = attrsOf(node);
    const rId = a['r:id'] ?? a['rId'] ?? '';
    if (rId) ctx.hyperlinkStack.push(rId);
    for (const c of childrenOf(node, 'w:hyperlink')) {
      collectInlines(c, ctx, out);
    }
    if (rId) ctx.hyperlinkStack.pop();
  }
  // Track-change wrappers — "accept all" policy:
  //  - `<w:ins>` / `<w:moveTo>` ← inserted / move-target content;
  //    treat as kept. Recurse into the wrapped runs.
  //  - `<w:del>` / `<w:moveFrom>` ← deleted / move-source content;
  //    drop entirely (no recursion).
  else if ('w:ins' in node || 'w:moveTo' in node) {
    const tag = 'w:ins' in node ? 'w:ins' : 'w:moveTo';
    for (const c of childrenOf(node, tag)) {
      collectInlines(c, ctx, out);
    }
  } else if ('w:del' in node || 'w:moveFrom' in node) {
    // Intentionally no-op: deletion / move-source content is dropped.
  }
  // Comment range brackets. These live as siblings of `<w:r>` at
  // the paragraph level (and can span paragraphs — the stack on
  // ImportContext is doc-wide so cross-paragraph ranges work).
  else if ('w:commentRangeStart' in node) {
    const id = attrsOf(node)['w:id'];
    if (id) ctx.commentRangeStack.push(id);
  } else if ('w:commentRangeEnd' in node) {
    const id = attrsOf(node)['w:id'];
    if (id) {
      const idx = ctx.commentRangeStack.lastIndexOf(id);
      if (idx >= 0) ctx.commentRangeStack.splice(idx, 1);
    }
  }
  // Other inline-ish nodes (w:bookmarkStart, w:bookmarkEnd,
  // w:commentReference, etc.) — skip.
}

function parseRun(rNode: XmlNode, ctx: ImportContext, out: PMNode[]): void {
  const rChildren = childrenOf(rNode, 'w:r');
  const rPrEl = findChild(rChildren, 'w:rPr');
  const baseMarks = rPrEl ? [...parseRPr(rPrEl, ctx.styles).marks] : [];

  // Compute the live marks at the moment of emitting a text node.
  // Field state can change mid-run when `<w:fldChar>` appears between
  // text-emitting children, so we resolve hyperlink-from-field per
  // emission rather than once up-front.
  const currentMarks = (): Mark[] => {
    const m: Mark[] = [...baseMarks];
    if (ctx.hyperlinkStack.length > 0) {
      const top = ctx.hyperlinkStack[ctx.hyperlinkStack.length - 1]!;
      const href = ctx.rels[top];
      if (href) m.push(schema.marks['link']!.create({ href }));
    }
    if (!m.some((x) => x.type.name === 'link')) {
      for (let i = ctx.fieldStack.length - 1; i >= 0; i--) {
        const f = ctx.fieldStack[i]!;
        if (f.phase === 'result' && f.hyperlinkHref) {
          m.push(schema.marks['link']!.create({ href: f.hyperlinkHref }));
          break;
        }
      }
    }
    // Each open `<w:commentRangeStart>` contributes a `comment_range`
    // mark. Multiple overlapping comment ranges on the same text get
    // multiple marks — ProseMirror collapses duplicates with the
    // same threadId but keeps distinct ids.
    for (const threadId of ctx.commentRangeStack) {
      m.push(schema.marks['comment_range']!.create({ threadId }));
    }
    return m;
  };

  const inInstrPhase = (): boolean =>
    ctx.fieldStack.some((f) => f.phase === 'instr');

  for (const c of rChildren) {
    // Field-code state transitions: begin → instr phase, separate →
    // result phase (parse HYPERLINK url if present), end → pop.
    if ('w:fldChar' in c) {
      const t = attrsOf(c)['w:fldCharType'];
      if (t === 'begin') {
        ctx.fieldStack.push({ phase: 'instr', instr: '', hyperlinkHref: null });
      } else if (t === 'separate') {
        const top = ctx.fieldStack[ctx.fieldStack.length - 1];
        if (top) {
          top.phase = 'result';
          const mm = top.instr.match(/HYPERLINK\s+"([^"]*)"/i);
          if (mm) top.hyperlinkHref = mm[1] ?? null;
        }
      } else if (t === 'end') {
        ctx.fieldStack.pop();
      }
      continue;
    }
    // Field instruction text accumulates into the current field's
    // `instr` buffer; we never emit it as display text.
    if ('w:instrText' in c) {
      const top = ctx.fieldStack[ctx.fieldStack.length - 1];
      if (top && top.phase === 'instr') top.instr += textContent(c);
      continue;
    }
    // Any display content between begin and separate (rare) is part
    // of the field's specification, not its rendered output. Drop.
    if (inInstrPhase()) continue;

    if ('w:t' in c) {
      const text = textContent(c);
      if (text.length > 0) {
        try {
          let effectiveMarks = currentMarks();
          // Verbatim's pilcrow encoding: a `¶` glyph in a run sized to
          // 6pt (`<w:sz w:val="12"/>`). Recognize it and use the
          // non-inclusive `pilcrow_marker` mark in place of `font_size`
          // — the inclusive font_size mark would otherwise cause
          // adjacent typing to inherit the 6pt size.
          if (text === '¶') {
            const sizeIdx = effectiveMarks.findIndex(
              (m) => m.type.name === 'font_size' && m.attrs['halfPoints'] === 12,
            );
            if (sizeIdx >= 0) {
              effectiveMarks = [
                ...effectiveMarks.slice(0, sizeIdx),
                ...effectiveMarks.slice(sizeIdx + 1),
                schema.marks['pilcrow_marker']!.create(),
              ];
            }
          }
          out.push(schema.text(text, effectiveMarks));
        } catch (_) {
          // Empty text or invalid characters; skip.
        }
      }
    } else if ('w:tab' in c) {
      try { out.push(schema.text('\t', currentMarks())); } catch (_) { /* */ }
    }
    // <w:br/>: page-type breaks and plain line breaks both import as a
    // newline (no hard-page-break support).
    else if ('w:br' in c) {
      try { out.push(schema.text('\n', currentMarks())); } catch (_) { /* */ }
    }
    // Word-internal hyphen elements: non-breaking hyphen and soft
    // (optional/discretionary) hyphen. Round-trip as the corresponding
    // Unicode characters so they survive editing.
    else if ('w:noBreakHyphen' in c) {
      try { out.push(schema.text('‑', currentMarks())); } catch (_) { /* */ }
    } else if ('w:softHyphen' in c) {
      try { out.push(schema.text('­', currentMarks())); } catch (_) { /* */ }
    }
    // Footnote / endnote references — become self-contained footnote
    // nodes carrying the flattened body from footnotes.xml/endnotes.xml
    // (empty when the part wasn't provided; the marker still survives).
    else if ('w:footnoteReference' in c || 'w:endnoteReference' in c) {
      const isEnd = 'w:endnoteReference' in c;
      const id = attrsOf(c)['w:id'] ?? '';
      const map = isEnd ? ctx.endnotes : ctx.footnotes;
      const content = (id && map?.get(id)) || [];
      let fnNode = schema.nodes['footnote']!.create({
        kind: isEnd ? 'endnote' : 'footnote',
        content,
      });
      if (ctx.commentRangeStack.length > 0) {
        fnNode = fnNode.mark(
          ctx.commentRangeStack.map((threadId) =>
            schema.marks['comment_range']!.create({ threadId }),
          ),
        );
      }
      out.push(fnNode);
    }
    // Inline pictures: <w:drawing><wp:inline>… or floating
    // <w:drawing><wp:anchor>…. Both wrap a picture referenced via
    // r:embed on an <a:blip>. Without media-parts access we can't
    // round-trip the image bytes, so the drawing is silently dropped.
    else if ('w:drawing' in c) {
      let imgNode = parseDrawing(c, ctx);
      if (imgNode) {
        // Apply any open comment ranges to the image so a comment
        // anchored on a picture survives the docx round-trip — the text
        // path does the same from `commentRangeStack` above.
        if (ctx.commentRangeStack.length > 0) {
          imgNode = imgNode.mark(
            ctx.commentRangeStack.map((threadId) =>
              schema.marks['comment_range']!.create({ threadId }),
            ),
          );
        }
        out.push(imgNode);
      }
    }
  }
}

/**
 * Walk a <w:drawing> element to find the image's blip embed (relId)
 * and extent (dimensions in EMU), look up the media bytes via the
 * provided rels + media-parts map, and produce an `image` schema node
 * with the bytes embedded as base64.
 *
 * Returns null if any required piece is missing — the relId, the rel
 * lookup, the media file in the zip, etc. — so a drawing we can't
 * round-trip cleanly is dropped.
 */
function parseDrawing(drawingNode: XmlNode, ctx: ImportContext): PMNode | null {
  if (!ctx.mediaParts) return null;

  const blipEmbed = findFirstAttr(drawingNode, 'a:blip', 'r:embed');
  if (!blipEmbed) return null;

  // Resolve relId → target path (e.g., 'media/image1.png').
  const target = ctx.rels[blipEmbed];
  if (!target) return null;
  // Rel targets are relative to word/document.xml; full zip path is
  // 'word/' + target.
  const zipPath = target.startsWith('/') ? target.slice(1) : `word/${target}`;
  const part = ctx.mediaParts.get(zipPath);
  if (!part) return null;

  // Dimensions from <wp:extent cx="..." cy="..."/> (EMU).
  const cx = parseInt(findFirstAttr(drawingNode, 'wp:extent', 'cx') ?? '0', 10);
  const cy = parseInt(findFirstAttr(drawingNode, 'wp:extent', 'cy') ?? '0', 10);

  // Alt text lives on <wp:docPr descr="..."/> at the drawing level;
  // for backwards compatibility with older OOXML producers that wrote
  // descr only on the nested <pic:cNvPr/>, fall back to that. Either
  // path matches what our exporter emits (both copies, mirrored).
  const altRaw = findFirstAttr(drawingNode, 'wp:docPr', 'descr')
    ?? findFirstAttr(drawingNode, 'pic:cNvPr', 'descr')
    ?? '';

  const data = bytesToBase64(part.bytes);

  try {
    return schema.nodes['image']!.createChecked({
      data,
      contentType: part.contentType,
      widthEmu: Number.isFinite(cx) && cx > 0 ? cx : 0,
      heightEmu: Number.isFinite(cy) && cy > 0 ? cy : 0,
      alt: altRaw,
    });
  } catch {
    return null;
  }
}

/**
 * Find the first descendant of `root` matching `tagName`, return its
 * value for attribute `attr`. Walks the fast-xml-parser tree shape
 * (each node is an object whose tag-name key is its children array,
 * with attributes under the ':@' key).
 */
function findFirstAttr(root: XmlNode, tagName: string, attr: string): string | null {
  const stack: XmlNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    for (const key of Object.keys(node)) {
      if (key === ':@') continue;
      if (key === tagName) {
        const a = attrsOf(node);
        if (attr in a) return a[attr] ?? null;
        // Also recurse into the matched node's children (the attribute
        // might be on a descendant of the same tag name — defensive).
      }
      const children = (node as Record<string, unknown>)[key];
      if (Array.isArray(children)) {
        for (const c of children) {
          if (c && typeof c === 'object') stack.push(c as XmlNode);
        }
      }
    }
  }
  return null;
}

interface ParsedRPr {
  marks: Mark[];
}

/**
 * Parse a <w:rPr> element into a set of marks.
 *
 * Per OOXML 17.7.5.10, this is meaningful only when rPr is a child of
 * <w:r>. When it's a child of <w:pPr>, it describes the paragraph mark
 * (¶) only — see parseParagraph, which deliberately ignores pPr/rPr.
 */
function parseRPr(rPr: XmlNode, styles?: StyleMap): ParsedRPr {
  const marks: Mark[] = [];
  const props = childrenOf(rPr, 'w:rPr');
  // Direct <w:u/> is deferred — we decide between underline_mark and
  // underline_direct after seeing whether rStyle="StyleUnderline" is
  // also present in this rPr (order between rStyle and w:u is not
  // guaranteed by OOXML).
  let sawDirectU = false;
  // <w:i/> is deferred for the same reason: on an undertag run it's the
  // exporter's parity encoding (the undertag style implies italic
  // display), not user formatting — importing it as an italic mark
  // would grow marks on every round-trip.
  let sawItalic = false;

  for (const prop of props) {
    const tag = Object.keys(prop).find((k) => k !== ':@');
    if (!tag) continue;
    const a = attrsOf(prop);

    switch (tag) {
      case 'w:rStyle': {
        const styleId = a['w:val'];
        if (styleId) {
          let markName: string | undefined = RSTYLE_TO_MARK[styleId];
          if (!markName) {
            // Legacy character style (Author-Date, Debate Underline, …) not in
            // the canonical map — classify via the shared legacy vocabulary.
            const role = legacyRole({ id: styleId, name: styles?.get(styleId)?.name ?? null });
            if (role === 'char-cite') markName = 'cite_mark';
            else if (role === 'char-underline') markName = 'underline_mark';
          }
          if (markName) marks.push(schema.marks[markName]!.create());
        }
        // Unknown / empty rStyles are dropped (stylepox cleanup).
        break;
      }
      case 'w:b': {
        if (a['w:val'] === '0' || a['w:val'] === 'false') {
          // Explicit "bold off" — preserved as a `bold_off` mark so it
          // both round-trips AND renders (a word un-bolded inside a tag,
          // which is bold by default).
          marks.push(schema.marks['bold_off']!.create());
        } else {
          marks.push(schema.marks['bold']!.create());
        }
        break;
      }
      case 'w:i': {
        if (a['w:val'] !== '0' && a['w:val'] !== 'false') {
          sawItalic = true;
        }
        break;
      }
      case 'w:strike':
      case 'w:dstrike': {
        // Single (`<w:strike/>`) and double (`<w:dstrike/>`) strikethrough
        // both map to our single strikethrough mark — we don't carry
        // the double-strike distinction. On round-trip, double-strike
        // becomes single-strike, which is functionally equivalent for
        // the marks Verbatim users care about.
        if (a['w:val'] !== '0' && a['w:val'] !== 'false') {
          if (!marks.some((m) => m.type.name === 'strikethrough')) {
            marks.push(schema.marks['strikethrough']!.create());
          }
        }
        break;
      }
      case 'w:u': {
        const val = a['w:val'];
        if (val && val !== 'none' && val !== '0') {
          sawDirectU = true;
        }
        break;
      }
      case 'w:color': {
        const c = a['w:val'];
        if (c && /^[0-9a-fA-F]{6}$/.test(c)) {
          marks.push(schema.marks['font_color']!.create({ color: c }));
        }
        break;
      }
      case 'w:sz': {
        const v = a['w:val'];
        const hp = v ? parseInt(v, 10) : NaN;
        if (Number.isFinite(hp) && hp > 0) {
          marks.push(schema.marks['font_size']!.create({ halfPoints: hp }));
        }
        break;
      }
      case 'w:highlight': {
        const c = a['w:val'];
        if (c && c !== 'none') {
          marks.push(schema.marks['highlight']!.create({ color: c }));
        }
        break;
      }
      case 'w:shd': {
        const c = a['w:fill'];
        if (c && /^[0-9a-fA-F]{6}$/.test(c) && c.toLowerCase() !== 'auto') {
          marks.push(schema.marks['shading']!.create({ color: c }));
        }
        break;
      }
      case 'w:rFonts': {
        // Per-run font override. Prefer w:ascii (the primary attribute
        // for English text); fall back to hAnsi or cs if ascii isn't
        // set. We store one font name; the exporter emits it across
        // all three attributes on round-trip.
        const name = a['w:ascii'] || a['w:hAnsi'] || a['w:cs'] || '';
        if (name) {
          marks.push(schema.marks['font_family']!.create({ name }));
        }
        break;
      }
      case 'w:vertAlign': {
        const v = a['w:val'];
        if (v === 'superscript') {
          marks.push(schema.marks['superscript']!.create());
        } else if (v === 'subscript') {
          marks.push(schema.marks['subscript']!.create());
        }
        // 'baseline' (the explicit normal) and unknown values: drop.
        break;
      }
      // Other rPr props (lang, etc.) — drop.
    }
  }

  if (sawDirectU && !marks.some((m) => m.type.name === 'underline_mark')) {
    // <w:u/> without rStyle="StyleUnderline" → direct underline. The
    // named-style-normalizer plugin promotes this to underline_mark
    // if it lands in a body-like textblock; structural textblocks
    // (tag / analytic / pocket / hat / block / undertag) keep
    // underline_direct.
    marks.push(schema.marks['underline_direct']!.create());
  }
  if (sawItalic && !marks.some((m) => m.type.name === 'undertag_mark')) {
    // <w:i/> on an undertag run is swallowed as parity encoding. A
    // genuine user italic on undertag text is indistinguishable in the
    // XML (the exporter emits identical runs for both) and renders
    // identically (the style already displays italic), so this loses
    // nothing visible — the same accepted trade as underline above.
    marks.push(schema.marks['italic']!.create());
  }

  return { marks };
}

/** Verbatim heading level number (1–5, as returned by buildLegacyHeadingMap)
 *  → schema node type. */
const HEADING_LEVEL_NODE: Record<number, string> = {
  1: 'pocket',
  2: 'hat',
  3: 'block',
  4: 'tag',
  5: 'block',
};

/** Whether the document already defines the modern Verbatim required styles —
 *  i.e. a "mixed" doc, whose legacy headings are read by outline level rather
 *  than having their depth inferred. */
function hasVerbatimStyles(styles: StyleMap): boolean {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const s of styles.values()) {
    ids.add(s.id);
    if (s.name) names.add(s.name);
  }
  const groups = [
    ['Style13ptBold', 'Style 13 pt Bold'],
    ['StyleUnderline', 'Style Underline'],
    ['Emphasis'],
  ];
  return groups.every((vs) => vs.some((v) => ids.has(v) || names.has(v)));
}

/** Effective outline level of a paragraph: a direct `<w:outlineLvl>` override,
 *  else the style's own level (-1 when neither is present). */
function paragraphOutline(pPr: XmlNode | null, info: StyleInfo | undefined): number {
  if (pPr) {
    const olEl = findChild(childrenOf(pPr, 'w:pPr'), 'w:outlineLvl');
    if (olEl) {
      const n = parseInt(attrsOf(olEl)['w:val'] ?? '', 10);
      if (Number.isFinite(n)) return n;
    }
  }
  return info?.outlineLevel ?? -1;
}

// ── Outline-level heading promotion ──────────────────────────────────────────
// Mirror of the style cleaner's first-pass header detection
// (`ooxml/style-clean/style-cleaner.ts`): a paragraph carrying an outline level
// AND the matching Verbatim heading formatting is promoted to its structural
// node, so a doc whose tags/headings are plain "Normal" + a direct
// `<w:outlineLvl>` (no heading style) still imports its structure. The bold /
// size / underline conjuncts are the cleaner's guardrails — they keep an
// ordinary Word doc that merely uses outline levels from being mis-structured.

/** Direct run bold tri-state: true (`<w:b/>`), false (`<w:b w:val="0"/>`), or null
 *  (not set on the run). */
function runBoldState(rPr: XmlNode | null): boolean | null {
  if (!rPr) return null;
  const b = findChild(childrenOf(rPr, 'w:rPr'), 'w:b');
  if (!b) return null;
  const v = attrsOf(b)['w:val'];
  return v !== '0' && v !== 'false';
}
/** Direct run size in points (`<w:sz>` is half-points), or null. */
function runSizePt(rPr: XmlNode | null): number | null {
  if (!rPr) return null;
  const sz = findChild(childrenOf(rPr, 'w:rPr'), 'w:sz');
  if (!sz) return null;
  const n = parseInt(attrsOf(sz)['w:val'] ?? '', 10);
  return Number.isFinite(n) ? n / 2 : null;
}
/** Direct run underline (`<w:u>` other than `none`). */
function runUnderlined(rPr: XmlNode | null): boolean {
  if (!rPr) return false;
  const u = findChild(childrenOf(rPr, 'w:rPr'), 'w:u');
  if (!u) return false;
  return (attrsOf(u)['w:val'] ?? 'single') !== 'none';
}
/** The run's character style id (`<w:rStyle>`), or null. */
function runCharStyle(rPr: XmlNode | null): string | null {
  if (!rPr) return null;
  const rs = findChild(childrenOf(rPr, 'w:rPr'), 'w:rStyle');
  return rs ? (attrsOf(rs)['w:val'] ?? null) : null;
}

/** Effective bold of a paragraph — mirror of the cleaner's `effectivelyBold`: a
 *  run is bold if it's directly bold, or (when it doesn't set bold itself) if its
 *  character style or the paragraph style resolves bold. The style bolds are the
 *  `basedOn`-resolved values precomputed in `parseStyles`, so this stays a few
 *  property reads per run with no chain walking. */
function paragraphEffectivelyBold(
  pChildren: XmlNode[],
  pInfo: StyleInfo | undefined,
  styles: StyleMap,
): boolean {
  const pStyleBold = pInfo?.bold ?? false;
  for (const c of pChildren) {
    if (!('w:r' in c)) continue;
    const rPr = findChild(childrenOf(c, 'w:r'), 'w:rPr');
    const direct = runBoldState(rPr);
    if (direct === true) return true;
    if (direct === false) continue; // explicit bold-off on this run
    const rStyle = runCharStyle(rPr);
    const charBold = rStyle ? (styles.get(rStyle)?.bold ?? false) : false;
    if (charBold || pStyleBold) return true;
  }
  return false;
}

/** The structural node a non-heading paragraph's outline level + formatting imply,
 *  or null to leave it a paragraph. Mirrors `style-cleaner.ts` levels 0–3 →
 *  pocket / hat / block / tag with the same guards: pocket / hat / block key off
 *  DIRECT run bold + size (+ underline); the tag keys off effective bold (direct
 *  run, the run's char style, or the paragraph style). The outline level and the
 *  style bolds are `basedOn`-resolved in `parseStyles`, so a heading/tag that is
 *  one only through an inherited style is caught too. Only consulted when
 *  style-based classification produced a plain `paragraph`. */
function outlineHeadingNode(
  pPr: XmlNode | null,
  pChildren: XmlNode[],
  info: StyleInfo | undefined,
  styles: StyleMap,
): string | null {
  const outline = paragraphOutline(pPr, info);
  if (outline < 0 || outline > 3) return null;
  const rPrs = pChildren
    .filter((c) => 'w:r' in c)
    .map((r) => findChild(childrenOf(r, 'w:r'), 'w:rPr'));
  const anyRun = (pred: (rPr: XmlNode | null) => boolean): boolean => rPrs.some(pred);
  if (outline === 0)
    return anyRun((r) => runBoldState(r) === true && runSizePt(r) === 26) ? 'pocket' : null;
  if (outline === 1)
    return anyRun((r) => runBoldState(r) === true && runSizePt(r) === 22) ? 'hat' : null;
  if (outline === 2)
    return anyRun((r) => runBoldState(r) === true && runUnderlined(r) && runSizePt(r) === 16)
      ? 'block'
      : null;
  // outline === 3 → Tag, gated on the cleaner's effectivelyBold.
  return paragraphEffectivelyBold(pChildren, info, styles) ? 'tag' : null;
}

/** Decide how this document's legacy paragraph styles map to schema nodes.
 *  Returns null unless the body actually USES an unambiguously-legacy paragraph
 *  style (so files that merely share Word's heading names are unaffected).
 *  Mirrors the cleaner's legacy-remap: tags anchor at Heading 4, and the
 *  organizational headings get a level by outline (mixed) or by inferred depth
 *  (pure pre-Verbatim). */
function planLegacy(bodyChildren: XmlNode[], styles: StyleMap): LegacyPlan | null {
  let tripped = false;
  const headingLevels = new Set<number>();
  for (const node of bodyChildren) {
    if (!('w:p' in node)) continue;
    const pPr = findChild(childrenOf(node, 'w:p'), 'w:pPr');
    const pStyleEl = pPr ? findChild(childrenOf(pPr, 'w:pPr'), 'w:pStyle') : null;
    const pStyle = pStyleEl ? (attrsOf(pStyleEl)['w:val'] ?? null) : null;
    if (!pStyle) continue;
    const info = styles.get(pStyle);
    const lookup = { name: info?.name ?? null, id: pStyle };
    const role = legacyRole(lookup);
    if (!role) continue;
    if (isUnambiguousLegacy(lookup)) tripped = true;
    if (role === 'heading') headingLevels.add(paragraphOutline(pPr, info));
  }
  if (!tripped) return null;
  const levelFor = buildLegacyHeadingMap(headingLevels, hasVerbatimStyles(styles));
  return {
    headingNode: (outline) => HEADING_LEVEL_NODE[levelFor(outline)] ?? 'block',
  };
}

function resolveNodeType(pStyle: string | null, ctx: ImportContext, pPr: XmlNode | null): string {
  const info = pStyle ? ctx.styles.get(pStyle) : undefined;

  // Legacy document: classify legacy paragraph styles first, so a legacy
  // heading — even Word's own "Heading 1" — follows the document's inferred
  // hierarchy rather than its literal Word level. Cites/cards fall through to
  // 'paragraph' and the card-grouping pass reclassifies them.
  if (ctx.legacy && pStyle) {
    const role = legacyRole({ name: info?.name ?? null, id: pStyle });
    if (role === 'tag') return 'tag';
    if (role === 'heading') return ctx.legacy.headingNode(paragraphOutline(pPr, info));
    if (role === 'cite' || role === 'body') return 'paragraph';
  }

  if (pStyle && pStyle in PSTYLE_TO_NODE) {
    return PSTYLE_TO_NODE[pStyle]!;
  }
  // Unknown styleId — try the name/id-based fallback rules (e.g. analytics
  // authored under a non-canonical style). Synthesize a minimal StyleInfo
  // when styles.xml is absent so the styleId-based rules still fire.
  if (pStyle) {
    const fallback = fallbackNodeType(info ?? { id: pStyle, name: null, type: null });
    if (fallback) return fallback;
  }
  // No pStyle (or unknown) → treat as plain Normal paragraph.
  // The card-grouping pass below will reclassify Normals after a Tag
  // into card_body / cite_paragraph as appropriate.
  return 'paragraph';
}

/**
 * Card-grouping pass.
 *
 * Walks the flat paragraph list and groups Tag-rooted sequences into
 * card nodes. Other paragraphs become flat siblings.
 *
 * Conventions:
 *   - A Tag starts a card.
 *   - The card consumes following undertags, then Normals — each
 *     classified as cite_paragraph (any cite_mark on non-whitespace
 *     content) or card_body — plus inline tables.
 *   - The card ends at the next heading-level paragraph (Tag, Pocket,
 *     Hat, Block, Analytic) or end of document. An Analytic under a tag
 *     therefore ends the card and starts its own analytic_unit.
 *
 * This mirrors the way real Verbatim docs are structured — the card
 * boundary is implicit in the paragraph sequence; we promote it to a
 * schema node for editor-side ergonomics.
 *
 * Exported as the shared phase-(b) back-end for the smart-paste
 * converters (see the `ParaInfo` doc comment) — they classify foreign
 * clipboard HTML into `ParaInfo[]` and hand assembly to this exact
 * code path so paste and .docx import can never disagree about
 * structure.
 */
export function assembleDoc(
  paragraphs: ParaInfo[],
  provenance?: Map<string, number>,
): PMNode {
  const docNodes: PMNode[] = [];
  // Auto-numbering: card/analytic_unit node → the numId/ilvl its tag carried, so
  // the reconstruction pass below can derive numRole/numRestart (NUMBERING §5).
  const cardNumInfo = new Map<PMNode, { numId: number; ilvl: number }>();
  let i = 0;
  while (i < paragraphs.length) {
    const para = paragraphs[i]!;

    // Pre-assembled raw nodes (tables) bypass the paragraph-classifier
    // logic entirely — they emit straight into the doc at this point.
    if (para.rawNode) {
      docNodes.push(para.rawNode);
      i++;
      continue;
    }

    if (para.nodeType === 'analytic') {
      // Start an analytic_unit: analytic + undertag* + card_body*
      const analyticAttrs = attrsForHeading(para.headingId);
      recordProvenance(provenance, analyticAttrs.id, para);
      const analyticNode = schema.nodes['analytic']!.create(
        withIndent(analyticAttrs, para),
        para.inlines,
      );
      const unitChildren: PMNode[] = [analyticNode];
      let j = i + 1;

      // Consume undertags directly attached to the analytic.
      while (j < paragraphs.length && paragraphs[j]!.nodeType === 'undertag') {
        const u = paragraphs[j]!;
        unitChildren.push(
          schema.nodes['undertag']!.create(withIndent(null, u), u.inlines),
        );
        j++;
      }

      // Body paragraphs: classify by cite_mark presence (same rule as
      // in cards); analytic_unit accepts cite_paragraph too.
      // Also absorb inline tables — the analytic_unit schema accepts
      // `table` as a child; without this loop seeing them, every
      // post-analytic table would be ejected back to the doc level
      // and break the visual grouping users expect.
      while (j < paragraphs.length) {
        const p = paragraphs[j]!;
        if (p.nodeType === 'paragraph') {
          const slot = hasCiteMark(p.inlines) ? 'cite_paragraph' : 'card_body';
          unitChildren.push(schema.nodes[slot]!.create(withIndent(null, p), p.inlines));
          j++;
          continue;
        }
        if (p.rawNode && p.rawNode.type.name === 'table') {
          unitChildren.push(p.rawNode);
          j++;
          continue;
        }
        break;
      }

      try {
        const unitNode = schema.nodes['analytic_unit']!.createChecked(null, unitChildren);
        docNodes.push(unitNode);
        if (para.numId != null) {
          cardNumInfo.set(unitNode, { numId: para.numId, ilvl: para.ilvl ?? 0 });
        }
      } catch (_e) {
        // Analytic_unit construction failed — emit children directly at
        // doc level, coercing tags/analytics into wrappers since they
        // can't appear at doc level on their own.
        for (const child of unitChildren) {
          docNodes.push(coerceToDocChild(child));
        }
      }
      i = j;
      continue;
    }

    if (para.nodeType === 'tag') {
      // Start a card: tag + undertag* + cite_paragraph? + card_body*
      const tagAttrs = attrsForHeading(para.headingId);
      recordProvenance(provenance, tagAttrs.id, para);
      const tagNode = schema.nodes['tag']!.create(
        withIndent(tagAttrs, para),
        para.inlines,
      );
      const cardChildren: PMNode[] = [tagNode];
      let j = i + 1;

      // Consume undertags directly attached to the tag.
      while (j < paragraphs.length && paragraphs[j]!.nodeType === 'undertag') {
        const u = paragraphs[j]!;
        cardChildren.push(
          schema.nodes['undertag']!.create(withIndent(null, u), u.inlines),
        );
        j++;
      }

      // An analytic under the tag is NOT folded into the card — `analytic`
      // anchors its own analytic_unit. The body loop below stops at it, the
      // card ends here, and the next outer-loop iteration starts an
      // analytic_unit from it (absorbing the bodies that follow). Same result
      // as pasting an analytic into a card.

      // Body paragraphs: any Normal paragraph until we hit a heading-
      // level boundary. Classify each as cite_paragraph if its inline
      // content carries any cite_mark, otherwise as card_body. This is
      // content-based (matches what the user sees) rather than position-
      // based, so cards with multiple cite paragraphs round-trip cleanly.
      // Inline tables are absorbed into the card too — the schema
      // accepts `table` as a card child, and a docx where the table
      // sits between the tag and the next heading was authored as
      // part of that card's evidence.
      while (j < paragraphs.length) {
        const p = paragraphs[j]!;
        if (p.nodeType === 'paragraph') {
          const slot = hasCiteMark(p.inlines) ? 'cite_paragraph' : 'card_body';
          cardChildren.push(schema.nodes[slot]!.create(withIndent(null, p), p.inlines));
          j++;
          continue;
        }
        if (p.rawNode && p.rawNode.type.name === 'table') {
          cardChildren.push(p.rawNode);
          j++;
          continue;
        }
        break;
      }

      // Construct the card.
      try {
        const cardNode = schema.nodes['card']!.createChecked(null, cardChildren);
        docNodes.push(cardNode);
        if (para.numId != null) {
          cardNumInfo.set(cardNode, { numId: para.numId, ilvl: para.ilvl ?? 0 });
        }
      } catch (_e) {
        // Card construction failed — emit children directly at doc
        // level, coercing tags/analytics into wrappers. Should be rare
        // since the doc content expression is permissive.
        for (const child of cardChildren) {
          docNodes.push(coerceToDocChild(child));
        }
      }
      i = j;
    } else {
      // Standalone paragraph kind (pocket/hat/block, or a fallback tag/analytic).
      const node = paragraphToNode(para);
      if (node) {
        if (HEADING_TYPE_NAMES.has(node.type.name)) {
          recordProvenance(provenance, (node.attrs as { id?: string }).id, para);
        }
        docNodes.push(node);
      }
      i++;
    }
  }

  // Reconstruct the numbering skeleton (numRole / numRestart) from the numId/ilvl
  // the cards carried — a no-op when the doc had no numbering.
  const numbered = reconstructNumbering(docNodes, cardNumInfo);

  // Wrap in doc node. If schema rejects (which would be surprising given
  // our permissive content expression), coerce stray tags/analytics
  // into legal doc-level children and try again.
  try {
    return schema.nodes['doc']!.createChecked(null, numbered);
  } catch (_e) {
    return schema.nodes['doc']!.createChecked(
      null,
      numbered.map((n) => coerceToDocChild(n)),
    );
  }
}

/**
 * Rebuild the numbering skeleton from Word numbering (NUMBERING_PLAN.md §5).
 * `cardNumInfo` gives each numbered card's numId/ilvl. We walk the top-level
 * sequence and reconstruct:
 *   - numRole: ilvl 0 → 'number', ilvl ≥ 1 → 'sub' (clamped; we're two-level).
 *   - a card numRestart when its numId differs from the previous numbered card's
 *     AND no heading sat between them (a heading already explains the restart).
 *   - a block numRestart=false ("continue") when the numbered cards on both sides
 *     share one numId — the running count flowed across it.
 * Returns fresh nodes only where something changed; a doc with no numbering is
 * returned untouched.
 */
function reconstructNumbering(
  nodes: PMNode[],
  cardNumInfo: Map<PMNode, { numId: number; ilvl: number }>,
): PMNode[] {
  if (cardNumInfo.size === 0) return nodes;

  const role = new Map<number, 'number' | 'sub'>();
  const cardRestart = new Set<number>();
  const blockContinue = new Set<number>();
  let lastNumId: number | null = null;
  let pendingBlocks: number[] = []; // block indices since the last numbered card

  for (let k = 0; k < nodes.length; k++) {
    const t = nodes[k]!.type.name;
    if (t === 'pocket' || t === 'hat') {
      // A higher heading is a hard scope reset; the next card's new numId is
      // explained by it, so it never marks a card restart.
      pendingBlocks = [];
      lastNumId = null;
      continue;
    }
    if (t === 'block') {
      pendingBlocks.push(k);
      continue;
    }
    if (t === 'card' || t === 'analytic_unit') {
      const info = cardNumInfo.get(nodes[k]!);
      if (!info) continue; // a skip: leaves run tracking untouched
      role.set(k, info.ilvl === 0 ? 'number' : 'sub');
      if (lastNumId !== null) {
        if (info.numId === lastNumId) {
          // Same run continued — any blocks it crossed are "continue" blocks.
          for (const b of pendingBlocks) blockContinue.add(b);
        } else if (pendingBlocks.length === 0) {
          // New numId with no heading to explain it → a mid-list card restart.
          cardRestart.add(k);
        }
      }
      lastNumId = info.numId;
      pendingBlocks = [];
    }
  }

  if (role.size === 0 && cardRestart.size === 0 && blockContinue.size === 0) return nodes;
  return nodes.map((n, k) => {
    const t = n.type.name;
    if (t === 'card' || t === 'analytic_unit') {
      const r = role.get(k);
      const restart = cardRestart.has(k);
      if (r || restart) {
        return n.type.create({ ...n.attrs, numRole: r ?? 'none', numRestart: restart }, n.content, n.marks);
      }
    } else if (t === 'block' && blockContinue.has(k)) {
      return n.type.create({ ...n.attrs, numRestart: false }, n.content, n.marks);
    }
    return n;
  });
}

/** True if any NON-WHITESPACE inline node carries the cite_mark mark.
 *  Cut docs routinely carry the cite character style on shrunk
 *  inter-word spaces deep into body text (Verbatim's 8-pt-space
 *  convention keeps whatever rStyle the cut left on them) — that's
 *  styling debris, not a cite line, and classifying on it turned body
 *  paragraphs into cite_paragraphs that e.g. refuse to shrink. */
function hasCiteMark(inlines: readonly PMNode[]): boolean {
  for (const n of inlines) {
    if (n.isText && (!n.text || !n.text.trim())) continue;
    if (n.marks.some((m) => m.type.name === 'cite_mark')) return true;
  }
  return false;
}

function attrsForHeading(id: string | null): { id: string } {
  return { id: id ?? newHeadingId() };
}

/** Record `headingId → srcPara` for the source-anchor injector, when the caller
 *  asked for provenance and we have both a heading id and a paragraph index.
 *  No-op on the normal import path (`provenance` undefined). */
function recordProvenance(
  provenance: Map<string, number> | undefined,
  headingId: string | undefined,
  para: ParaInfo,
): void {
  if (provenance && headingId && para.srcPara != null && para.srcPara >= 0) {
    provenance.set(headingId, para.srcPara);
  }
}

/** Merge per-paragraph round-trip attrs (indent + spacing) onto a
 *  base attrs object. Returns `null` unchanged when nothing to add
 *  so call sites can still pass `null` for paragraphs that had
 *  neither a `<w:ind>` nor a `<w:spacing>`. */
function withIndent(
  base: Record<string, unknown> | null,
  para: ParaInfo,
): Record<string, unknown> | null {
  const hasIndent = para.indent && para.indent > 0;
  const hasSpacing = para.spacing && Object.keys(para.spacing).length > 0;
  if (!hasIndent && !hasSpacing) return base;
  const out: Record<string, unknown> = { ...(base ?? {}) };
  if (hasIndent) out['indent'] = para.indent;
  if (hasSpacing) out['spacing'] = para.spacing;
  return out;
}

function paragraphToNode(para: ParaInfo): PMNode | null {
  // A "Normal" paragraph at doc level (not under a Tag/Analytic) that
  // contains any cite_mark inline is promoted to cite_paragraph — same
  // content-based classification we use inside cards. Schema allows
  // cite_paragraph at doc level, and this preserves round-trip fidelity
  // for stray F8'd paragraphs not yet wrapped in a card.
  const effectiveType =
    para.nodeType === 'paragraph' && hasCiteMark(para.inlines)
      ? 'cite_paragraph'
      : para.nodeType;
  const nodeType = schema.nodes[effectiveType] as NodeType | undefined;
  if (!nodeType) return null;
  const isHeading = ['pocket', 'hat', 'block', 'tag', 'analytic'].includes(effectiveType);
  const baseAttrs = isHeading ? attrsForHeading(para.headingId) : {};
  const attrs: Record<string, unknown> = { ...baseAttrs };
  // Every paragraph-like textblock kind carries the indent + spacing
  // round-trip attrs.
  if (para.indent > 0) attrs['indent'] = para.indent;
  if (para.spacing && Object.keys(para.spacing).length > 0) {
    attrs['spacing'] = para.spacing;
  }
  try {
    return nodeType.createChecked(attrs, para.inlines);
  } catch (_e) {
    return null;
  }
}

function coerceToDocChild(node: PMNode): PMNode {
  // Tags and analytics aren't legal at doc level on their own; wrap them
  // in their required parent (card / analytic_unit) so a fallback doc
  // construction still validates.
  if (node.type.name === 'tag') {
    return schema.nodes['card']!.createChecked(null, [node]);
  }
  if (node.type.name === 'analytic') {
    return schema.nodes['analytic_unit']!.createChecked(null, [node]);
  }
  return node;
}
