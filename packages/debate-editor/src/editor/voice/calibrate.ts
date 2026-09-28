/**
 * Calibration (spec §4.4): one minute in which the user says each
 * command word a couple of times through the microphone they actually
 * use, optionally whispered. Whatever the recognizer writes for each
 * word becomes that user's alias for it; spellings that collide with
 * another word are reported instead of learned. The profile is keyed to
 * the selected microphone and lives in settings — never in a document.
 */
import { settings } from '../settings.js';
import { showToast } from '../toast.js';
import { pushOverlay, popOverlay } from '../overlay-stack.js';
import { installModalKeys, armDialogFocus, captureFocusForDialog } from '../text-prompt.js';
import type { VoiceController } from './controller.js';
import { learnAliases, VOICE_COMMANDS, VOICE_COMMAND_LABELS, type VoiceVerb } from './vocabulary.js';

const TAKES_PER_WORD = 2;

export async function openVoiceCalibration(controller: VoiceController): Promise<void> {
  if (!(await controller.ensureActive())) return;
  // From here until close the session belongs to the dialog: every
  // utterance reaches the takes below and nothing fires on the document;
  // a sleeping recognizer wakes and auto-sleep waits.
  controller.setCalibrating(true);
  if (document.querySelector('.pmd-voice-calibrate')) return;

  const overlay = document.createElement('div');
  overlay.className = 'pmd-route-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'pmd-route-dialog pmd-voice-calibrate';
  overlay.appendChild(dialog);

  const header = document.createElement('div');
  header.className = 'pmd-route-header';
  header.textContent = 'Calibrate voice control';
  const intro = document.createElement('p');
  intro.className = 'pmd-voice-calibrate-intro';
  intro.textContent =
    'Say each word when it appears, at your normal speaking volume, then again. ' +
    'What the recognizer hears becomes your own spelling of the word. Space skips a word; Esc cancels.';
  const whisperRow = document.createElement('label');
  whisperRow.className = 'pmd-voice-calibrate-option';
  const whisperBox = document.createElement('input');
  whisperBox.type = 'checkbox';
  whisperRow.append(whisperBox, document.createTextNode(' Also run a whispered pass (for quiet rooms)'));
  const prompt = document.createElement('div');
  prompt.className = 'pmd-voice-calibrate-prompt';
  const wordEl = document.createElement('div');
  wordEl.className = 'pmd-voice-calibrate-word';
  const roleEl = document.createElement('div');
  roleEl.className = 'pmd-voice-calibrate-role';
  const progressEl = document.createElement('div');
  progressEl.className = 'pmd-voice-calibrate-progress';
  const heardEl = document.createElement('div');
  heardEl.className = 'pmd-voice-calibrate-heard';
  prompt.append(wordEl, roleEl, progressEl, heardEl);
  const actions = document.createElement('div');
  actions.className = 'pmd-voice-calibrate-actions';
  const startBtn = document.createElement('button');
  startBtn.type = 'button';
  startBtn.className = 'pmd-route-cancel';
  startBtn.textContent = 'Start';
  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'pmd-route-cancel';
  skipBtn.textContent = 'Skip word';
  skipBtn.hidden = true;
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'pmd-route-cancel';
  cancelBtn.textContent = 'Cancel';
  actions.append(startBtn, skipBtn, cancelBtn);
  dialog.append(header, intro, whisperRow, prompt, actions);

  const token = pushOverlay();
  const restoreFocus = captureFocusForDialog();
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let removeKeys: (() => void) | null = null;
  const close = (): void => {
    controller.setCalibrating(false);
    if (closed) return;
    closed = true;
    unsubscribe?.();
    removeKeys?.();
    popOverlay(token);
    overlay.remove();
    restoreFocus();
  };
  cancelBtn.addEventListener('click', close);

  // The plan: every word twice, then the whispered pass if asked.
  type Step = { verb: VoiceVerb; whisper: boolean };
  let steps: Step[] = [];
  let at = 0;
  let takes: string[] = [];
  const heard = new Map<VoiceVerb, string[]>();
  let skipCurrent: (() => void) | null = null;

  const showStep = (): void => {
    const step = steps[at];
    if (!step) {
      finish();
      return;
    }
    wordEl.textContent = step.verb;
    roleEl.textContent = `${step.whisper ? 'whisper: ' : 'say: '}${VOICE_COMMAND_LABELS[step.verb]}`;
    progressEl.textContent = `${at + 1} of ${steps.length} · ${takes.length}/${TAKES_PER_WORD} heard`;
    heardEl.textContent = '';
  };
  const advance = (): void => {
    const step = steps[at];
    if (step) {
      const list = heard.get(step.verb) ?? [];
      heard.set(step.verb, [...list, ...takes]);
    }
    takes = [];
    at += 1;
    showStep();
  };
  const finish = (): void => {
    unsubscribe?.();
    unsubscribe = null;
    const deviceId = settings.get('voiceInputDeviceId') || '';
    const existing = settings.get('voiceProfiles')[deviceId];
    const aliases: Record<string, string[]> = { ...(existing?.aliases ?? {}) };
    const report: string[] = [];
    let learned = 0;
    for (const verb of VOICE_COMMANDS) {
      const transcripts = heard.get(verb) ?? [];
      if (!transcripts.length) continue;
      const res = learnAliases(verb, transcripts, { aliases });
      if (res.aliases.length) {
        aliases[verb] = [...new Set([...(aliases[verb] ?? []), ...res.aliases])];
        learned += res.aliases.length;
      }
      for (const c of res.collisions) report.push(`"${verb}" was heard as "${c.transcript}", which is how "${c.with}" sounds — say them a little differently.`);
      const recognized = transcripts.filter((t) => res.aliases.length === 0 && res.collisions.length === 0).length;
      if (!recognized && !res.aliases.length) report.push(`"${verb}" was not recognized in any take.`);
    }
    settings.set('voiceProfiles', { ...settings.get('voiceProfiles'), [deviceId]: { aliases, updatedAt: Date.now() } });
    controller.reloadProfile();
    wordEl.textContent = 'Done';
    roleEl.textContent = learned ? `${learned} new spelling${learned === 1 ? '' : 's'} learned for this microphone.` : 'Every word was recognized as itself — nothing to learn.';
    progressEl.textContent = '';
    heardEl.innerHTML = '';
    for (const line of report) {
      const p = document.createElement('div');
      p.className = 'pmd-voice-calibrate-report';
      p.textContent = line;
      heardEl.appendChild(p);
    }
    skipBtn.hidden = true;
    cancelBtn.textContent = 'Close';
    showToast('Voice calibration saved', { durationMs: 1800 });
  };
  const start = (): void => {
    steps = VOICE_COMMANDS.map((verb) => ({ verb, whisper: false }));
    if (whisperBox.checked) steps = [...steps, ...VOICE_COMMANDS.map((verb) => ({ verb, whisper: true }))];
    at = 0;
    takes = [];
    startBtn.hidden = true;
    whisperRow.hidden = true;
    skipBtn.hidden = false;
    unsubscribe = controller.onTranscript((raw, verb) => {
      if (closed || !steps[at]) return;
      const t = raw.trim();
      if (!t) return;
      takes.push(t);
      heardEl.textContent = verb === steps[at]!.verb ? `heard "${t}" ✓` : `heard "${t}"`;
      progressEl.textContent = `${at + 1} of ${steps.length} · ${takes.length}/${TAKES_PER_WORD} heard`;
      if (takes.length >= TAKES_PER_WORD) setTimeout(advance, 350);
    });
    skipCurrent = advance;
    showStep();
  };
  startBtn.addEventListener('click', start);
  skipBtn.addEventListener('click', () => skipCurrent?.());

  removeKeys = installModalKeys(dialog, token, (e) => {
    if (e.key === 'Escape') {
      close();
      return true;
    }
    if (e.key === ' ' && !skipBtn.hidden) {
      skipCurrent?.();
      return true;
    }
    if (e.key === 'Enter' && !startBtn.hidden) {
      start();
      return true;
    }
    return false;
  });
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close();
  });
  document.body.appendChild(overlay);
  armDialogFocus(dialog, 'dialog', 'Calibrate voice control');
}
