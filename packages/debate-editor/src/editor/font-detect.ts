/**
 * Detect which named fonts are actually installed on the user's system.
 *
 * The trick: render a fixed test string in the candidate font with each
 * of the three CSS generic fallbacks (monospace / serif / sans-serif).
 * If the candidate isn't installed, the browser falls back to the
 * generic and the rendered metrics match the bare generic's metrics.
 * If the candidate IS installed, at least one base's measurement
 * differs.
 *
 * Not perfect — a font with the same metrics as one of the bases would
 * be misclassified — but reliable for the body fonts we care about
 * here.
 *
 * Generic CSS keywords (serif, sans-serif, monospace, ...) are always
 * available; skip detection for them.
 */

const GENERIC_KEYWORDS = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
]);

/** Fonts the app bundles via `@font-face` declarations in style.css.
 *  Always reported as available: the metrics probe below would
 *  spuriously report them missing on first paint (the woff2 hasn't
 *  downloaded yet, so the browser still renders the fallback), and
 *  they're guaranteed present once `document.fonts.ready` resolves. */
const BUNDLED_FONTS = new Set([
  // Accessibility fonts (woff2 in src/editor/fonts).
  'Atkinson Hyperlegible',
  'Lexend',
  'OpenDyslexic',
  // Metric-compatible open-source substitutes for the proprietary / system
  // fonts the picker offers but can't ship (Carlito→Calibri, Caladea→Cambria,
  // Tinos→Times New Roman / Liberation Serif, Arimo→Arial / Helvetica /
  // Liberation Sans, Gelasio→Georgia, Comic Neue→Comic Sans MS, DejaVu Sans→
  // Verdana / Tahoma), plus the real OSS families themselves. The @font-face
  // `local()` still prefers a user's real font. See style.css + LICENSES.md.
  'Calibri',
  'Cambria',
  'Times New Roman',
  'Arial',
  'Georgia',
  'Helvetica',
  'Comic Sans MS',
  'Verdana',
  'Tahoma',
  'Liberation Serif',
  'Liberation Sans',
  'DejaVu Sans',
  'DejaVu Serif',
  'Noto Sans',
  'Noto Serif',
]);

const TEST_STRING = 'mmmmmmmmmmlli';
const TEST_SIZE = '72px';
const BASE_FONTS = ['monospace', 'serif', 'sans-serif'] as const;

const cache = new Map<string, boolean>();

/**
 * Returns true if `font` resolves to a real installed font (i.e. not a
 * silent fallback to one of the generic categories). Generic keywords
 * are always considered available.
 */
export function isFontAvailable(font: string): boolean {
  if (GENERIC_KEYWORDS.has(font)) return true;
  if (BUNDLED_FONTS.has(font)) return true;
  if (typeof document === 'undefined') return false; // SSR / non-DOM
  const cached = cache.get(font);
  if (cached !== undefined) return cached;

  const probe = document.createElement('span');
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.left = '-9999px';
  probe.style.top = '-9999px';
  probe.style.fontSize = TEST_SIZE;
  probe.textContent = TEST_STRING;
  document.body.appendChild(probe);

  // Baseline dimensions for each generic.
  const baseDimensions = new Map<string, { w: number; h: number }>();
  for (const base of BASE_FONTS) {
    probe.style.fontFamily = base;
    baseDimensions.set(base, {
      w: probe.offsetWidth,
      h: probe.offsetHeight,
    });
  }

  // If candidate differs from at least one base, it's installed.
  let detected = false;
  for (const base of BASE_FONTS) {
    probe.style.fontFamily = `"${font}", ${base}`;
    const baseDim = baseDimensions.get(base)!;
    if (probe.offsetWidth !== baseDim.w || probe.offsetHeight !== baseDim.h) {
      detected = true;
      break;
    }
  }

  document.body.removeChild(probe);
  cache.set(font, detected);
  return detected;
}
