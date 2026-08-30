/**
 * Ribbon tooltip controller. Centralizes tooltip text for every ribbon-side
 * button + dropdown menu item so a single setting (`ribbonTooltipMode`) governs
 * what hovering reveals, and so the displayed keyboard shortcut tracks user
 * rebinds via `ribbonKeyOverrides` automatically.
 *
 * Tooltips are drawn by a small CUSTOM renderer (one shared floating element),
 * NOT the native `title` attribute. Electron/Chromium on macOS renders native
 * `title` tooltips erratically — slow to trigger, flickery, and often absent —
 * while the same attributes are fine in a real browser, so the desktop build
 * felt broken. Rendering our own gives identical, reliable behavior everywhere.
 * Icon-only buttons still get an `aria-label` so screen readers have a name.
 *
 * The controller also ADOPTS any native `title` set elsewhere in the UI chrome
 * (find/replace, comments, dropzone, command bar, speech controls, …) the first
 * time it's hovered — moving the text into this same custom renderer and
 * stripping the flaky native attribute — so the whole app's tooltips behave
 * consistently, not just the ribbon targets that register explicitly. The
 * contenteditable document is left alone (we don't strip ProseMirror's titles).
 *
 * Modes (`settings.ribbonTooltipMode`):
 *   - `none`     — no tooltips on any ribbon target.
 *   - `tooltip`  — buttons show the action label; dropdown items show nothing
 *                  (their menu label already does).
 *   - `shortcut` — only the current shortcut, on both buttons and dropdown
 *                  items. Targets without a shortcut get no tooltip.
 *   - `both`     — buttons show `Label (Shortcut)` (or just label if no
 *                  shortcut); dropdown items show shortcut-only.
 *
 * Call sites register a target with `registerRibbonTooltip(...)`, which applies
 * the tooltip immediately. The settings subscriber calls
 * `reapplyAllRibbonTooltips()` whenever `ribbonTooltipMode` or
 * `ribbonKeyOverrides` changes so tooltips stay in sync with rebinds and mode
 * flips.
 */

import { settings } from './settings.js';
import {
  primaryKeyFor,
  formatKeyForDisplay,
  RIBBON_COMMAND_LABELS,
  type AnyCommandId,
} from './ribbon-commands.js';

export interface RibbonTooltipTarget {
  el: HTMLElement;
  /** A command id to derive both label (via RIBBON_COMMAND_LABELS) and shortcut
   *  (via primaryKeyFor + formatKeyForDisplay). Pass this for any button that
   *  maps 1:1 to a ribbon command. Plugin command ids work for the shortcut
   *  half but aren't in the static label table — pass `label` alongside. */
  commandId?: AnyCommandId;
  /** Explicit label override. Used for buttons whose tooltip text doesn't match
   *  `RIBBON_COMMAND_LABELS[commandId]` (e.g., the state-aware autosave toggle,
   *  the Paste Text button). Falls back to the command-id-derived label. */
  label?: string;
  /** A dropdown menu item rather than a top-level button. Affects `tooltip` and
   *  `both` modes: menu items never show their label (the menu already does),
   *  only the shortcut-or-nothing. */
  kind?: 'button' | 'menuItem';
}

const targets: RibbonTooltipTarget[] = [];
/** Composed tooltip text per registered element (what the custom tip shows). */
const tipText = new WeakMap<HTMLElement, string>();

export function registerRibbonTooltip(t: RibbonTooltipTarget): void {
  installController();
  // De-dup if the same element is registered twice — last one wins.
  const existing = targets.findIndex((x) => x.el === t.el);
  if (existing >= 0) targets.splice(existing, 1);
  targets.push(t);
  applyOne(t);
}

export function unregisterRibbonTooltip(el: HTMLElement): void {
  const idx = targets.findIndex((x) => x.el === el);
  if (idx >= 0) targets.splice(idx, 1);
  tipText.delete(el);
  if (hoveredEl === el || activeEl === el) hideTip();
}

export function reapplyAllRibbonTooltips(): void {
  for (const t of targets) applyOne(t);
  // A mode flip / rebind can change what's showing — clear any visible tip.
  hideTip();
}

function applyOne(t: RibbonTooltipTarget): void {
  const mode = settings.get('ribbonTooltipMode');
  const label =
    t.label ??
    (t.commandId
      ? ((RIBBON_COMMAND_LABELS as Partial<Record<string, string>>)[t.commandId] ?? '')
      : '');
  let shortcut: string | null = null;
  if (t.commandId) {
    const key = primaryKeyFor(t.commandId, settings.get('ribbonKeyOverrides'));
    if (key) shortcut = formatKeyForDisplay(key);
  }
  const kind = t.kind ?? 'button';
  const text = composeTitle(mode, kind, label, shortcut);

  // Never set the native `title` — that's the flaky path the custom
  // renderer exists to avoid.
  t.el.removeAttribute('title');

  // Custom-tooltip text (mode-dependent; empty in `none` mode → no tooltip).
  if (text) tipText.set(t.el, text);
  else tipText.delete(t.el);

  // Accessibility: with `title` stripped, an icon-only button still needs a
  // stable accessible name — give it the action label, independent of the
  // visual tooltip mode. Menu items keep their visible text as their name,
  // so leave their aria alone.
  if (kind !== 'menuItem') {
    if (label) t.el.setAttribute('aria-label', label);
    else t.el.removeAttribute('aria-label');
  }
}

function composeTitle(
  mode: 'none' | 'tooltip' | 'shortcut' | 'both',
  kind: 'button' | 'menuItem',
  label: string,
  shortcut: string | null,
): string {
  if (mode === 'none') return '';
  if (kind === 'menuItem') {
    // Menu items never repeat the label (it's already in the menu).
    return mode === 'shortcut' || mode === 'both' ? shortcut ?? '' : '';
  }
  // Top-level button.
  switch (mode) {
    case 'tooltip':
      return label;
    case 'shortcut':
      return shortcut ?? '';
    case 'both':
      if (!label) return shortcut ?? '';
      return shortcut ? `${label} (${shortcut})` : label;
  }
}

// ---- custom tooltip renderer ---------------------------------------------
//
// One shared floating element, shown after a hover delay and positioned under
// (or above, if no room) the hovered target. Delegated pointer listeners look
// up the registered target at/above the pointer, so dynamically added/removed
// buttons just work and we never attach per-element listeners.

const SHOW_DELAY_MS = 450;
let tipEl: HTMLDivElement | null = null;
let hoveredEl: HTMLElement | null = null;
let activeEl: HTMLElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;
let controllerInstalled = false;

function ensureTipEl(): HTMLDivElement {
  if (tipEl) return tipEl;
  const el = document.createElement('div');
  el.className = 'pmd-ribbon-tooltip';
  el.setAttribute('role', 'tooltip');
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  tipEl = el;
  return el;
}

function positionTip(target: HTMLElement, tip: HTMLDivElement): void {
  const r = target.getBoundingClientRect();
  const box = tip.getBoundingClientRect(); // measurable at opacity 0
  const gap = 6;
  const margin = 4;
  let left = r.left + r.width / 2 - box.width / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - box.width - margin));
  let top = r.bottom + gap;
  if (top + box.height > window.innerHeight - margin) {
    top = r.top - gap - box.height; // flip above when no room below
  }
  top = Math.max(margin, top);
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function showTip(target: HTMLElement): void {
  const text = tipText.get(target);
  if (!text || !target.isConnected) return;
  const tip = ensureTipEl();
  tip.textContent = text;
  positionTip(target, tip); // position while still transparent → no flash
  tip.classList.add('pmd-ribbon-tooltip-visible');
  tip.setAttribute('aria-hidden', 'false');
  activeEl = target;
}

function hideTip(): void {
  if (showTimer != null) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  hoveredEl = null;
  activeEl = null;
  if (tipEl) {
    tipEl.classList.remove('pmd-ribbon-tooltip-visible');
    tipEl.setAttribute('aria-hidden', 'true');
  }
}

/** The tooltip target at or above an event target: a registered ribbon target,
 *  or any UI-chrome element carrying a native `title` (which we adopt on hover —
 *  see onPointerOver). The contenteditable document keeps native behavior so we
 *  don't strip `title`s off ProseMirror-managed nodes. */
function tooltipElFor(node: EventTarget | null): HTMLElement | null {
  let el: Element | null = node instanceof Element ? node : null;
  while (el) {
    if (el instanceof HTMLElement) {
      if (tipText.has(el)) return el;
      if (el.title && !el.isContentEditable) return el;
    }
    el = el.parentElement;
  }
  return null;
}

function onPointerOver(e: PointerEvent): void {
  const el = tooltipElFor(e.target);
  if (!el || el === hoveredEl) return; // same target → don't reset the timer
  // Adopt a native `title` set directly by UI chrome (most of the app does this,
  // bypassing the controller) so it gets our reliable tooltip instead of
  // Chromium's flaky one. Re-read every hover so state-aware titles stay fresh;
  // keep an accessible name via aria-label so screen readers don't lose it.
  if (el.title) {
    const adopted = el.title;
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', adopted);
    el.removeAttribute('title');
    tipText.set(el, adopted);
  }
  // Entered a new (or first) target.
  if (showTimer != null) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  if (activeEl && activeEl !== el) hideTip();
  hoveredEl = el;
  showTimer = setTimeout(() => {
    showTimer = null;
    if (hoveredEl === el) showTip(el);
  }, SHOW_DELAY_MS);
}

function onPointerOut(e: PointerEvent): void {
  if (!hoveredEl) return;
  const t = e.target;
  if (!(t instanceof Node) || !hoveredEl.contains(t)) return; // not our subtree
  const related = e.relatedTarget;
  if (related instanceof Node && hoveredEl.contains(related)) return; // still in
  hideTip();
}

function installController(): void {
  if (controllerInstalled) return;
  controllerInstalled = true;
  document.addEventListener('pointerover', onPointerOver, true);
  document.addEventListener('pointerout', onPointerOut, true);
  // Anything that could otherwise leave a stuck or misplaced tip.
  document.addEventListener('pointerdown', hideTip, true);
  window.addEventListener('scroll', hideTip, true);
  window.addEventListener('blur', hideTip);
}
