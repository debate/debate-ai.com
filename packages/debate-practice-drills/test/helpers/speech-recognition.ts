/**
 * @fileoverview A stand-in for the browser's `SpeechRecognition`, so the
 * dictation buttons render and can be driven: `emit` delivers a final
 * transcript segment to the recognizer that is currently listening.
 */
export class FakeRecognition {
  static current: FakeRecognition | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start() {
    FakeRecognition.current = this;
  }
  stop() {
    this.onend?.();
    FakeRecognition.current = null;
  }
  /** Delivers one final transcript segment. */
  static emit(transcript: string) {
    FakeRecognition.current?.onresult?.({ resultIndex: 0, results: [{ 0: { transcript }, isFinal: true, length: 1 }] });
  }
  /** Fails the current session the way the browser does when the mic is blocked. */
  static fail(error = "not-allowed") {
    FakeRecognition.current?.onerror?.({ error });
  }
}

/** Installs the stand-in on `window`; returns a function that removes it. */
export function installSpeechRecognition(): () => void {
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = FakeRecognition;
  return () => {
    delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    FakeRecognition.current = null;
  };
}
