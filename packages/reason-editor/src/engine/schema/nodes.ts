/**
 * ProseMirror node specs.
 *
 * Design choice (see DECISIONS.md):
 *
 *   Most heading-level nodes (pocket, hat, block, analytic) are *flat
 *   paragraphs with inline content*, not tree containers. This matches
 *   how Word represents them in OOXML (paragraphs with Heading1-3 /
 *   Analytic styles, hierarchy implicit in document order + outline
 *   level). Tree-shaped grouping ("the cards under hat 2") is a derived
 *   view — the navigation panel walks paragraphs grouped by outline
 *   level — not a schema constraint.
 *
 *   `card` *is* tree-structured: it has a required `tag` child, optional
 *   cite_paragraph or analytic, and zero+ card_body paragraphs. This
 *   matches the user's mental model of cards as objects we can move /
 *   send / drag / select as units.
 *
 *   Heading-like nodes (pocket, hat, block, tag, analytic) carry a
 *   stable `id` attribute (UUID) for transclusion targeting per
 *   ARCHITECTURE.md §4 and §12.
 */

import type { NodeSpec } from 'prosemirror-model';
import { newHeadingId } from './ids.js';

/** Paragraph-level left indent in OOXML dxa (twentieths of a point;
 *  1440 dxa = 1 inch = 96 CSS px, so px = dxa / 15). Default 0.
 *  Applied to every node that serializes to `<w:p>` so the value
 *  round-trips through docx untouched. */
const indentAttr = {
  indent: {
    default: 0 as number,
    validate: (v: unknown) =>
      typeof v === 'number' && Number.isFinite(v) && v >= 0,
  },
};

/** OOXML `<w:spacing>` attributes captured verbatim for round-trip.
 *  Stored as a plain `{ [attr]: value }` object whose keys are the
 *  OOXML attribute names (`w:before`, `w:after`, `w:line`,
 *  `w:lineRule`, etc.). Visual rendering is governed by per-type
 *  CSS, not this attr — see PROJECT.md's queued per-type display-
 *  spacing setting. Null when the source paragraph had no
 *  `<w:spacing>` element. */
const spacingAttr = {
  spacing: {
    default: null as Record<string, string> | null,
    validate: (v: unknown) =>
      v === null ||
      (typeof v === 'object' && v !== null && !Array.isArray(v)),
  },
};

const headingAttrs = {
  id: {
    default: null as string | null,
    validate: (v: unknown) => (v === null || typeof v === 'string'),
  },
  ...indentAttr,
  ...spacingAttr,
};

/** Convert a paragraph node's `indent` (dxa) to an inline CSS
 *  declaration, or return empty when unindented. */
function indentToStyle(indent: unknown): string {
  const n = Number(indent ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `padding-left: ${n / 15}px`;
}

/** Read a paragraph's left indent from its rendered HTML — used
 *  by parseDOM for round-trip through our own toDOM and for paste
 *  from sources that wrote padding-left. Returns 0 when absent
 *  or non-px. */
function readIndentFromStyle(dom: HTMLElement): number {
  const v = dom.style.paddingLeft;
  if (!v) return 0;
  const m = v.match(/^(\d+(?:\.\d+)?)px$/);
  if (!m) return 0;
  return Math.max(0, Math.round(parseFloat(m[1]!) * 15));
}

/** Generate a fresh ID at construction time if none provided. */
export function ensureId(attrs: Record<string, unknown> | null): { id: string } {
  if (attrs && typeof attrs['id'] === 'string' && attrs['id']) {
    return { id: attrs['id'] };
  }
  return { id: newHeadingId() };
}

/**
 * Block-level content legal at the doc root. Note: `tag` and `analytic`
 * are *not* in this list — tags only appear as the required first child
 * of a `card`, analytics only appear inside an `analytic_unit` (or as a
 * cite-position alternative inside a card).
 *
 * Order matters: ProseMirror's `splitBlock` calls `defaultBlockAt` to
 * pick the type for a freshly-created paragraph at the doc level (e.g.
 * Enter at the end of an existing paragraph), and `defaultBlockAt`
 * returns the FIRST textblock in the alternation. Putting `paragraph`
 * first ensures Enter on a normal paragraph creates another normal
 * paragraph rather than a Pocket. The same trick is used inside `card`
 * (see its content expression).
 */
const BLOCK_CONTENT =
  '(paragraph | pocket | hat | block | card | analytic_unit | undertag | cite_paragraph | card_body | table)*';

export const nodes: { [name: string]: NodeSpec } = {
  /** Top-level container. Sequence of block-level content. */
  doc: { content: BLOCK_CONTENT },

  /** A run of inline content. Plain text + marks. */
  text: { group: 'inline' },

  /**
   * Inline image. Round-trips to OOXML `<w:drawing><wp:inline>...`.
   *
   * The image bytes are stored as base64 in the `data` attr so the doc
   * is self-contained and survives JSON round-trips through localStorage,
   * collaboration sync, undo/redo, etc. without a separate manifest.
   * `widthEmu` / `heightEmu` carry the original OOXML dimensions in
   * English Metric Units (914400 EMU per inch); rendering converts to
   * pixels at 96dpi.
   *
   * Atomic + draggable: ProseMirror treats the image as an indivisible
   * inline glyph — cursor goes around it, not into it. Draggable lets
   * users move it via drag-and-drop (when supporting that later).
   */
  image: {
    inline: true,
    group: 'inline',
    atom: true,
    draggable: true,
    attrs: {
      data: {
        default: '',
        validate: (v: unknown) => typeof v === 'string',
      },
      contentType: {
        default: 'image/png',
        validate: (v: unknown) =>
          typeof v === 'string' && /^image\//.test(v),
      },
      widthEmu: {
        default: 0,
        validate: (v: unknown) =>
          typeof v === 'number' && Number.isFinite(v) && v >= 0,
      },
      heightEmu: {
        default: 0,
        validate: (v: unknown) =>
          typeof v === 'number' && Number.isFinite(v) && v >= 0,
      },
      alt: {
        default: '',
        validate: (v: unknown) => typeof v === 'string',
      },
    },
    parseDOM: [
      {
        tag: 'img[data-pmd-image]',
        getAttrs: (dom: HTMLElement) => {
          const src = dom.getAttribute('src') ?? '';
          const m = src.match(/^data:([^;]+);base64,(.+)$/);
          if (!m) return false;
          const widthEmu = parseInt(dom.getAttribute('data-width-emu') ?? '0', 10);
          const heightEmu = parseInt(dom.getAttribute('data-height-emu') ?? '0', 10);
          return {
            data: m[2],
            contentType: m[1],
            widthEmu: Number.isFinite(widthEmu) ? widthEmu : 0,
            heightEmu: Number.isFinite(heightEmu) ? heightEmu : 0,
            alt: dom.getAttribute('alt') ?? '',
          };
        },
      },
      {
        // Placeholder span — for non-browser-renderable formats (EMF /
        // WMF / TIFF). Carries the same data attributes so re-saving
        // through DOM round-trip works.
        tag: 'span[data-pmd-image]',
        getAttrs: (dom: HTMLElement) => {
          const data = dom.getAttribute('data-image-data') ?? '';
          const contentType = dom.getAttribute('data-content-type') ?? 'application/octet-stream';
          const widthEmu = parseInt(dom.getAttribute('data-width-emu') ?? '0', 10);
          const heightEmu = parseInt(dom.getAttribute('data-height-emu') ?? '0', 10);
          return {
            data,
            contentType,
            widthEmu: Number.isFinite(widthEmu) ? widthEmu : 0,
            heightEmu: Number.isFinite(heightEmu) ? heightEmu : 0,
            alt: dom.getAttribute('data-alt') ?? '',
          };
        },
      },
    ],
    toDOM: (node) => {
      const data = String(node.attrs['data'] ?? '');
      const contentType = String(node.attrs['contentType'] ?? 'image/png');
      const widthEmu = Number(node.attrs['widthEmu'] ?? 0);
      const heightEmu = Number(node.attrs['heightEmu'] ?? 0);
      const alt = String(node.attrs['alt'] ?? '');

      // 914400 EMU per inch; 96 px per inch → 9525 EMU per pixel.
      const widthPx = widthEmu > 0 ? Math.round(widthEmu / 9525) : 0;
      const heightPx = heightEmu > 0 ? Math.round(heightEmu / 9525) : 0;

      // Browser-renderable raster + svg formats: emit as <img data:>.
      // Non-renderable formats (EMF, WMF, TIFF, octet-stream): emit a
      // styled placeholder span instead of a broken image tag. Bytes
      // are still preserved on the element so round-trip works.
      const RENDERABLE = new Set([
        'image/png', 'image/jpeg', 'image/gif',
        'image/webp', 'image/bmp', 'image/svg+xml',
      ]);

      if (data && RENDERABLE.has(contentType)) {
        const attrs: Record<string, string> = {
          'data-pmd-image': '',
          src: `data:${contentType};base64,${data}`,
          alt,
          'data-width-emu': String(widthEmu),
          'data-height-emu': String(heightEmu),
          style: 'max-width: 100%; height: auto;',
        };
        if (widthPx > 0) attrs['width'] = String(widthPx);
        if (heightPx > 0) attrs['height'] = String(heightPx);
        return ['img', attrs];
      }

      // Placeholder for unsupported formats. Visual styling lives in
      // CSS (.pmd-image-placeholder); only per-instance dimensions are
      // inline so they don't clobber other rules — particularly the
      // `display: none` read-mode override.
      const sizeStyle = widthPx > 0 && heightPx > 0
        ? `width: ${widthPx}px; height: ${heightPx}px;`
        : 'min-width: 80px; min-height: 80px;';
      const subtype = contentType.replace(/^image\//, '').replace(/^x-/, '');
      const label = `[${subtype} image]`;
      return [
        'span',
        {
          'data-pmd-image': '',
          'data-image-data': data,
          'data-content-type': contentType,
          'data-width-emu': String(widthEmu),
          'data-height-emu': String(heightEmu),
          'data-alt': alt,
          class: 'pmd-image-placeholder',
          title: alt ? `${label} — ${alt}` : label,
          style: sizeStyle,
        },
        label,
      ];
    },
  },

  /**
   * Heading paragraphs — flat in document order, hierarchy via the
   * derived outline view, not schema containment.
   */
  pocket: {
    content: 'inline*',
    attrs: headingAttrs,
    defining: true,
    parseDOM: [{
      tag: 'h1.pmd-pocket',
      getAttrs: (dom: HTMLElement) => ({ indent: readIndentFromStyle(dom) }),
    }],
    toDOM: (node) => {
      const attrs: Record<string, string> = {
        class: 'pmd-pocket',
        'data-id': String(node.attrs['id'] ?? ''),
      };
      const style = indentToStyle(node.attrs['indent']);
      if (style) attrs['style'] = style;
      return ['h1', attrs, 0];
    },
  },

  hat: {
    content: 'inline*',
    attrs: headingAttrs,
    defining: true,
    parseDOM: [{
      tag: 'h2.pmd-hat',
      getAttrs: (dom: HTMLElement) => ({ indent: readIndentFromStyle(dom) }),
    }],
    toDOM: (node) => {
      const attrs: Record<string, string> = {
        class: 'pmd-hat',
        'data-id': String(node.attrs['id'] ?? ''),
      };
      const style = indentToStyle(node.attrs['indent']);
      if (style) attrs['style'] = style;
      return ['h2', attrs, 0];
    },
  },

  block: {
    content: 'inline*',
    attrs: headingAttrs,
    defining: true,
    parseDOM: [{
      tag: 'h3.pmd-block',
      getAttrs: (dom: HTMLElement) => ({ indent: readIndentFromStyle(dom) }),
    }],
    toDOM: (node) => {
      const attrs: Record<string, string> = {
        class: 'pmd-block',
        'data-id': String(node.attrs['id'] ?? ''),
      };
      const style = indentToStyle(node.attrs['indent']);
      if (style) attrs['style'] = style;
      return ['h3', attrs, 0];
    },
  },

  /**
   * A card: required tag followed by any combination of supplementary
   * paragraphs (undertags, cite, analytic, card body).
   *
   * The strict-order schema (`tag undertag* (cite|analytic)? card_body*`)
   * was loosened so editing operations can insert a card_body in any
   * position after the tag — e.g., Enter at end of tag drops a new
   * body directly under the tag, above any pre-existing cite/body.
   * Importer still produces the strict order for documents loaded
   * from .docx; round-trip is a no-op (the strict ordering is just one
   * legal ordering among many).
   *
   * Undertags belong to the tag they follow — they don't mark a card
   * boundary.
   */
  card: {
    // Order matters: ProseMirror's splitBlock command (and other
    // schema-driven defaults) calls `defaultBlockAt` to pick the
    // "natural" type for a freshly-created paragraph in this slot.
    // It returns the FIRST textblock in the alternation. Putting
    // `card_body` first ensures that pressing Enter at the start of a
    // cite (or anywhere else inside a card) creates a normal body
    // paragraph — never an undertag. Undertag styling is reserved for
    // text the user explicitly opts into.
    content: 'tag (card_body | undertag | cite_paragraph | analytic | table)*',
    defining: true,
    isolating: true,
    parseDOM: [{ tag: 'div.pmd-card' }],
    toDOM: () => ['div', { class: 'pmd-card' }, 0],
  },

  /** Card label. Heading-level outline-4 with stable id. Card-only. */
  tag: {
    content: 'inline*',
    attrs: headingAttrs,
    defining: true,
    parseDOM: [{
      tag: 'h4.pmd-tag',
      getAttrs: (dom: HTMLElement) => ({ indent: readIndentFromStyle(dom) }),
    }],
    toDOM: (node) => {
      const attrs: Record<string, string> = {
        class: 'pmd-tag',
        'data-id': String(node.attrs['id'] ?? ''),
      };
      const style = indentToStyle(node.attrs['indent']);
      if (style) attrs['style'] = style;
      return ['h4', attrs, 0];
    },
  },

  /** Cite paragraph. Used inside a card or at the doc level. */
  cite_paragraph: {
    content: 'inline*',
    attrs: { ...indentAttr, ...spacingAttr },
    parseDOM: [{
      tag: 'p.pmd-cite-para',
      getAttrs: (dom: HTMLElement) => ({ indent: readIndentFromStyle(dom) }),
    }],
    toDOM: (node) => {
      const attrs: Record<string, string> = { class: 'pmd-cite-para' };
      const style = indentToStyle(node.attrs['indent']);
      if (style) attrs['style'] = style;
      return ['p', attrs, 0];
    },
  },

  /** Card body paragraph — implicit Normal style on export. */
  card_body: {
    content: 'inline*',
    attrs: { ...indentAttr, ...spacingAttr },
    parseDOM: [{
      tag: 'p.pmd-card-body',
      getAttrs: (dom: HTMLElement) => ({ indent: readIndentFromStyle(dom) }),
    }],
    toDOM: (node) => {
      const attrs: Record<string, string> = { class: 'pmd-card-body' };
      const style = indentToStyle(node.attrs['indent']);
      if (style) attrs['style'] = style;
      return ['p', attrs, 0];
    },
  },

  /**
   * Analytic paragraph — outline-level-4 with stable id. Distinct from
   * a tag in styling (color #1F3864) and semantic role. Appears as the
   * required first child of an `analytic_unit`, OR as a cite-position
   * alternative inside a `card`.
   */
  analytic: {
    content: 'inline*',
    attrs: headingAttrs,
    defining: true,
    parseDOM: [{
      tag: 'p.pmd-analytic',
      getAttrs: (dom: HTMLElement) => ({ indent: readIndentFromStyle(dom) }),
    }],
    toDOM: (node) => {
      const attrs: Record<string, string> = {
        class: 'pmd-analytic',
        'data-id': String(node.attrs['id'] ?? ''),
      };
      const style = indentToStyle(node.attrs['indent']);
      if (style) attrs['style'] = style;
      return ['p', attrs, 0];
    },
  },

  /**
   * An analytic-rooted unit, peer to `card`. Required analytic, optional
   * undertag(s), zero+ body paragraphs, and (since the cite-paste
   * simplification) cite_paragraph too. Cite paragraphs aren't a
   * conventional part of an analytic — analytics are commentary, not
   * external evidence — but allowing them here keeps cite-paste
   * uniform across card and analytic_unit destinations and avoids
   * forced new-card creation when the user just wants a cite below
   * an analytic's body. Drags as a unit.
   */
  analytic_unit: {
    // Loosened the same way `card` was — see the card content
    // expression's comment, including the rationale for putting
    // `card_body` first in the alternation.
    content: 'analytic (card_body | undertag | cite_paragraph | table)*',
    defining: true,
    isolating: true,
    parseDOM: [{ tag: 'div.pmd-analytic-unit' }],
    toDOM: () => ['div', { class: 'pmd-analytic-unit' }, 0],
  },

  /** Undertag paragraph (linked to UndertagChar). */
  undertag: {
    content: 'inline*',
    attrs: { ...indentAttr, ...spacingAttr },
    parseDOM: [{
      tag: 'p.pmd-undertag',
      getAttrs: (dom: HTMLElement) => ({ indent: readIndentFromStyle(dom) }),
    }],
    toDOM: (node) => {
      const attrs: Record<string, string> = { class: 'pmd-undertag' };
      const style = indentToStyle(node.attrs['indent']);
      if (style) attrs['style'] = style;
      return ['p', attrs, 0];
    },
  },

  /** Generic body paragraph — implicit Normal style. Optional
   *  `alignment` attr surfaces OOXML's `<w:jc>` for paragraphs in
   *  contexts where alignment matters (table cells especially —
   *  Word tables routinely center their cell content). Null means
   *  default (left/inherited). Values match Word's set. */
  paragraph: {
    content: 'inline*',
    attrs: {
      alignment: {
        default: null as 'left' | 'center' | 'right' | 'justify' | null,
        validate: (v: unknown) =>
          v === null ||
          v === 'left' ||
          v === 'center' ||
          v === 'right' ||
          v === 'justify',
      },
      ...indentAttr,
      ...spacingAttr,
    },
    parseDOM: [
      {
        tag: 'p',
        getAttrs: (dom: HTMLElement) => {
          const align = dom.style.textAlign || null;
          return {
            alignment:
              align === 'left' ||
              align === 'center' ||
              align === 'right' ||
              align === 'justify'
                ? align
                : null,
            indent: readIndentFromStyle(dom),
          };
        },
      },
    ],
    toDOM: (node) => {
      const align = node.attrs['alignment'] as string | null;
      const indentStyle = indentToStyle(node.attrs['indent']);
      const styles: string[] = [];
      if (align) styles.push(`text-align: ${align}`);
      if (indentStyle) styles.push(indentStyle);
      const attrs: Record<string, string> = {};
      if (styles.length > 0) attrs['style'] = styles.join('; ');
      return ['p', attrs, 0];
    },
  },

  // ---- Tables (prosemirror-tables compatible) -------------------
  // Round-tripped from OOXML <w:tbl> / <w:tr> / <w:tc>. Cells hold
  // generic paragraphs only — no cards / analytics / pockets etc.
  // inside cells (matches OOXML's "no nesting of structural debate
  // elements inside table cells" practice).
  //
  // Cell attrs follow prosemirror-tables' convention so the
  // built-in commands (addRowAfter, deleteRow, mergeCells, etc.)
  // work without adaptation.

  table: {
    content: 'table_row+',
    tableRole: 'table',
    isolating: true,
    group: 'block',
    attrs: {
      // Opaque OOXML `<w:tblPr>` inner content captured at import time
      // and re-emitted verbatim on export. Lets us round-trip table-
      // level borders / styles / shading without modeling each
      // property in the schema. New tables created in the editor have
      // this null and get the exporter's default tblPr.
      rawTblPr: {
        default: null as string | null,
        validate: (v: unknown) => v === null || typeof v === 'string',
      },
    },
    parseDOM: [{ tag: 'table' }],
    toDOM: () => ['table', { class: 'pmd-table' }, ['tbody', 0]],
  },

  table_row: {
    content: '(table_cell | table_header)*',
    tableRole: 'row',
    parseDOM: [{ tag: 'tr' }],
    toDOM: () => ['tr', 0],
  },

  table_cell: {
    content: 'paragraph+',
    attrs: {
      colspan: { default: 1, validate: (v: unknown) => typeof v === 'number' && v >= 1 },
      rowspan: { default: 1, validate: (v: unknown) => typeof v === 'number' && v >= 1 },
      colwidth: {
        default: null as number[] | null,
        validate: (v: unknown) =>
          v === null || (Array.isArray(v) && v.every((n) => typeof n === 'number')),
      },
      // Opaque OOXML `<w:tcPr>` children captured at import time
      // (everything except `gridSpan`, `vMerge`, and `tcW`, which are
      // derived from the cell's structural attrs). Re-emitted after
      // the structural bits on export so per-cell borders / shading /
      // vAlign etc. round-trip.
      rawTcPr: {
        default: null as string | null,
        validate: (v: unknown) => v === null || typeof v === 'string',
      },
    },
    tableRole: 'cell',
    isolating: true,
    parseDOM: [
      {
        tag: 'td',
        getAttrs: (dom: HTMLElement) => readCellAttrs(dom),
      },
    ],
    toDOM: (node) => ['td', cellAttrsToDom(node.attrs), 0],
  },

  // Defined for prosemirror-tables compatibility even though OOXML
  // doesn't distinguish header cells from body cells. Importer always
  // produces table_cell; we keep table_header so the plugin's
  // commands (e.g. toggleHeaderRow) function should the user invoke
  // them.
  table_header: {
    content: 'paragraph+',
    attrs: {
      colspan: { default: 1, validate: (v: unknown) => typeof v === 'number' && v >= 1 },
      rowspan: { default: 1, validate: (v: unknown) => typeof v === 'number' && v >= 1 },
      colwidth: {
        default: null as number[] | null,
        validate: (v: unknown) =>
          v === null || (Array.isArray(v) && v.every((n) => typeof n === 'number')),
      },
      // See `table_cell.rawTcPr` for the round-trip contract.
      rawTcPr: {
        default: null as string | null,
        validate: (v: unknown) => v === null || typeof v === 'string',
      },
    },
    tableRole: 'header_cell',
    isolating: true,
    parseDOM: [
      {
        tag: 'th',
        getAttrs: (dom: HTMLElement) => readCellAttrs(dom),
      },
    ],
    toDOM: (node) => ['th', cellAttrsToDom(node.attrs), 0],
  },
};

function readCellAttrs(dom: HTMLElement): {
  colspan: number;
  rowspan: number;
  colwidth: number[] | null;
} {
  const colspan = parseInt(dom.getAttribute('colspan') || '1', 10) || 1;
  const rowspan = parseInt(dom.getAttribute('rowspan') || '1', 10) || 1;
  const widthAttr = dom.getAttribute('data-colwidth');
  const colwidth = widthAttr
    ? widthAttr.split(',').map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n))
    : null;
  return { colspan, rowspan, colwidth };
}

function cellAttrsToDom(attrs: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const colspan = Number(attrs['colspan'] ?? 1);
  const rowspan = Number(attrs['rowspan'] ?? 1);
  if (colspan !== 1) out['colspan'] = String(colspan);
  if (rowspan !== 1) out['rowspan'] = String(rowspan);
  const colwidth = attrs['colwidth'] as number[] | null;
  if (colwidth && colwidth.length > 0) {
    out['data-colwidth'] = colwidth.join(',');
  }
  return out;
}
