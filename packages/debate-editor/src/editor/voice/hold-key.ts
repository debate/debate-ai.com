/**
 * The dictation key (spec §4.2). A capture-phase keydown/keyup pair on
 * the document. Two behaviors, chosen by a setting:
 *
 *  - hold: the chord held = dictation; release of the main key (or of a
 *    modifier the chord needs) = end. Auto-repeat keydowns are swallowed
 *    while held so nothing types.
 *  - toggle: one press starts, the next press ends. For a mouse macro
 *    that cannot hold, or a hand that cannot. Other keys pass through
 *    (the hands are free), and the service's silence limit ends a
 *    forgotten session; `isDictating` reports that so the next press
 *    starts fresh rather than "ending" a session already over.
 *
 * A window blur ends dictation in both modes (a lost keyup must never
 * leave the mic buffering forever; a session left on while you are in
 * another app must not transcribe the room).
 */
import { ribbonKeyStringFor } from '../ribbon-commands.js';

export type DictateKeyMode = 'hold' | 'toggle';

export interface HoldKeyDeps {
  /** The chord, e.g. "Mod-Shift-Space" (ribbon key-string format). */
  getKey: () => string;
  begin: () => void;
  end: () => void;
  /** Default 'hold'. */
  getMode?: () => DictateKeyMode;
  /** Toggle mode asks this before deciding whether a press starts or ends. */
  isDictating?: () => boolean;
  /** Whether a voice session is on at all. Off → the listener stays out
   *  of the way entirely, so a chord shared with another command still
   *  reaches that command (Search Everything sat on the first default). */
  isActive?: () => boolean;
}

const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Shift', 'Alt']);

/** Whether releasing `e` breaks the held chord `chord`. */
export function releaseEndsHold(e: KeyboardEvent, chord: string): boolean {
  const parts = chord.split('-');
  const main = parts[parts.length - 1] ?? '';
  if (MODIFIER_KEYS.has(e.key)) {
    const needed =
      (e.key === 'Shift' && parts.includes('Shift')) ||
      (e.key === 'Alt' && parts.includes('Alt')) ||
      ((e.key === 'Control' || e.key === 'Meta') && parts.includes('Mod'));
    return needed;
  }
  const released = e.code === 'Space' || e.key === ' ' ? 'Space' : /^Digit[0-9]$/.test(e.code) ? e.code.slice(5) : e.key.length === 1 ? e.key.toLowerCase() : e.key;
  return released.toLowerCase() === main.toLowerCase();
}

export function installHoldToDictate(deps: HoldKeyDeps): () => void {
  let holding = false;
  const onDown = (e: KeyboardEvent): void => {
    const chord = deps.getKey();
    if (!chord) return;
    if (!(deps.isActive?.() ?? true)) return;
    if ((deps.getMode?.() ?? 'hold') === 'toggle') {
      if (e.repeat || MODIFIER_KEYS.has(e.key) || ribbonKeyStringFor(e) !== chord) return;
      e.preventDefault();
      e.stopPropagation();
      if (deps.isDictating?.()) deps.end();
      else deps.begin();
      return;
    }
    if (holding) {
      // Auto-repeat of the held chord (or any stray key while holding):
      // swallow so nothing types into the document mid-dictation.
      if (e.repeat || ribbonKeyStringFor(e) === chord) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
    if (MODIFIER_KEYS.has(e.key)) return;
    if (ribbonKeyStringFor(e) !== chord) return;
    e.preventDefault();
    e.stopPropagation();
    holding = true;
    deps.begin();
  };
  const onUp = (e: KeyboardEvent): void => {
    if (!holding) return;
    if (!releaseEndsHold(e, deps.getKey())) return;
    e.preventDefault();
    e.stopPropagation();
    holding = false;
    deps.end();
  };
  const onBlur = (): void => {
    if (holding) {
      holding = false;
      deps.end();
      return;
    }
    if ((deps.getMode?.() ?? 'hold') === 'toggle' && deps.isDictating?.()) deps.end();
  };
  document.addEventListener('keydown', onDown, true);
  document.addEventListener('keyup', onUp, true);
  window.addEventListener('blur', onBlur);
  return () => {
    document.removeEventListener('keydown', onDown, true);
    document.removeEventListener('keyup', onUp, true);
    window.removeEventListener('blur', onBlur);
  };
}
