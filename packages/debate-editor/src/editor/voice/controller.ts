/**
 * Voice controller (voice v2): session lifecycle glue between the
 * recognizer worker and the editor. Owns mic capture, the two channels
 * (ambient commands; held-key dictation), event routing into the
 * dispatcher and the landing pipeline, the feedback pill, and the
 * per-microphone calibration profile. Desktop-only — the web edition
 * has no recognition host.
 */
import type { EditorView } from 'prosemirror-view';
import { alertDialog, confirmDialog } from '../text-prompt.js';
import type { RibbonContext } from '../ribbon-commands.js';
import { settings } from '../settings.js';
import { showToast } from '../toast.js';
import { MicCapture } from './capture.js';
import { cleanupTranscript } from './cleanup.js';
import { applyVoiceCommand, type DispatchDeps } from './dispatch.js';
import { landDictation } from './landing.js';
import { patchVoiceState, voicePluginKey } from './plugin.js';
import { VoicePill } from './ui.js';
import type { VoiceEndedEvent, VoiceEvent, VoiceLevel } from './types';
import type { VoiceProfile } from './vocabulary.js';

/** The preload voice surface (subset of window.electronAPI). */
export interface VoiceHostApi {
  voiceStart(opts?: { autoSleepSeconds?: number; profile?: VoiceProfile | null }): Promise<{ ok: boolean; error?: string; modelLoadMs?: number }>;
  voiceStop(): Promise<void>;
  voicePushAudio(chunk: ArrayBuffer): void;
  voiceDictation(on: boolean, opts?: { autoEndAfterMs?: number }): Promise<void>;
  voiceSetProfile(profile: VoiceProfile | null): Promise<void>;
  voiceCalibrating?(on: boolean): Promise<void>;
  voiceClipboard(op: 'copy' | 'cut' | 'paste'): Promise<void>;
  onVoiceEvent(handler: (event: unknown) => void): () => void;
  onVoiceLevel(handler: (level: VoiceLevel) => void): () => void;
  voiceModelInfo?(): Promise<{ present: boolean; downloading: boolean; sizeMB: number }>;
  voiceDownloadModel?(): Promise<{ ok: boolean; error?: string }>;
}

export function voiceHost(): VoiceHostApi | null {
  const api = (window as unknown as { electronAPI?: Partial<VoiceHostApi> }).electronAPI;
  return api && typeof api.voiceStart === 'function' ? (api as VoiceHostApi) : null;
}

export type TranscriptListener = (raw: string, verb: string | null) => void;

/** The calibration profile for the selected microphone ('' = default). */
export function profileForDevice(deviceId: string): VoiceProfile | null {
  const all = settings.get('voiceProfiles');
  const mine = all[deviceId] ?? all[''];
  return mine ? { aliases: mine.aliases } : null;
}

export class VoiceController {
  private capture = new MicCapture();
  private pill: VoicePill | null = null;
  private unsubscribers: Array<() => void> = [];
  private active = false;
  private starting = false;
  private generation = 0;
  private holding = false;
  private transcriptListeners = new Set<TranscriptListener>();
  /** While the calibration dialog is open, utterances go to its
   *  transcript listeners only — nothing fires on the document — and
   *  the recognizer stays awake. */
  private calibrating = false;
  private uiInputBaseline: string | null = null;

  constructor(
    private deps: {
      getView: () => EditorView | null;
      ribbonCtx: RibbonContext;
      undo?: () => boolean;
      onCalibrate?: () => void;
    },
  ) {}

  get isActive(): boolean {
    return this.active;
  }

  get isHolding(): boolean {
    return this.holding;
  }

  /** Every command-mode transcript (accepted or not), for calibration. */
  onTranscript(fn: TranscriptListener): () => void {
    this.transcriptListeners.add(fn);
    return () => this.transcriptListeners.delete(fn);
  }

  setCalibrating(on: boolean): void {
    this.calibrating = on;
    void voiceHost()?.voiceCalibrating?.(on);
  }

  async toggle(): Promise<void> {
    if (this.starting) return;
    if (this.active) {
      this.stop();
      return;
    }
    this.starting = true;
    try {
      await this.startSession();
    } finally {
      this.starting = false;
    }
  }

  /** Start if not running; resolves true when listening. */
  async ensureActive(): Promise<boolean> {
    if (this.active) return true;
    await this.toggle();
    return this.active;
  }

  private async startSession(): Promise<void> {
    const gen = ++this.generation;
    const cancelled = () => gen !== this.generation;
    const host = voiceHost();
    if (!host) {
      showToast('Voice control needs the desktop app', { durationMs: 1600 });
      return;
    }
    const view = this.deps.getView();
    if (!view) {
      showToast('Open a document first, then turn voice on', { durationMs: 1800 });
      return;
    }

    this.pill ??= new VoicePill({
      onStop: () => {
        if (this.active) this.stop();
      },
      onCalibrate: this.deps.onCalibrate,
    });
    this.pill.setListening(true);
    this.pill.setEcho('loading model…', true);

    const deviceId = settings.get('voiceInputDeviceId') || '';
    const res = await host.voiceStart({
      autoSleepSeconds: settings.get('voiceAutoSleepSeconds'),
      profile: profileForDevice(deviceId),
    });
    if (cancelled()) {
      void host.voiceStop();
      this.pill?.setListening(false);
      return;
    }
    if (!res.ok) {
      this.pill.setListening(false);
      if (res.error === 'voice-model-missing') {
        void this.offerModelDownload(host);
        return;
      }
      const msg =
        res.error === 'voice-mic-denied'
          ? 'Microphone access denied — enable it in System Settings → Privacy & Security → Microphone'
          : `Voice failed to start: ${res.error}`;
      showToast(msg, { durationMs: res.error === 'voice-mic-denied' ? 4000 : 2400 });
      return;
    }

    const ui: DispatchDeps['ui'] = {
      echo: (text, ok) => {
        this.pill?.setEcho(text, ok);
        if (ok) this.pill?.earconAccept();
        else this.pill?.earconReject();
      },
      hint: (text) => this.pill?.setEcho(text, false),
    };
    const dispatchDeps: DispatchDeps = {
      ribbonCtx: this.deps.ribbonCtx,
      ui,
      undo: this.deps.undo,
    };

    this.unsubscribers.push(
      host.onVoiceEvent((raw) => this.handleEvent(raw as VoiceEvent | VoiceEndedEvent, dispatchDeps)),
      host.onVoiceLevel((level) => {
        this.pill?.setLevel(level);
        this.pill?.setAutoSleepCountdown(level.autoSleepRemainingMs ?? null);
      }),
    );

    try {
      await this.capture.start((chunk) => host.voicePushAudio(chunk), deviceId || undefined);
      if (cancelled()) {
        this.capture.stop();
        void host.voiceStop();
        this.pill?.setListening(false);
        return;
      }
    } catch (err) {
      if (deviceId) {
        try {
          await this.capture.start((chunk) => host.voicePushAudio(chunk));
          showToast('Saved microphone not found — using system default', { durationMs: 2000 });
        } catch (err2) {
          this.stop();
          showToast(`Microphone unavailable: ${String(err2)}`, { durationMs: 2400 });
          return;
        }
      } else {
        this.stop();
        showToast(`Microphone unavailable: ${String(err)}`, { durationMs: 2400 });
        return;
      }
    }

    // Device changes mid-session swap the capture stream live and load
    // that microphone's calibration profile.
    let activeDeviceId = deviceId;
    this.unsubscribers.push(
      settings.subscribe((snapshot) => {
        if (!this.active || snapshot.voiceInputDeviceId === activeDeviceId) return;
        activeDeviceId = snapshot.voiceInputDeviceId;
        this.capture.stop();
        void this.capture
          .start((chunk) => host.voicePushAudio(chunk), activeDeviceId || undefined)
          .catch((err) => showToast(`Microphone switch failed: ${String(err)}`, { durationMs: 2400 }));
        void host.voiceSetProfile(profileForDevice(activeDeviceId));
      }),
    );

    this.active = true;
    this.pill.setMode('command');
    this.pill.setEcho('listening', true);
    this.pill.earconMode('command');
    this.pill.setPen(voicePluginKey.getState(view.state)?.pen ?? null);
    document.body.classList.add('pmd-voice-listening');
    setBodyModeClass('command');
    patchVoiceState(view, { listening: true, mode: 'command' });
  }

  /** First-run flow when the models aren't downloaded yet. */
  private async offerModelDownload(host: VoiceHostApi): Promise<void> {
    if (!host.voiceDownloadModel || !host.voiceModelInfo) {
      showToast("Voice model not downloaded, and this install can't fetch it — update CardMirror", { durationMs: 3200 });
      return;
    }
    const info = await host.voiceModelInfo();
    if (info.downloading) {
      showToast('Voice model is already downloading — you’ll be notified when it’s ready', { durationMs: 3200 });
      return;
    }
    const proceed = await confirmDialog(
      `Voice control needs a one-time download of its speech engine and recognition model (about ${info.sizeMB} MB). ` +
        'This can take a few minutes; you can keep working and you’ll be notified when it’s ready. Download now?',
      { okLabel: 'Download' },
    );
    if (!proceed) return;
    showToast('Downloading voice model in the background…', { durationMs: 3200 });
    const res = await host.voiceDownloadModel();
    if (res.ok) {
      await alertDialog('Voice model downloaded. Press the voice key (or the ribbon button) to start voice control.');
    } else {
      const reason = res.error === 'download-in-progress' ? 'already in progress' : (res.error ?? 'unknown error');
      showToast(`Voice model download failed: ${reason}`, { durationMs: 4000 });
    }
  }

  /** Push the (possibly just calibrated) profile to the live session. */
  reloadProfile(): void {
    if (!this.active) return;
    void voiceHost()?.voiceSetProfile(profileForDevice(settings.get('voiceInputDeviceId') || ''));
  }

  // ---- held-key dictation ----

  beginDictation(): void {
    if (!this.active) {
      showToast('Turn voice control on first (Alt-Shift-V)', { durationMs: 1800 });
      return;
    }
    if (this.holding) return;
    this.holding = true;
    // Toggle mode carries the silence limit; a held key is its own limit.
    const toggle = settings.get('voiceDictateToggle');
    void voiceHost()?.voiceDictation(true, toggle ? { autoEndAfterMs: settings.get('voiceDictateSilenceSeconds') * 1000 } : undefined);
    const view = this.deps.getView();
    if (view) patchVoiceState(view, { ghostText: null });
  }

  /** Whether a dictation session is open (the toggle key asks). */
  isDictating(): boolean {
    return this.holding;
  }

  endDictation(): void {
    if (!this.holding) return;
    this.holding = false;
    void voiceHost()?.voiceDictation(false);
    const view = this.deps.getView();
    if (view) patchVoiceState(view, { ghostText: '…' });
  }

  stop(): void {
    this.generation++;
    this.active = false;
    this.holding = false;
    this.capture.stop();
    for (const u of this.unsubscribers.splice(0)) u();
    void voiceHost()?.voiceStop();
    this.pill?.setListening(false);
    document.body.classList.remove('pmd-voice-listening');
    setBodyModeClass(null);
    const view = this.deps.getView();
    if (view) patchVoiceState(view, { listening: false, ghostText: null, mode: 'command' });
  }

  private handleEvent(event: VoiceEvent | VoiceEndedEvent, deps: DispatchDeps): void {
    if (event.kind === 'ended') {
      this.stop();
      showToast(`Voice stopped: ${event.reason}`, { durationMs: 2600 });
      return;
    }
    const view = this.deps.getView();
    if (!view) return;
    void this.routeEvent(view, event, deps)
      .catch((err) => {
        console.error('voice: command failed', err);
        this.pill?.setEcho(`(error) ${event.raw ?? ''}`, false);
        this.pill?.earconReject();
      })
      .finally(() => {
        const v = this.deps.getView();
        const st = v ? voicePluginKey.getState(v.state) : null;
        if (st) this.pill?.setPen(st.pen);
      });
  }

  private async routeEvent(view: EditorView, event: VoiceEvent, deps: DispatchDeps): Promise<void> {
    switch (event.kind) {
      case 'command':
        for (const fn of this.transcriptListeners) fn(event.raw, event.verb);
        if (this.calibrating) {
          // The dialog heard it; the document must not.
          this.pill?.setEcho(event.raw, true);
          break;
        }
        await applyVoiceCommand(view, event, deps);
        break;
      case 'rejection':
        for (const fn of this.transcriptListeners) fn(event.raw, null);
        if (this.calibrating) {
          this.pill?.setEcho(event.raw, false);
          break;
        }
        if (event.reason === 'too-long') break; // speech aimed elsewhere; stay quiet
        this.pill?.setEcho(`(not a command) "${event.raw}"`, false);
        patchVoiceState(view, { appendLog: { utteranceId: event.utteranceId, kind: 'rejection', text: event.raw } });
        break;
      case 'dictation': {
        patchVoiceState(view, { ghostText: null });
        if (this.calibrating) break; // nothing lands while the dialog is open
        if (!event.text.trim()) {
          this.pill?.setEcho('(nothing heard)', false);
          break;
        }
        const input = activeUiInput();
        if (input) {
          // Focused UI inputs (palette search fields, dialogs) receive
          // dictation instead of the document.
          typeIntoUiInput(input, event.text);
          this.pill?.setEcho(event.text, true);
          break;
        }
        const sel = view.state.selection;
        const before = view.state.doc.textBetween(Math.max(0, sel.from - 200), sel.from, '\n', ' ');
        const cleaned = await cleanupTranscript(event.text, { before, names: namesNear(view) });
        const v2 = this.deps.getView();
        if (!v2) break;
        const pen = voicePluginKey.getState(v2.state)?.pen ?? null;
        landDictation(v2, { utteranceId: event.utteranceId, pen, deps, text: cleaned });
        this.pill?.setEcho(cleaned, true);
        this.pill?.earconAccept();
        break;
      }
      case 'mode': {
        if (event.from === 'dictation') {
          patchVoiceState(view, { ghostText: null });
          if (this.holding && event.trigger === 'silence') {
            // The service ended the session (toggle mode's silence limit):
            // the key side must agree, or the next press would "end" a
            // session that is already over.
            this.holding = false;
            this.pill?.setEcho('dictation stopped — silence', false);
          }
        }
        this.pill?.setMode(event.to);
        this.pill?.earconMode(event.to);
        setBodyModeClass(event.to);
        patchVoiceState(view, { mode: event.to, appendLog: { utteranceId: event.utteranceId, kind: 'mode', text: event.trigger } });
        break;
      }
    }
  }

  stateFor(view: EditorView) {
    return voicePluginKey.getState(view.state);
  }
}

const MODE_CLASSES = ['pmd-voice-m-command', 'pmd-voice-m-dictation', 'pmd-voice-m-asleep'];
function setBodyModeClass(mode: string | null): void {
  document.body.classList.remove(...MODE_CLASSES);
  if (mode) document.body.classList.add(`pmd-voice-m-${mode}`);
}

/** Capitalized words near the cursor plus every tag's capitalized
 *  words — the names the speaker is likely to say (cleanup hints). */
export function namesNear(view: EditorView): string[] {
  const { doc, selection } = view.state;
  const near = doc.textBetween(Math.max(0, selection.from - 2500), Math.min(doc.content.size, selection.from + 2500), ' ', ' ');
  const tags: string[] = [];
  doc.descendants((node) => {
    if (node.type.name === 'tag' || node.type.name === 'cite_paragraph') {
      tags.push(node.textContent);
      return false;
    }
    return true;
  });
  const seen = new Set<string>();
  for (const m of `${near} ${tags.join(' ')}`.matchAll(/\b[A-Z][a-zA-Z'’-]{2,}\b/g)) {
    const w = m[0];
    if (!seen.has(w)) seen.add(w);
    if (seen.size >= 60) break;
  }
  return [...seen];
}

/** A focused text input outside the editor (palette search, dialogs). */
export function activeUiInput(): HTMLInputElement | HTMLTextAreaElement | null {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement && (el.type === 'text' || el.type === 'search' || !el.type)) return el;
  if (el instanceof HTMLTextAreaElement) return el;
  return null;
}

export function typeIntoUiInput(el: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const before = el.value.slice(0, start);
  const sep = before && !/\s$/.test(before) ? ' ' : '';
  el.value = before + sep + text + el.value.slice(end);
  const caret = (before + sep + text).length;
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new InputEvent('input', { bubbles: true }));
}
