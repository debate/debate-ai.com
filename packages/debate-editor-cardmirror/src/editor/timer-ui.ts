/**
 * Built-in countdown timer UI.
 *
 * Renders the timer panel (display + buttons), wires click /
 * keyboard handlers to `timer-state.ts` actions, and runs a
 * per-window tick that updates the display labels off the shared
 * state. The panel is mounted into `#timer-panel` in `index.html`;
 * the per-window visibility toggle lives in settings (transient,
 * not persisted).
 *
 * Layout has two modes, switched by `pmd-timer-compact` on the
 * root element:
 *   Expanded → reset | display | (start/9/6/3) | (aff/neg)
 *   Compact  → display | (start/reset stacked) | (aff/neg)
 *
 * Editable display: when paused, clicking the display makes it
 * `contenteditable` in any mode. The user types MM:SS or keypad digits (last
 * two digits are seconds, e.g. 800 → 8:00); on blur or
 * Enter we parse + `setActiveRemainingMs`, which writes the active mode's clock
 * (in a prep mode that adjusts that side's saved balance, not just the speech
 * timer).
 */

import { settings } from './settings.js';
import { getElectronHost } from './host/index.js';
import {
  configurePrepTotal,
  getPrepRemainingMs,
  getTimerState,
  getVisibleRemainingMs,
  loadSpeechPreset,
  markTimerExpired,
  pauseTimer,
  resetTimer,
  selectMode,
  setActiveRemainingMs,
  setTimerPoppedOut,
  shownPrepSide,
  startTimer,
  subscribeTimer,
  togglePrepShownSide,
} from './timer-state.js';

/** Format ms as MM:SS, clamping to 0 and rounding upward to whole
 *  seconds so a running clock doesn't visually flash 0:00 a half-
 *  second before the actual end. */
function formatMs(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Parse a user-typed timer value into ms, or null if unparseable.
 *
 *  - `MM:SS` is taken literally (seconds must be < 60): `8:00` → 8 min.
 *  - Bare digits are read keypad / microwave style — the LAST TWO digits are
 *    seconds, everything before them is minutes: `800` → 8:00, `130` → 1:30,
 *    `1230` → 12:30. One- or two-digit input has no minutes part, so it's just
 *    seconds: `45` → 0:45, `90` → 1:30 (the 90 seconds carry). */
export function parseTimeInput(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (colonMatch) {
    const m = parseInt(colonMatch[1]!, 10);
    const sec = parseInt(colonMatch[2]!, 10);
    if (sec >= 60) return null;
    return (m * 60 + sec) * 1000;
  }
  if (/^\d+$/.test(trimmed)) {
    const seconds = parseInt(trimmed.length <= 2 ? trimmed : trimmed.slice(-2), 10);
    const minutes = trimmed.length <= 2 ? 0 : parseInt(trimmed.slice(0, -2), 10);
    return (minutes * 60 + seconds) * 1000;
  }
  return null;
}

let mounted = false;

/** Mount the timer UI into the panel placeholder in index.html.
 *  Idempotent — calling more than once no-ops after the first.
 *
 *  `popout: true` is the floating-window variant (timer.html): the
 *  panel is ALWAYS shown (a pop-out window whose panel hid itself
 *  would be an empty float), gets no pop-out button of its own, and
 *  closes its window when the shared state says the timer is no
 *  longer popped out (or no longer visible) — state is the single
 *  driver; the window never decides on its own. */
export function mountTimerUI(opts?: { popout?: boolean }): void {
  const isPopout = opts?.popout === true;
  if (mounted) return;
  const panelEl = document.getElementById('timer-panel');
  if (!panelEl) return;
  mounted = true;
  // Pin to a const so closures defined further down retain the
  // narrowed type (TS doesn't propagate the null-check refinement
  // into later function declarations).
  const panel: HTMLElement = panelEl;

  panel.classList.add('pmd-timer-panel');
  // Flat element list — each element is positioned via CSS grid
  // rules keyed on its id, so compact mode can re-arrange them
  // without restructuring the DOM.
  panel.innerHTML = `
    <button id="timer-reset-btn" class="pmd-timer-reset" type="button"
            title="Reset all timers" aria-label="Reset all timers">↻</button>
    <div id="timer-display" class="pmd-timer-display"
         role="timer" aria-live="off"
         title="Click to edit when paused">0:00</div>
    <button id="timer-start-btn" class="pmd-timer-start" type="button"
            aria-label="Start or pause">▶</button>
    <button id="timer-preset-1-btn" class="pmd-timer-preset" type="button"
            data-preset-index="0"></button>
    <button id="timer-preset-2-btn" class="pmd-timer-preset" type="button"
            data-preset-index="1"></button>
    <button id="timer-preset-3-btn" class="pmd-timer-preset" type="button"
            data-preset-index="2"></button>
    <button id="timer-preset-4-btn" class="pmd-timer-preset" type="button"
            data-preset-index="3"></button>
    <button id="timer-aff-btn" class="pmd-timer-prep pmd-timer-aff" type="button"
            aria-label="Affirmative prep"><span class="pmd-timer-prep-prefix">A:</span><span class="pmd-timer-prep-time" id="timer-aff-time">10:00</span></button>
    <button id="timer-neg-btn" class="pmd-timer-prep pmd-timer-neg" type="button"
            aria-label="Negative prep"><span class="pmd-timer-prep-prefix">N:</span><span class="pmd-timer-prep-time" id="timer-neg-time">10:00</span></button>
    <button id="timer-prep-single-btn" class="pmd-timer-prep pmd-timer-prep-single" type="button"
            aria-label="Prep"><span class="pmd-timer-prep-prefix">A:</span><span class="pmd-timer-prep-time" id="timer-prep-single-time">10:00</span></button>
    <button id="timer-prep-switch-btn" class="pmd-timer-prep-switch" type="button"
            title="Switch prep side" aria-label="Switch between affirmative and negative prep">⇄</button>
  `;
  if (isPopout) panel.classList.add('pmd-timer-panel-popout');

  // Pop-out / pop-in button, far column. Main windows (desktop
  // only) get ⇱ "pop out"; the float itself gets ⇲ "pop back in" —
  // without it the frameless window's only exits are Cmd-W and
  // hiding the timer from a main window, neither discoverable. Web
  // has no always-on-top windows to offer, so no button there.
  const popoutHost = getElectronHost();
  if (isPopout || popoutHost?.timerPopoutOpen) {
    const btn = document.createElement('button');
    btn.id = 'timer-popout-btn';
    btn.className = 'pmd-timer-popout-btn';
    btn.type = 'button';
    const label = isPopout
      ? 'Pop timer back into CardMirror'
      : 'Pop timer out into a floating window';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.textContent = isPopout ? '⇲' : '⇱';
    btn.addEventListener('click', () => {
      if (isPopout) {
        // Clearing the flag closes this window via the subscription
        // below and un-hides the panel in every main window.
        setTimerPoppedOut(false);
        return;
      }
      // Measure the rendered panel BEFORE hiding it so the float can
      // hug the content exactly, and pass this window's chrome zoom
      // so the float renders at the same scale (the pop-out has no
      // host surface, so it can't apply the zoom itself).
      const rect = panel.getBoundingClientRect();
      // Order matters: flip the shared flag FIRST so every main
      // window hides its panel before the float appears — the two
      // must never be visible together, not even for a frame.
      setTimerPoppedOut(true);
      popoutHost?.timerPopoutOpen?.({
        contentWidth: Math.ceil(rect.width),
        contentHeight: Math.ceil(rect.height),
        zoomFactor: settings.get('chromeScalePct') / 100,
      });
    });
    panel.appendChild(btn);
  }

  const display = document.getElementById('timer-display') as HTMLDivElement;
  const startBtn = document.getElementById('timer-start-btn') as HTMLButtonElement;
  const resetBtn = document.getElementById('timer-reset-btn') as HTMLButtonElement;
  const affBtn = document.getElementById('timer-aff-btn') as HTMLButtonElement;
  const negBtn = document.getElementById('timer-neg-btn') as HTMLButtonElement;
  const affTime = document.getElementById('timer-aff-time') as HTMLSpanElement;
  const negTime = document.getElementById('timer-neg-time') as HTMLSpanElement;
  // Compact-only controls: the single prep button (shows one side,
  // per shownPrepSide) and the side switch. CSS hides them in the
  // expanded layout and hides aff/neg in compact.
  const prepSingleBtn = document.getElementById('timer-prep-single-btn') as HTMLButtonElement;
  const prepSingleTime = document.getElementById('timer-prep-single-time') as HTMLSpanElement;
  const prepSinglePrefix = prepSingleBtn.querySelector('.pmd-timer-prep-prefix') as HTMLSpanElement;
  const prepSwitchBtn = document.getElementById('timer-prep-switch-btn') as HTMLButtonElement;
  const presetBtns: HTMLButtonElement[] = [];
  for (let i = 0; i < 4; i++) {
    const b = document.getElementById(`timer-preset-${i + 1}-btn`) as HTMLButtonElement;
    presetBtns.push(b);
  }

  // ─── Click wiring ────────────────────────────────────────────
  startBtn.addEventListener('click', () => {
    const s = getTimerState();
    if (s.running) pauseTimer();
    else startTimer();
  });
  resetBtn.addEventListener('click', () => {
    const prepMs = settings.get('timerPrepMinutes') * 60 * 1000;
    resetTimer(prepMs);
  });
  affBtn.addEventListener('click', () => selectMode('affPrep'));
  negBtn.addEventListener('click', () => selectMode('negPrep'));
  prepSingleBtn.addEventListener('click', () =>
    selectMode(shownPrepSide() === 'aff' ? 'affPrep' : 'negPrep'),
  );
  prepSwitchBtn.addEventListener('click', () => togglePrepShownSide());
  for (const btn of presetBtns) {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset['presetIndex'] ?? '0', 10);
      const presets = settings.get('timerSpeechPresets');
      const minutes = presets[idx] ?? 0;
      loadSpeechPreset(minutes);
    });
  }

  // ─── Editable display ────────────────────────────────────────
  // Click the display while paused → contenteditable, in ANY mode. Blur or
  // Enter parses + commits via setActiveRemainingMs (which writes the active
  // mode's clock — so editing aff/neg prep adjusts that side's saved balance,
  // letting you fix a prep clock you started/stopped a touch late). Escape
  // cancels by re-rendering the current state.
  display.addEventListener('click', () => {
    const s = getTimerState();
    if (s.running) return;
    display.contentEditable = 'true';
    display.focus();
    // Select-all so a quick MM:SS retype replaces the value.
    const range = document.createRange();
    range.selectNodeContents(display);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
  const commitEdit = (): void => {
    if (display.contentEditable !== 'true') return;
    display.contentEditable = 'false';
    const parsed = parseTimeInput(display.textContent ?? '');
    if (parsed !== null) setActiveRemainingMs(parsed);
    render();
  };
  display.addEventListener('blur', commitEdit);
  display.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      display.contentEditable = 'false';
      render();
    }
  });

  // ─── Render loop ─────────────────────────────────────────────
  // Render whenever state changes (start/pause/preset/reset/mode-
  // switch) and tick once per ~250ms while running so the display
  // updates smoothly. Tick is light — just reads state + updates
  // text content; no state writes per tick.
  let tickTimer: number | null = null;
  function render(): void {
    if (display.contentEditable === 'true') return; // don't clobber user typing
    const s = getTimerState();
    const now = Date.now();
    display.textContent = formatMs(getVisibleRemainingMs(s, now));
    // Surface the mode so CSS can give the big display the same aff/neg
    // color / text treatment as the prep buttons (per `data-prep-label`) when
    // prep time is loaded — a presentational `::before` / color, so the text
    // node stays just the time.
    display.dataset['mode'] = s.mode;
    startBtn.textContent = s.running ? '⏸' : '▶';
    startBtn.setAttribute('aria-pressed', s.running ? 'true' : 'false');
    affTime.textContent = formatMs(getPrepRemainingMs(s, 'aff', now));
    negTime.textContent = formatMs(getPrepRemainingMs(s, 'neg', now));
    affBtn.classList.toggle('pmd-timer-prep-active', s.mode === 'affPrep');
    negBtn.classList.toggle('pmd-timer-prep-active', s.mode === 'negPrep');
    // Single prep button mirrors whichever side is shown, borrowing
    // the aff/neg classes so the color / prefix treatments apply.
    const side = shownPrepSide(s);
    prepSingleBtn.classList.toggle('pmd-timer-aff', side === 'aff');
    prepSingleBtn.classList.toggle('pmd-timer-neg', side === 'neg');
    prepSinglePrefix.textContent = side === 'aff' ? 'A:' : 'N:';
    prepSingleTime.textContent = formatMs(getPrepRemainingMs(s, side, now));
    prepSingleBtn.setAttribute('aria-label', side === 'aff' ? 'Affirmative prep' : 'Negative prep');
    prepSingleBtn.classList.toggle(
      'pmd-timer-prep-active',
      s.mode === (side === 'aff' ? 'affPrep' : 'negPrep'),
    );
    // Update preset labels from settings (changes when the user
    // edits speech presets or switches profile).
    const presets = settings.get('timerSpeechPresets');
    for (let i = 0; i < presetBtns.length; i++) {
      presetBtns[i]!.textContent = String(presets[i] ?? '');
    }
    // Flash-red gating — toggle a class when remaining ms is at or
    // below one of the configured flash thresholds (and timer is
    // running). The CSS rule does the actual flash animation.
    const flashEnabled = settings.get('timerFlashEnabled');
    const flashSeconds = settings.get('timerFlashSeconds');
    const visibleMs = getVisibleRemainingMs(s, now);
    const inFlashWindow =
      flashEnabled &&
      s.running &&
      visibleMs > 0 &&
      flashSeconds.some((sec) => {
        const threshMs = sec * 1000;
        return visibleMs <= threshMs && visibleMs > threshMs - 1000;
      });
    display.classList.toggle('pmd-timer-flash', inFlashWindow);
    // Ran-out latch: a running clock reading 0:00 marks its mode
    // expired in SHARED state, so every window and the pop-out go
    // red together (markTimerExpired's guards absorb the concurrent
    // per-window ticks).
    if (s.running && visibleMs <= 0) markTimerExpired();
    // Steady alert red until this clock is re-armed (preset / Reset /
    // typed time). Mode-scoped: another clock's display shows its own
    // colors; switching back to the ran-out one is red again.
    display.classList.toggle(
      'pmd-timer-expired',
      s.expiredMode !== null && s.mode === s.expiredMode,
    );
  }

  function ensureTick(): void {
    if (getTimerState().running && tickTimer === null) {
      tickTimer = window.setInterval(render, 250);
    } else if (!getTimerState().running && tickTimer !== null) {
      window.clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  subscribeTimer(() => {
    // Visibility lives in the timer state, so a cross-window
    // broadcast of `visible` needs to flip `panel.hidden` here.
    // Cheap to re-apply the whole chrome on any state change.
    applyChrome();
    render();
    ensureTick();
    // Pop-out window: the shared state is the single driver of this
    // window's existence — un-popping or hiding the timer anywhere
    // closes the float. (window.close() works without extra
    // privileges here because the main process opened this window.)
    if (isPopout) {
      const s = getTimerState();
      if (!s.poppedOut || !s.visible) window.close();
    }
  });

  // Compact-mode + visibility wiring — read from settings on mount
  // and resync on every settings change.
  function applyChrome(): void {
    panel.classList.toggle('pmd-timer-compact', settings.get('timerCompact'));
    // Fourth speech preset (expanded only — compact hides all
    // presets); the CSS re-flows Start/Pause into its own column.
    panel.classList.toggle('pmd-timer-four', settings.get('timerShowFourthPreset'));
    // CSS rules key on `data-prep-label` to show / hide the
    // A: / N: prefix and the blue / red color treatment.
    panel.setAttribute('data-prep-label', settings.get('timerPrepLabel'));
    // Visibility lives in the shared timer state (not settings)
    // so it broadcasts across windows. The pause-on-hide
    // behavior is handled inside `setTimerVisible` itself.
    // While popped out, main windows hide the in-app panel — the
    // timer must never show in the float and a window at once. The
    // pop-out variant always shows (its window closes instead).
    const s = getTimerState();
    panel.hidden = isPopout ? false : !s.visible || s.poppedOut;
  }
  applyChrome();
  settings.subscribe(() => {
    applyChrome();
    // Keep the prep-total cache in state in sync with the setting.
    configurePrepTotal(settings.get('timerPrepMinutes') * 60 * 1000);
    render();
  });

  // Initial render — paint whatever state we booted with.
  render();
  ensureTick();
}
