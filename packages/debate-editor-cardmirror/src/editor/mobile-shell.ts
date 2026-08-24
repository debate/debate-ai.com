/**
 * Mobile shell — view-first chrome for phones and tablets on the web
 * edition (SPEC-mobile-view.md). Mounted at boot by editor/index.ts
 * when `resolveMobileLayout` picks mobile; rides the single-doc
 * machinery (same mountView, open/save flows, recovery, home screen)
 * rather than running its own editor.
 *
 * Structure:
 *   app bar     ☰ title ↶ ↷ Aa ⋮
 *   #app        the existing single-doc scroller (PM view inside,
 *               never editable — see mobile-plugin.ts)
 *   mode bar    Read / Move / Repair mode toggles
 *   #status-bar the existing footer, restyled by mobile CSS
 *
 * The outline drawer hosts the SAME NavigationPanel instance the
 * desktop sidebar uses — its mount element (#nav-panel) is relocated
 * into the drawer, so caret tracking, level filters, and
 * click-to-jump keep working unchanged.
 */

import { TextSelection } from 'prosemirror-state';
import { confirmDialog } from './text-prompt.js';
import { settings, ZOOM_MIN_PCT, ZOOM_MAX_PCT } from './settings.js';
import { getActiveView, getNavPanel, runRibbon, getLiveZoomPct, setLiveZoomPct } from './index.js';
import { readModeAwareUndo, readModeAwareRedo } from './read-mode-plugin.js';
import { mobileDensity } from './mobile-layout.js';
import {
  setMobileTapMode,
  onMobileUnitTapped,
  setMobileUnitSelection,
  type MobileTapMode,
} from './mobile-plugin.js';
import {
  moveInsertPos,
  entryUnitRange,
  unitRangeAtPos,
  executeUnitMove,
  type UnitRange,
} from './structural-move.js';
import { preciseScrollIntoView } from './precise-scroll.js';
import { aiConfigured } from './ai/llm.js';
import { showToast } from './toast.js';

const ZOOM_MIN = ZOOM_MIN_PCT;
const ZOOM_MAX = ZOOM_MAX_PCT;

let mounted = false;
let drawerApi: { open: () => void; close: () => void } | null = null;

export function mountMobileShell(): void {
  if (mounted) return;
  mounted = true;
  document.body.classList.add('pmd-mobile', `pmd-mobile-${mobileDensity(window.innerWidth)}`);

  const appBar = buildAppBar();
  document.body.insertBefore(appBar, document.body.firstChild);
  const { drawer, scrim, openDrawer, closeDrawer } = buildDrawer();
  drawerApi = { open: openDrawer, close: closeDrawer };
  document.body.appendChild(scrim);
  document.body.appendChild(drawer);
  document.body.appendChild(buildModeBar());
  document.body.appendChild(buildMoveSheet());
  document.body.appendChild(buildRepairSheet());
  onMobileUnitTapped(handleUnitTapped);
  installPinchZoom();
  installEdgeSwipe(openDrawer);

  // ☰ in the app bar: phone toggles the overlay drawer; tablet
  // collapses / restores the persistent rail.
  appBar.querySelector<HTMLButtonElement>('.pmd-mappbar-drawer')!
    .addEventListener('click', () => {
      if (document.body.classList.contains('pmd-mobile-tablet')) {
        document.body.classList.toggle('pmd-mobile-rail-collapsed');
        return;
      }
      if (document.body.classList.contains('pmd-mobile-drawer-open')) closeDrawer();
      else openDrawer();
    });
}

// ─── App bar ───────────────────────────────────────────────────────

function buildAppBar(): HTMLElement {
  const bar = document.createElement('header');
  bar.className = 'pmd-mobile-appbar';

  const drawerBtn = iconButton('☰', 'Outline', 'pmd-mappbar-drawer');
  bar.appendChild(drawerBtn);

  const title = document.createElement('span');
  title.className = 'pmd-mappbar-title';
  bar.appendChild(title);
  syncTitle(title);

  // Undo / redo are permanent app-bar residents (markers, moves and
  // repairs all live in PM history); a no-op tap is harmless, so no
  // enabled-state tracking is needed.
  const undoBtn = iconButton('↶', 'Undo', 'pmd-mappbar-undo');
  undoBtn.addEventListener('click', () => {
    const view = getActiveView();
    if (view) readModeAwareUndo(view.state, view.dispatch.bind(view), view);
  });
  bar.appendChild(undoBtn);
  const redoBtn = iconButton('↷', 'Redo', 'pmd-mappbar-redo');
  redoBtn.addEventListener('click', () => {
    const view = getActiveView();
    if (view) readModeAwareRedo(view.state, view.dispatch.bind(view), view);
  });
  bar.appendChild(redoBtn);

  const displayBtn = iconButton('Aa', 'Display options', 'pmd-mappbar-display');
  displayBtn.addEventListener('click', () => toggleSheet(buildDisplaySheet));
  bar.appendChild(displayBtn);

  const menuBtn = iconButton('⋮', 'Menu', 'pmd-mappbar-menu');
  menuBtn.addEventListener('click', () => toggleSheet(buildOverflowSheet));
  bar.appendChild(menuBtn);

  return bar;
}

/** Mirror the window title (sans app suffix) into the app bar. The
 *  single-doc title flow already maintains document.title on every
 *  open/save/dirty change; observing it avoids new exports. */
function syncTitle(el: HTMLSpanElement): void {
  const apply = (): void => {
    el.textContent = document.title.replace(/\s*[—-]\s*CardMirror\s*$/, '') || 'CardMirror';
  };
  apply();
  const titleEl = document.querySelector('title');
  if (titleEl) {
    new MutationObserver(apply).observe(titleEl, { childList: true });
  }
}

function iconButton(glyph: string, label: string, cls: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `pmd-mappbar-btn ${cls}`;
  btn.textContent = glyph;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  return btn;
}

// ─── Outline drawer ────────────────────────────────────────────────

function buildDrawer(): {
  drawer: HTMLElement;
  scrim: HTMLElement;
  openDrawer: () => void;
  closeDrawer: () => void;
} {
  const drawer = document.createElement('div');
  drawer.className = 'pmd-mobile-drawer';
  const scrim = document.createElement('div');
  scrim.className = 'pmd-mobile-scrim';

  // Adopt the desktop nav mount point wholesale — the NavigationPanel
  // instance inside keeps its EditorView attachment and caret sync.
  const navEl = document.getElementById('nav-panel');
  if (navEl) drawer.appendChild(navEl);
  // The drawer must never be emptied by the desktop "hide nav pane"
  // toggle; visibility is the drawer's own open/closed state.
  settings.set('navPaneVisible', true);

  const openDrawer = (): void => {
    document.body.classList.add('pmd-mobile-drawer-open');
    // "Send to…" (and anything else that needs the outline) must be
    // able to surface a collapsed tablet rail.
    document.body.classList.remove('pmd-mobile-rail-collapsed');
  };
  const closeDrawer = (): void => {
    document.body.classList.remove('pmd-mobile-drawer-open');
    // Dismissing the drawer always cancels a pending "Send to…" —
    // idempotent when none is active.
    destModeActive = false;
    getNavPanel().exitDestinationMode();
  };
  scrim.addEventListener('click', closeDrawer);
  // Jumping somewhere is the end of a navigation — dismiss (overlay
  // densities only; the tablet rail stays put via CSS, where this
  // class toggle has no effect). In destination mode the Send-to
  // callback owns the drawer: an invalid target keeps it open.
  drawer.addEventListener('click', (e) => {
    if (destModeActive) return;
    if ((e.target as HTMLElement).closest('.pmd-nav-item')) {
      window.setTimeout(closeDrawer, 120);
    }
  });
  return { drawer, scrim, openDrawer, closeDrawer };
}

/** Left-edge swipe opens the drawer (phone density). */
function installEdgeSwipe(openDrawer: () => void): void {
  let startX = -1;
  let startY = -1;
  let pointerId = -1;
  window.addEventListener('pointerdown', (e) => {
    if (e.clientX > 24) return;
    startX = e.clientX;
    startY = e.clientY;
    pointerId = e.pointerId;
  });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = Math.abs(e.clientY - startY);
    if (dx > 36 && dy < 48) {
      pointerId = -1;
      openDrawer();
    }
  });
  window.addEventListener('pointerup', () => {
    pointerId = -1;
  });
}

// ─── Mode bar ──────────────────────────────────────────────────────

function buildModeBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'pmd-mobile-modebar';

  const readBtn = document.createElement('button');
  readBtn.type = 'button';
  readBtn.className = 'pmd-mobile-mode-btn pmd-mobile-mode-read';
  readBtn.textContent = '◉ Read';
  readBtn.title = 'Read mode — highlights and cites only; tap text to drop a reading marker';
  const syncRead = (): void => {
    readBtn.classList.toggle('pmd-mode-active', settings.get('readMode'));
  };
  syncRead();
  settings.subscribe(syncRead);
  readBtn.addEventListener('click', () => {
    // Read and the tap-select modes are mutually exclusive — both
    // claim the tap.
    if (!settings.get('readMode') && tapMode !== 'none') setTapMode('none');
    runRibbon('toggleReadMode');
  });
  bar.appendChild(readBtn);

  moveBtn = document.createElement('button');
  moveBtn.type = 'button';
  moveBtn.className = 'pmd-mobile-mode-btn pmd-mobile-mode-move';
  moveBtn.textContent = '✥ Move';
  moveBtn.title = 'Move mode — tap a card or heading to pick it up';
  moveBtn.addEventListener('click', () => setTapMode(tapMode === 'move' ? 'none' : 'move'));
  bar.appendChild(moveBtn);

  repairBtn = document.createElement('button');
  repairBtn.type = 'button';
  repairBtn.className = 'pmd-mobile-mode-btn pmd-mobile-mode-repair';
  repairBtn.textContent = '✦ Repair';
  repairBtn.title = 'AI repair — tap a card or heading to choose the scope';
  repairBtn.addEventListener('click', () =>
    setTapMode(tapMode === 'repair' ? 'none' : 'repair'),
  );
  bar.appendChild(repairBtn);

  return bar;
}

// ─── Tap-select modes (Move / Repair) ──────────────────────────────

let tapMode: MobileTapMode = 'none';
let moveBtn: HTMLButtonElement | null = null;
let repairBtn: HTMLButtonElement | null = null;
let moveSheet: HTMLElement | null = null;
let moveSheetLabel: HTMLElement | null = null;
let repairSheet: HTMLElement | null = null;
let repairSheetLabel: HTMLElement | null = null;
let repairBusy = false;
let currentUnit: UnitRange | null = null;
let destModeActive = false;

function setTapMode(mode: MobileTapMode): void {
  const view = getActiveView();
  if (!view) return;
  tapMode = mode;
  moveBtn?.classList.toggle('pmd-mode-active', mode === 'move');
  repairBtn?.classList.toggle('pmd-mode-active', mode === 'repair');
  setMobileTapMode(view, mode);
  currentUnit = null;
  hideMoveSheet();
  hideRepairSheet();
  cancelDestinationMode();
  if (mode === 'none') return;
  // Both modes dispatch doc edits; read mode locks them (and owns taps).
  if (settings.get('readMode')) runRibbon('toggleReadMode');
  showToast(
    mode === 'move'
      ? 'Tap a card or heading to pick it up'
      : 'Tap a card to choose what to repair',
  );
}

function handleUnitTapped(unit: UnitRange | null): void {
  currentUnit = unit;
  if (!unit) {
    hideMoveSheet();
    hideRepairSheet();
    // In Repair mode a heading tap resolves to no unit on purpose —
    // say why instead of silently doing nothing.
    if (tapMode === 'repair') showToast('Tap a card — repairs run one card at a time');
    return;
  }
  if (tapMode === 'repair') showRepairSheet(unit);
  else showMoveSheet(unit);
}

function buildMoveSheet(): HTMLElement {
  const sheet = document.createElement('div');
  sheet.className = 'pmd-mobile-movesheet';
  sheet.hidden = true;
  moveSheet = sheet;

  moveSheetLabel = document.createElement('div');
  moveSheetLabel.className = 'pmd-mobile-movesheet-label';
  sheet.appendChild(moveSheetLabel);

  const row = document.createElement('div');
  row.className = 'pmd-mobile-movesheet-actions';
  const action = (
    label: string,
    title: string,
    run: () => void,
    cls = '',
  ): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pmd-mobile-movesheet-btn ${cls}`;
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('click', run);
    row.appendChild(btn);
    return btn;
  };
  action('▲ Up', 'Move one step up', () => moveStep(-1));
  action('▼ Down', 'Move one step down', () => moveStep(1));
  action('⇪ Send to…', 'Pick a destination in the outline', startSendTo);
  action('⧉ Copy', 'Copy to the clipboard', copyUnit);
  action('⌫ Delete', 'Delete', () => void deleteUnit(), 'pmd-movesheet-danger');
  action('✕', 'Put down (stay in Move mode)', () => {
    const view = getActiveView();
    if (view) setMobileUnitSelection(view, null);
    currentUnit = null;
    hideMoveSheet();
  });
  sheet.appendChild(row);
  return sheet;
}

function showMoveSheet(unit: UnitRange): void {
  if (!moveSheet || !moveSheetLabel) return;
  const label = unit.label.trim() || '(untitled)';
  moveSheetLabel.textContent = `${unit.type === 'card' || unit.type === 'analytic_unit' ? 'Card' : unit.type[0]!.toUpperCase() + unit.type.slice(1)} — ${label}`;
  moveSheet.hidden = false;
}

function hideMoveSheet(): void {
  if (moveSheet) moveSheet.hidden = true;
}

/** After a successful move the transaction parks the selection at the
 *  top of the landed content — re-derive the unit there so the
 *  highlight and the sheet follow it. */
function reselectMovedUnit(view: NonNullable<ReturnType<typeof getActiveView>>): void {
  const unit = unitRangeAtPos(view.state.doc, view.state.selection.from);
  currentUnit = unit;
  setMobileUnitSelection(view, unit);
  if (unit) {
    showMoveSheet(unit);
    const dom = view.nodeDOM(unit.from);
    if (dom instanceof HTMLElement) preciseScrollIntoView(view, dom);
  } else {
    hideMoveSheet();
  }
}

function moveStep(dir: -1 | 1): void {
  const view = getActiveView();
  if (!view || !currentUnit) return;
  const insertPos = moveInsertPos(view.state.doc, currentUnit, dir);
  if (insertPos === null) {
    showToast(dir === -1 ? 'Already at the top' : 'Already at the bottom');
    return;
  }
  if (!executeUnitMove(view, currentUnit, insertPos)) {
    showToast("Can't move there");
    return;
  }
  reselectMovedUnit(view);
}

function startSendTo(): void {
  if (!currentUnit) return;
  destModeActive = true;
  getNavPanel().enterDestinationMode((entry, anchor) => {
    const view = getActiveView();
    if (!view || !currentUnit) {
      cancelDestinationMode();
      drawerApi?.close();
      return;
    }
    const target = entryUnitRange(view.state.doc, entry);
    if (!target) {
      showToast("Can't drop there — pick another row");
      return; // stay in destination mode
    }
    // Target inside (or identical to) the moved unit: nonsense move.
    if (target.from >= currentUnit.from && target.from < currentUnit.to) {
      showToast("Can't move a section next to itself");
      return;
    }
    showPlacementChooser(target, anchor);
  });
  drawerApi?.open();
  showToast('Tap a destination in the outline');
}

/** Above/below chooser — "Send to…" NEVER places a unit inside the
 *  target (inserting after a same-level heading's line would strand
 *  the target's own content under the moved unit); the tap picks the
 *  neighbor, this picks the side. Press-slide-release onto a choice
 *  works as well as two taps: the commit listens for pointerup over
 *  either button at the document level. */
let placementPop: HTMLElement | null = null;

function showPlacementChooser(target: UnitRange, anchor: DOMRect | null): void {
  hidePlacementChooser();
  const pop = document.createElement('div');
  pop.className = 'pmd-mobile-place-pop';
  placementPop = pop;

  const label = document.createElement('div');
  label.className = 'pmd-mobile-place-label';
  label.textContent = target.label.trim() || '(untitled)';
  const mk = (text: string, insertPos: number, cls: string): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pmd-mobile-place-btn ${cls}`;
    btn.textContent = text;
    btn.dataset['insertPos'] = String(insertPos);
    return btn;
  };
  pop.appendChild(mk('▲ Place above', target.from, 'pmd-place-above'));
  pop.appendChild(label);
  pop.appendChild(mk('▼ Place below', target.to, 'pmd-place-below'));
  document.body.appendChild(pop);

  // Anchor beside the tapped row, clamped to the viewport.
  if (anchor) {
    const popH = pop.offsetHeight || 120;
    const top = Math.max(
      8,
      Math.min(anchor.top + anchor.height / 2 - popH / 2, window.innerHeight - popH - 8),
    );
    pop.style.top = `${Math.round(top)}px`;
    pop.style.left = `${Math.round(Math.min(anchor.right + 8, window.innerWidth - pop.offsetWidth - 8))}px`;
  } else {
    pop.style.top = '40%';
    pop.style.left = '50%';
    pop.style.transform = 'translateX(-50%)';
  }

  // Commit on release over a button (covers tap AND press-slide-
  // release); dismiss on release anywhere else.
  const onUp = (e: PointerEvent): void => {
    const el = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest('.pmd-mobile-place-btn') as HTMLButtonElement | null;
    if (el && placementPop?.contains(el)) {
      document.removeEventListener('pointerup', onUp);
      commitSendTo(Number(el.dataset['insertPos']));
      return;
    }
    if (!placementPop?.contains(e.target as Node)) {
      document.removeEventListener('pointerup', onUp);
      hidePlacementChooser(); // stay in destination mode for another pick
    }
  };
  // Defer past the pointerup that opened the chooser.
  window.setTimeout(() => document.addEventListener('pointerup', onUp), 0);
}

function hidePlacementChooser(): void {
  placementPop?.remove();
  placementPop = null;
}

function commitSendTo(insertPos: number): void {
  hidePlacementChooser();
  const view = getActiveView();
  if (!view || !currentUnit || !Number.isFinite(insertPos)) return;
  if (!executeUnitMove(view, currentUnit, insertPos)) {
    showToast("Can't move there");
    return;
  }
  destModeActive = false;
  drawerApi?.close(); // also exits destination mode
  reselectMovedUnit(view);
  showToast('Moved — ↶ to undo');
}

function cancelDestinationMode(): void {
  destModeActive = false;
  getNavPanel().exitDestinationMode();
  hidePlacementChooser();
}

// ─── Repair sheet (AI text / formatting repair on the unit) ───────

function buildRepairSheet(): HTMLElement {
  const sheet = document.createElement('div');
  sheet.className = 'pmd-mobile-movesheet pmd-mobile-repairsheet';
  sheet.hidden = true;
  repairSheet = sheet;
  repairSheetLabel = document.createElement('div');
  repairSheetLabel.className = 'pmd-mobile-movesheet-label';
  sheet.appendChild(repairSheetLabel);
  const body = document.createElement('div');
  body.className = 'pmd-mobile-repairsheet-body';
  sheet.appendChild(body);
  return sheet;
}

function aiReady(): boolean {
  return aiConfigured();
}

function showRepairSheet(unit: UnitRange): void {
  if (!repairSheet || !repairSheetLabel) return;
  const label = unit.label.trim() || '(untitled)';
  const kind =
    unit.type === 'card' || unit.type === 'analytic_unit'
      ? 'Card'
      : unit.type[0]!.toUpperCase() + unit.type.slice(1);
  repairSheetLabel.textContent = `Repair scope: ${kind} — ${label}`;

  const body = repairSheet.querySelector<HTMLElement>('.pmd-mobile-repairsheet-body')!;
  body.textContent = '';
  if (!aiReady()) {
    const note = document.createElement('div');
    note.className = 'pmd-mobile-movesheet-label';
    note.textContent = 'AI repair needs AI features enabled and an API key.';
    body.appendChild(note);
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'pmd-mobile-movesheet-btn';
    open.textContent = 'Open Settings';
    open.addEventListener('click', () => {
      void import('./mobile-settings-ui.js').then((m) => m.openMobileSettings());
    });
    body.appendChild(open);
  } else {
    const row = document.createElement('div');
    row.className = 'pmd-mobile-movesheet-actions';
    const action = (text: string, run: () => void): void => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pmd-mobile-movesheet-btn';
      btn.textContent = text;
      btn.addEventListener('click', run);
      row.appendChild(btn);
    };
    action('✦ Repair text (OCR)', () => runRepairOnUnit('repairText'));
    action('✦ Repair formatting', () => runRepairOnUnit('repairFormatting'));
    action('✦ Repair cite', runRepairCite);
    action('✕', () => {
      const view = getActiveView();
      if (view) setMobileUnitSelection(view, null);
      currentUnit = null;
      hideRepairSheet();
    });
    body.appendChild(row);
  }
  repairSheet.hidden = false;
}

function hideRepairSheet(): void {
  if (repairSheet) repairSheet.hidden = true;
}

/** Select the unit's text and fire the existing repair command — the
 *  repair flows read `state.selection` and can't tell a tap-made
 *  scope from a keyboard-made one. Tooltip, flashes, and toasts all
 *  come from the shared implementation. */
function runRepairOnUnit(command: 'repairText' | 'repairFormatting'): void {
  const view = getActiveView();
  if (!view || !currentUnit || repairBusy) return;
  // Scope to the unit's BODY paragraphs only — the text and
  // formatting repairs must never sweep tags and cites in (a card's
  // tag is the user's own writing, and cites have their own repair).
  // Body blocks trail the tag/cite in a card, so first-body → last-
  // body excludes them.
  let first: number | null = null;
  let last: number | null = null;
  view.state.doc.nodesBetween(currentUnit.from, currentUnit.to, (node, pos) => {
    if (node.type.name === 'card_body' || node.type.name === 'paragraph') {
      if (first === null) first = pos + 1;
      last = pos + node.nodeSize - 1;
      return false;
    }
    return true;
  });
  if (first === null || last === null) {
    showToast('No body text here to repair');
    return;
  }
  fireRepair(view, first, last, command);
}

/** Repair cite: select the tapped card's cite paragraph and run the
 *  AI cite creator on it (the Mod-Shift-X command). A card with no
 *  cite paragraph falls back to the first non-undertag paragraph
 *  beneath the tag — imported/OCR'd cards often carry their citation
 *  as plain body text, which is exactly what the cite creator is
 *  for. */
function runRepairCite(): void {
  const view = getActiveView();
  if (!view || !currentUnit || repairBusy) return;
  if (currentUnit.level !== 4) {
    showToast('Tap a single card to repair its cite');
    return;
  }
  let cite: { from: number; to: number } | null = null;
  let fallback: { from: number; to: number } | null = null;
  view.state.doc.nodesBetween(currentUnit.from, currentUnit.to, (node, pos) => {
    if (cite) return false;
    const t = node.type.name;
    if (t === 'cite_paragraph') {
      cite = { from: pos + 1, to: pos + node.nodeSize - 1 };
      return false;
    }
    if (!fallback && node.isTextblock && t !== 'tag' && t !== 'undertag') {
      fallback = { from: pos + 1, to: pos + node.nodeSize - 1 };
    }
    return true;
  });
  const target = cite ?? fallback;
  if (!target) {
    showToast('This card has nothing to make a cite from');
    return;
  }
  fireRepair(
    view,
    (target as { from: number }).from,
    (target as { to: number }).to,
    'aiCreateCite',
  );
}

/** Select the scope, bring it on-screen (the in-flight thinking/Clod
 *  pill anchors at the selection start — an off-screen anchor would
 *  hide the progress indicator), and fire the ribbon command. */
function fireRepair(
  view: NonNullable<ReturnType<typeof getActiveView>>,
  from: number,
  to: number,
  command: 'repairText' | 'repairFormatting' | 'aiCreateCite',
): void {
  const { doc } = view.state;
  view.dispatch(
    view.state.tr.setSelection(TextSelection.between(doc.resolve(from), doc.resolve(to))),
  );
  const dom = view.nodeDOM(currentUnit!.from);
  if (dom instanceof HTMLElement) preciseScrollIntoView(view, dom);
  runRibbon(command);
  // Debounce accidental double-taps; the repair itself reports
  // progress and completion through its own thinking / Clod-mode
  // tooltip (governed by the Clod setting) + toasts.
  repairBusy = true;
  window.setTimeout(() => {
    repairBusy = false;
  }, 1500);
}

function copyUnit(): void {
  const view = getActiveView();
  if (!view || !currentUnit) return;
  // Park the caret inside the unit's head; the existing command
  // copies the heading + subtree at the cursor.
  view.dispatch(
    view.state.tr.setSelection(
      TextSelection.near(view.state.doc.resolve(currentUnit.from + 1)),
    ),
  );
  runRibbon('copyCurrentHeading');
  showToast('Copied');
}

async function deleteUnit(): Promise<void> {
  const view = getActiveView();
  if (!view || !currentUnit) return;
  const label = currentUnit.label.trim() || 'this';
  // In-DOM confirm; the helper restores focus itself (the native confirm
  // never returned keyboard focus on Windows/Linux).
  if (!(await confirmDialog(`Delete "${label}"?`, { okLabel: 'Delete' }))) {
    return;
  }
  view.dispatch(view.state.tr.delete(currentUnit.from, currentUnit.to));
  currentUnit = null;
  hideMoveSheet();
  showToast('Deleted — ↶ to undo');
}

// ─── Bottom sheets (display options, overflow menu) ────────────────

let openSheetEl: HTMLElement | null = null;
let openSheetBuilder: (() => HTMLElement) | null = null;

function toggleSheet(builder: () => HTMLElement): void {
  // Tapping the same trigger twice closes; a different trigger swaps.
  const same = openSheetBuilder === builder;
  closeSheet();
  if (same) return;
  const sheet = builder();
  sheet.classList.add('pmd-mobile-sheet');
  document.body.appendChild(sheet);
  openSheetEl = sheet;
  openSheetBuilder = builder;
  const dismiss = (e: PointerEvent): void => {
    if (openSheetEl && !openSheetEl.contains(e.target as Node)) closeSheet();
  };
  // Defer so the opening tap doesn't immediately dismiss.
  window.setTimeout(() => {
    document.addEventListener('pointerdown', dismiss, { once: true });
  }, 0);
}

function closeSheet(): void {
  openSheetEl?.remove();
  openSheetEl = null;
  openSheetBuilder = null;
}

function buildDisplaySheet(): HTMLElement {
  const sheet = document.createElement('div');

  const zoomRow = document.createElement('div');
  zoomRow.className = 'pmd-msheet-row';
  const zoomHead = document.createElement('div');
  zoomHead.className = 'pmd-msheet-rowhead';
  const zoomLabel = document.createElement('span');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(ZOOM_MIN);
  slider.max = String(ZOOM_MAX);
  slider.step = '5';
  const syncZoom = (): void => {
    slider.value = String(getLiveZoomPct());
    zoomLabel.textContent = `Text size — ${slider.value}%`;
  };
  syncZoom();
  slider.addEventListener('input', () => {
    setLiveZoomPct(Number(slider.value));
    syncZoom();
  });
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'pmd-msheet-reset';
  reset.textContent = 'Reset';
  reset.addEventListener('click', () => {
    setLiveZoomPct(100);
    syncZoom();
  });
  zoomHead.appendChild(zoomLabel);
  zoomHead.appendChild(reset);
  zoomRow.appendChild(zoomHead);
  zoomRow.appendChild(slider);
  sheet.appendChild(zoomRow);

  const themeRow = document.createElement('div');
  themeRow.className = 'pmd-msheet-row';
  const themeLabel = document.createElement('span');
  themeLabel.textContent = 'Theme';
  themeRow.appendChild(themeLabel);
  const group = document.createElement('div');
  group.className = 'pmd-msheet-segment';
  for (const t of ['light', 'dark', 'system'] as const) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = t[0]!.toUpperCase() + t.slice(1);
    const sync = (): void => {
      btn.classList.toggle('pmd-mode-active', settings.get('theme') === t);
    };
    sync();
    settings.subscribe(sync);
    btn.addEventListener('click', () => settings.set('theme', t));
    group.appendChild(btn);
  }
  themeRow.appendChild(group);
  sheet.appendChild(themeRow);

  return sheet;
}

function buildOverflowSheet(): HTMLElement {
  const sheet = document.createElement('div');
  const item = (label: string, run: () => void): void => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pmd-msheet-item';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      closeSheet();
      run();
    });
    sheet.appendChild(btn);
  };
  item('Open…', () => runRibbon('openFile'));
  item('New document', () => runRibbon('newDocument'));
  item('Export a copy…', () => runRibbon('saveAs'));
  item('Word count', () => runRibbon('wordCountSelection'));
  item('Settings', () => {
    void import('./mobile-settings-ui.js').then((m) => m.openMobileSettings());
  });
  item('Use desktop layout', () => {
    settings.set('mobileLayout', 'desktop');
    window.location.reload();
  });
  item('Home', () => runRibbon('goHome'));
  return sheet;
}

// ─── Pinch zoom ────────────────────────────────────────────────────

/** Two-finger pinch on the doc scroller drives the SAME content zoom
 *  as the desktop status-bar buttons (`zoomPct` → `--editor-zoom`,
 *  CSS `zoom` on the editor). Live preview writes the CSS variable
 *  directly; the setting commits once at gesture end (clamped, in
 *  5% steps) so cross-tab sync isn't spammed mid-gesture. */
function installPinchZoom(): void {
  const app = document.getElementById('app');
  if (!app) return;
  const pointers = new Map<number, { x: number; y: number }>();
  let startDist = 0;
  let startPct = 100;
  let badgeTimer = 0;

  const badge = document.createElement('div');
  badge.className = 'pmd-mobile-zoom-badge';
  badge.hidden = true;
  document.body.appendChild(badge);

  const dist = (): number => {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  app.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      startDist = dist();
      startPct = getLiveZoomPct();
    }
  });
  app.addEventListener(
    'pointermove',
    (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size !== 2 || startDist === 0) return;
      e.preventDefault();
      const pct = clampZoom(startPct * (dist() / startDist));
      document.documentElement.style.setProperty('--editor-zoom', String(pct / 100));
      badge.textContent = `${Math.round(pct)}%`;
      badge.hidden = false;
      window.clearTimeout(badgeTimer);
      badgeTimer = window.setTimeout(() => {
        badge.hidden = true;
      }, 800);
    },
    { passive: false },
  );
  const release = (e: PointerEvent): void => {
    if (!pointers.has(e.pointerId)) return;
    if (pointers.size === 2) {
      // Gesture ends — commit the final value through the settings
      // pipeline (applyZoom re-derives --editor-zoom from it).
      const livePct =
        Number(
          getComputedStyle(document.documentElement).getPropertyValue('--editor-zoom'),
        ) * 100 || startPct;
      setLiveZoomPct(Math.round(clampZoom(livePct) / 5) * 5);
      startDist = 0;
    }
    pointers.delete(e.pointerId);
  };
  app.addEventListener('pointerup', release);
  app.addEventListener('pointercancel', release);
}

function clampZoom(pct: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pct));
}
