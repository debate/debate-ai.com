/**
 * Frozen appearance for copied HTML (2026-09-19).
 *
 * The clipboard HTML is the schema's own DOM: `pmd-*` classes and `data-*`
 * attributes, styled by the app's stylesheet. Any other app that receives
 * it (an email, Google Docs, Word) has no stylesheet for those classes and
 * shows plain text. This pass writes the look those classes have on THIS
 * machine — the user's display sizes, colors, typography flags and body
 * font, i.e. the same settings the editor CSS is driven by — onto the
 * elements as inline styles, so the paste elsewhere looks like the
 * document did to the copier. Always the light palette: dark mode is a
 * screen preference, and its colors would be unreadable on white.
 *
 * Invariant (the whole point of doing it this way): a paste back into
 * CardMirror — this version or any earlier one — must produce exactly the
 * document it did before. The schema's parseDOM reads classes and `data-*`
 * attributes, plus a few inline properties it turns into marks or attrs:
 * `font-weight` (bold), `font-style` (italic), a `line-through`
 * `text-decoration` (strikethrough), `vertical-align` (super / subscript),
 * `padding-left` (indent) and, on paragraphs, `text-align`. Those are
 * NEVER written here, and a property already present on an element is
 * never overwritten. The cost is that bold coming from a style rather
 * than a Bold mark — tags, cites, analytics — travels only as far as the
 * receiving app's own defaults for h1–h4 carry it. The schema files have
 * been byte-identical since 1.6.0; clipboard-styles.test.ts round-trips a
 * rich fragment through the schema parser to hold the invariant.
 *
 * Applied by wrapping the clipboard serializer (`withFrozenStyles`), so
 * every producer of clipboard HTML — the native copy / cut / drag, the
 * outline pane's copy, Copy Current Heading, the card preview, cut in
 * place, Create Reference — freezes the same way. `text/plain` is
 * untouched, and so is `data-pm-slice`.
 */
import { DOMSerializer, type Fragment } from 'prosemirror-model';
import { settings, type DisplayColors, type DisplaySizes, type DisplayTypography } from './settings.js';

export interface FrozenAppearance {
  sizes: DisplaySizes;
  colors: DisplayColors;
  typography: DisplayTypography;
  bodyFont: string;
}

/** The copier's current display settings — what the editor CSS renders. */
export function frozenAppearanceFromSettings(): FrozenAppearance {
  return {
    sizes: settings.get('displaySizes'),
    colors: settings.get('displayColors'),
    typography: settings.get('displayTypography'),
    bodyFont: settings.get('bodyFont'),
  };
}

/** The 16 OOXML highlight names → the hex the editor paints (style.css). */
const HIGHLIGHT_HEX: Record<string, string> = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff',
  blue: '#0000ff', red: '#ff0000', darkBlue: '#000080', darkCyan: '#008080',
  darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000',
  darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000',
};
/** Emphasis / pocket box border, light theme (`--pmd-c-emphasis-box`). */
const BOX_COLOR = '#333';
/** Text over a light / dark highlight or shading band (`--pmd-c-band-fg-*`). */
const BAND_FG = { light: '#000', dark: '#fff' } as const;

const pt = (n: number): string => `${n}pt`;
const fontFamily = (name: string): string => (/[^A-Za-z0-9-]/.test(name) ? `"${name.replace(/"/g, '')}"` : name);

/** A run size set by an enclosing font_size span (`--pmd-run-font-size`
 *  inline), which the editor CSS lets override a mark's own size. Read
 *  off the attribute text: jsdom's style object does not carry custom
 *  properties reliably. */
function runFontSize(el: Element): string | null {
  const host = el.closest('[style*="--pmd-run-font-size"]');
  const m = host?.getAttribute('style')?.match(/--pmd-run-font-size:\s*([\d.]+pt)/);
  return m ? m[1]! : null;
}

/** Write the frozen look onto every element under `root`, in place. */
export function freezeStylesInto(root: ParentNode, app: FrozenAppearance): void {
  const font = fontFamily(app.bodyFont);
  const t = app.typography;
  const underlineThickness = t.underlineSize > 0 ? pt(t.underlineSize) : null;
  /** Set a property unless the element already carries one (its own
   *  toDOM output — an indent, a run size, a color — always wins). */
  const set = (el: HTMLElement, prop: string, value: string): void => {
    if (!el.style.getPropertyValue(prop)) el.style.setProperty(prop, value);
  };
  const underline = (el: HTMLElement, style = 'underline'): void => {
    set(el, 'text-decoration', style);
    if (underlineThickness) set(el, 'text-decoration-thickness', underlineThickness);
  };
  const bandText = (el: HTMLElement, band: string | null): void => {
    if (band === 'light' || band === 'dark') set(el, 'color', BAND_FG[band]);
  };

  for (const el of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
    const cl = el.classList;
    if (cl.contains('pmd-pocket')) {
      set(el, 'font-size', pt(app.sizes.pocket));
      set(el, 'font-family', font);
      set(el, 'text-align', 'center');
      if (t.pocketBox) {
        set(el, 'border', `${pt(t.pocketBoxSize)} solid ${BOX_COLOR}`);
        // Never padding-left: the parser reads it as the heading's indent.
        set(el, 'padding-top', '6pt');
        set(el, 'padding-bottom', '6pt');
        set(el, 'padding-right', '12pt');
      }
    } else if (cl.contains('pmd-hat')) {
      set(el, 'font-size', pt(app.sizes.hat));
      set(el, 'font-family', font);
      set(el, 'text-align', 'center');
      underline(el, t.hatUnderlineDouble ? 'underline double' : 'underline');
    } else if (cl.contains('pmd-block')) {
      set(el, 'font-size', pt(app.sizes.block));
      set(el, 'font-family', font);
      set(el, 'text-align', 'center');
      underline(el);
    } else if (cl.contains('pmd-tag')) {
      set(el, 'font-size', pt(app.sizes.tag));
      set(el, 'font-family', font);
    } else if (cl.contains('pmd-analytic')) {
      set(el, 'font-size', pt(app.sizes.analytic));
      set(el, 'font-family', font);
      set(el, 'color', app.colors.analytic);
    } else if (cl.contains('pmd-undertag')) {
      set(el, 'font-size', pt(app.sizes.undertag));
      set(el, 'font-family', '"Times New Roman", serif'); // fixed in the stylesheet, not the body font
      set(el, 'color', app.colors.undertag);
    } else if (cl.contains('pmd-card-body') || cl.contains('pmd-cite-para') || (el.tagName === 'P' && !/\bpmd-/.test(el.className))) {
      set(el, 'font-size', pt(app.sizes.normal));
      set(el, 'font-family', font);
    } else if (el.tagName === 'DIV' && /\bpmd-(card|analytic-unit|transclusion-ref|self-ref)\b/.test(el.className)) {
      set(el, 'font-size', pt(app.sizes.normal));
      set(el, 'font-family', font);
    } else if (cl.contains('pmd-cite')) {
      set(el, 'font-size', runFontSize(el) ?? pt(app.sizes.cite));
      if (t.citeUnderlined) underline(el);
    } else if (cl.contains('pmd-underline')) {
      set(el, 'font-size', runFontSize(el) ?? pt(app.sizes.underline));
      underline(el);
    } else if (cl.contains('pmd-emphasis')) {
      set(el, 'font-size', runFontSize(el) ?? pt(app.sizes.emphasis));
      underline(el);
      if (t.emphasisBox) set(el, 'border', `${pt(t.emphasisBoxSize)} solid ${BOX_COLOR}`);
    } else if (cl.contains('pmd-highlight')) {
      const name = el.getAttribute('data-highlight') ?? 'yellow';
      const hex = HIGHLIGHT_HEX[name];
      if (hex) {
        set(el, 'background-color', hex);
        bandText(el, el.getAttribute('data-highlight-band'));
      }
    } else if (el.hasAttribute('data-shading')) {
      bandText(el, el.getAttribute('data-shading-band')); // the fill is already inline
    } else if (cl.contains('pmd-undertag-mark')) {
      set(el, 'color', app.colors.undertag);
    } else if (cl.contains('pmd-analytic-mark')) {
      set(el, 'color', app.colors.analytic);
    } else if (cl.contains('pmd-pilcrow')) {
      set(el, 'font-size', '6pt');
    }
  }
}

/** A serializer that freezes the current appearance into everything it
 *  serializes; the clipboard serializer is built through this. */
class FrozenStyleSerializer extends DOMSerializer {
  override serializeFragment(fragment: Fragment, options?: { document?: Document }, target?: HTMLElement | DocumentFragment): HTMLElement | DocumentFragment {
    const out = super.serializeFragment(fragment, options, target);
    freezeStylesInto(out, frozenAppearanceFromSettings());
    return out;
  }
}

export function withFrozenStyles(serializer: DOMSerializer): DOMSerializer {
  return new FrozenStyleSerializer(serializer.nodes, serializer.marks);
}
