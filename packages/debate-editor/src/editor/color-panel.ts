/**
 * Ribbon "color panel" — three split buttons (Highlight / Background
 * / Font Color) with swatch-picker dropdowns and Word-style paintbrush
 * mode.
 *
 * Each control:
 *   - Main button: if selection is non-empty, applies the active color
 *     to it. If selection is empty, toggles a sticky paintbrush mode
 *     for that mark — subsequent drag-selects in the editor get the
 *     active color automatically until Escape or the button is clicked
 *     again. Behaviour mirrors Word's highlighter pen. Only a genuine
 *     stroke paints: a primary-button drag or double/triple-click
 *     select that began in the editor. Right-clicks, shift-click
 *     extends, and selections made before the gesture never do.
 *   - Arrow button: opens a 16-swatch picker. Top-left swatch is always
 *     the none/automatic option (No highlight / No background /
 *     Automatic). Picking any swatch — including "none" — updates the
 *     persisted color and applies it to the current selection in one
 *     click; a "none" pen paints by stripping the mark.
 *
 * Active color persists via `settings.lastHighlightColor` /
 * `lastShadingColor` / `lastFontColor`; the bar under each main
 * button reflects the live value.
 */

import type { EditorView } from 'prosemirror-view';
import { TextSelection, type Command, type Transaction } from 'prosemirror-state';
import { settings } from './settings.js';
import {
  WORD_HIGHLIGHT_COLORS,
  WORD_SHADING_COLORS,
  highlightRgbFor,
} from './color-palette.js';
import {
  applyHighlight,
  applyShading,
  setHighlightColor,
  setShadingColor,
  setFontColor,
  primaryKeyFor,
  formatKeyForDisplay,
} from './ribbon-commands.js';
import { schema } from '../schema/index.js';
import { classifyChar } from './word-break.js';

type ViewRef = { view: EditorView | null };
export type PaintbrushMode = 'highlight' | 'shading' | 'fontcolor';

export interface ColorPanelHandle {
  /** Toggle paint mode for the given target — turns it on if off,
   *  off if already on, or switches modes if a different one was on.
   *  Used by the keybinding-driven ribbon commands so users can arm
   *  the paintbrush without clicking the ribbon button. */
  togglePaintbrush(mode: PaintbrushMode): void;
  /** Open the color-picker dropdown anchored at the ribbon's arrow
   *  button for the given mode. Used by the keybinding-driven
   *  picker-open commands. Anchors at the arrow-button DOM element
   *  so the dropdown lands in the same place as a ribbon click. */
  openPicker(mode: PaintbrushMode): void;
  /** Re-apply the paint-mode visuals to the CURRENT view. Called on
   *  pane-focus changes (setActiveView): the brush itself already
   *  follows focus — the mouseup handler resolves the view at stroke
   *  time — but the armed cursor/class are DOM state on a specific
   *  editor element, so without this the pane you left keeps showing
   *  the brush and the pane you're in doesn't. */
  syncPaintbrushView(): void;
}

interface ColorControlSetup {
  mainBtnId: string;
  arrowBtnId: string;
  pickerLabel: string;
  paintbrushMode: PaintbrushMode;
  /** Command issued when main button is clicked with a non-empty selection. */
  onMainClick: () => Command;
  /** Command applied per drag-select while paintbrush mode is active. */
  paintbrushApply: () => Command;
  /** Same, for a strip-key stroke — the strip-pen ("no color"). */
  stripApply: () => Command;
  /** Builds the swatch grid; calls `pick(value)` when a swatch is clicked. */
  buildPicker: (pick: (value: string | null) => void) => HTMLElement;
  /** Update the live indicator bar (and the font-color glyph) to reflect the active color. */
  updateIndicator: () => void;
}

/** Which modifier flips an armed colored pen to the strip-pen for one
 *  stroke. ⌥-drag moves the whole window on current macOS (so an
 *  Option-held stroke turns into a window drag before it can land),
 *  and ⌘ is spoken for too — the override lives on ⌃ Control there.
 *  Alt everywhere else. Read per call so tests can stub the platform. */
function onMac(): boolean {
  return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform ?? '');
}
function stripKeyHeld(e: MouseEvent): boolean {
  return onMac() ? e.ctrlKey : e.altKey;
}
function isStripKey(e: KeyboardEvent): boolean {
  return e.key === (onMac() ? 'Control' : 'Alt');
}

export function wireColorPanel(viewRef: ViewRef): ColorPanelHandle {
  let activePaintbrush: PaintbrushMode | null = null;
  // Strip key (⌃ on macOS, Alt elsewhere) held = temporary strip-pen
  // ("paint no color") while a colored pen is armed. This flag only
  // keeps the CURSOR truthful — the actual apply decision reads the
  // modifier off the mouseup itself, so a missed keyup can never make
  // the wrong pen fire.
  let stripKeyOverride = false;

  const controls: ColorControlSetup[] = [
    buildHighlightControl(),
    buildShadingControl(),
    buildFontColorControl(),
  ];

  // Platform-aware tooltips for the F-key-bound main buttons. Font
  // color has no hotkey so it keeps its plain label.
  for (const [btnId, label, cmdId] of [
    ['highlight-btn', 'Highlight', 'applyHighlight'],
    ['shading-btn', 'Background color', 'applyShading'],
  ] as const) {
    const btn = document.getElementById(btnId);
    if (!btn) continue;
    const key = formatKeyForDisplay(
      primaryKeyFor(cmdId as Parameters<typeof primaryKeyFor>[0]),
    );
    btn.setAttribute('title', key ? `${label} (${key})` : label);
  }

  // The editor element currently carrying the paint-mode visuals.
  // Cleanup must target THIS element, not whichever view is focused at
  // sync time — in multi-pane, disarming from a different pane used to
  // leave the armed pane's brush cursor stuck forever.
  let paintedEl: HTMLElement | null = null;

  function syncPaintbrushUI(): void {
    if (paintedEl) {
      paintedEl.classList.remove(
        'pmd-paintbrush-highlight',
        'pmd-paintbrush-shading',
        'pmd-paintbrush-fontcolor',
      );
      // Reset any custom cursor from a previous mode. The CSS
      // fallback (cursor: text) takes over until we re-arm.
      paintedEl.style.cursor = '';
      paintedEl = null;
    }
    const view = viewRef.view;
    const editorEl = view?.dom as HTMLElement | undefined;
    for (const id of ['highlight-btn', 'shading-btn', 'fontcolor-btn']) {
      document.getElementById(id)?.classList.remove('pmd-paintbrush-active');
    }
    if (activePaintbrush) {
      if (editorEl) paintedEl = editorEl;
      editorEl?.classList.add(`pmd-paintbrush-${activePaintbrush}`);
      document.getElementById(`${activePaintbrush}-btn`)?.classList.add('pmd-paintbrush-active');
      // Custom SVG cursor: a precision pointer (I-beam) so the user
      // can still see exactly which character they're about to
      // start a paint drag on, plus a small swatch hanging off the
      // lower-right showing the active color. Refreshed on every
      // settings change (subscriber below) so swapping the color
      // in mid-session updates the cursor live. While the strip key holds the
      // strip-pen override, the swatch shows the app's "no color"
      // glyph (white with a red slash) instead of the pen color.
      if (editorEl) {
        const strip = stripKeyOverride && !penIsNone(activePaintbrush);
        const color = strip ? null : resolvePaintbrushColor(activePaintbrush);
        editorEl.style.cursor = `url("${paintbrushCursorDataUri(color)}") 6 10, text`;
      }
    }
  }

  function setPaintbrush(mode: PaintbrushMode | null): void {
    activePaintbrush = mode;
    syncPaintbrushUI();
  }

  for (const c of controls) {
    const mainBtn = document.getElementById(c.mainBtnId) as HTMLButtonElement | null;
    const arrowBtn = document.getElementById(c.arrowBtnId) as HTMLButtonElement | null;
    if (!mainBtn || !arrowBtn) continue;

    // Don't steal focus — the command operates on the live editor selection.
    const preventBlur = (e: Event) => e.preventDefault();
    mainBtn.addEventListener('mousedown', preventBlur);
    arrowBtn.addEventListener('mousedown', preventBlur);

    mainBtn.addEventListener('click', () => {
      const view = viewRef.view;
      if (!view) return;
      const sel = view.state.selection;
      if (sel.empty) {
        setPaintbrush(activePaintbrush === c.paintbrushMode ? null : c.paintbrushMode);
        return;
      }
      const cmd = c.onMainClick();
      cmd(view.state, view.dispatch.bind(view));
      view.focus();
    });

    arrowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openPicker(arrowBtn, c, viewRef);
    });

    c.updateIndicator();
  }

  // Sticky paintbrush — apply the active mark to every drag-selected
  // range while a paintbrush mode is on. After applying, collapse the
  // selection to the end of the painted range so the user can see
  // what they just painted (Word's "lift the brush" UX). The strip
  // key (⌃ on macOS, Alt elsewhere) held at release turns a colored
  // pen into the strip-pen for this stroke ("paint no color"); a pen
  // already set to "none" ignores it — it strips either way.
  //
  // A stroke must be a gesture the user made AS painting: a
  // primary-button drag (or double/triple-click select) that began
  // inside the editor while the brush was armed. Anything else that
  // releases a mouse button over a live selection must not paint —
  // before this handshake ANY mouseup did, so armed-brush + select-all
  // + right-click (a context-menu attempt; the browser preserves the
  // selection for it) painted a shared doc wall-to-wall in one event
  // (field incident 2026-08-14). Shift-click extends are excluded on
  // the same principle: that's the select-to-copy gesture, and a drag
  // paints the same range anyway.
  let paintStroke: { editorEl: HTMLElement; x: number; y: number } | null = null;
  document.addEventListener(
    'mousedown',
    (e) => {
      paintStroke = null;
      if (!activePaintbrush || e.button !== 0 || e.shiftKey) return;
      const target = e.target instanceof Element ? e.target : null;
      const editorEl = target?.closest('.ProseMirror');
      if (!(editorEl instanceof HTMLElement)) return;
      paintStroke = { editorEl, x: e.clientX, y: e.clientY };
    },
    // Capture, so a plugin that swallows mousedown can neither leave a
    // stale stroke record behind nor block a legitimate one.
    true,
  );
  document.addEventListener('mouseup', (e) => {
    const stroke = paintStroke;
    paintStroke = null;
    if (!activePaintbrush) return;
    if (e.button !== 0) return;
    if (!stroke) return;
    const view = viewRef.view;
    if (!view) return;
    // The gesture must have started in the pane resolved at stroke
    // time — the element match also keeps ribbon-click mouseups (and
    // strokes begun in another pane) away from this view's selection.
    if (stroke.editorEl !== view.dom) return;
    if (!view.dom.contains(e.target as Node)) return;
    // A stationary single click is selection housekeeping (caret move,
    // collapse), not a stroke — require real drag travel or a
    // double/triple-click select.
    if (e.detail < 2 && Math.hypot(e.clientX - stroke.x, e.clientY - stroke.y) < 3) return;
    const sel = view.state.selection;
    if (sel.empty) return;
    const setup = controls.find((c) => c.paintbrushMode === activePaintbrush);
    if (!setup) return;
    const strip = stripKeyHeld(e) && !penIsNone(activePaintbrush);
    const cmd = strip ? setup.stripApply() : setup.paintbrushApply();
    applyAndCollapseSelection(view, cmd);
  });

  // Escape clears paintbrush mode (Word convention).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activePaintbrush) {
      setPaintbrush(null);
      e.preventDefault();
    }
  });

  // Track the strip key for the override cursor. `keydown` repeats
  // while held — the flag guard keeps the cursor rebuild to one per
  // press. A window blur clears the override: app-switching with the
  // key down eats the keyup, and returning stuck in strip mode would
  // paint "no color" with a colored cursor showing.
  document.addEventListener('keydown', (e) => {
    if (isStripKey(e) && activePaintbrush && !stripKeyOverride) {
      stripKeyOverride = true;
      syncPaintbrushUI();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (isStripKey(e) && stripKeyOverride) {
      stripKeyOverride = false;
      if (activePaintbrush) syncPaintbrushUI();
    }
  });
  window.addEventListener('blur', () => {
    if (stripKeyOverride) {
      stripKeyOverride = false;
      if (activePaintbrush) syncPaintbrushUI();
    }
  });

  settings.subscribe(() => {
    for (const c of controls) c.updateIndicator();
    // Live-refresh the paint cursor when the active color changes
    // (otherwise picking a new swatch leaves the cursor showing
    // the old color until paint mode is toggled off + back on).
    if (activePaintbrush) syncPaintbrushUI();
  });

  return {
    togglePaintbrush: (mode: PaintbrushMode) => {
      setPaintbrush(activePaintbrush === mode ? null : mode);
    },
    openPicker: (mode: PaintbrushMode) => {
      const setup = controls.find((c) => c.paintbrushMode === mode);
      if (!setup) return;
      const anchor = document.getElementById(setup.arrowBtnId) as HTMLButtonElement | null;
      if (!anchor) return;
      openPicker(anchor, setup, viewRef);
    },
    syncPaintbrushView: () => {
      // Cheap no-op path when nothing is armed AND nothing is painted:
      // this runs on every pane-focus change.
      if (activePaintbrush || paintedEl) syncPaintbrushUI();
    },
  };
}

/** Whether the armed pen for `mode` is the "no color" pen. The Alt
 *  strip-pen override is only meaningful for a COLORED pen — a none
 *  pen already strips, so Alt changes nothing there. */
function penIsNone(mode: PaintbrushMode): boolean {
  if (mode === 'highlight') return settings.get('lastHighlightColor') === null;
  if (mode === 'shading') return settings.get('lastShadingColor') === null;
  return settings.get('lastFontColor') === null;
}

/** Resolve the active color for a paintbrush mode to a CSS color
 *  string suitable for the SVG cursor swatch. Reads the same
 *  `lastX` settings the ribbon indicator bars do, so the cursor
 *  matches what the next click will apply. */
function resolvePaintbrushColor(mode: PaintbrushMode): string {
  if (mode === 'highlight') {
    const name = settings.get('lastHighlightColor');
    // Null pen paints "none" — the cursor swatch shows white.
    const rgb = name === null ? 'ffffff' : highlightRgbFor(name) ?? 'ffff00';
    return '#' + rgb;
  }
  if (mode === 'shading') {
    const rgb = settings.get('lastShadingColor') ?? 'ffffff';
    return '#' + rgb;
  }
  // fontcolor
  const v = settings.get('lastFontColor');
  return '#' + (v ?? '000000');
}

/** Build the SVG-cursor data URI for paint mode. The cursor is a
 *  thin I-beam (precision pointer for text selection) with a small
 *  color swatch hanging off the lower-right corner. Hotspot:
 *  centered on the I-beam (x=6, y=10 in the 24x24 viewBox), set in
 *  the consuming `cursor:` declaration. A null `fillColor` renders
 *  the "no color" glyph — white with a red diagonal slash, matching
 *  the pickers' none-swatch — for the Alt strip-pen override. */
function paintbrushCursorDataUri(fillColor: string | null): string {
  const swatch =
    fillColor === null
      ? '<rect x="12" y="13" width="10" height="10" fill="#fff" stroke="#000" stroke-width="1"/>' +
        '<line x1="12" y1="23" x2="22" y2="13" stroke="#d21" stroke-width="2"/>'
      : `<rect x="12" y="13" width="10" height="10" fill="${fillColor}" stroke="#000" stroke-width="1"/>`;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
    // I-beam: vertical stem + top/bottom caps. Two-tone (white
    // stroke underneath the black stroke) so the cursor stays
    // visible on dark backgrounds.
    '<g stroke="#fff" stroke-width="3" fill="none">' +
    '<line x1="6" y1="2" x2="6" y2="18"/>' +
    '<line x1="3" y1="2" x2="9" y2="2"/>' +
    '<line x1="3" y1="18" x2="9" y2="18"/>' +
    '</g>' +
    '<g stroke="#000" stroke-width="1.5" fill="none">' +
    '<line x1="6" y1="2" x2="6" y2="18"/>' +
    '<line x1="3" y1="2" x2="9" y2="2"/>' +
    '<line x1="3" y1="18" x2="9" y2="18"/>' +
    '</g>' +
    // Color swatch in the lower-right with a thin dark outline.
    swatch +
    '</svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function buildHighlightControl(): ColorControlSetup {
  return {
    mainBtnId: 'highlight-btn',
    arrowBtnId: 'highlight-picker-btn',
    pickerLabel: 'Highlight color',
    paintbrushMode: 'highlight',
    onMainClick: () => applyHighlight(() => settings.get('lastHighlightColor')),
    // Paintbrush uses the toggle (applyHighlight, not setHighlightColor)
    // so re-painting a uniformly-highlighted range strips it.
    paintbrushApply: () => applyHighlight(() => settings.get('lastHighlightColor')),
    // Alt stroke: the null pen — strips regardless of the armed color.
    stripApply: () => applyHighlight(() => null),
    buildPicker: (pick) => {
      const grid = document.createElement('div');
      grid.className = 'pmd-color-picker-grid';
      // Top-left: "No highlight" strip swatch.
      grid.appendChild(buildStripSwatch('No highlight', () => pick(null)));
      for (const c of WORD_HIGHLIGHT_COLORS) {
        grid.appendChild(buildColorSwatch(c.rgb, c.label, () => pick(c.name)));
      }
      return grid;
    },
    updateIndicator: () => {
      const bar = document.getElementById('highlight-bar');
      if (!bar) return;
      const name = settings.get('lastHighlightColor');
      // Null pen ("No highlight") reads as plain white — absence of
      // color is paper-white, matching the none swatch's constant.
      const rgb = name === null ? 'FFFFFF' : highlightRgbFor(name) ?? 'FFFF00';
      bar.style.background = `#${rgb}`;
    },
  };
}

function buildShadingControl(): ColorControlSetup {
  return {
    mainBtnId: 'shading-btn',
    arrowBtnId: 'shading-picker-btn',
    pickerLabel: 'Background color',
    paintbrushMode: 'shading',
    onMainClick: () => applyShading(() => settings.get('lastShadingColor')),
    // Toggle, mirroring highlight paintbrush — re-painting an already-
    // shaded range strips the mark.
    paintbrushApply: () => applyShading(() => settings.get('lastShadingColor')),
    stripApply: () => applyShading(() => null),
    buildPicker: (pick) => {
      const grid = document.createElement('div');
      grid.className = 'pmd-color-picker-grid';
      // Top-left: "No background color" strip swatch.
      grid.appendChild(buildStripSwatch('No background color', () => pick(null)));
      for (const c of WORD_SHADING_COLORS) {
        grid.appendChild(buildColorSwatch(c.rgb, c.label, () => pick(c.rgb)));
      }
      return grid;
    },
    updateIndicator: () => {
      const bar = document.getElementById('shading-bar');
      if (!bar) return;
      const rgb = settings.get('lastShadingColor') ?? 'FFFFFF';
      bar.style.background = `#${rgb}`;
    },
  };
}

function buildFontColorControl(): ColorControlSetup {
  return {
    mainBtnId: 'fontcolor-btn',
    arrowBtnId: 'fontcolor-picker-btn',
    pickerLabel: 'Font color',
    paintbrushMode: 'fontcolor',
    onMainClick: () => setFontColor(settings.get('lastFontColor')),
    paintbrushApply: () => setFontColor(settings.get('lastFontColor')),
    // Alt stroke: temporary "Automatic" — strips the font_color mark.
    stripApply: () => setFontColor(null),
    buildPicker: (pick) => {
      const grid = document.createElement('div');
      grid.className = 'pmd-color-picker-grid';
      // Top-left: "Automatic" — strip the font_color mark entirely.
      grid.appendChild(buildStripSwatch('Automatic', () => pick(null)));
      for (const c of WORD_HIGHLIGHT_COLORS) {
        grid.appendChild(buildColorSwatch(c.rgb, c.label, () => pick(c.rgb)));
      }
      return grid;
    },
    updateIndicator: () => {
      const bar = document.getElementById('fontcolor-bar');
      const glyph = document.getElementById('fontcolor-glyph');
      const v = settings.get('lastFontColor');
      // No explicit color picked ("Automatic") — show the
      // theme's default text color so the A is readable in both
      // light and dark mode. Otherwise show the chosen color.
      if (bar) bar.style.background = `#${v ?? '000000'}`;
      if (glyph) {
        if (v) {
          glyph.style.color = `#${v}`;
        } else {
          glyph.style.color = '';
        }
      }
    },
  };
}

function buildColorSwatch(rgb: string, label: string, onPick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pmd-color-swatch';
  btn.style.background = `#${rgb}`;
  btn.title = label;
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', onPick);
  return btn;
}

function buildStripSwatch(label: string, onPick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pmd-color-swatch pmd-swatch-none';
  btn.title = label;
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', onPick);
  return btn;
}

let openPickerEl: HTMLElement | null = null;
let openPickerDismiss: (() => void) | null = null;

function openPicker(
  anchor: HTMLElement,
  setup: ColorControlSetup,
  viewRef: ViewRef,
): void {
  if (openPickerEl) {
    const wasSame = openPickerEl.dataset['controlId'] === setup.arrowBtnId;
    closeOpenPicker();
    if (wasSame) return; // toggle closed
  }

  const picker = document.createElement('div');
  picker.className = 'pmd-color-picker';
  picker.dataset['controlId'] = setup.arrowBtnId;

  const handlePick = (value: string | null) => {
    const view = viewRef.view;
    if (!view) {
      closeOpenPicker();
      return;
    }

    if (setup.mainBtnId === 'highlight-btn') {
      if (value === null) {
        // "No highlight": persists as the active pen (F11 / paintbrush
        // then strip) AND strips across the current selection, same
        // persist-and-apply shape as the colored swatches.
        settings.set('lastHighlightColor', null);
        stripMarkInSelection(view, 'highlight');
      } else {
        settings.set('lastHighlightColor', value);
        setHighlightColor(value)(view.state, view.dispatch.bind(view));
      }
    } else if (setup.mainBtnId === 'shading-btn') {
      if (value === null) {
        settings.set('lastShadingColor', null);
        stripMarkInSelection(view, 'shading');
      } else {
        settings.set('lastShadingColor', value);
        setShadingColor(value)(view.state, view.dispatch.bind(view));
      }
    } else if (setup.mainBtnId === 'fontcolor-btn') {
      // Automatic = null persists; font color paintbrush then strips.
      settings.set('lastFontColor', value);
      setFontColor(value)(view.state, view.dispatch.bind(view));
    }

    view.focus();
    closeOpenPicker();
  };

  picker.appendChild(setup.buildPicker(handlePick));

  const label = document.createElement('div');
  label.className = 'pmd-color-picker-label';
  label.textContent = setup.pickerLabel;
  picker.appendChild(label);

  document.body.appendChild(picker);

  // Position below the anchor (shifted slightly left so the 4-column
  // grid isn't clipped by the narrow arrow button).
  const rect = anchor.getBoundingClientRect();
  picker.style.top = `${rect.bottom + 2}px`;
  picker.style.left = `${rect.left - 60}px`;

  const onDocPointerDown = (e: PointerEvent) => {
    if (!openPickerEl) return;
    const target = e.target as Node | null;
    if (target && openPickerEl.contains(target)) return;
    // The trigger is part of the open picker's owned surface. Let its later
    // click handler perform the same-control toggle; closing here first would
    // clear `openPickerEl`, so that click would immediately open a new picker.
    if (target && anchor.contains(target)) return;
    closeOpenPicker();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeOpenPicker();
  };
  document.addEventListener('pointerdown', onDocPointerDown);
  document.addEventListener('keydown', onKey);

  anchor.setAttribute('aria-expanded', 'true');

  openPickerEl = picker;
  openPickerDismiss = () => {
    document.removeEventListener('pointerdown', onDocPointerDown);
    document.removeEventListener('keydown', onKey);
    anchor.setAttribute('aria-expanded', 'false');
    picker.remove();
  };
}

function closeOpenPicker(): void {
  if (openPickerDismiss) openPickerDismiss();
  openPickerEl = null;
  openPickerDismiss = null;
}

/** One-shot strip of a named mark across the current selection.
 *  Trims one trailing space char from the selection's end before
 *  removing — same Layer 3 formatting rule used elsewhere. */
function stripMarkInSelection(view: EditorView, markName: 'highlight' | 'shading'): void {
  const sel = view.state.selection;
  if (sel.empty) return;
  const type = schema.marks[markName];
  if (!type) return;
  let { from, to } = sel;
  if (to > from) {
    try {
      const last = view.state.doc.textBetween(to - 1, to);
      if (last.length > 0 && classifyChar(last) === 'space') to -= 1;
    } catch {
      /* range boundary — leave as-is */
    }
  }
  const tr = view.state.tr.removeMark(from, to, type);
  view.dispatch(tr);
}

/**
 * Run a paintbrush command and collapse the resulting selection to a
 * cursor at the end of the painted range. The "lift the brush" UX —
 * after mouseup, the selection disappears so the user can see what
 * they just painted without the selection highlight obscuring it.
 *
 * Captures the command's transaction (via a dispatch interceptor)
 * instead of dispatching twice, so undo treats the apply + collapse
 * as a single operation.
 */
function applyAndCollapseSelection(view: EditorView, cmd: Command): void {
  let captured: Transaction | null = null;
  const ok = cmd(view.state, (t) => { captured = t; });
  if (!ok || captured === null) return;
  const tr: Transaction = captured;
  tr.setSelection(TextSelection.create(tr.doc, tr.selection.to));
  view.dispatch(tr);
}
