/**
 * @file docs-zoom.ts
 * @description The docs "Zoom level" setting: which levels there are, how a
 * click or key moves between them, and where the choice is kept. The level is
 * the CSS variable `--debate-docs-zoom` on `<html>`, which `styles/docs.css`
 * applies as `zoom` to the page content (`[data-docs-zoom]`), not to the
 * header, sidebar or toolbar. `DOCS_ZOOM_INIT_SCRIPT` restores a stored level
 * before first paint. The button and shortcuts are `components/guides/zoom-button.tsx`.
 */

/** The zoom levels in percent, in order; the first and last are the limits. */
export const ZOOM_STEPS = [50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200] as const;
export const ZOOM_DEFAULT = 100;
export const ZOOM_MIN = ZOOM_STEPS[0];
export const ZOOM_MAX = ZOOM_STEPS[ZOOM_STEPS.length - 1]!;
export const ZOOM_STORAGE_KEY = 'debate-docs-zoom';
export const ZOOM_VARIABLE = '--debate-docs-zoom';

/** A stored or typed level as a valid percent: the nearest step, or 100 for junk. */
export function normalizeZoom(value: unknown): number {
  const percent = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(percent)) return ZOOM_DEFAULT;
  return ZOOM_STEPS.reduce((best, step) => (Math.abs(step - percent) < Math.abs(best - percent) ? step : best));
}

/** The next level up, or the same at the limit. */
export function zoomIn(level: number): number {
  return ZOOM_STEPS.find((step) => step > level) ?? ZOOM_MAX;
}

/** The next level down, or the same at the limit. */
export function zoomOut(level: number): number {
  return [...ZOOM_STEPS].reverse().find((step) => step < level) ?? ZOOM_MIN;
}

export function readZoom(): number {
  try {
    return normalizeZoom(localStorage.getItem(ZOOM_STORAGE_KEY) ?? ZOOM_DEFAULT);
  } catch {
    return ZOOM_DEFAULT;
  }
}

/** Applies a level to the page and remembers it. */
export function writeZoom(level: number): void {
  const percent = normalizeZoom(level);
  document.documentElement.style.setProperty(ZOOM_VARIABLE, String(percent / 100));
  try {
    if (percent === ZOOM_DEFAULT) localStorage.removeItem(ZOOM_STORAGE_KEY);
    else localStorage.setItem(ZOOM_STORAGE_KEY, String(percent));
  } catch {
    // Blocked storage: the level lasts until the page is reloaded.
  }
}

/** Inline script for the docs layout: restores a stored level before paint. */
export const DOCS_ZOOM_INIT_SCRIPT = `try{var z=parseFloat(localStorage.getItem(${JSON.stringify(ZOOM_STORAGE_KEY)}));if(z>=${ZOOM_MIN}&&z<=${ZOOM_MAX})document.documentElement.style.setProperty(${JSON.stringify(ZOOM_VARIABLE)},String(z/100))}catch(e){}`;

export type ZoomAction = 'in' | 'out' | 'reset';

/** What a click does: Shift resets, Ctrl/Cmd zooms out, a plain click zooms in. */
export function zoomActionForClick(event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): ZoomAction {
  if (event.shiftKey) return 'reset';
  return event.ctrlKey || event.metaKey ? 'out' : 'in';
}

/** What a keystroke does: Ctrl/Cmd with + or = (in), - (out) or 0 (reset); null for anything else. */
export function zoomActionForKey(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): ZoomAction | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  if (event.key === '+' || event.key === '=') return 'in';
  if (event.key === '-' || event.key === '_') return 'out';
  if (event.key === '0') return 'reset';
  return null;
}

export function applyZoomAction(level: number, action: ZoomAction): number {
  return action === 'in' ? zoomIn(level) : action === 'out' ? zoomOut(level) : ZOOM_DEFAULT;
}

/** The tooltip text: every way to zoom. */
export const ZOOM_TOOLTIP = [
  'Click: zoom in',
  'Ctrl/Cmd + click: zoom out',
  'Shift + click: reset to 100%',
  'Ctrl/Cmd + + : zoom in',
  'Ctrl/Cmd + - : zoom out',
  'Ctrl/Cmd + 0 : reset',
].join('\n');
