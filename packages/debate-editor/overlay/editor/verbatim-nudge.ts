/**
 * Verbatim onboarding nudge — a one-time pointer at the keyboard
 * shortcuts reference (`reference-ui.ts`) for a visitor who never got
 * the UI tour's own "reference" step (`ui-tour.ts`): an established
 * profile the tour auto-skips outright, or someone who started the
 * tour and left (Esc / closed the tab) before reaching that step.
 * CardMirror's F8/F9/F10/F3 hotkey family is a direct port of
 * Verbatim's own, so this is the one thing worth surfacing to a
 * Verbatim-trained user who'd otherwise never discover the reference.
 *
 * Split into a pure trigger check (`shouldShowVerbatimNudge`, directly
 * tested) and the DOM/dialog side effect (`maybeShowVerbatimNudge`),
 * mirroring how the rest of this package separates decision logic from
 * its rendering.
 */
import { settings } from './settings.js';
import { promptForRouteChoice } from './text-prompt.js';
import { isUiTourRunning } from './ui-tour.js';

export interface VerbatimNudgeState {
  hasSeenVerbatimNudge: boolean;
  hasOpenedShortcutsReference: boolean;
  hasSeenUiTour: boolean;
}

/** Whether the nudge should show right now, given the current settings
 *  snapshot. Already seen, or the reference has already been opened by
 *  any route → no. `hasSeenUiTour` is stamped the instant a tour
 *  STARTS or is auto-skipped for an established profile (see
 *  `ui-tour.ts#maybeAutoStartUiTour`) — false here means the tour
 *  hasn't even been offered yet, so let it go first rather than racing
 *  it. (Whether a tour is actively mid-run right now is a separate,
 *  live-DOM concern handled by `maybeShowVerbatimNudge` below, not by
 *  this pure predicate.) */
export function shouldShowVerbatimNudge(state: VerbatimNudgeState): boolean {
  if (state.hasSeenVerbatimNudge) return false;
  if (state.hasOpenedShortcutsReference) return false;
  if (!state.hasSeenUiTour) return false;
  return true;
}

const NUDGE_MESSAGE =
  'Coming from Verbatim? CardMirror keeps the same F8 / F9 / F10 / F3 hotkey family — ' +
  'the full reference is one click away.';

const POLL_MS = 2000;
// ~5 minutes — generous enough to outlast a tour actually being taken
// (the tour itself estimates "about a minute") before giving up.
const MAX_TRIES = 150;

let scheduled = false;

function currentState(): VerbatimNudgeState {
  return {
    hasSeenVerbatimNudge: settings.get('hasSeenVerbatimNudge'),
    hasOpenedShortcutsReference: settings.get('hasOpenedShortcutsReference'),
    hasSeenUiTour: settings.get('hasSeenUiTour'),
  };
}

/** Poll for the right moment to show the nudge. Call once; safe to
 *  call from every entry point since it's a no-op after the first
 *  call. Desktop layout only, mirroring the UI tour's own gating (the
 *  mobile UI has no ribbon reference button to point at). */
export function maybeShowVerbatimNudge(): void {
  if (scheduled) return;
  scheduled = true;
  let tries = 0;
  const poll = window.setInterval(() => {
    tries++;
    if (settings.get('hasSeenVerbatimNudge')) {
      window.clearInterval(poll);
      return;
    }
    if (tries > MAX_TRIES) {
      window.clearInterval(poll);
      return;
    }
    if (isUiTourRunning()) return; // wait the tour out rather than stack on top of it
    if (!shouldShowVerbatimNudge(currentState())) return;
    // A document has to actually be open for the reference to mean
    // anything — the home screen doesn't need this nudge.
    if (document.querySelector('.ProseMirror') === null) return;
    window.clearInterval(poll);
    settings.set('hasSeenVerbatimNudge', true);
    void promptForRouteChoice<'reference'>({
      message: NUDGE_MESSAGE,
      choices: [
        {
          value: 'reference',
          label: 'Open the shortcuts reference',
          description: 'See every command and its key, searchable, printable, exportable.',
        },
      ],
      cancelLabel: 'Not now',
    }).then((choice) => {
      if (choice === 'reference') {
        void import('./reference-ui.js').then((m) => m.openReference());
      }
    });
  }, POLL_MS);
}
