// @vitest-environment jsdom
/**
 * @fileoverview Covers useSpeechRecorder, the hook that ties the in-round
 * speech recorder to the timer: recording has to start when the speech starts,
 * stop when it stops, and land in localStorage under the speech's own key so
 * the recording is still there after a reload.
 *
 * jsdom has no MediaRecorder and no getUserMedia, so both are stubbed with the
 * smallest fakes that still exercise the hook's real control flow.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSpeechRecorder } from "../src/hooks/useSpeechRecorder";
import type { SpeechTimerState } from "../src/types";
import { flush, mount } from "./helpers/mount";

type RecorderState = "inactive" | "recording";

/** Records every instance so a test can drive stop() and inspect the result. */
const instances: FakeMediaRecorder[] = [];

class FakeMediaRecorder {
  state: RecorderState = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(public stream: MediaStream) {
    instances.push(this);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

const tracks = [{ stop: vi.fn() }];
const fakeStream = { getTracks: () => tracks } as unknown as MediaStream;

let getUserMedia: ReturnType<typeof vi.fn>;

const PAUSED: SpeechTimerState["state"] = { name: "paused" };
const RUNNING: SpeechTimerState["state"] = { name: "running", startTime: 0 };
const DONE: SpeechTimerState["state"] = { name: "done" };

type Options = Parameters<typeof useSpeechRecorder>[0];
type Api = ReturnType<typeof useSpeechRecorder>;

/** Mounts the hook in a throwaway component and hands back its return value. */
function Probe({ options, onApi }: { options: Options; onApi: (api: Api) => void }) {
  onApi(useSpeechRecorder(options));
  return null;
}

async function renderHook(options: Options) {
  let api!: Api;
  const view = await mount(
    <Probe options={options} onApi={(next) => (api = next)} />,
  );
  return {
    get current() {
      return api;
    },
    rerender: (next: Options) =>
      view.rerender(<Probe options={next} onApi={(v) => (api = v)} />),
    unmount: view.unmount,
  };
}

const baseOptions = (overrides: Partial<Options> = {}): Options => ({
  timerState: PAUSED,
  currentSpeechName: "1AC",
  ...overrides,
});

beforeEach(() => {
  instances.length = 0;
  tracks[0].stop.mockClear();
  localStorage.clear();
  getUserMedia = vi.fn().mockResolvedValue(fakeStream);
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useSpeechRecorder recording toggle", () => {
  it("starts with recording disabled and no mic chosen", async () => {
    const hook = await renderHook(baseOptions());
    expect(hook.current.isRecordingEnabled).toBe(false);
    expect(hook.current.selectedMicDeviceId).toBeUndefined();
    await hook.unmount();
  });

  it("keeps its own enabled state when uncontrolled", async () => {
    const hook = await renderHook(baseOptions());
    await flush(() => hook.current.setIsRecordingEnabled(true));
    expect(hook.current.isRecordingEnabled).toBe(true);
    await hook.unmount();
  });

  it("defers to the controlled enabled prop instead of its own state", async () => {
    const onRecordingEnabledChange = vi.fn();
    const hook = await renderHook(
      baseOptions({ recordingEnabled: false, onRecordingEnabledChange }),
    );

    await flush(() => hook.current.setIsRecordingEnabled(true));

    // The parent owns the value, so it stays false until the parent says otherwise.
    expect(hook.current.isRecordingEnabled).toBe(false);
    expect(onRecordingEnabledChange).toHaveBeenCalledWith(true);
    await hook.unmount();
  });

  it("keeps its own mic selection when uncontrolled", async () => {
    const onMicDeviceIdChange = vi.fn();
    const hook = await renderHook(baseOptions({ onMicDeviceIdChange }));
    await flush(() => hook.current.setSelectedMicDeviceId("mic-2"));
    expect(hook.current.selectedMicDeviceId).toBe("mic-2");
    expect(onMicDeviceIdChange).toHaveBeenCalledWith("mic-2");
    await hook.unmount();
  });

  it("defers to the controlled mic prop instead of its own state", async () => {
    const onMicDeviceIdChange = vi.fn();
    const hook = await renderHook(
      baseOptions({ micDeviceId: "mic-1", onMicDeviceIdChange }),
    );

    await flush(() => hook.current.setSelectedMicDeviceId("mic-2"));

    expect(hook.current.selectedMicDeviceId).toBe("mic-1");
    expect(onMicDeviceIdChange).toHaveBeenCalledWith("mic-2");
    await hook.unmount();
  });
});

describe("useSpeechRecorder timer sync", () => {
  it("does not touch the microphone while recording is disabled", async () => {
    const hook = await renderHook(baseOptions({ timerState: RUNNING }));
    expect(getUserMedia).not.toHaveBeenCalled();
    await hook.unmount();
  });

  it("starts recording when the speech starts", async () => {
    const hook = await renderHook(
      baseOptions({ recordingEnabled: true, timerState: PAUSED }),
    );
    await hook.rerender(
      baseOptions({ recordingEnabled: true, timerState: RUNNING }),
    );

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(1);
    expect(instances[0].state).toBe("recording");
    await hook.unmount();
  });

  it("asks for the selected microphone by device id", async () => {
    const hook = await renderHook(
      baseOptions({
        recordingEnabled: true,
        micDeviceId: "mic-7",
        timerState: RUNNING,
      }),
    );

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { deviceId: { exact: "mic-7" } },
    });
    await hook.unmount();
  });

  it("asks for the default microphone when none is selected", async () => {
    const hook = await renderHook(
      baseOptions({ recordingEnabled: true, timerState: RUNNING }),
    );
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    await hook.unmount();
  });

  it("announces the recording so the rest of the app can react", async () => {
    const started = vi.fn();
    window.addEventListener("debate-recording-started", started);

    const hook = await renderHook(
      baseOptions({ recordingEnabled: true, timerState: RUNNING }),
    );

    expect(started).toHaveBeenCalledTimes(1);
    expect((started.mock.calls[0][0] as CustomEvent).detail).toEqual({
      speechName: "1AC",
    });
    window.removeEventListener("debate-recording-started", started);
    await hook.unmount();
  });

  it("stops recording and releases the mic when the speech is paused", async () => {
    const hook = await renderHook(
      baseOptions({ recordingEnabled: true, timerState: RUNNING }),
    );
    await hook.rerender(
      baseOptions({ recordingEnabled: true, timerState: PAUSED }),
    );

    expect(instances[0].state).toBe("inactive");
    expect(tracks[0].stop).toHaveBeenCalled();
    await hook.unmount();
  });

  it("stops recording when the speech finishes", async () => {
    const hook = await renderHook(
      baseOptions({ recordingEnabled: true, timerState: RUNNING }),
    );
    await hook.rerender(
      baseOptions({ recordingEnabled: true, timerState: DONE }),
    );
    expect(instances[0].state).toBe("inactive");
    await hook.unmount();
  });

  it("stops recording when recording is switched off mid-speech", async () => {
    const hook = await renderHook(
      baseOptions({ recordingEnabled: true, timerState: RUNNING }),
    );
    await hook.rerender(
      baseOptions({ recordingEnabled: false, timerState: RUNNING }),
    );
    expect(instances[0].state).toBe("inactive");
    await hook.unmount();
  });

  it("survives a microphone permission denial", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getUserMedia.mockRejectedValue(new Error("Permission denied"));

    const hook = await renderHook(
      baseOptions({ recordingEnabled: true, timerState: RUNNING }),
    );

    expect(instances).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    await hook.unmount();
  });
});

describe("useSpeechRecorder persistence", () => {
  /** Waits for the FileReader in the save path to finish. */
  const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

  it("saves the finished recording under the speech's own key", async () => {
    const saved = vi.fn();
    window.addEventListener("debate-recording-saved", saved);

    const hook = await renderHook(
      baseOptions({
        recordingEnabled: true,
        timerState: RUNNING,
        speechLabel: "1AC — Riley",
      }),
    );
    await hook.rerender(
      baseOptions({
        recordingEnabled: true,
        timerState: PAUSED,
        speechLabel: "1AC — Riley",
      }),
    );
    await settled();

    const stored = localStorage.getItem("debate-recording-1AC");
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored as string)).toMatchObject({
      speechName: "1AC",
      speechLabel: "1AC — Riley",
    });
    expect(saved).toHaveBeenCalled();
    window.removeEventListener("debate-recording-saved", saved);
    await hook.unmount();
  });

  it("falls back to the speech name when no label was given", async () => {
    const hook = await renderHook(
      baseOptions({ recordingEnabled: true, timerState: RUNNING }),
    );
    await hook.rerender(
      baseOptions({ recordingEnabled: true, timerState: PAUSED }),
    );
    await settled();

    expect(
      JSON.parse(localStorage.getItem("debate-recording-1AC") as string),
    ).toMatchObject({ speechLabel: "1AC" });
    await hook.unmount();
  });
});
