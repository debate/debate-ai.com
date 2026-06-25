/**
 * Schema → OOXML exporter.
 *
 * Walks a ProseMirror doc and emits a valid `word/document.xml` plus the
 * matching `word/_rels/document.xml.rels` (collecting hyperlink relationships
 * along the way).
 *
 * Round-trip contract per ARCHITECTURE.md §3:
 *   - Schema-typed structure → canonical Verbatim style references.
 *   - Direct-formatting marks → run/paragraph properties.
 *   - Stable heading IDs → `pmd-heading-<uuid>` bookmarks bracketing the heading paragraph.
 */

import type { Mark, Node as PMNode } from 'prosemirror-model';
import {
  el,
  emptyEl,
  escAttr,
  escText,
  XML_PROLOG,
} from '../ooxml/xml.js';
import {
  MARK_TO_RSTYLE,
  NODE_TO_PSTYLE,
} from '../ooxml/styles.js';
import { bookmarkNameForId } from '../schema/ids.js';
import { base64ToBytes } from '../ooxml/base64.js';
import type { Thread } from '../comments-plugin.js';

interface HyperlinkRel {
  rId: string;
  target: string;
}

interface ImageRel {
  rId: string;
  target: string;
}

/** A binary part the exporter wants written into the docx zip. */
export interface ExportedMediaPart {
  /** Full zip path, e.g. `word/media/image1.png`. */
  path: string;
  bytes: Uint8Array;
}

export interface ExportResult {
  /** `word/document.xml` content. */
  documentXml: string;
  /** `word/_rels/document.xml.rels` content. */
  relsXml: string;
  /** Image / binary parts that the docx zip writer must include. */
  mediaParts: ExportedMediaPart[];
  /** `word/comments.xml` content, or `null` if no comments were
   *  passed in (so the zip writer can skip emitting the part). */
  commentsXml: string | null;
  /** `word/commentsExtended.xml` content. Same null-when-absent
   *  contract as `commentsXml`. */
  commentsExtendedXml: string | null;
}

export interface ExportOptions {
  /** Comment threads to emit. When absent or empty no comments
   *  parts are produced, and the document.xml omits
   *  `<w:commentRangeStart/End>` brackets regardless of what marks
   *  the doc tree carries. */
  threads?: readonly Thread[];
  /** Stable per-document UUID. When provided, `toDocx` writes it as a
   *  custom document property (`docProps/custom.xml`) for the Learn
   *  annotation layer. `exportDoc` itself ignores it. */
  docId?: string;
}

/** Map common image MIME types to file extensions. */
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/tiff': 'tif',
  'image/x-emf': 'emf',
  'image/x-wmf': 'wmf',
};

const DOCUMENT_OPEN = `${XML_PROLOG}
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14"><w:body>`;

const SECT_PR_AND_DOCUMENT_CLOSE = `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;

const RELS_OPEN = `${XML_PROLOG}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`;
const RELS_CLOSE = '</Relationships>';

/**
 * Heading-level node types that get a `pmd-heading-<uuid>` bookmark on
 * export (per ARCHITECTURE.md §4 stable heading IDs).
 */
const HEADING_LIKE = new Set(['pocket', 'hat', 'block', 'tag', 'analytic']);

/** Schema container nodes whose children we emit at the parent level. */
const TRANSPARENT_CONTAINERS = new Set([
  'doc',
  'card',
  'analytic_unit',
]);

class DocxExporter {
  private parts: string[] = [];
  private bookmarkCounter = 0;
  private rels: HyperlinkRel[] = [];
  private imageRels: ImageRel[] = [];
  private mediaParts: ExportedMediaPart[] = [];
  // rId1 = styles (always present), rId2 = settings (Verbatim
  // recognition surface — see Docx.empty() + buildRelsXml). Dynamic
  // rels (hyperlinks / images / comments) claim rId3+.
  private nextRelId = 3;
  private nextImageIdx = 1;
  private nextDocPrId = 1;
  /** ThreadIds currently allow-listed for `<w:commentRangeStart/End>`
   *  emission. Comments that aren't in this set are silently
   *  stripped from output even if the doc still carries their mark
   *  (matches "Save As → Include comments: off"). Empty set when
   *  the caller didn't pass any threads, which is the v0 default. */
  private allowedThreadIds: Set<string> = new Set();
  /** ThreadIds currently inside an open `<w:commentRangeStart>`
   *  during the document.xml walk. Tracked so we can emit
   *  `<w:commentRangeEnd>` + `<w:commentReference>` exactly once
   *  per contiguous run of marked text. */
  private openCommentRanges: Set<string> = new Set();
  /** Threads passed in to `exportDoc`. Used to emit `comments.xml`
   *  and `commentsExtended.xml` after the doc walk. */
  private threads: readonly Thread[] = [];
  /** Comment-paragraph paraId allocator for `commentsExtended.xml`. */
  private nextParaIdHex = 0x10000000;

  exportDoc(doc: PMNode, opts: ExportOptions = {}): ExportResult {
    if (doc.type.name !== 'doc') {
      throw new Error(`Expected doc node, got ${doc.type.name}`);
    }

    this.threads = opts.threads ?? [];
    for (const t of this.threads) this.allowedThreadIds.add(t.id);

    this.parts.push(DOCUMENT_OPEN);
    this.emitChildren(doc);
    // Close any comment ranges still open at end of doc (defensive —
    // shouldn't normally happen, but guards against schema drift).
    this.closeOpenCommentRanges();
    this.parts.push(SECT_PR_AND_DOCUMENT_CLOSE);

    return {
      documentXml: this.parts.join(''),
      relsXml: this.buildRelsXml(),
      mediaParts: this.mediaParts,
      commentsXml: this.threads.length > 0 ? this.buildCommentsXml() : null,
      commentsExtendedXml: this.threads.length > 0 ? this.buildCommentsExtendedXml() : null,
    };
  }

  private emitChildren(node: PMNode): void {
    node.forEach((child) => this.emitBlock(child));
  }

  private emitBlock(node: PMNode): void {
    if (TRANSPARENT_CONTAINERS.has(node.type.name)) {
      this.emitChildren(node);
      return;
    }
    if (node.type.name === 'table') {
      this.emitTable(node);
      return;
    }
    // Every other block-level node is a paragraph kind.
    this.emitParagraph(node);
  }

  /**
   * Emit `<w:tbl>` for a `table` node. Cells with `rowspan > 1` are
   * split into a "restart" cell at the top + N-1 "continue" cells
   * (`<w:vMerge/>`) synthesized in the subsequent rows at the same
   * column position. This is the inverse of the importer's vMerge
   * collapse. Empty continuation cells get an empty paragraph for
   * OOXML structural validity.
   *
   * Column placement: PM rows store cells in document order without
   * gaps, but OOXML rows include vMerge continuation cells at their
   * inherited-from-above column positions. We compute each PM cell's
   * effective grid column by skipping over positions occupied by a
   * vMerge from a previous row.
   */
  private emitTable(table: PMNode): void {
    type CellAtCol = { node: PMNode; col: number };
    const rows: CellAtCol[][] = [];
    // `occupied[rowIdx]` is the set of grid columns claimed by a
    // vertical span originating in an earlier row.
    const occupied: Set<number>[] = [];
    let rowIdx = 0;
    table.forEach((row) => {
      if (row.type.name !== 'table_row') return;
      const cells: CellAtCol[] = [];
      let col = 0;
      const myOccupied = occupied[rowIdx] ?? new Set<number>();
      row.forEach((cell) => {
        if (cell.type.name !== 'table_cell' && cell.type.name !== 'table_header') return;
        // Advance past columns claimed by a vMerge from above.
        while (myOccupied.has(col)) col++;
        cells.push({ node: cell, col });
        const cs = Number(cell.attrs['colspan'] ?? 1);
        const rs = Number(cell.attrs['rowspan'] ?? 1);
        // Reserve every column this cell spans for every row it
        // spans below this one.
        for (let r = 1; r < rs; r++) {
          const target = rowIdx + r;
          if (!occupied[target]) occupied[target] = new Set<number>();
          for (let c = 0; c < cs; c++) occupied[target]!.add(col + c);
        }
        col += cs;
      });
      rows.push(cells);
      rowIdx++;
    });

    // Build per-row continuation entries (one for each cell with
    // rowspan > 1, repeated rs-1 times in the rows below).
    type Cont = { col: number; colspan: number };
    const continuationsByRow: Cont[][] = rows.map(() => []);
    rows.forEach((rowCells, rIdx) => {
      for (const c of rowCells) {
        const rs = Number(c.node.attrs['rowspan'] ?? 1);
        const cs = Number(c.node.attrs['colspan'] ?? 1);
        for (let r = 1; r < rs; r++) {
          const target = rIdx + r;
          if (target < continuationsByRow.length) {
            continuationsByRow[target]!.push({ col: c.col, colspan: cs });
          }
        }
      }
    });

    // Determine number of columns from the widest row's right edge
    // (including continuations) so we can emit a minimal `<w:tblGrid>`.
    let colCount = 0;
    rows.forEach((cells, rIdx) => {
      let rightEdge = 0;
      for (const c of cells) {
        const r = c.col + Number(c.node.attrs['colspan'] ?? 1);
        if (r > rightEdge) rightEdge = r;
      }
      for (const k of continuationsByRow[rIdx] ?? []) {
        const r = k.col + k.colspan;
        if (r > rightEdge) rightEdge = r;
      }
      if (rightEdge > colCount) colCount = rightEdge;
    });
    if (colCount === 0) colCount = 1;

    this.parts.push('<w:tbl>');
    // Imported tables carry their original `<w:tblPr>` content
    // verbatim on `table.rawTblPr` (table borders, custom tblStyle,
    // shading, etc.). Re-emit it untouched when present; otherwise
    // fall back to the default for editor-created tables.
    const rawTblPr = (table.attrs['rawTblPr'] as string | null) ?? null;
    if (rawTblPr) {
      this.parts.push(`<w:tblPr>${rawTblPr}</w:tblPr>`);
    } else {
      this.parts.push(
        '<w:tblPr>' +
          '<w:tblStyle w:val="TableGrid"/>' +
          '<w:tblW w:w="0" w:type="auto"/>' +
          '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>' +
          '</w:tblPr>',
      );
    }
    // Build per-column dxa widths from each cell's `colwidth` array
    // (CSS px). Convert px → dxa: 1 px = 15 dxa at 96 DPI. Walk every
    // cell so a wider row can fill in widths for columns the first
    // row spanned over. Fall back to an even split when nothing was
    // recorded (e.g. imports from sources that didn't set widths).
    const colDxa: (number | null)[] = new Array(colCount).fill(null);
    rows.forEach((rowCells) => {
      for (const c of rowCells) {
        const widths = c.node.attrs['colwidth'] as number[] | null;
        if (!widths || widths.length === 0) continue;
        const cs = Number(c.node.attrs['colspan'] ?? 1);
        for (let i = 0; i < cs && i < widths.length; i++) {
          const w = widths[i];
          if (typeof w === 'number' && w > 0 && colDxa[c.col + i] == null) {
            colDxa[c.col + i] = Math.round(w * 15);
          }
        }
      }
    });
    const defaultColDxa = Math.floor(9350 / colCount);
    let grid = '<w:tblGrid>';
    for (let i = 0; i < colCount; i++) {
      grid += `<w:gridCol w:w="${colDxa[i] ?? defaultColDxa}"/>`;
    }
    grid += '</w:tblGrid>';
    this.parts.push(grid);

    rows.forEach((rowCells, rowIdx) => {
      this.parts.push('<w:tr>');
      // Build an ordered emission list combining the row's real
      // cells and any vMerge continuation cells that belong here.
      type Entry =
        | { kind: 'real'; node: PMNode; col: number }
        | { kind: 'continue'; col: number; colspan: number };
      const entries: Entry[] = [];
      for (const c of rowCells) entries.push({ kind: 'real', node: c.node, col: c.col });
      for (const k of continuationsByRow[rowIdx] ?? []) {
        entries.push({ kind: 'continue', col: k.col, colspan: k.colspan });
      }
      entries.sort((a, b) => a.col - b.col);

      const cellDxa = (col: number, span: number): number => {
        let sum = 0;
        for (let i = 0; i < span; i++) sum += colDxa[col + i] ?? defaultColDxa;
        return sum;
      };
      for (const e of entries) {
        if (e.kind === 'real') {
          const cs = Number(e.node.attrs['colspan'] ?? 1);
          const rs = Number(e.node.attrs['rowspan'] ?? 1);
          this.parts.push('<w:tc>');
          let tcPr = '';
          if (cs > 1) tcPr += `<w:gridSpan w:val="${cs}"/>`;
          if (rs > 1) tcPr += '<w:vMerge w:val="restart"/>';
          // Append per-cell extras (borders, shading, vAlign, etc.)
          // verbatim after the structurally-derived bits.
          const rawTcPr = (e.node.attrs['rawTcPr'] as string | null) ?? null;
          if (rawTcPr) tcPr += rawTcPr;
          this.parts.push(`<w:tcPr><w:tcW w:w="${cellDxa(e.col, cs)}" w:type="dxa"/>${tcPr}</w:tcPr>`);
          e.node.forEach((child) => {
            if (child.type.name === 'paragraph') {
              this.emitParagraph(child);
            } else {
              this.emitBlock(child);
            }
          });
          this.parts.push('</w:tc>');
        } else {
          // Continuation cell. Empty paragraph + <w:vMerge/>.
          // Continuation cells inherit borders/shading from the
          // restart cell in OOXML, so no rawTcPr to emit here.
          this.parts.push('<w:tc>');
          let tcPr = '';
          if (e.colspan > 1) tcPr += `<w:gridSpan w:val="${e.colspan}"/>`;
          tcPr += '<w:vMerge/>';
          this.parts.push(`<w:tcPr><w:tcW w:w="${cellDxa(e.col, e.colspan)}" w:type="dxa"/>${tcPr}</w:tcPr>`);
          this.parts.push('<w:p/>');
          this.parts.push('</w:tc>');
        }
      }
      this.parts.push('</w:tr>');
    });

    this.parts.push('</w:tbl>');
  }

  private emitParagraph(node: PMNode): void {
    const { name } = node.type;
    const pStyle = NODE_TO_PSTYLE[name] ?? null;
    const isHeading = HEADING_LIKE.has(name);
    const id = isHeading ? ((node.attrs['id'] as string | null) ?? null) : null;
    const alignment = (node.attrs['alignment'] as string | null) ?? null;

    let pPrInner = '';
    if (pStyle) pPrInner += `<w:pStyle w:val="${pStyle}"/>`;
    if (alignment) pPrInner += `<w:jc w:val="${alignment}"/>`;
    // Per-paragraph `<w:spacing>` attributes captured at import. The
    // editor renders body paragraph rhythm via per-type CSS instead
    // of these values; we re-emit them verbatim so Word sees the
    // original spacing on export.
    const spacing = node.attrs['spacing'] as Record<string, string> | null;
    if (spacing && typeof spacing === 'object') {
      const attrs: string[] = [];
      for (const [k, v] of Object.entries(spacing)) {
        if (typeof v === 'string') attrs.push(`${k}="${escAttr(v)}"`);
      }
      if (attrs.length > 0) pPrInner += `<w:spacing ${attrs.join(' ')}/>`;
    }
    // Left indent in OOXML dxa; the schema's `indent` attr stores
    // the raw OOXML value so round-trip is byte-identical.
    const indent = Number(node.attrs['indent'] ?? 0);
    if (Number.isFinite(indent) && indent > 0) {
      pPrInner += `<w:ind w:left="${indent}"/>`;
    }
    const pPr = pPrInner ? `<w:pPr>${pPrInner}</w:pPr>` : '';

    this.parts.push('<w:p>');
    this.parts.push(pPr);

    if (id) {
      const wId = this.bookmarkCounter++;
      this.parts.push(emptyEl('w:bookmarkStart', { 'w:id': wId, 'w:name': bookmarkNameForId(id) }));
      this.emitInlines(node);
      this.parts.push(emptyEl('w:bookmarkEnd', { 'w:id': wId }));
    } else {
      this.emitInlines(node);
    }

    this.parts.push('</w:p>');
  }

  private emitInlines(paragraph: PMNode): void {
    paragraph.forEach((child) => {
      // Reconcile open comment ranges against this inline's
      // comment_range marks. Threads that appear now and weren't
      // open get a `<w:commentRangeStart>`; threads that were
      // open and are no longer get closed. Images run through the
      // same reconciliation so a comment that spans across an
      // inline image stays continuous.
      const wanted = new Set<string>();
      if (child.isText || child.type.name === 'image') {
        for (const mark of child.marks) {
          if (mark.type.name !== 'comment_range') continue;
          const id = String(mark.attrs['threadId'] ?? '');
          if (id && this.allowedThreadIds.has(id)) wanted.add(id);
        }
      }
      this.reconcileCommentRanges(wanted);

      if (child.isText) {
        this.emitTextRun(child.text ?? '', child.marks);
      } else if (child.type.name === 'image') {
        this.emitImageRun(child);
      }
      // Other inline non-text nodes: defensive no-op.
    });
    // Close any comment ranges still open at the paragraph
    // boundary. OOXML accepts ranges that cross paragraphs, but
    // most readers (including Word) handle per-paragraph ranges
    // more predictably — so we close+reopen at boundaries.
    this.closeOpenCommentRanges();
  }

  /** Bracket the next inline emission with `<w:commentRangeStart>`
   *  / `<w:commentRangeEnd>` + `<w:commentReference>` runs so the
   *  threads in `wanted` end up anchored to this stretch of text. */
  private reconcileCommentRanges(wanted: Set<string>): void {
    // Close ranges that are open but no longer wanted.
    for (const id of [...this.openCommentRanges]) {
      if (!wanted.has(id)) {
        this.parts.push(`<w:commentRangeEnd w:id="${escAttr(id)}"/>`);
        this.parts.push(
          `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr>` +
            `<w:commentReference w:id="${escAttr(id)}"/></w:r>`,
        );
        this.openCommentRanges.delete(id);
      }
    }
    // Open ranges that are wanted but not yet open.
    for (const id of wanted) {
      if (!this.openCommentRanges.has(id)) {
        this.parts.push(`<w:commentRangeStart w:id="${escAttr(id)}"/>`);
        this.openCommentRanges.add(id);
      }
    }
  }

  /** Emit `<w:commentRangeEnd>` + `<w:commentReference>` for every
   *  thread whose start tag is still open. */
  private closeOpenCommentRanges(): void {
    if (this.openCommentRanges.size === 0) return;
    this.reconcileCommentRanges(new Set());
  }

  private emitImageRun(node: PMNode): void {
    const data = String(node.attrs['data'] ?? '');
    if (!data) return;
    const contentType = String(node.attrs['contentType'] ?? 'image/png');
    const widthEmu = Math.max(0, Math.round(Number(node.attrs['widthEmu'] ?? 0)));
    const heightEmu = Math.max(0, Math.round(Number(node.attrs['heightEmu'] ?? 0)));
    const alt = String(node.attrs['alt'] ?? '');

    // Generate the media part (binary write into the zip).
    const ext = CONTENT_TYPE_EXTENSIONS[contentType] ?? 'bin';
    const idx = this.nextImageIdx++;
    const filename = `image${idx}.${ext}`;
    const target = `media/${filename}`;
    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(data);
    } catch {
      return;
    }
    this.mediaParts.push({ path: `word/${target}`, bytes });

    // Register an image relationship.
    const rId = this.registerImage(target);

    // EMU dimensions: prefer provided; otherwise pick a sensible default
    // (a 4-inch / 384-pixel-equivalent box) so Word doesn't render at 0×0.
    const cx = widthEmu > 0 ? widthEmu : 3657600;
    const cy = heightEmu > 0 ? heightEmu : 2743200;

    const docPrId = this.nextDocPrId++;
    const drawing = buildDrawingXml({ rId, cx, cy, docPrId, alt });
    this.parts.push(`<w:r>${drawing}</w:r>`);
  }

  private registerImage(target: string): string {
    const rId = `rId${this.nextRelId++}`;
    this.imageRels.push({ rId, target });
    return rId;
  }

  private emitTextRun(text: string, marks: readonly Mark[]): void {
    if (text.length === 0) return;

    const linkMark = marks.find((m) => m.type.name === 'link');
    const otherMarks = linkMark ? marks.filter((m) => m !== linkMark) : marks;

    // Split the text at characters that round-trip as dedicated OOXML
    // run children rather than `<w:t>` content: U+2011 non-breaking
    // hyphen → `<w:noBreakHyphen/>`, U+00AD soft hyphen →
    // `<w:softHyphen/>`. Regular ASCII '-' stays inside `<w:t>`.
    const runChildren: string[] = [];
    let buf = '';
    const flush = (): void => {
      if (buf.length > 0) {
        runChildren.push(`<w:t xml:space="preserve">${escText(buf)}</w:t>`);
        buf = '';
      }
    };
    for (const ch of text) {
      if (ch === '‑') {
        flush();
        runChildren.push('<w:noBreakHyphen/>');
      } else if (ch === '­') {
        flush();
        runChildren.push('<w:softHyphen/>');
      } else if (ch === '\t') {
        // Round-trips with the importer's `<w:tab/>` → '\t'. Without this
        // the tab landed as a literal character inside `<w:t>`.
        flush();
        runChildren.push('<w:tab/>');
      } else if (ch === '\n') {
        // Importer maps `<w:br/>` → '\n'. (A page break also imports as
        // '\n', so it re-exports as a line break — the break type isn't
        // preserved in the doc model, but the break itself now is.)
        flush();
        runChildren.push('<w:br/>');
      } else {
        buf += ch;
      }
    }
    flush();

    const run = `<w:r>${this.rPrFromMarks(otherMarks)}${runChildren.join('')}</w:r>`;

    if (linkMark) {
      const href = String(linkMark.attrs['href'] ?? '');
      const rId = this.registerHyperlink(href);
      this.parts.push(`<w:hyperlink r:id="${rId}" w:history="1">${run}</w:hyperlink>`);
    } else {
      this.parts.push(run);
    }
  }

  /** Compose <w:rPr>...</w:rPr> from a set of marks. */
  private rPrFromMarks(marks: readonly Mark[]): string {
    if (marks.length === 0) return '';
    const props: string[] = [];

    // Order matters for some validators. Word's typical ordering:
    // rStyle, rFonts, b, bCs, i, iCs, color, sz, szCs, u, highlight, shd, ...

    const rStyleMark = marks.find((m) => m.type.name in MARK_TO_RSTYLE);
    if (rStyleMark) {
      const styleId = MARK_TO_RSTYLE[rStyleMark.type.name];
      if (styleId) props.push(emptyEl('w:rStyle', { 'w:val': styleId }));
    }

    const fontFamilyMark = marks.find((m) => m.type.name === 'font_family');
    if (fontFamilyMark) {
      const name = String(fontFamilyMark.attrs['name'] ?? '');
      if (name) {
        // Set ascii / hAnsi / cs to the same value. East Asian and
        // other script-specific attributes are uncommon in debate docs;
        // we omit them and let Word fall back to its defaults.
        props.push(emptyEl('w:rFonts', {
          'w:ascii': name,
          'w:hAnsi': name,
          'w:cs': name,
        }));
      }
    }

    if (marks.some((m) => m.type.name === 'bold')) {
      props.push('<w:b/>');
    } else if (marks.some((m) => m.type.name === 'bold_off')) {
      // Explicit "bold off" — overrides the bold a bold-by-default style
      // (e.g. Heading4/tag) would otherwise inherit.
      props.push('<w:b w:val="0"/>');
    }
    if (marks.some((m) => m.type.name === 'italic')) {
      props.push('<w:i/>');
      props.push('<w:iCs/>');
    }
    if (marks.some((m) => m.type.name === 'strikethrough')) {
      props.push('<w:strike/>');
    }
    if (marks.some((m) => m.type.name === 'superscript')) {
      props.push(emptyEl('w:vertAlign', { 'w:val': 'superscript' }));
    } else if (marks.some((m) => m.type.name === 'subscript')) {
      props.push(emptyEl('w:vertAlign', { 'w:val': 'subscript' }));
    }

    // undertag_mark style implies italic display; emit italic for parity
    // (per DECISIONS.md: dual-encoding precedent set by underline_mark).
    if (marks.some((m) => m.type.name === 'undertag_mark') &&
        !marks.some((m) => m.type.name === 'italic')) {
      props.push('<w:i/>');
      props.push('<w:iCs/>');
    }

    const colorMark = marks.find((m) => m.type.name === 'font_color');
    if (colorMark) {
      const c = String(colorMark.attrs['color'] ?? '000000');
      props.push(emptyEl('w:color', { 'w:val': c }));
    }

    const sizeMark = marks.find((m) => m.type.name === 'font_size');
    if (sizeMark) {
      const hp = Number(sizeMark.attrs['halfPoints'] ?? 22);
      props.push(emptyEl('w:sz', { 'w:val': hp }));
      props.push(emptyEl('w:szCs', { 'w:val': hp }));
    } else if (marks.some((m) => m.type.name === 'pilcrow_marker')) {
      // pilcrow_marker carries no attrs — Verbatim's canonical 6-pt
      // pilcrow encoding is `<w:sz w:val="12"/>`. Emit when no explicit
      // font_size is present (font_size takes precedence if both are
      // somehow set on the same run, though that shouldn't happen in
      // practice).
      props.push(emptyEl('w:sz', { 'w:val': 12 }));
      props.push(emptyEl('w:szCs', { 'w:val': 12 }));
    }

    if (
      marks.some((m) => m.type.name === 'underline_mark' || m.type.name === 'underline_direct')
    ) {
      // underline_mark: dual-encoding per NOTES-verbatim.md §5 gotcha
      //   #1 — rStyle="StyleUnderline" (already emitted above) AND
      //   <w:u w:val="single"/>.
      // underline_direct: just <w:u w:val="single"/>, no rStyle.
      props.push(emptyEl('w:u', { 'w:val': 'single' }));
    }

    const highlightMark = marks.find((m) => m.type.name === 'highlight');
    if (highlightMark) {
      const c = String(highlightMark.attrs['color'] ?? 'yellow');
      props.push(emptyEl('w:highlight', { 'w:val': c }));
    }

    const shadingMark = marks.find((m) => m.type.name === 'shading');
    if (shadingMark) {
      const c = String(shadingMark.attrs['color'] ?? 'D2D2D2');
      props.push(emptyEl('w:shd', { 'w:val': 'clear', 'w:color': 'auto', 'w:fill': c }));
    }

    if (props.length === 0) return '';
    return el('w:rPr', {}, props.join(''));
  }

  private registerHyperlink(href: string): string {
    const existing = this.rels.find((r) => r.target === href);
    if (existing) return existing.rId;
    const rId = `rId${this.nextRelId++}`;
    this.rels.push({ rId, target: href });
    return rId;
  }

  private buildRelsXml(): string {
    const inner: string[] = [];
    inner.push(
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    );
    // Link to `word/settings.xml`. `Docx.empty()` writes the
    // settings part itself; this rel makes Word's document-loader
    // pick it up. Without the link, Word skips settings.xml and the
    // <w:attachedTemplate> recognition surface inside it is
    // invisible to Verbatim's ribbon-visibility callback. Hardcoded
    // rId2 because `this.nextRelId` starts at 2 — any dynamic rel
    // (hyperlink / image / comments) added below claims rId3+.
    inner.push(
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>',
    );
    for (const rel of this.rels) {
      // Hyperlink Targets are user-supplied URLs and commonly
      // contain `&` (query-string separators), which is illegal
      // in raw XML attribute values. Word still opens the doc
      // (recovery mode) but flags it as corrupted on first
      // open, which is the symptom that surfaced this bug. The
      // rId is internally generated and safe; the target is the
      // only attribute that needs escaping here. Image rels
      // (below) and the styles / settings rels (above) get
      // internally-controlled Targets that contain no special
      // chars, so they don't need it — but we escape image
      // targets too for symmetry / defense in depth (a media
      // filename with a special char would have the same
      // problem).
      inner.push(
        `<Relationship Id="${rel.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escAttr(rel.target)}" TargetMode="External"/>`,
      );
    }
    for (const rel of this.imageRels) {
      inner.push(
        `<Relationship Id="${rel.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${escAttr(rel.target)}"/>`,
      );
    }
    if (this.threads.length > 0) {
      const commentsRId = `rId${this.nextRelId++}`;
      inner.push(
        `<Relationship Id="${commentsRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>`,
      );
      const commentsExRId = `rId${this.nextRelId++}`;
      inner.push(
        `<Relationship Id="${commentsExRId}" Type="http://schemas.microsoft.com/office/2011/relationships/commentsExtended" Target="commentsExtended.xml"/>`,
      );
    }
    return `${RELS_OPEN}${inner.join('')}${RELS_CLOSE}`;
  }

  /** Build `word/comments.xml`. Each `Comment` in each `Thread`
   *  becomes one `<w:comment>` element. Body text is split on
   *  newlines into separate `<w:p>` children, each carrying a
   *  fresh `w14:paraId` so the extended file can link replies. */
  private buildCommentsXml(): string {
    const out: string[] = [];
    out.push(XML_PROLOG);
    out.push(
      '<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
        ' xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">',
    );
    for (const thread of this.threads) {
      for (const c of thread.comments) {
        const paraId = this.allocParaId();
        this.paraIdByCommentId.set(c.id, paraId);
        out.push(
          `<w:comment w:id="${escAttr(c.id)}" w:author="${escAttr(c.author)}"` +
            ` w:date="${escAttr(c.date)}" w:initials="${escAttr(c.initials)}">`,
        );
        const paragraphs = c.text.split('\n');
        for (let i = 0; i < paragraphs.length; i++) {
          // Only the FIRST paragraph carries the paraId — that's
          // what commentsExtended links against. Subsequent
          // paragraphs of multi-line comments are body content.
          const idAttr = i === 0 ? ` w14:paraId="${paraId}"` : '';
          out.push(`<w:p${idAttr}>`);
          out.push(`<w:r><w:t xml:space="preserve">${escText(paragraphs[i] ?? '')}</w:t></w:r>`);
          out.push('</w:p>');
        }
        out.push('</w:comment>');
      }
    }
    out.push('</w:comments>');
    return out.join('');
  }

  /** Build `word/commentsExtended.xml`. One `<w15:commentEx>` per
   *  comment, declaring the parent relationship (root comments are
   *  also emitted, with no `paraIdParent` attribute). */
  private buildCommentsExtendedXml(): string {
    const out: string[] = [];
    out.push(XML_PROLOG);
    out.push(
      '<w15:commentsEx xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml">',
    );
    for (const thread of this.threads) {
      for (const c of thread.comments) {
        const paraId = this.paraIdByCommentId.get(c.id);
        if (!paraId) continue;
        const parentParaId = c.parentId
          ? this.paraIdByCommentId.get(c.parentId)
          : null;
        const parentAttr = parentParaId
          ? ` w15:paraIdParent="${parentParaId}"`
          : '';
        out.push(`<w15:commentEx w15:paraId="${paraId}" w15:done="0"${parentAttr}/>`);
      }
    }
    out.push('</w15:commentsEx>');
    return out.join('');
  }

  /** Allocate a fresh 8-hex-digit paraId. */
  private allocParaId(): string {
    const v = (this.nextParaIdHex++).toString(16).padStart(8, '0').toUpperCase();
    return v;
  }
  private paraIdByCommentId: Map<string, string> = new Map();
}

/**
 * Build the OOXML drawing XML for an inline picture. Self-contains the
 * required namespaces (wp, a, pic) so we don't have to hoist them onto
 * <w:document>. Standard inline-picture shape — no effects, no
 * positioning, no theme styling.
 */
function buildDrawingXml(opts: {
  rId: string;
  cx: number;
  cy: number;
  docPrId: number;
  alt: string;
}): string {
  const { rId, cx, cy, docPrId, alt } = opts;
  const altEsc = escText(alt);
  const name = `Picture ${docPrId}`;
  return (
    '<w:drawing>' +
      `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">` +
        `<wp:extent cx="${cx}" cy="${cy}"/>` +
        '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
        `<wp:docPr id="${docPrId}" name="${escText(name)}" descr="${altEsc}"/>` +
        '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
        '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
          '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
            '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
              '<pic:nvPicPr>' +
                `<pic:cNvPr id="${docPrId}" name="${escText(name)}" descr="${altEsc}"/>` +
                '<pic:cNvPicPr/>' +
              '</pic:nvPicPr>' +
              '<pic:blipFill>' +
                `<a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${rId}"/>` +
                '<a:stretch><a:fillRect/></a:stretch>' +
              '</pic:blipFill>' +
              '<pic:spPr>' +
                '<a:xfrm>' +
                  '<a:off x="0" y="0"/>' +
                  `<a:ext cx="${cx}" cy="${cy}"/>` +
                '</a:xfrm>' +
                '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
              '</pic:spPr>' +
            '</pic:pic>' +
          '</a:graphicData>' +
        '</a:graphic>' +
      '</wp:inline>' +
    '</w:drawing>'
  );
}

/** Public API: schema doc → document.xml + rels. */
export function exportDoc(doc: PMNode, opts: ExportOptions = {}): ExportResult {
  return new DocxExporter().exportDoc(doc, opts);
}
