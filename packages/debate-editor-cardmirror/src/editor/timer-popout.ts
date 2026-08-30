/**
 * Entry for the floating always-on-top timer window (timer.html,
 * desktop only — opened by the main process via `timerPopoutOpen`).
 *
 * Deliberately tiny: mounts the shared timer UI and nothing else.
 * All state rides timer-state.ts's localStorage + BroadcastChannel,
 * so this window ticks and controls the very same timer as every
 * main window with almost no host access — its preload
 * (timer-popout-preload.ts) exposes exactly ONE call, the window
 * self-resize (settings persist in localStorage too, so presets /
 * compact / theme all read identically here).
 *
 * Lifecycle: state is the single driver. Booting here asserts
 * `poppedOut: true` (this window exists, therefore the timer is
 * popped out — makes the flag self-healing if the button's write
 * was lost); un-popping or hiding the timer anywhere closes this
 * window via the subscription in timer-ui.ts; and pagehide clears
 * the flag so a user closing the float by any windowing gesture
 * pops the timer back into the main windows. The main process
 * backstops the crash case by broadcasting `timer:popout-closed`.
 */

import { settings } from './settings.js';
import { initTimerAudio } from './timer-audio.js';
import { mountTimerUI } from './timer-ui.js';
import { setTimerPoppedOut, setTimerVisible } from './timer-state.js';

/** The one host call this window has (timer-popout-preload.ts):
 *  size the frameless window to hug the panel after a reflow. */
declare global {
  interface Window {
    timerPopoutBridge?: {
      resizeContent(contentWidth: number, contentHeight: number): Promise<void>;
    };
  }
}

/** Mirror the app's UI theme (`data-theme="dark"` on the root — the
 *  same attribute index.ts's applyTheme sets). Settings share the
 *  origin's localStorage, so reads and change events line up with
 *  the main windows for free. */
function applyPopoutTheme(): void {
  const pref = settings.get('theme');
  const dark =
    pref === 'dark' ||
    (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}
applyPopoutTheme();
settings.subscribe(applyPopoutTheme);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPopoutTheme);

mountTimerUI({ popout: true });
// The float is the PREFERRED audio owner: always visible, never
// throttled — the beep can't be late here no matter what's on top.
initTimerAudio({ popout: true });

// This window existing IS the popped-out state; visible follows per
// the no-hidden-but-floating rule.
setTimerVisible(true);
setTimerPoppedOut(true);

// Closing the float by any normal path returns the timer to the main
// windows. (pagehide, not beforeunload: it also fires on the
// window-manager close button and doesn't inhibit unload.) The
// subscription in timer-ui.ts would close us on this write — that's
// a no-op mid-teardown.
window.addEventListener('pagehide', () => setTimerPoppedOut(false));

// Hug the panel whenever its content reflows — the compact ↔
// expanded toggle (synced in from any window's settings change)
// changes the panel's natural size, and the frameless window can't
// resize itself (`resizable: false` blocks window.resizeTo).
// rAF-coalesced: ResizeObserver can fire in bursts during a reflow.
{
  const panel = document.getElementById('timer-panel');
  const bridge = window.timerPopoutBridge;
  if (panel && bridge) {
    let raf: number | null = null;
    // Belt-and-braces against any residual measure→resize feedback
    // (the CSS keeps the panel content-sized, so its rect must not
    // track the viewport — but a loop here would race the window
    // manager, so refuse to re-send an unchanged size regardless).
    let lastW = 0;
    let lastH = 0;
    const hug = (): void => {
      raf = null;
      const rect = panel.getBoundingClientRect();
      const w = Math.ceil(rect.width);
      const h = Math.ceil(rect.height);
      if (w <= 40 || h <= 20) return;
      if (Math.abs(w - lastW) <= 1 && Math.abs(h - lastH) <= 1) return;
      lastW = w;
      lastH = h;
      void bridge.resizeContent(w, h);
    };
    new ResizeObserver(() => {
      if (raf === null) raf = requestAnimationFrame(hug);
    }).observe(panel);
  }
}
