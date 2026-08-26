/**
 * Word's named highlight palette + helpers shared by the color UI,
 * the F11/Ctrl-F11 commands, and the settings store.
 *
 * Each entry maps one of Word's 15 highlight color names (the values
 * legal in `<w:highlight w:val="…"/>`) to its canonical RGB. The same
 * RGB is used when applying *shading* in the equivalent color, so
 * "yellow shading" produces `<w:shd w:fill="FFFF00"/>` matching what
 * Word renders for `<w:highlight w:val="yellow"/>`. Round-trip is
 * lossless because shading's hex RGB is what gets stored regardless.
 *
 * Color order matches Word's highlighter dropdown: brights first
 * (top row), darks second (bottom row), grays and black at the end.
 */

export interface WordColor {
  /** The OOXML highlight color name. */
  name: string;
  /** Canonical 6-char hex (no leading `#`). */
  rgb: string;
  /** Human label for tooltips. */
  label: string;
}

export const WORD_HIGHLIGHT_COLORS: readonly WordColor[] = [
  { name: 'yellow',      rgb: 'FFFF00', label: 'Yellow' },
  { name: 'green',       rgb: '00FF00', label: 'Bright Green' },
  { name: 'cyan',        rgb: '00FFFF', label: 'Turquoise' },
  { name: 'magenta',     rgb: 'FF00FF', label: 'Pink' },
  { name: 'blue',        rgb: '0000FF', label: 'Blue' },
  { name: 'red',         rgb: 'FF0000', label: 'Red' },
  { name: 'darkYellow',  rgb: '808000', label: 'Dark Yellow' },
  { name: 'darkGreen',   rgb: '008000', label: 'Dark Green' },
  { name: 'darkCyan',    rgb: '008080', label: 'Teal' },
  { name: 'darkMagenta', rgb: '800080', label: 'Violet' },
  { name: 'darkBlue',    rgb: '000080', label: 'Dark Blue' },
  { name: 'darkRed',     rgb: '800000', label: 'Dark Red' },
  { name: 'lightGray',   rgb: 'C0C0C0', label: 'Gray 25%' },
  { name: 'darkGray',    rgb: '808080', label: 'Gray 50%' },
  { name: 'black',       rgb: '000000', label: 'Black' },
];

/**
 * Background ("shading") swatch palette. Identical to the highlight palette
 * EXCEPT the dark-red slot, which is replaced with salmon. Shading is stored as
 * a raw RGB hex (`<w:shd w:fill="…"/>`), so — unlike highlight, whose value must
 * be one of Word's 15 named colors — it isn't constrained to the OOXML highlight
 * names, and a softer salmon reads better as a background than dark red.
 */
export const WORD_SHADING_COLORS: readonly WordColor[] = WORD_HIGHLIGHT_COLORS.map(
  (c) => (c.name === 'darkRed' ? { name: 'salmon', rgb: 'FA8072', label: 'Salmon' } : c),
);

/**
 * Verbatim's `HighlightToBackgroundColor` macro produces shading with
 * RGB `D2D2D2` — close to but not identical to Word's `lightGray` /
 * "Gray 25%" at `C0C0C0`. New shading we apply uses the Word-standard
 * value; existing `D2D2D2` in imported docs renders at exact hex
 * because the schema preserves the actual color attr (the palette is
 * for picking, not for normalizing existing data).
 */

const HIGHLIGHT_NAME_SET = new Set(WORD_HIGHLIGHT_COLORS.map((c) => c.name));
const HIGHLIGHT_RGB_BY_NAME = new Map(WORD_HIGHLIGHT_COLORS.map((c) => [c.name, c.rgb]));

/** True if `name` is one of Word's 15 named highlight colors. */
export function isWordHighlightName(name: string): boolean {
  return HIGHLIGHT_NAME_SET.has(name);
}

/** Returns the RGB hex for a Word color name, or null if unknown. */
export function highlightRgbFor(name: string): string | null {
  return HIGHLIGHT_RGB_BY_NAME.get(name) ?? null;
}

/** True if `hex` is a 6-char lowercase/uppercase hex without `#`. */
export function isHex6(hex: unknown): hex is string {
  return typeof hex === 'string' && /^[0-9a-fA-F]{6}$/.test(hex);
}

/** Reverse lookup: RGB hex → human-readable label. Word's 15
 *  highlight RGBs map straight back to their canonical labels.
 *  Verbatim's "protected grey" sentinel (`D2D2D2`) — produced
 *  by `HighlightToBackgroundColor` — gets its own label because
 *  it's semantically distinct from Word's `lightGray` even
 *  though both render as a pale grey. Anything else falls back
 *  to the bare hex. */
const LABEL_BY_RGB = new Map<string, string>();
for (const c of WORD_HIGHLIGHT_COLORS) {
  LABEL_BY_RGB.set(c.rgb.toUpperCase(), c.label);
}
LABEL_BY_RGB.set('D2D2D2', 'Protected Grey');
LABEL_BY_RGB.set('FA8072', 'Salmon'); // background-shading-only swatch (replaces Dark Red)

/** Human label for a stored highlight `color` attribute value
 *  (Word OOXML name like `yellow`). Falls back to the raw value
 *  for unknown names. */
export function highlightColorLabel(name: string): string {
  if (!name) return '';
  for (const c of WORD_HIGHLIGHT_COLORS) {
    if (c.name === name) return c.label;
  }
  return name;
}

/** Human label for a stored shading `color` attribute value
 *  (RGB hex without `#`). Matches Word's 15 palette names, plus
 *  Verbatim's "Protected Grey" (D2D2D2). Unknown hexes display
 *  as `#XXXXXX`. */
export function shadingColorLabel(hex: string): string {
  if (!hex) return '';
  const up = hex.toUpperCase();
  return LABEL_BY_RGB.get(up) ?? `#${up}`;
}
