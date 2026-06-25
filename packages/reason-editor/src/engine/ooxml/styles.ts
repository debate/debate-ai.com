/**
 * Canonical style block for word/styles.xml.
 *
 * Per ARCHITECTURE.md §3 (round-trip contract / fungibility), our exports
 * must produce style definitions matching what Verbatim itself produces.
 * This block is sourced verbatim (heh) from `Debate.dotm:word/styles.xml`
 * — see NOTES-verbatim.md §1, §7 for the canonical names and inheritance.
 *
 * Style IDs we emit (the docx-level identifiers, not the display aliases):
 *   - Heading1 (alias: Pocket)        — paragraph style, outline level 0
 *   - Heading2 (alias: Hat)           — paragraph style, outline level 1
 *   - Heading3 (alias: Block)         — paragraph style, outline level 2
 *   - Heading4 (alias: Tag)           — paragraph style, outline level 3
 *   - Style13ptBold (alias: Cite)     — character style
 *   - StyleUnderline (alias: Underline) — character style
 *   - Emphasis                        — character style (with bdr)
 *   - Analytic / AnalyticChar         — Advanced Verbatim linked pair
 *   - Undertag / UndertagChar         — Advanced Verbatim linked pair
 *   - Normal                          — required default style
 *   - DefaultParagraphFont            — required default character style
 */

import { XML_PROLOG } from './xml.js';

/**
 * The canonical styles.xml content.
 *
 * This is essentially a stripped-down version of the full styles.xml
 * from Debate.dotm — we keep only the styles Verbatim and our editor
 * actually use, which keeps exports clean (stylepox-free by construction).
 */
export const CANONICAL_STYLES_XML = `${XML_PROLOG}
<w:styles xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia" w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160" w:line="259" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:aliases w:val="Normal/Card"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont">
    <w:name w:val="Default Paragraph Font"/>
    <w:uiPriority w:val="1"/>
    <w:semiHidden/>
    <w:unhideWhenUsed/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:aliases w:val="Pocket"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:link w:val="Heading1Char"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:pageBreakBefore/>
      <w:pBdr>
        <w:top w:val="single" w:sz="24" w:space="1" w:color="auto"/>
        <w:left w:val="single" w:sz="24" w:space="4" w:color="auto"/>
        <w:bottom w:val="single" w:sz="24" w:space="1" w:color="auto"/>
        <w:right w:val="single" w:sz="24" w:space="4" w:color="auto"/>
      </w:pBdr>
      <w:spacing w:before="480"/>
      <w:jc w:val="center"/>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:sz w:val="52"/>
      <w:szCs w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:aliases w:val="Hat"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:link w:val="Heading2Char"/>
    <w:uiPriority w:val="1"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:pageBreakBefore/>
      <w:spacing w:before="480"/>
      <w:jc w:val="center"/>
      <w:outlineLvl w:val="1"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:sz w:val="44"/>
      <w:szCs w:val="26"/>
      <w:u w:val="double"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:aliases w:val="Block"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:link w:val="Heading3Char"/>
    <w:uiPriority w:val="2"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:pageBreakBefore/>
      <w:spacing w:before="200"/>
      <w:jc w:val="center"/>
      <w:outlineLvl w:val="2"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:sz w:val="32"/>
      <w:szCs w:val="24"/>
      <w:u w:val="single"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="heading 4"/>
    <w:aliases w:val="Tag"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:link w:val="Heading4Char"/>
    <w:uiPriority w:val="3"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:spacing w:before="200"/>
      <w:outlineLvl w:val="3"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:iCs/>
      <w:sz w:val="26"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="Heading1Char">
    <w:name w:val="Heading 1 Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:link w:val="Heading1"/>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:sz w:val="52"/>
      <w:szCs w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="Heading2Char">
    <w:name w:val="Heading 2 Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:link w:val="Heading2"/>
    <w:uiPriority w:val="1"/>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:sz w:val="44"/>
      <w:szCs w:val="26"/>
      <w:u w:val="double"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="Heading3Char">
    <w:name w:val="Heading 3 Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:link w:val="Heading3"/>
    <w:uiPriority w:val="2"/>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:sz w:val="32"/>
      <w:szCs w:val="24"/>
      <w:u w:val="single"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="Heading4Char">
    <w:name w:val="Heading 4 Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:link w:val="Heading4"/>
    <w:uiPriority w:val="3"/>
    <w:rPr>
      <w:rFonts w:eastAsiaTheme="majorEastAsia" w:cstheme="majorBidi"/>
      <w:b/>
      <w:iCs/>
      <w:sz w:val="26"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:styleId="Emphasis">
    <w:name w:val="Emphasis"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:uiPriority w:val="8"/>
    <w:qFormat/>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
      <w:b w:val="0"/>
      <w:i w:val="0"/>
      <w:iCs/>
      <w:sz w:val="22"/>
      <w:u w:val="single"/>
      <w:bdr w:val="single" w:sz="8" w:space="0" w:color="auto"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="Style13ptBold">
    <w:name w:val="Style 13 pt Bold"/>
    <w:aliases w:val="Cite"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:uiPriority w:val="6"/>
    <w:qFormat/>
    <w:rPr>
      <w:b/>
      <w:bCs/>
      <w:sz w:val="26"/>
      <w:u w:val="none"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="StyleUnderline">
    <w:name w:val="Style Underline"/>
    <w:aliases w:val="Underline"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:uiPriority w:val="7"/>
    <w:qFormat/>
    <w:rPr>
      <w:b w:val="0"/>
      <w:sz w:val="22"/>
      <w:u w:val="single"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:customStyle="1" w:styleId="Undertag">
    <w:name w:val="Undertag"/>
    <w:basedOn w:val="Normal"/>
    <w:link w:val="UndertagChar"/>
    <w:autoRedefine/>
    <w:uiPriority w:val="5"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:after="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:eastAsiaTheme="majorEastAsia" w:hAnsi="Times New Roman" w:cstheme="majorBidi"/>
      <w:i/>
      <w:iCs/>
      <w:color w:val="385623" w:themeColor="accent6" w:themeShade="80"/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="UndertagChar">
    <w:name w:val="Undertag Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:link w:val="Undertag"/>
    <w:uiPriority w:val="5"/>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:eastAsiaTheme="majorEastAsia" w:hAnsi="Times New Roman" w:cstheme="majorBidi"/>
      <w:i/>
      <w:iCs/>
      <w:color w:val="385623" w:themeColor="accent6" w:themeShade="80"/>
      <w:sz w:val="24"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:customStyle="1" w:styleId="Analytic">
    <w:name w:val="Analytic"/>
    <w:basedOn w:val="Heading4"/>
    <w:link w:val="AnalyticChar"/>
    <w:autoRedefine/>
    <w:uiPriority w:val="5"/>
    <w:qFormat/>
    <w:rPr>
      <w:color w:val="1F3864" w:themeColor="accent1" w:themeShade="80"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="AnalyticChar">
    <w:name w:val="Analytic Char"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:link w:val="Analytic"/>
    <w:uiPriority w:val="5"/>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:eastAsiaTheme="majorEastAsia" w:hAnsi="Times New Roman" w:cstheme="majorBidi"/>
      <w:b/>
      <w:iCs/>
      <w:color w:val="1F3864" w:themeColor="accent1" w:themeShade="80"/>
      <w:sz w:val="26"/>
    </w:rPr>
  </w:style>
</w:styles>`;

/** Map from our schema node type name → docx pStyle styleId. */
export const NODE_TO_PSTYLE: Record<string, string | null> = {
  pocket: 'Heading1',
  hat: 'Heading2',
  block: 'Heading3',
  tag: 'Heading4',
  analytic: 'Analytic',
  undertag: 'Undertag',
  // Normal/no-pStyle:
  cite_paragraph: null,
  card_body: null,
  paragraph: null,
};

/** Map from our schema mark name → docx rStyle styleId. */
export const MARK_TO_RSTYLE: Record<string, string | null> = {
  cite_mark: 'Style13ptBold',
  underline_mark: 'StyleUnderline',
  emphasis_mark: 'Emphasis',
  undertag_mark: 'UndertagChar',
  analytic_mark: 'AnalyticChar',
};

/** Reverse: docx pStyle styleId → schema node type name. */
export const PSTYLE_TO_NODE: Record<string, string> = {
  Heading1: 'pocket',
  Heading2: 'hat',
  Heading3: 'block',
  Heading4: 'tag',
  Analytic: 'analytic',
  Undertag: 'undertag',
};

/** Parsed metadata for one `<w:style>` from `word/styles.xml`. */
export interface StyleInfo {
  /** styleId — the `w:styleId` attr, i.e. the token a paragraph's
   *  `<w:pStyle w:val>` references. */
  id: string;
  /** Human-readable name from `<w:name w:val>`, or null if absent. */
  name: string | null;
  /** `w:type` attr: 'paragraph' | 'character' | 'table' | 'numbering'. */
  type: string | null;
  /** Effective outline level — the style's own `<w:pPr>/<w:outlineLvl>`, else
   *  resolved through `basedOn` (or null). Used to place legacy heading styles at
   *  the right level, and to recognize a heading/tag authored only via a style. */
  outlineLevel?: number | null;
  /** Effective bold — the style's own `<w:rPr>/<w:b>`, else resolved through
   *  `basedOn` (true / false / null). Used to recognize a tag whose bold comes
   *  from its style chain rather than direct run formatting. */
  bold?: boolean | null;
}

/** styleId → parsed style metadata, built from `word/styles.xml`. */
export type StyleMap = Map<string, StyleInfo>;

/** Lowercase + strip all whitespace, so a display name ("Analytic Real")
 *  and its space-stripped styleId ("AnalyticReal") compare equal. */
function tightenStyleToken(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

/**
 * Fallback paragraph classification for styles whose styleId isn't one of
 * our canonical ids in {@link PSTYLE_TO_NODE}. Recognizes analytics that
 * were authored under non-standard styles (other templates, hand-built
 * styles), matching on either the display name or the styleId:
 *
 *   1. A style named/id'd "Analytic Real" → `analytic` (explicit).
 *   2. A **paragraph-type** style whose name or id contains "analytic"
 *      → `analytic`.
 *
 * Returns the schema node-type name, or null if no rule applies. Callers
 * run this only after the exact {@link PSTYLE_TO_NODE} lookup misses, so
 * "not one of our other existing styles" holds by construction.
 */
export function fallbackNodeType(info: StyleInfo | undefined): string | null {
  if (!info) return null;
  const name = info.name ? tightenStyleToken(info.name) : '';
  const id = tightenStyleToken(info.id);

  // Rule 1: explicit "Analytic Real", by name or styleId. Unconditional.
  if (name === 'analyticreal' || id === 'analyticreal') return 'analytic';

  // Rule 2: a paragraph-type style whose name or id contains "analytic".
  if (
    info.type === 'paragraph' &&
    (name.includes('analytic') || id.includes('analytic'))
  ) {
    return 'analytic';
  }

  return null;
}

/** Reverse: docx rStyle styleId → schema mark name.
 *
 *  Modern Verbatim styleIds (`StyleUnderline`, `Style13ptBold`,
 *  etc.) live alongside legacy styleIds shipped by earlier
 *  Verbatim distributions. The legacy names are widespread in
 *  older debate files — a tester's 2013-14 1AC contained 1,760
 *  underlined runs marked with the legacy `StyleBoldUnderline`
 *  styleId that would otherwise be silently dropped on import.
 *
 *  The export side always normalizes back to the modern styleId,
 *  so round-tripping an old file through CardMirror produces a
 *  doc with current rStyle ids — no need to track which dialect
 *  the file came from. */
export const RSTYLE_TO_MARK: Record<string, string> = {
  // ─── Underline named-style ──────────────────────────────────
  StyleUnderline: 'underline_mark',
  // Aliases / legacy:
  Underline: 'underline_mark',
  // Pre-modern Verbatim shipped "Style Bold Underline" (styleId
  // `StyleBoldUnderline`) as the underline character style.
  StyleBoldUnderline: 'underline_mark',

  // ─── Cite named-style ───────────────────────────────────────
  Style13ptBold: 'cite_mark',
  // Pre-modern Verbatim shipped "Style Style Bold + 12 pt"
  // (styleId `StyleStyleBold12pt`) as the cite character style.
  StyleStyleBold12pt: 'cite_mark',
  // Some files carry the cite style under its alias as the styleId
  // (`Cite`) instead of `Style13ptBold` — e.g. after a rename, or in an
  // older/variant Verbatim distribution. Safe to map: an `rStyle` only ever
  // references a character style, so a run-level `Cite` is the cite mark.
  Cite: 'cite_mark',

  // ─── Emphasis / structural marks ────────────────────────────
  Emphasis: 'emphasis_mark',
  UndertagChar: 'undertag_mark',
  AnalyticChar: 'analytic_mark',
};
