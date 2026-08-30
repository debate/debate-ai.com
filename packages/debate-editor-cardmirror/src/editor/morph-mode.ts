/**
 * Morph mode — PROTOTYPE (dev exploration, 2026-08).
 *
 * Turns the Sensel Morph's Video Editing overlay (stock HID keymap,
 * unmodifiable without the defunct Sensel App's USB session) into a
 * card-cutting control surface by interpreting its fixed key
 * vocabulary INSIDE the editor. The overlay can't be re-mapped, but
 * we own the receiving end.
 *
 * Armed/disarmed via the `toggleMorphMode` ribbon command (command
 * bar, or bind a key in Settings — deliberately no default key:
 * Mod-Alt-m, the old dev chord, belongs to saveMarkedCards). While
 * armed:
 *
 *   - MOVEMENT IS NATIVE. The jog wheel emits arrow keys; the
 *     bottom-left modifier cluster (Ctrl/option · Shift · Alt/cmd)
 *     emits real modifiers. Hold ⇧ + wheel = letter-wise selection,
 *     ⌥⇧ + wheel = word-wise — the exact keyboard semantics. Only
 *     the wheel's multi-tick detent BURSTS are damped (sub-60ms
 *     same-direction ticks); held-key auto-repeat and human tapping
 *     pass through at their native rate.
 *
 *   - Pads that emit a plain un-modified key are BINDABLE to any
 *     ribbon command: the left 4×3 bank, Play/Pause (space), the
 *     wheel's shuttle/ring pads (◀◀ J · K · ▶▶ L · In I · Select D ·
 *     Out O), and the numpad digits (the top strip's Project/Source/…
 *     pads emit the same numpad codes as the right bank, so they
 *     share bindings). Bindings fire only while a selection is
 *     active; with a bare caret every pad types normally so tag/cite
 *     text can be written without disarming. Configured via the ⚙
 *     button on the armed pill — the dialog is a schematic of the
 *     overlay drawn with the legends PRINTED on the silicone
 *     (Insert, Overwrite, Razor, …), so it doubles as a cheat sheet
 *     for the fixed pads. Persisted in localStorage
 *     (MORPH_BINDINGS_KEY); DEFAULT_BINDINGS mirrors the classic
 *     F-key layout.
 *
 *   - UNBOUND ring letters are swallowed while a selection is active
 *     (brushing the wheel must never type over scanned text);
 *     unbound bank/numpad pads type normally.
 *
 *   - Chord pads are bindable too, matched exactly and only while a
 *     selection is active: Add Edit (⌘K), Def Trans (⌘D), Slide
 *     (⌥.). Slip / Nudge emit BARE right-side modifiers (right ⌥⌘ /
 *     right ⌘) and bind via tap-vs-hold on the AltRight/MetaRight
 *     codes — left-side modifiers (the physical cluster, normal
 *     typing) never participate. Unbound, all of these stay native
 *     (Save ⌘S, Undo ⌘Z, and the track-height arcs always do).
 *
 *   - The Zoom arc (and the top strip's Expand pad, which emits the
 *     same '=' key) → body zoom (fixed).
 *
 *   Everything else passes through untouched; disarmed, the plugin
 *   is completely inert.
 */

import { Plugin, TextSelection, type Command, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import {
  RIBBON_COMMAND_IDS,
  commandLabelFor,
  type RibbonCommandId,
} from './ribbon-commands.js';
import { pushOverlay, popOverlay, isTopOverlay } from './overlay-stack.js';

export interface MorphModeDeps {
  /** Builds a real ribbon command with the editor's live context. */
  buildCommand: (id: RibbonCommandId) => Command;
  /** Body zoom nudge in percent (positive or negative). */
  zoomBy: (deltaPct: number) => void;
}

/** What one pad does. `cmd` is a RibbonCommandId, the special string
 *  'skip', or '' for unbound. `advance` collapses the selection to
 *  its trailing edge after the command so the scan continues. */
interface PadBinding {
  cmd: string;
  advance: boolean;
}

const MORPH_BINDINGS_KEY = 'cardmirror.morphPadBindings.v1';

const DEFAULT_BINDINGS: Record<string, PadBinding> = {
  ',': { cmd: 'setPocket', advance: false },
  '.': { cmd: 'setHat', advance: false },
  m: { cmd: 'setBlock', advance: false },
  q: { cmd: 'setTag', advance: false },
  w: { cmd: 'applyCite', advance: false },
  p: { cmd: 'condenseDefault', advance: false },
  c: { cmd: 'applyHighlight', advance: true },
  v: { cmd: 'clearToNormal', advance: false },
  r: { cmd: 'applyUnderline', advance: true },
  a: { cmd: 'applyEmphasis', advance: true },
  ' ': { cmd: 'skip', advance: false },
};

/** Bindable tokens → the legend PRINTED on the overlay's silicone,
 *  used in the pill summary and as the dialog's pad titles. */
const TOKEN_NAMES: Record<string, string> = {
  ',': 'Insert', '.': 'Overwrite', m: 'Mark', q: 'Ripple Left',
  w: 'Ripple Right', p: 'Pen', c: 'Razor', v: 'Selection', r: 'Rate',
  a: 'F Select', ' ': 'Play/Pause', j: '◀◀', k: 'K', l: '▶▶',
  i: 'In', d: 'Select', o: 'Out',
  'chord:cmd+k': 'Add Edit', 'chord:cmd+d': 'Def Trans',
  'chord:alt+.': 'Slide', 'tap:metaR': 'Nudge', 'tap:altR+metaR': 'Slip',
  'num:1': '1', 'num:2': '2', 'num:3': '3', 'num:4': '4', 'num:5': '5',
  'num:6': '6', 'num:7': '7', 'num:8': '8', 'num:9': '9', 'num:0': '0',
  'num:.': '·',
};

/** Ring letters — swallowed while a selection is active unless bound,
 *  so an accidental wheel brush can't type over the scanned text. */
const RING_KEYS = new Set(['j', 'k', 'l', 'i', 'd', 'o']);

/** Normalize a keydown to a binding token ('' = not bindable). Numpad
 *  digits get their own tokens so the overlay's number pads are
 *  distinguishable from typed digit-row digits on a real keyboard. */
function bindTokenFor(event: KeyboardEvent): string {
  if (event.code.startsWith('Numpad')) {
    const rest = event.code.slice('Numpad'.length);
    if (/^\d$/.test(rest)) return `num:${rest}`;
    if (rest === 'Decimal') return 'num:.';
    return '';
  }
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

function loadBindings(): Record<string, PadBinding> {
  try {
    const raw = localStorage.getItem(MORPH_BINDINGS_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };
    const parsed = JSON.parse(raw) as Record<string, PadBinding>;
    const valid = new Set<string>(['skip', '', ...RIBBON_COMMAND_IDS]);
    const out: Record<string, PadBinding> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v.cmd === 'string' && valid.has(v.cmd)) {
        out[k] = { cmd: v.cmd, advance: !!v.advance };
      }
    }
    return out;
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

function saveBindings(b: Record<string, PadBinding>): void {
  try {
    localStorage.setItem(MORPH_BINDINGS_KEY, JSON.stringify(b));
  } catch {
    // localStorage unavailable — session-only config is fine for a prototype
  }
}

const collapseToHead: Command = (state, dispatch) => {
  const sel = state.selection;
  if (sel.empty) return true;
  if (dispatch) {
    dispatch(state.tr.setSelection(TextSelection.create(state.doc, sel.head)));
  }
  return true;
};

/** Run a stamp command over the scan selection, then collapse to the
 *  trailing edge so scanning continues without a manual reset. */
function stampAndAdvance(cmd: Command): Command {
  return (state, dispatch, view) => {
    const end = Math.max(state.selection.anchor, state.selection.head);
    const ran = cmd(state, dispatch, view);
    if (ran && view) {
      const s2: EditorState = view.state;
      const pos = Math.min(end, s2.doc.content.size);
      view.dispatch(s2.tr.setSelection(TextSelection.create(s2.doc, pos)));
    }
    return ran;
  };
}

/** Wheel damping — see header. */
const WHEEL_BURST_MS = 60;
let wheelLastPassMs = 0;
let wheelDir = 0;

/** true = swallow this tick, false = let it through natively. */
function dampWheelTick(dir: 1 | -1, event: KeyboardEvent): boolean {
  if (event.repeat) return false; // held key: native OS repeat rate
  const now = performance.now();
  if (dir === wheelDir && now - wheelLastPassMs < WHEEL_BURST_MS) {
    return true; // trailing tick of a detent burst
  }
  wheelDir = dir;
  wheelLastPassMs = now;
  return false;
}

// ---------------------------------------------------------------------------
// Config dialog — a schematic of the whole video-editing overlay, labeled
// with the legends printed on the silicone.
// ---------------------------------------------------------------------------

/** One drawn pad. `token` present = bindable; otherwise a fixed pad
 *  whose `sub` explains what it does (the cheat-sheet part). `grow`
 *  stretches the pad horizontally within its row. */
interface PadCell {
  legend: string;
  sub?: string;
  token?: string;
  grow?: number;
}

let armed = false;
let indicator: HTMLDivElement | null = null;

// Installed by the (most recent) plugin instance so the ribbon command
// can flip the chip: armed state is module-global, but the chip
// renderer lives in the plugin closure (it reads the live bindings).
let _showIndicator: ((on: boolean) => void) | null = null;

/** The `toggleMorphMode` ribbon command's implementation. */
export function toggleMorphMode(): void {
  armed = !armed;
  _showIndicator?.(armed);
}

// MODULE-level, not per-plugin-instance: multi-pane builds one plugin
// instance per pane, and a config save from one pane's chip must be
// live in every pane immediately (not after its next reconfigure).
let bindings: Record<string, PadBinding> = loadBindings();
// Compiled token → Command map, rebuilt whenever bindings change.
let grid: Record<string, Command> = {};

export function morphModePlugin(deps: MorphModeDeps): Plugin {

  function compile(): void {
    grid = {};
    for (const [key, b] of Object.entries(bindings)) {
      if (b.cmd === '') continue;
      const base: Command =
        b.cmd === 'skip' ? collapseToHead : deps.buildCommand(b.cmd as RibbonCommandId);
      grid[key] = b.advance && b.cmd !== 'skip' ? stampAndAdvance(base) : base;
    }
  }
  compile();

  function bindingName(b: PadBinding): string {
    return b.cmd === 'skip' ? 'Skip' : commandLabelFor(b.cmd as RibbonCommandId);
  }

  // The chip's echo span — shows the last fired command, like the
  // voice pill's parse echo.
  let echoEl: HTMLSpanElement | null = null;

  function setEcho(text: string): void {
    if (echoEl) echoEl.textContent = text;
  }

  function showIndicator(on: boolean): void {
    if (indicator?.parentNode) indicator.parentNode.removeChild(indicator);
    indicator = null;
    echoEl = null;
    if (!on) return;
    indicator = document.createElement('div');
    // The voice pill's classes wholesale = its exact look; the
    // command-mode accent dot doubles as the "armed" signal.
    indicator.className =
      'pmd-voice-pill pmd-voice-on pmd-voice-mode-command pmd-morph-chip';
    const dot = document.createElement('span');
    dot.className = 'pmd-voice-dot';
    const badge = document.createElement('span');
    badge.className = 'pmd-voice-mode-badge';
    badge.textContent = 'Morph';
    echoEl = document.createElement('span');
    echoEl.className = 'pmd-voice-echo';
    echoEl.textContent = 'armed';
    const gear = document.createElement('button');
    gear.type = 'button';
    gear.className = 'pmd-morph-chip-gear';
    gear.title = 'Configure Morph pads';
    gear.setAttribute('aria-label', 'Configure Morph pads');
    gear.textContent = '⚙';
    gear.addEventListener('click', openConfigDialog);
    const off = document.createElement('button');
    off.type = 'button';
    off.className = 'pmd-morph-chip-gear';
    off.title = 'Disarm Morph mode';
    off.setAttribute('aria-label', 'Disarm Morph mode');
    off.textContent = '✕';
    off.addEventListener('click', () => toggleMorphMode());
    indicator.append(dot, badge, echoEl, gear, off);
    document.body.appendChild(indicator);
  }

  function openConfigDialog(): void {
    const draft: Record<string, PadBinding> = {};
    for (const token of Object.keys(TOKEN_NAMES)) {
      draft[token] = { ...(bindings[token] ?? { cmd: '', advance: false }) };
    }
    const sortedIds = [...RIBBON_COMMAND_IDS].sort((x, y) =>
      commandLabelFor(x).localeCompare(commandLabelFor(y)),
    );
    const pickerOptions: Array<{ value: string; label: string }> = [
      { value: '', label: '— types —' },
      { value: 'skip', label: 'Skip (collapse)' },
      ...sortedIds.map((id) => ({ value: id as string, label: commandLabelFor(id) })),
    ];
    // The open command popup's close function, if any — the dialog's
    // Escape handler closes the popup first, the dialog second.
    let activePicker: (() => void) | null = null;

    const overlay = document.createElement('div');
    overlay.className = 'pmd-route-overlay';
    const panel = document.createElement('div');
    panel.className = 'pmd-route-dialog pmd-morph-dialog';

    const header = document.createElement('div');
    header.className = 'pmd-route-header';
    header.textContent = 'Morph — video editing overlay';
    const intro = document.createElement('div');
    intro.className = 'pmd-morph-intro';
    intro.textContent =
      'Drawn like the overlay, labeled like the overlay. Purple pads are rebindable ' +
      'and fire only while a selection is active (bare caret = pads type normally). ' +
      'Gray pads are fixed — the small text says what they do. “↩ scan” collapses ' +
      'the selection to its end after the command. Unbound wheel pads are ignored ' +
      'during a selection so brushing the wheel can’t type over scanned text; ' +
      'unbound number pads just type.';
    panel.append(header, intro);

    function fixedPad(cell: PadCell): HTMLDivElement {
      const el = document.createElement('div');
      el.className = 'pmd-morph-pad pmd-morph-pad-fixed';
      el.style.flexGrow = String(cell.grow ?? 1);
      const t = document.createElement('div');
      t.className = 'pmd-morph-pad-legend';
      t.textContent = cell.legend;
      el.appendChild(t);
      if (cell.sub) {
        const s = document.createElement('div');
        s.className = 'pmd-morph-pad-sub';
        s.textContent = cell.sub;
        el.appendChild(s);
      }
      return el;
    }

    /** Searchable command popup, anchored under (or over) the clicked
     *  binding value. Substring-filters labels as you type; ↑/↓ +
     *  Enter picks, Escape / outside click / dialog scroll closes. */
    function openPicker(
      anchor: HTMLElement,
      current: string,
      apply: (v: string) => void,
    ): void {
      activePicker?.();
      const pop = document.createElement('div');
      pop.className = 'pmd-morph-picker';
      const rect = anchor.getBoundingClientRect();
      const width = Math.max(rect.width, 260);
      pop.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
      pop.style.width = `${width}px`;
      const below = window.innerHeight - rect.bottom;
      if (below < 200) {
        pop.style.bottom = `${window.innerHeight - rect.top + 4}px`;
        pop.style.maxHeight = `${Math.min(300, rect.top - 12)}px`;
      } else {
        pop.style.top = `${rect.bottom + 4}px`;
        pop.style.maxHeight = `${Math.min(300, below - 12)}px`;
      }
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'pmd-morph-picker-input';
      input.placeholder = 'Type to search…';
      const listEl = document.createElement('div');
      listEl.className = 'pmd-morph-picker-list';
      pop.append(input, listEl);

      let filtered = pickerOptions;
      let active = Math.max(0, pickerOptions.findIndex((o) => o.value === current));

      const closePicker = (): void => {
        pop.remove();
        document.removeEventListener('mousedown', onOutside, true);
        panel.removeEventListener('scroll', closePicker, true);
        activePicker = null;
      };
      const onOutside = (e: MouseEvent): void => {
        if (!pop.contains(e.target as Node)) closePicker();
      };

      function renderList(): void {
        listEl.innerHTML = '';
        if (filtered.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'pmd-morph-picker-empty';
          empty.textContent = 'No matching commands';
          listEl.appendChild(empty);
          return;
        }
        filtered.forEach((o, i) => {
          const item = document.createElement('div');
          item.className =
            'pmd-morph-picker-item' +
            (i === active ? ' pmd-morph-picker-active' : '') +
            (o.value === current ? ' pmd-morph-picker-current' : '');
          item.textContent = o.label;
          item.title = o.label;
          item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            apply(o.value);
            closePicker();
          });
          listEl.appendChild(item);
        });
        (listEl.children[active] as HTMLElement | undefined)?.scrollIntoView({
          block: 'nearest',
        });
      }

      input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        filtered = q
          ? pickerOptions.filter((o) => o.label.toLowerCase().includes(q))
          : pickerOptions;
        active = 0;
        renderList();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          active = Math.min(active + 1, filtered.length - 1);
          renderList();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          active = Math.max(active - 1, 0);
          renderList();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const o = filtered[active];
          if (o) { apply(o.value); closePicker(); }
        }
      });

      document.addEventListener('mousedown', onOutside, true);
      panel.addEventListener('scroll', closePicker, true);
      document.body.appendChild(pop);
      activePicker = closePicker;
      renderList();
      input.focus();
    }

    function bindPad(cell: PadCell): HTMLDivElement {
      const token = cell.token!;
      const entry = draft[token] ?? (draft[token] = { cmd: '', advance: false });
      const el = document.createElement('div');
      el.className = 'pmd-morph-pad pmd-morph-pad-bind';
      el.style.flexGrow = String(cell.grow ?? 1);
      const t = document.createElement('div');
      t.className = 'pmd-morph-pad-legend';
      t.textContent = cell.legend;
      el.appendChild(t);
      if (cell.sub) {
        const s = document.createElement('div');
        s.className = 'pmd-morph-pad-sub';
        s.textContent = cell.sub;
        el.appendChild(s);
      }
      // Wrapping value display — a bare <select> clips long command
      // labels to one cramped line. Clicking opens the searchable
      // command popup.
      const valueWrap = document.createElement('div');
      valueWrap.className = 'pmd-morph-bind-value';
      valueWrap.tabIndex = 0;
      const valueText = document.createElement('span');
      valueText.className = 'pmd-morph-bind-value-text';
      const refreshValue = (): void => {
        valueText.textContent =
          entry.cmd === '' ? '— types —'
          : entry.cmd === 'skip' ? 'Skip (collapse)'
          : commandLabelFor(entry.cmd as RibbonCommandId);
        valueWrap.classList.toggle('pmd-morph-unbound', entry.cmd === '');
      };
      refreshValue();
      valueWrap.appendChild(valueText);
      const advLabel = document.createElement('label');
      advLabel.className = 'pmd-morph-adv';
      advLabel.title =
        'Collapse the selection to its end after the command (stamp-and-continue)';
      const adv = document.createElement('input');
      adv.type = 'checkbox';
      adv.checked = entry.advance;
      adv.disabled = entry.cmd === '' || entry.cmd === 'skip';
      advLabel.append(adv, document.createTextNode('↩ scan'));
      const applyPick = (v: string): void => {
        entry.cmd = v;
        adv.disabled = v === '' || v === 'skip';
        refreshValue();
      };
      valueWrap.addEventListener('mousedown', (e) => {
        e.preventDefault();
        openPicker(valueWrap, entry.cmd, applyPick);
      });
      valueWrap.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker(valueWrap, entry.cmd, applyPick);
        }
      });
      adv.addEventListener('change', () => { entry.advance = adv.checked; });
      el.append(valueWrap, advLabel);
      return el;
    }

    function row(cells: PadCell[]): HTMLDivElement {
      const r = document.createElement('div');
      r.className = 'pmd-morph-row';
      for (const c of cells) r.appendChild(c.token ? bindPad(c) : fixedPad(c));
      return r;
    }

    function zone(title: string, rows: HTMLDivElement[], grow = 1): HTMLDivElement {
      const z = document.createElement('div');
      z.className = 'pmd-morph-zone';
      z.style.flexGrow = String(grow);
      z.style.flexBasis = '0';
      const t = document.createElement('div');
      t.className = 'pmd-morph-zone-title';
      t.textContent = title;
      z.appendChild(t);
      for (const r of rows) z.appendChild(r);
      return z;
    }

    // --- Top strip (printed: Save … Delete) ------------------------------
    panel.appendChild(zone('Top strip', [row([
      { legend: 'Save', sub: '⌘S · native' },
      { legend: 'Undo', sub: '⌘Z · native' },
      { legend: 'Redo', sub: '⇧Z · native' },
      { legend: 'Project', sub: '= pad “1”' },
      { legend: 'Source', sub: '= pad “2”' },
      { legend: 'Program', sub: '= pad “4”' },
      { legend: 'Timeline', sub: '= pad “3”' },
      { legend: 'Effect Ctrl', sub: '= pad “5”' },
      { legend: 'Expand', sub: 'zoom + · fixed' },
      { legend: 'Tab', sub: 'native' },
      { legend: 'Ripple Del', sub: 'delete · native' },
      { legend: 'Delete', sub: 'delete · native' },
    ])]));

    // --- Main area: left bank | jog wheel | right bank -------------------
    const main = document.createElement('div');
    main.className = 'pmd-morph-zones';

    main.appendChild(zone('Left bank', [
      row([
        { legend: 'Insert', token: ',' },
        { legend: 'Overwrite', token: '.' },
        { legend: 'Mark', token: 'm' },
      ]),
      row([
        { legend: 'Ripple Left', token: 'q' },
        { legend: 'Add Edit', token: 'chord:cmd+k' },
        { legend: 'Ripple Right', token: 'w' },
      ]),
      row([
        { legend: 'Pen', token: 'p' },
        { legend: 'Razor', token: 'c' },
        { legend: 'Selection', token: 'v' },
      ]),
      row([
        { legend: 'Def Trans', token: 'chord:cmd+d' },
        { legend: 'Rate', token: 'r' },
        { legend: 'F Select', token: 'a' },
      ]),
      row([
        { legend: 'Slip', token: 'tap:altR+metaR' },
        { legend: 'Slide', token: 'chord:alt+.' },
        { legend: 'Nudge', token: 'tap:metaR' },
      ]),
      row([
        { legend: 'Ctrl option', sub: 'hold: modifier' },
        { legend: 'Shift', sub: 'hold + wheel: select' },
        { legend: 'Alt cmd', sub: 'hold + wheel: word' },
      ]),
    ], 3));

    main.appendChild(zone('Jog wheel', [
      row([
        { legend: 'Video', sub: '⌘0 · native' },
        { legend: 'Prev', sub: '⇧⌘M · native' },
        { legend: 'Home', sub: 'native' },
        { legend: 'End', sub: 'native' },
        { legend: 'Next', sub: '⇧M · native' },
        { legend: 'Audio', sub: '⌘9 · native' },
      ]),
      row([
        { legend: 'Video ⌶', sub: 'track height arc · ⌘= ⌘− · native' },
        { legend: '◀◀', token: 'j' },
        { legend: 'WHEEL', sub: '← → scan · hold ⇧ / ⌥⇧ selects · burst-damped', grow: 2 },
        { legend: '▶▶', token: 'l' },
        { legend: 'Audio ⌶', sub: 'track height arc · ⌥= ⌥− · native' },
      ]),
      row([
        { legend: 'In', token: 'i' },
        { legend: 'K', token: 'k' },
        { legend: 'Select', token: 'd' },
        { legend: 'Deselect', sub: '⇧⌘A · native' },
        { legend: 'Out', token: 'o' },
      ]),
      row([
        { legend: '🔍− Zoom', sub: 'arc · fixed: body zoom out' },
        { legend: 'Zoom 🔍+', sub: 'arc · fixed: body zoom in' },
      ]),
      row([{ legend: 'Play/Pause', token: ' ', grow: 1 }]),
      row([{ legend: 'Navigate', sub: 'scroll strip · native document scroll', grow: 1 }]),
    ], 5));

    main.appendChild(zone('Right bank', [
      row([
        { legend: '7', token: 'num:7' },
        { legend: '8', token: 'num:8' },
        { legend: '9', token: 'num:9' },
      ]),
      row([
        { legend: '4', token: 'num:4' },
        { legend: '5', token: 'num:5' },
        { legend: '6', token: 'num:6' },
      ]),
      row([
        { legend: '1', token: 'num:1' },
        { legend: '2', token: 'num:2' },
        { legend: '3', token: 'num:3' },
      ]),
      row([
        { legend: '0', token: 'num:0' },
        { legend: '·', token: 'num:.' },
        { legend: 'Enter', sub: 'native' },
      ]),
      row([
        { legend: 'Volume Dn', sub: 'system' },
        { legend: '▲', sub: 'native' },
        { legend: 'Volume Up', sub: 'system' },
      ]),
      row([
        { legend: '◀', sub: '= wheel tick' },
        { legend: '▼', sub: 'native' },
        { legend: '▶', sub: '= wheel tick' },
      ]),
    ], 3));

    panel.appendChild(main);

    // --- Buttons ---------------------------------------------------------
    const buttons = document.createElement('div');
    buttons.className = 'pmd-text-prompt-buttons';
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'pmd-route-cancel';
    resetBtn.textContent = 'Reset to defaults';
    resetBtn.style.marginRight = 'auto';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'pmd-route-cancel';
    cancelBtn.textContent = 'Cancel';
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'pmd-text-prompt-ok';
    saveBtn.textContent = 'Save';

    const overlayToken = pushOverlay();
    const close = (): void => {
      activePicker?.();
      overlay.remove();
      popOverlay(overlayToken);
      document.removeEventListener('keydown', onEsc, true);
    };
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isTopOverlay(overlayToken)) {
        e.stopPropagation();
        // Escape peels one layer: the command popup first, then the
        // dialog.
        if (activePicker) activePicker();
        else close();
      }
    };
    resetBtn.addEventListener('click', () => {
      close();
      bindings = { ...DEFAULT_BINDINGS };
      saveBindings(bindings);
      compile();
      showIndicator(armed);
    });
    cancelBtn.addEventListener('click', close);
    saveBtn.addEventListener('click', () => {
      close();
      bindings = draft;
      saveBindings(bindings);
      compile();
      showIndicator(armed); // refresh the pill's summary
    });
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', onEsc, true);
    buttons.append(resetBtn, cancelBtn, saveBtn);
    panel.appendChild(buttons);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    saveBtn.focus();
  }

  // Tap-vs-hold detection for the Slip/Nudge pads, which emit bare
  // RIGHT-side modifiers (right ⌥⌘ together / right ⌘ alone). The
  // physical modifier cluster and normal typing use the LEFT codes, so
  // only AltRight/MetaRight participate: a clean tap (no other key or
  // mouse press during the hold, released within TAP_MAX_MS) fires the
  // pad's binding; any chord use stays a real modifier.
  const TAP_MAX_MS = 400;
  const heldRight = new Set<string>();
  let tapPure = false;
  let tapSawBoth = false;
  let tapDownMs = 0;

  function runPad(token: string, view: EditorView): boolean {
    const cmd = grid[token];
    if (!cmd) return false;
    cmd(view.state, view.dispatch, view);
    const b = bindings[token];
    if (b) setEcho(bindingName(b));
    return true;
  }

  _showIndicator = showIndicator;

  return new Plugin({
    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent) {
        if (!armed) return false;

        if (event.code === 'AltRight' || event.code === 'MetaRight') {
          if (!event.repeat) {
            if (heldRight.size === 0) {
              tapPure = true;
              tapSawBoth = false;
              tapDownMs = performance.now();
            }
            heldRight.add(event.code);
            if (heldRight.size === 2) tapSawBoth = true;
          }
          return false; // always also behaves as a real modifier
        }
        // Any other key during a right-modifier hold makes it a chord.
        if (heldRight.size > 0) tapPure = false;

        if (event.key === 'ArrowRight') return dampWheelTick(1, event);
        if (event.key === 'ArrowLeft') return dampWheelTick(-1, event);

        // Chord pads (Add Edit ⌘K · Def Trans ⌘D · Slide ⌥.) — matched
        // exactly, and only while a selection is active; unbound (or
        // caretted) they stay native.
        if (!view.state.selection.empty && !event.ctrlKey && !event.shiftKey) {
          const cmdOnly = event.metaKey && !event.altKey;
          const altOnly = event.altKey && !event.metaKey;
          if (cmdOnly && event.code === 'KeyK' && runPad('chord:cmd+k', view)) return true;
          if (cmdOnly && event.code === 'KeyD' && runPad('chord:cmd+d', view)) return true;
          if (altOnly && event.code === 'Period' && runPad('chord:alt+.', view)) return true;
        }

        // Everything below is plain-key only — remaining modifier
        // chords (⌥⇧-wheel, ⌘C, …) stay native.
        if (event.metaKey || event.ctrlKey || event.altKey) return false;

        if (event.key === '-') { deps.zoomBy(-10); setEcho('Zoom out'); return true; }
        if (event.key === '=') { deps.zoomBy(10); setEcho('Zoom in'); return true; }

        // Bare caret = typing mode: pads type their letters so tag
        // and cite text can be written without disarming.
        if (view.state.selection.empty) return false;

        const token = bindTokenFor(event);
        // consume on success — never type over the selection
        if (token && runPad(token, view)) return true;
        if (RING_KEYS.has(token)) return true; // unbound ring brush: swallow
        return false;
      },
      handleDOMEvents: {
        keyup(view: EditorView, event: KeyboardEvent) {
          if (!armed) return false;
          if (event.code !== 'AltRight' && event.code !== 'MetaRight') return false;
          const wasMeta = event.code === 'MetaRight';
          heldRight.delete(event.code);
          if (heldRight.size > 0) return false; // wait for the full release
          const held = performance.now() - tapDownMs;
          if (tapPure && held <= TAP_MAX_MS && !view.state.selection.empty) {
            if (tapSawBoth) runPad('tap:altR+metaR', view);
            else if (wasMeta) runPad('tap:metaR', view);
          }
          return false;
        },
        // A click mid-hold (right-⌘-click etc.) is a chord, not a tap.
        mousedown() {
          tapPure = false;
          return false;
        },
      },
    },
    view() {
      // Plugin sets rebuild on every reconfigure (settings changes,
      // plugin-command registration, pane focus churn in multi-pane).
      // The armed state is module-global ON PURPOSE so those rebuilds
      // don't silently disarm: re-show the chip on construction, hide
      // it on destroy, and never touch `armed` from lifecycle.
      _showIndicator = showIndicator;
      if (armed) showIndicator(true);
      return {
        destroy() {
          // Only tidy the chip when disarmed: in multi-pane, one
          // pane's teardown must not hide the chip for the others.
          if (!armed && indicator?.parentNode) {
            indicator.parentNode.removeChild(indicator);
            indicator = null;
          }
        },
      };
    },
  });
}
