/**
 * Card-cutter activation gate.
 *
 * The whole feature is hidden until a user opts in from the browser
 * console: `__cardcutter('on')`. That flips the `cardCutterEnabled`
 * setting, which (a) activates the ribbon commands + shortcuts and
 * (b) reveals the Card Cutter settings tab (whose Disable button — or
 * `__cardcutter('off')` — flips it back). Nothing about the feature
 * is discoverable in the UI before the console command.
 */

import { settings } from './settings.js';
import { showToast } from './toast.js';
import { installCardCutterRegistry, tryLoadCardCutterEngine } from './card-cutter-port.js';

export function cardCutterActive(): boolean {
  return !!settings.get('cardCutterEnabled');
}

/** Install the console entry point + the body-class reflection. Call
 *  once at boot. Safe on every host; the feature does nothing until
 *  toggled on. */
export function installCardCutterGate(): void {
  installCardCutterRegistry();

  window.__cardcutter = (cmd) => {
    if (cmd === 'status') {
      return cardCutterActive() ? 'card cutter: ON' : 'card cutter: off';
    }
    const on = cmd === 'on';
    settings.set('cardCutterEnabled', on);
    return on
      ? "card cutter ENABLED — see Settings → Card Cutter. Disable there or with __cardcutter('off')."
      : 'card cutter disabled.';
  };

  const reflect = (): void => {
    const on = cardCutterActive();
    document.body.classList.toggle('pmd-card-cutter-on', on);
    if (on) void tryLoadCardCutterEngine();
  };
  reflect();
  let last = cardCutterActive();
  settings.subscribe(() => {
    const now = cardCutterActive();
    if (now === last) return;
    last = now;
    reflect();
    showToast(now ? 'Card cutter enabled' : 'Card cutter disabled');
  });
}
