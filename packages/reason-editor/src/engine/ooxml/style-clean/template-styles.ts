/**
 * Style whitelist for the .docx style cleaner — a faithful port of the data
 * in the scouting-assistant cleaner (`style_cleaner.STYLE_RENAME_MAP` plus the
 * styles bundled in `assets/template_doc.docx`).
 *
 * The cleaner keeps only styles whose id appears in the combined map below,
 * renaming each to its canonical `name` and setting/removing its `alias`.
 * Everything else is removed (unless it's a user-protected style).
 */

export interface StyleSpec {
  name: string;
  alias: string | null;
}

/** Port of `STYLE_RENAME_MAP` (style_cleaner.py). The canonical Verbatim set. */
export const STYLE_RENAME_MAP: Record<string, StyleSpec> = {
  Normal: { name: 'Normal', alias: null },
  Heading1: { name: 'Heading 1', alias: 'Pocket' },
  Heading2: { name: 'Heading 2', alias: 'Hat' },
  Heading3: { name: 'Heading 3', alias: 'Block' },
  Heading4: { name: 'Heading 4', alias: 'Tag' },
  Emphasis: { name: 'Emphasis', alias: null },
  Heading1Char: { name: 'Heading 1 Char', alias: 'Pocket Char' },
  Heading2Char: { name: 'Heading 2 Char', alias: 'Hat Char' },
  Heading3Char: { name: 'Heading 3 Char', alias: 'Block Char' },
  Heading4Char: { name: 'Heading 4 Char', alias: 'Tag Char' },
  Style13ptBold: { name: 'Style13ptBold', alias: 'Cite' },
  StyleUnderline: { name: 'StyleUnderline', alias: 'Underline' },
  Heading5: { name: 'Heading 5', alias: null },
  Heading5Char: { name: 'Heading 5 Char', alias: null },
  Header: { name: 'Header', alias: null },
  HeaderChar: { name: 'Header Char', alias: null },
  Footer: { name: 'Footer', alias: null },
  FooterChar: { name: 'Footer Char', alias: null },
  BodyText: { name: 'Body Text', alias: null },
  BodyTextChar: { name: 'Body Text Char', alias: null },
  NoSpacing: { name: 'No Spacing', alias: null },
  NoSpacingChar: { name: 'No Spacing Char', alias: null },
  Undertag: { name: 'Undertag', alias: null },
  UndertagChar: { name: 'Undertag Char', alias: null },
  Analytic: { name: 'Analytic', alias: null },
  AnalyticChar: { name: 'Analytic Char', alias: null },
};

/** Port of `_get_template_styles()` — the styles in template_doc.docx that are
 *  NOT already in STYLE_RENAME_MAP (id → {name, alias}). All have no alias. */
export const TEMPLATE_STYLES: Record<string, StyleSpec> = {
  DefaultParagraphFont: { name: 'Default Paragraph Font', alias: null },
  TableNormal: { name: 'Normal Table', alias: null },
  NoList: { name: 'No List', alias: null },
  FollowedHyperlink: { name: 'FollowedHyperlink', alias: null },
  Strong: { name: 'Strong', alias: null },
  BookTitle: { name: 'Book Title', alias: null },
  '111111': { name: 'Outline List 2', alias: null },
  Hyperlink: { name: 'Hyperlink', alias: null },
  UnresolvedMention: { name: 'Unresolved Mention', alias: null },
};

/** `combined = {**STYLE_RENAME_MAP, **template_styles}` — the keep/rename set. */
export const COMBINED_STYLE_MAP: Record<string, StyleSpec> = {
  ...STYLE_RENAME_MAP,
  ...TEMPLATE_STYLES,
};
