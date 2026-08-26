/**
 * Timer profile switching, shared by the Settings profile picker and the
 * "Cycle Timer Preset" command so the two can't drift. A profile (College /
 * High School / Pomodoro) is a named set of timer durations; switching one in
 * mirrors its saved speech presets + prep total into the live settings and
 * refills the prep clocks.
 */

import { settings, type Settings } from './settings.js';
import { resetTimer } from './timer-state.js';

/** Order the Cycle Timer Preset command walks (and wraps): College → High
 *  School → Pomodoro. */
const PROFILE_CYCLE: Settings['timerProfile'][] = ['college', 'highSchool', 'pomodoro'];

export const TIMER_PROFILE_LABELS: Record<Settings['timerProfile'], string> = {
  highSchool: 'High school',
  college: 'College',
  pomodoro: 'Pomodoro',
};

/** Switch to `profile` and apply its saved durations to the live settings + prep
 *  clocks. Profile switch is conceptually "set up a fresh round," so the prep
 *  balances refill (via resetTimer) rather than carrying over. */
export function applyTimerProfile(profile: Settings['timerProfile']): void {
  settings.set('timerProfile', profile);
  const p = settings.get('timerProfiles')[profile];
  settings.set('timerSpeechPresets', p.speechPresets as never);
  settings.set('timerPrepMinutes', p.prepMinutes);
  resetTimer(p.prepMinutes * 60 * 1000);
}

/** Advance to the next profile in the cycle (wrapping) and apply it. Returns the
 *  new profile id (its label is in {@link TIMER_PROFILE_LABELS}). */
export function cycleTimerProfile(): Settings['timerProfile'] {
  const cur = settings.get('timerProfile');
  const i = PROFILE_CYCLE.indexOf(cur);
  const next = PROFILE_CYCLE[(i + 1) % PROFILE_CYCLE.length]!;
  applyTimerProfile(next);
  return next;
}
