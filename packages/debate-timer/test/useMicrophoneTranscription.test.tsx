// @vitest-environment jsdom
/**
 * @fileoverview Covers the React wiring around the browser's SpeechRecognition
 * API — the "🎤 Record" button behind the word counter and the word-count
 * submission form. jsdom ships no SpeechRecognition, so a fake constructor
 * stands in and the tests drive its callbacks the way a browser would.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMicrophoneTranscription } from "../src/hooks/useMicrophoneTranscription";
import { flush, mount } from "./helpers/mount";

interface ResultLike {
  0: { transcript: string };
  isFinal: boolean;
}

const instances: FakeRecognition[] = [];

class FakeRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  started = false;
  stopped = false;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ResultLike> }) => void) | null =
    null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    instances.push(this);
  }

  start() {
    this.started = true;
  }

  stop() {
    this.stopped = true;
    this.onend?.();
  }
}

const finalResult = (transcript: string): ResultLike => ({
  0: { transcript },
  isFinal: true,
});
const interimResult = (transcript: string): ResultLike => ({
  0: { transcript },
  isFinal: false,
});

type Api = ReturnType<typeof useMicrophoneTranscription>;

function Probe({
  onSegment,
  lang,
  onApi,
}: {
  onSegment: (s: string) => void;
  lang?: string;
  onApi: (api: Api) => void;
}) {
  onApi(useMicrophoneTranscription({ onSegment, lang }));
  return null;
}

async function renderHook(onSegment = vi.fn(), lang?: string) {
  let api!: Api;
  const view = await mount(
    <Probe onSegment={onSegment} lang={lang} onApi={(next) => (api = next)} />,
  );
  return {
    get current() {
      return api;
    },
    onSegment,
    unmount: view.unmount,
  };
}

afterEach(() => {
  instances.length = 0;
  vi.unstubAllGlobals();
  // `stubGlobal` cannot remove a property, so clear the shims by hand.
  delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
});

describe("useMicrophoneTranscription feature detection", () => {
  it("reports unsupported when the browser has no SpeechRecognition", async () => {
    const hook = await renderHook();
    expect(hook.current.isSupported).toBe(false);
    await hook.unmount();
  });

  it("does nothing on start when unsupported, rather than throwing", async () => {
    const hook = await renderHook();
    await flush(() => hook.current.start());
    expect(hook.current.isListening).toBe(false);
    expect(instances).toHaveLength(0);
    await hook.unmount();
  });

  it("reports supported behind the webkit-prefixed constructor", async () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    const hook = await renderHook();
    expect(hook.current.isSupported).toBe(true);
    await hook.unmount();
  });
});

describe("useMicrophoneTranscription dictation", () => {
  beforeEachSupported();

  it("configures recognition for continuous dictation", async () => {
    const hook = await renderHook(vi.fn(), "fr-FR");
    await flush(() => hook.current.start());

    expect(instances[0]).toMatchObject({
      continuous: true,
      interimResults: true,
      lang: "fr-FR",
      started: true,
    });
    await hook.unmount();
  });

  it("defaults to en-US", async () => {
    const hook = await renderHook();
    await flush(() => hook.current.start());
    expect(instances[0].lang).toBe("en-US");
    await hook.unmount();
  });

  it("reports that it is listening once started", async () => {
    const hook = await renderHook();
    await flush(() => hook.current.start());
    expect(hook.current.isListening).toBe(true);
    await hook.unmount();
  });

  it("emits finalized segments and ignores interim ones", async () => {
    const onSegment = vi.fn();
    const hook = await renderHook(onSegment);
    await flush(() => hook.current.start());

    await flush(() => {
      instances[0].onresult?.({
        resultIndex: 0,
        results: [interimResult("hello the"), finalResult("hello there")],
      });
    });

    expect(onSegment).toHaveBeenCalledTimes(1);
    expect(onSegment).toHaveBeenCalledWith("hello there");
    await hook.unmount();
  });

  it("only emits results from resultIndex onward", async () => {
    const onSegment = vi.fn();
    const hook = await renderHook(onSegment);
    await flush(() => hook.current.start());

    await flush(() => {
      instances[0].onresult?.({
        resultIndex: 1,
        results: [finalResult("already sent"), finalResult("new segment")],
      });
    });

    expect(onSegment).toHaveBeenCalledTimes(1);
    expect(onSegment).toHaveBeenCalledWith("new segment");
    await hook.unmount();
  });

  it("stops listening and surfaces a readable message on error", async () => {
    const hook = await renderHook();
    await flush(() => hook.current.start());

    await flush(() => instances[0].onerror?.({ error: "not-allowed" }));

    expect(hook.current.isListening).toBe(false);
    expect(hook.current.error).toBeTruthy();
    expect(hook.current.error).not.toBe("not-allowed");
    await hook.unmount();
  });

  it("clears a previous error when dictation restarts", async () => {
    const hook = await renderHook();
    await flush(() => hook.current.start());
    await flush(() => instances[0].onerror?.({ error: "no-speech" }));
    expect(hook.current.error).toBeTruthy();

    await flush(() => hook.current.start());
    expect(hook.current.error).toBeNull();
    await hook.unmount();
  });

  it("stops listening when the browser ends recognition on its own", async () => {
    const hook = await renderHook();
    await flush(() => hook.current.start());
    await flush(() => instances[0].onend?.());
    expect(hook.current.isListening).toBe(false);
    await hook.unmount();
  });

  it("stops recognition when asked", async () => {
    const hook = await renderHook();
    await flush(() => hook.current.start());
    await flush(() => hook.current.stop());

    expect(instances[0].stopped).toBe(true);
    expect(hook.current.isListening).toBe(false);
    await hook.unmount();
  });

  it("releases the microphone on unmount", async () => {
    const hook = await renderHook();
    await flush(() => hook.current.start());
    await hook.unmount();
    expect(instances[0].stopped).toBe(true);
  });
});

/** Installs the fake constructor for the dictation block above. */
function beforeEachSupported() {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
  });
}
