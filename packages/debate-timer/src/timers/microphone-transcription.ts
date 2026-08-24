/**
 * @fileoverview Microphone dictation for the live in-round word-limit popover
 * (`SpeechWordCounter`) — the last remaining half of the "Speech text is
 * typed or pasted; there is no transcription path feeding the word counter"
 * Known gap recorded in `docs/features/word-count-rounds.md`. The standalone
 * `/word-count` submission form and the transcript-extraction/coach-materials
 * forms already closed their halves of this gap the same way.
 *
 * This repo has no server-side/paid transcription service, so this closes the
 * gap with the browser's own Web Speech API (`SpeechRecognition` /
 * `webkitSpeechRecognition`) instead: a user speaks, the browser transcribes
 * locally/via its own vendor service, and the recognized text is appended
 * into the speech textarea inside the popover. No new ambient browser types
 * existed for this API in the repo (`SpeechRecognition` isn't in
 * `lib.dom.d.ts`), so this module also carries the minimal type shape it
 * needs — see `hooks/useMicrophoneTranscription.ts` for the React wiring
 * that actually instantiates it.
 *
 * `debate-timer` has no dependency on `debate-round` (the reverse is true —
 * `debate-round`'s `SpeechHeaderBar` imports `SpeechWordCounter` from this
 * package), so this is a local copy rather than a shared import, mirroring
 * `debate-round/src/round/microphone-transcription.ts` and
 * `debate-speech-writer/src/coach/microphone-transcription.ts`, the same
 * pattern's other two per-package copies.
 *
 * Pure and unit-testable on its own (feature detection takes an explicit
 * window-like object rather than reading a global), unlike the hook itself —
 * mirroring every other browser-API hook in this repo (e.g.
 * `debate-timer/src/hooks/useSpeechRecorder.ts`), none of which are directly
 * unit-tested since there is no jsdom environment in this repo's Vitest setup.
 *
 * @module timers/microphone-transcription
 */

/**
 * The subset of the global object this module needs to feature-detect.
 * Deliberately untyped as `unknown` at the call site (rather than a `Window`
 * reference) since neither `SpeechRecognition` nor `webkitSpeechRecognition`
 * exists on `lib.dom.d.ts`'s `Window` type.
 */
export type SpeechRecognitionHost = unknown;

/**
 * Returns the browser's `SpeechRecognition` constructor, preferring the
 * unprefixed name and falling back to the still-common `webkit`-prefixed one.
 * Returns `undefined` when neither exists (SSR, or a browser without support).
 */
export function getSpeechRecognitionConstructor(
  host: SpeechRecognitionHost | undefined,
): unknown {
  if (!host || typeof host !== "object") return undefined;
  const record = host as Record<string, unknown>;
  return record.SpeechRecognition ?? record.webkitSpeechRecognition ?? undefined;
}

/** Whether microphone dictation is available on `host` (`undefined` for SSR). */
export function isMicrophoneTranscriptionSupported(
  host: SpeechRecognitionHost | undefined,
): boolean {
  return typeof getSpeechRecognitionConstructor(host) === "function";
}

/**
 * Appends a newly dictated segment onto existing transcript text, joining
 * with a single space and never producing doubled whitespace. An empty (or
 * whitespace-only) segment is a no-op; dictating into an empty field returns
 * just the segment, trimmed.
 */
export function appendDictatedSegment(existingText: string, segment: string): string {
  const trimmedSegment = segment.trim();
  if (!trimmedSegment) return existingText;
  const trimmedExisting = existingText.replace(/\s+$/, "");
  if (!trimmedExisting) return trimmedSegment;
  return `${trimmedExisting} ${trimmedSegment}`;
}

/** Known `SpeechRecognitionErrorEvent.error` codes this module maps to a friendly message. */
export type SpeechRecognitionErrorCode =
  | "not-allowed"
  | "no-speech"
  | "audio-capture"
  | "network"
  | "aborted"
  | "language-not-supported"
  | "service-not-allowed"
  | (string & {});

const ERROR_MESSAGES: Partial<Record<SpeechRecognitionErrorCode, string>> = {
  "not-allowed": "Microphone access was denied. Allow microphone access and try again.",
  "no-speech": "No speech was detected. Try again and speak after clicking Record.",
  "audio-capture": "No microphone was found. Connect a microphone and try again.",
  network: "A network error interrupted speech recognition. Try again.",
  aborted: "Recording was stopped before any speech was recognized.",
  "language-not-supported": "This browser's speech recognition doesn't support the requested language.",
  "service-not-allowed": "The browser blocked access to its speech recognition service.",
};

/** Turns a `SpeechRecognitionErrorEvent.error` code into a readable, user-facing message. */
export function describeMicrophoneTranscriptionError(code: SpeechRecognitionErrorCode): string {
  return ERROR_MESSAGES[code] ?? `Speech recognition failed (${code}).`;
}
