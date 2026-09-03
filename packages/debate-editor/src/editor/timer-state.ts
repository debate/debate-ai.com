/**
 * Built-in countdown timer state.
 *
 * Owns the in-memory timer state plus persistence (localStorage)
 * plus cross-window sync (BroadcastChannel). UI code subscribes to
 * `subscribeTimer(fn)` and calls the action functions; UI never
 * mutates state directly. Three clocks share the big display —
 * 'speech' (transient round timer) and the persistent 'affPrep' /
 * 'negPrep' balances, which only Reset refills. Field semantics are
 * documented on `TimerState` below.
 *
 * Sync: every state mutation goes through `setState`, which writes
 * to localStorage AND posts the new state over a BroadcastChannel;
 * other windows apply it locally. Each window's UI ticks off the
 * same `runningSince + base` so visible remaining stays consistent
 * without a per-tick broadcast.
 */

const STORAGE_KEY = 'cardmirror-timer-state-v1';
const CHANNEL_NAME = 'cardmirror-timer-v1';

export type TimerMode = 'speech' | 'affPrep' | 'negPrep';

export interface TimerState {
  mode: TimerMode;
  running: boolean;
  /** Epoch ms when the current run began. Null when paused. */
  runningSince: number | null;
  /** Speech timer's remaining ms at the last pause / preset load.
   *  This is the snapshot used to compute the live display while
   *  running. When the timer is paused, this is the visible
   *  remaining; when running, live = base - (now - runningSince). */
  speechBaseRemainingMs: number;
  /** Same snapshot semantics as `speechBaseRemainingMs`, one per
   *  prep clock. Only Reset refills them to `prepTotalMs`. */
  affPrepBaseRemainingMs: number;
  negPrepBaseRemainingMs: number;
  /** Configured prep total (one Reset → both prep balances refill
   *  to this). Read from settings; cached here so the action
   *  functions don't need a settings ref. */
  prepTotalMs: number;
  /** Whether the timer panel is visible. Lives in the shared
   *  timer state (not in settings) so toggling the panel on in
   *  one window opens it in every other open window too — the
   *  shared BroadcastChannel pipes it across. Survives close +
   *  reopen via the same localStorage snapshot as the rest of
   *  the timer state. */
  visible: boolean;
  /** Whether the timer lives in the floating always-on-top pop-out
   *  window (desktop only). While true, every main window HIDES its
   *  in-app panel — the timer must never show in both places. The
   *  flag persists with the rest of the state, so it can go stale
   *  when the app quits with the pop-out open; the boot path calls
   *  `reconcileTimerPopout` with the host's answer to "does a timer
   *  window actually exist?" rather than clearing unconditionally —
   *  a mode-switch reload (three-pane toggle) reloads the window
   *  while the pop-out stays alive, and an unconditional clear
   *  there would resurrect the in-app panel next to the float. */
  poppedOut: boolean;
  /** Which side's prep balance the COMPACT panel's single prep
   *  button shows while the timer is in speech mode (a prep MODE
   *  always wins — see `shownPrepSide`). Shared state so every
   *  compact surface (windows + the pop-out) shows the same side. */
  prepShownSide: 'aff' | 'neg';
  /** The mode whose clock RAN OUT (vs merely sitting at 0:00 — a
   *  reset speech timer is zero but not expired). Drives the steady
   *  ran-out red on the display while that mode is active. Cleared
   *  only by re-arming: a preset load, Reset, or a typed time —
   *  deliberately NOT by pause or a mode switch, so the alert
   *  can't be dismissed by accident. */
  expiredMode: TimerMode | null;
}

const DEFAULT_PREP_MS = 10 * 60 * 1000;

function makeInitialState(): TimerState {
  return {
    mode: 'speech',
    running: false,
    runningSince: null,
    speechBaseRemainingMs: 0,
    affPrepBaseRemainingMs: DEFAULT_PREP_MS,
    negPrepBaseRemainingMs: DEFAULT_PREP_MS,
    prepTotalMs: DEFAULT_PREP_MS,
    visible: false,
    poppedOut: false,
    prepShownSide: 'aff',
    expiredMode: null,
  };
}

let state: TimerState = loadFromStorage() ?? makeInitialState();
const listeners = new Set<(s: TimerState) => void>();

// BroadcastChannel for cross-window sync. Available in modern
// browsers + Electron renderers. Wrapping in a try in case a host
// has it locked down (CSP, older browsers); the timer still works
// per-window in that case.
let channel: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener('message', (e: MessageEvent) => {
      const incoming = e.data as TimerState | null;
      if (!incoming || typeof incoming !== 'object') return;
      // Apply silently — don't re-broadcast. listeners fire so the
      // UI re-renders against the new state.
      state = sanitize(incoming);
      saveToStorage();
      for (const fn of listeners) fn(state);
    });
  }
} catch {
  channel = null;
}

function sanitize(raw: Partial<TimerState>): TimerState {
  const base = makeInitialState();
  return {
    mode: raw.mode === 'affPrep' || raw.mode === 'negPrep' ? raw.mode : 'speech',
    running: raw.running === true,
    runningSince:
      typeof raw.runningSince === 'number' && Number.isFinite(raw.runningSince)
        ? raw.runningSince
        : null,
    speechBaseRemainingMs: nonNegInt(raw.speechBaseRemainingMs, base.speechBaseRemainingMs),
    affPrepBaseRemainingMs: nonNegInt(raw.affPrepBaseRemainingMs, base.affPrepBaseRemainingMs),
    negPrepBaseRemainingMs: nonNegInt(raw.negPrepBaseRemainingMs, base.negPrepBaseRemainingMs),
    prepTotalMs: nonNegInt(raw.prepTotalMs, base.prepTotalMs),
    visible: raw.visible === true,
    poppedOut: raw.poppedOut === true,
    prepShownSide: raw.prepShownSide === 'neg' ? 'neg' : 'aff',
    expiredMode:
      raw.expiredMode === 'speech' || raw.expiredMode === 'affPrep' || raw.expiredMode === 'negPrep'
        ? raw.expiredMode
        : null,
  };
}

function nonNegInt(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return fallback;
  return Math.floor(v);
}

function loadFromStorage(): TimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return sanitize(parsed as Partial<TimerState>);
  } catch {
    return null;
  }
}

function saveToStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable (private mode); the timer
    // still works within the current window.
  }
}

/** Apply a state change, persist it, broadcast to other windows,
 *  and notify local listeners. Single funnel for all mutations so
 *  these three side effects can't drift. */
function setState(next: Partial<TimerState>): void {
  state = sanitize({ ...state, ...next });
  saveToStorage();
  if (channel) {
    try {
      channel.postMessage(state);
    } catch {
      // Channel might be closed in some teardown paths; skip.
    }
  }
  for (const fn of listeners) fn(state);
}

/** Subscribe to state changes. Returns an unsubscribe function. */
export function subscribeTimer(fn: (s: TimerState) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getTimerState(): TimerState {
  return state;
}

/** Compute the currently-displayed remaining ms for the active
 *  mode, accounting for live running offset. Visible-only — never
 *  written back to state; that happens on pause. */
export function getVisibleRemainingMs(s: TimerState = state, now: number = Date.now()): number {
  const base = baseForMode(s, s.mode);
  if (!s.running || s.runningSince === null) return base;
  return Math.max(0, base - (now - s.runningSince));
}

export function getPrepRemainingMs(s: TimerState, side: 'aff' | 'neg', now: number = Date.now()): number {
  const base = side === 'aff' ? s.affPrepBaseRemainingMs : s.negPrepBaseRemainingMs;
  // A side's prep clock counts down only while it's the active
  // running mode. Otherwise its persisted balance is what shows.
  const active = (side === 'aff' && s.mode === 'affPrep') || (side === 'neg' && s.mode === 'negPrep');
  if (!active || !s.running || s.runningSince === null) return base;
  return Math.max(0, base - (now - s.runningSince));
}

function baseForMode(s: TimerState, mode: TimerMode): number {
  if (mode === 'affPrep') return s.affPrepBaseRemainingMs;
  if (mode === 'negPrep') return s.negPrepBaseRemainingMs;
  return s.speechBaseRemainingMs;
}

// ─── Actions ──────────────────────────────────────────────────────

/** Begin counting down whatever's currently in `mode`. If we were
 *  already running, no-op. If the base is zero, no-op (nothing to
 *  count down). */
export function startTimer(): void {
  if (state.running) return;
  const base = baseForMode(state, state.mode);
  if (base <= 0) return;
  setState({ running: true, runningSince: Date.now() });
}

/** Latch the ran-out state for the active mode. Called from each
 *  window's render tick when a running clock reads 0:00; the guards
 *  make the concurrent per-window calls converge on one idempotent
 *  write instead of a broadcast storm. */
export function markTimerExpired(): void {
  if (state.expiredMode === state.mode) return;
  if (!state.running) return;
  if (getVisibleRemainingMs(state) > 0) return;
  setState({ expiredMode: state.mode });
}

/** Pause: snapshot the live remaining back into the base for the
 *  current mode so resuming continues from where we left off. */
export function pauseTimer(): void {
  if (!state.running) return;
  const now = Date.now();
  const elapsed = state.runningSince ? now - state.runningSince : 0;
  const base = baseForMode(state, state.mode);
  const newBase = Math.max(0, base - elapsed);
  if (state.mode === 'affPrep') {
    setState({ running: false, runningSince: null, affPrepBaseRemainingMs: newBase });
  } else if (state.mode === 'negPrep') {
    setState({ running: false, runningSince: null, negPrepBaseRemainingMs: newBase });
  } else {
    setState({ running: false, runningSince: null, speechBaseRemainingMs: newBase });
  }
}

/** Reset everything to the configured prep total: both prep
 *  balances refill, speech timer zeros, running is cleared. */
export function resetTimer(prepTotalMs: number = state.prepTotalMs): void {
  setState({
    running: false,
    runningSince: null,
    mode: 'speech',
    speechBaseRemainingMs: 0,
    affPrepBaseRemainingMs: prepTotalMs,
    negPrepBaseRemainingMs: prepTotalMs,
    prepTotalMs,
    expiredMode: null,
  });
}

/** Load a speech-timer preset (in minutes) into the main display,
 *  paused. Switches mode to 'speech'. */
export function loadSpeechPreset(minutes: number): void {
  const ms = Math.max(0, Math.floor(minutes * 60 * 1000));
  // If a prep was running, snapshot its progress before switching.
  if (state.running) pauseTimer();
  setState({
    mode: 'speech',
    running: false,
    runningSince: null,
    speechBaseRemainingMs: ms,
    expiredMode: null,
  });
}

/** Switch the active display to a side's prep clock. Doesn't start
 *  the countdown — user hits Start to begin. */
export function selectMode(mode: TimerMode): void {
  if (state.mode === mode) return;
  // Snapshot whatever was running so re-selecting later resumes
  // from the right point.
  if (state.running) pauseTimer();
  // Choosing a prep side anywhere (expanded aff/neg buttons too)
  // also makes it the compact panel's shown side, so dropping back
  // to speech mode keeps showing the side last worked with.
  if (mode === 'affPrep' || mode === 'negPrep') {
    setState({ mode, running: false, runningSince: null, prepShownSide: mode === 'affPrep' ? 'aff' : 'neg' });
  } else {
    setState({ mode, running: false, runningSince: null });
  }
}

/** The prep side the compact panel's single prep button shows: an
 *  active prep MODE always wins (the button must show the clock
 *  that's actually selected / running); otherwise the sticky
 *  `prepShownSide` preference. */
export function shownPrepSide(s: TimerState = state): 'aff' | 'neg' {
  if (s.mode === 'affPrep') return 'aff';
  if (s.mode === 'negPrep') return 'neg';
  return s.prepShownSide;
}

/** Compact panel's side-switch button. In speech mode it's a pure
 *  display flip; while a prep mode is selected it switches TO the
 *  other side's prep (pausing first, standard selectMode
 *  semantics) — a dead-looking switch that only changed a hidden
 *  preference would read as broken. */
export function togglePrepShownSide(): void {
  const next: 'aff' | 'neg' = shownPrepSide(state) === 'aff' ? 'neg' : 'aff';
  if (state.mode === 'affPrep' || state.mode === 'negPrep') {
    if (state.running) pauseTimer();
    setState({
      mode: next === 'aff' ? 'affPrep' : 'negPrep',
      running: false,
      runningSince: null,
      prepShownSide: next,
    });
  } else {
    setState({ prepShownSide: next });
  }
}

/** Set the ACTIVE mode's clock to a specific duration in ms (used by the
 *  editable display). For a prep mode this writes that side's persisted base, so
 *  the edit sticks across mode switches until the next Reset — matching the
 *  speech case, which writes the speech base. No-op while running. */
export function setActiveRemainingMs(ms: number): void {
  if (state.running) return;
  const v = Math.max(0, Math.floor(ms));
  if (state.mode === 'affPrep') setState({ affPrepBaseRemainingMs: v, expiredMode: null });
  else if (state.mode === 'negPrep') setState({ negPrepBaseRemainingMs: v, expiredMode: null });
  else setState({ speechBaseRemainingMs: v, expiredMode: null });
}

/** Push the configured prep total into state. Called when settings
 *  change (timerPrepMinutes). Doesn't disturb the current balances
 *  unless the user hits Reset. */
export function configurePrepTotal(prepTotalMs: number): void {
  if (state.prepTotalMs === prepTotalMs) return;
  setState({ prepTotalMs });
}

/** Toggle timer-panel visibility. Hiding the panel pauses any
 *  running clock — a clock must not keep counting down while the
 *  user can't see it. Broadcast over the shared channel so toggling
 *  in one window opens / closes the panel in every other open
 *  window too. */
export function setTimerVisible(visible: boolean): void {
  if (state.visible === visible) return;
  if (!visible && state.running) {
    // Pause first so the pause snapshot lands correctly, then
    // flip visible. Two setState calls is fine — both go through
    // the same persist + broadcast path.
    pauseTimer();
  }
  // Hiding the timer also retracts the pop-out: `visible: false` +
  // `poppedOut: true` would be a hidden-but-floating contradiction.
  // The pop-out window watches this state and closes itself when
  // poppedOut goes false.
  setState(visible ? { visible } : { visible, poppedOut: false });
}

/** Move the timer into (true) or back out of (false) the floating
 *  pop-out window. Popping out implies the timer is visible —
 *  there is no hidden-but-floating state. Does NOT pause: unlike
 *  hiding, the clock stays perfectly watchable in the float. */
export function setTimerPoppedOut(poppedOut: boolean): void {
  if (state.poppedOut === poppedOut) return;
  setState(poppedOut ? { poppedOut, visible: true } : { poppedOut });
}

/** Boot-time reconciliation for the persisted `poppedOut` flag.
 *  Call with the host's live answer to "does a timer pop-out window
 *  exist right now?" (false on web and when the host can't say).
 *  Clears a stale flag left by quitting with the pop-out open —
 *  without clearing it during a mode-switch reload, where the
 *  pop-out window survives the reload and the flag is still true. */
export function reconcileTimerPopout(popoutWindowExists: boolean): void {
  if (state.poppedOut && !popoutWindowExists) setState({ poppedOut: false });
}
