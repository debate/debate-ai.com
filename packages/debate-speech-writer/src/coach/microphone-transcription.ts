/**
 * @fileoverview Microphone dictation for the Coach Materials upload form —
 * closes the still-open "recording" half of follow-up (a) named under idea
 * #8 ("Video-Lecture-Training Coach AI") in TODO.md's Product Feature Ideas
 * list: "audio/video transcription... remains open — not started; no
 * transcription service exists in this repo," the same gap recorded in
 * `docs/features/coach-materials.md`'s Known gaps.
 *
 * This mirrors `debate-round`'s `round/microphone-transcription.ts`, which
 * closed the identical gap under idea #6 ("Speech Transcript Summaries and
 * Answers") using the browser's own Web Speech API
 * (`SpeechRecognition`/`webkitSpeechRecognition`) instead of a server-side/
 * paid transcription service, neither of which exists in this repo. The
 * logic is duplicated here rather than imported from `debate-round` because
 * `debate-round` already depends on `debate-speech-writer` — the reverse
 * import would be circular. No new ambient browser types existed for this
 * API in the repo (`SpeechRecognition` isn't in `lib.dom.d.ts`), so this
 * module also carries the minimal type shape it needs — see
 * `hooks/useMicrophoneTranscription.ts` for the React wiring that actually
 * instantiates it.
 *
 * Pure and unit-testable on its own (feature detection takes an explicit
 * window-like object rather than reading a global), unlike the hook itself —
 * mirroring every other browser-API hook in this repo, none of which are
 * directly unit-tested since there is no jsdom environment in this repo's
 * Vitest setup.
 *
 * @module coach/microphone-transcription
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
 * Appends a newly dictated segment onto existing material text, joining
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
