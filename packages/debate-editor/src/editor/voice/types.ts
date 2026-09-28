/**
 * Renderer-side mirror of the recognizer worker's typed events (voice
 * v2 — apps/desktop/src/voice/types.ts). The renderer consumes these
 * and nothing lower-level: no raw audio, no transcription streams.
 */

export type VoiceMode = 'command' | 'dictation' | 'asleep';

/** The sticky pen: the mark a bare mark word arms for the next dictation. */
export type PenName = 'underline' | 'highlight' | 'emphasis';

export interface VoiceEventBase {
  utteranceId: number;
  mode: VoiceMode;
  raw: string;
  tEndOfSpeech: number;
  tParse: number;
}

export type VoiceEvent = VoiceEventBase &
  (
    | { kind: 'command'; verb: string }
    | { kind: 'rejection'; reason: 'out-of-vocabulary' | 'too-long' }
    | { kind: 'dictation'; text: string; durationMs: number }
    | { kind: 'mode'; from: VoiceMode; to: VoiceMode; trigger: string }
  );

/** Out-of-band session-terminated notice (worker crash/exit). */
export interface VoiceEndedEvent {
  kind: 'ended';
  reason: string;
}

export interface VoiceLevel {
  rms: number;
  speech: boolean;
  autoSleepRemainingMs?: number;
}
