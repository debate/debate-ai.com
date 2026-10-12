// @vitest-environment jsdom
/**
 * @fileoverview Tests for `hooks/useMicrophoneTranscription.ts` against a
 * fake `SpeechRecognition` constructor installed on `window` — support
 * detection, start/stop, delivering only finalized segments, error and end
 * handling, and stopping the mic on unmount.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

import { useMicrophoneTranscription } from "../src/hooks/useMicrophoneTranscription";
import { describeMicrophoneTranscriptionError } from "../src/coach/microphone-transcription";
import { flush, mount } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

type Result = ReturnType<typeof useMicrophoneTranscription>;

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = "";
  start = vi.fn();
  stop = vi.fn();
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    FakeRecognition.instances.push(this);
  }
}

let latest: Result;
let view: Mounted;

function Harness({ onSegment, lang }: { onSegment: (s: string) => void; lang?: string }) {
  latest = useMicrophoneTranscription({ onSegment, lang });
  return null;
}

afterEach(async () => {
  await view?.unmount();
  FakeRecognition.instances = [];
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

describe("useMicrophoneTranscription", () => {
  it("reports unsupported and makes start a no-op without a SpeechRecognition constructor", async () => {
    view = await mount(createElement(Harness, { onSegment: vi.fn() }));
    expect(latest.isSupported).toBe(false);
    await flush(() => latest.start());
    expect(latest.isListening).toBe(false);
    expect(FakeRecognition.instances).toHaveLength(0);
    // stop with nothing started is harmless.
    await flush(() => latest.stop());
  });

  it("configures, starts and forwards only finalized segments", async () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    const onSegment = vi.fn();
    view = await mount(createElement(Harness, { onSegment, lang: "es-ES" }));
    expect(latest.isSupported).toBe(true);

    await flush(() => latest.start());
    const [recognition] = FakeRecognition.instances;
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.lang).toBe("es-ES");
    expect(recognition.start).toHaveBeenCalledTimes(1);
    expect(latest.isListening).toBe(true);

    await flush(() =>
      recognition.onresult?.({
        resultIndex: 1,
        results: [
          { 0: { transcript: "already handled" }, isFinal: true },
          { 0: { transcript: "interim words" }, isFinal: false },
          { 0: { transcript: "final words" }, isFinal: true },
        ],
      }),
    );
    expect(onSegment).toHaveBeenCalledTimes(1);
    expect(onSegment).toHaveBeenCalledWith("final words");

    await flush(() => latest.stop());
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    await flush(() => recognition.onend?.());
    expect(latest.isListening).toBe(false);
  });

  it("describes a recognition error and stops listening, clearing it on the next start", async () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
    view = await mount(createElement(Harness, { onSegment: vi.fn() }));
    await flush(() => latest.start());
    expect(FakeRecognition.instances[0].lang).toBe("en-US");

    await flush(() => FakeRecognition.instances[0].onerror?.({ error: "not-allowed" }));
    expect(latest.error).toBe(describeMicrophoneTranscriptionError("not-allowed"));
    expect(latest.isListening).toBe(false);

    await flush(() => latest.start());
    expect(latest.error).toBeNull();
    expect(FakeRecognition.instances).toHaveLength(2);
  });

  it("uses the latest onSegment callback and stops the mic on unmount", async () => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
    const first = vi.fn();
    const second = vi.fn();
    view = await mount(createElement(Harness, { onSegment: first }));
    await flush(() => latest.start());
    await view.rerender(createElement(Harness, { onSegment: second }));

    const [recognition] = FakeRecognition.instances;
    await flush(() =>
      recognition.onresult?.({ resultIndex: 0, results: [{ 0: { transcript: "hello" }, isFinal: true }] }),
    );
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("hello");

    await view.unmount();
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    view = await mount(createElement(Harness, { onSegment: vi.fn() }));
  });
});
