/**
 * Voice plugin state + utterance-atomicity machinery. The single most
 * important contract here: one utterance = one undo step, exactly, so
 * a spoken `undo` ≡ Ctrl+Z. Mechanism:
 *
 *  - every transaction produced by a voice utterance carries the
 *    utterance id in meta;
 *  - the FIRST transaction of a new utterance closes the previous
 *    history group (`closeHistory`), so the utterance starts fresh;
 *  - when the utterance finishes, `sealUtterance` closes the group
 *    again, so subsequent keyboard input can never merge into it.
 *
 * Within the utterance, prosemirror-history's normal adjacent-step
 * merging does the grouping — no custom history plugin.
 */
import { Plugin, PluginKey } from 'prosemirror-state';
import type { EditorState, Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { closeHistory } from 'prosemirror-history';
import type { PenName, VoiceMode } from './types';

export interface VoiceLogEntry {
  utteranceId: number;
  kind: 'command' | 'rejection' | 'dictation' | 'mode';
  text: string;
}

export interface VoicePluginState {
  listening: boolean;
  mode: VoiceMode;
  /** Sticky pen (spec §5.2): armed by a bare mark word, applied to the
   *  next dictation, disarmed by the same word or `bare`. Null = plain. */
  pen: PenName | null;
  /** Last utterance id whose transactions reached this state. */
  lastUtteranceId: number;
  /** Recent pill scrollback (newest last, capped). */
  log: VoiceLogEntry[];
  /** Provisional widget text at the cursor while a held dictation is
   *  being transcribed (decoration only — never document content). */
  ghostText: string | null;
}

const LOG_CAP = 50;

/** Transaction meta key carrying { utteranceId }. */
export const VOICE_UTTERANCE_META = 'voiceUtterance';

export const voicePluginKey = new PluginKey<VoicePluginState>('cardmirrorVoice');

const INITIAL: VoicePluginState = {
  listening: false,
  mode: 'command',
  pen: null,
  lastUtteranceId: 0,
  log: [],
  ghostText: null,
};

/** Patch applied via tr.setMeta(voicePluginKey, patch). */
export interface VoiceStatePatch {
  listening?: boolean;
  mode?: VoiceMode;
  pen?: PenName | null;
  appendLog?: VoiceLogEntry;
  ghostText?: string | null;
}

export function voicePlugin(): Plugin<VoicePluginState> {
  return new Plugin<VoicePluginState>({
    key: voicePluginKey,
    state: {
      init: () => ({ ...INITIAL }),
      apply(tr: Transaction, prev: VoicePluginState): VoicePluginState {
        let next = prev;
        const utter = tr.getMeta(VOICE_UTTERANCE_META) as { utteranceId: number } | undefined;
        if (utter && utter.utteranceId !== next.lastUtteranceId) {
          next = { ...next, lastUtteranceId: utter.utteranceId };
        }
        const patch = tr.getMeta(voicePluginKey) as VoiceStatePatch | undefined;
        if (patch) {
          next = { ...next };
          if (patch.listening !== undefined) next.listening = patch.listening;
          if (patch.mode !== undefined) next.mode = patch.mode;
          if (patch.pen !== undefined) next.pen = patch.pen;
          if (patch.appendLog) next.log = [...next.log, patch.appendLog].slice(-LOG_CAP);
          if (patch.ghostText !== undefined) next.ghostText = patch.ghostText;
        }
        return next;
      },
    },
    props: {
      decorations(state: EditorState) {
        const st = voicePluginKey.getState(state);
        if (!st?.ghostText) return null;
        const ghost = st.ghostText;
        return DecorationSet.create(state.doc, [
          Decoration.widget(
            state.selection.head,
            () => {
              const span = document.createElement('span');
              span.className = 'pmd-voice-ghost';
              span.textContent = ghost;
              return span;
            },
            { side: 1, key: `voice-ghost-${ghost}` },
          ),
        ]);
      },
    },
  });
}

/** Minimal view surface the dispatcher needs — also what tests provide. */
export interface ViewLike {
  readonly state: EditorState;
  dispatch(tr: Transaction): void;
}

/**
 * Returns a dispatch function for one utterance: the first transaction
 * of a new utterance id seals the previous undo group, and every
 * transaction is tagged with the utterance id.
 */
export function voiceDispatcher(view: ViewLike, utteranceId: number): (tr: Transaction) => void {
  let first = true;
  return (tr: Transaction) => {
    const st = voicePluginKey.getState(view.state);
    if (first && st && st.lastUtteranceId !== utteranceId) tr = closeHistory(tr);
    tr.setMeta(VOICE_UTTERANCE_META, { utteranceId });
    first = false;
    view.dispatch(tr);
  };
}

/**
 * Seal the undo group after an utterance's transactions have all been
 * dispatched: a steps-less transaction carrying closeHistory, so the
 * next keyboard input starts its own group instead of merging into the
 * utterance.
 */
export function sealUtterance(view: ViewLike): void {
  view.dispatch(closeHistory(view.state.tr));
}

/** Apply a state patch outside any utterance (pen change, log echo …). */
export function patchVoiceState(view: ViewLike, patch: VoiceStatePatch): void {
  const tr = view.state.tr;
  tr.setMeta(voicePluginKey, patch);
  tr.setMeta('addToHistory', false);
  view.dispatch(tr);
}
