// @vitest-environment jsdom
/**
 * @fileoverview `LiveWaveform` against a recording canvas context and a fake
 * Web Audio graph: which frame it draws for each mode, when it asks for a
 * microphone, and what it releases on teardown.
 *
 * jsdom has neither a canvas context nor `AudioContext`, so both are replaced
 * with small fakes that record what the component does to them.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiveWaveform } from "../src/recorder/live-waveform";
import { flush, mount } from "./helpers/mount";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface FakeCtx {
  calls: string[];
  fillStyle: unknown;
  globalCompositeOperation: string;
  scale: ReturnType<typeof vi.fn>;
  clearRect: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  roundRect: ReturnType<typeof vi.fn>;
  fill: ReturnType<typeof vi.fn>;
  createLinearGradient: ReturnType<typeof vi.fn>;
}

function makeCtx(): FakeCtx {
  const calls: string[] = [];
  const record = (name: string) => vi.fn(() => void calls.push(name));
  return {
    calls,
    fillStyle: "",
    globalCompositeOperation: "source-over",
    scale: vi.fn(),
    clearRect: record("clearRect"),
    fillRect: record("fillRect"),
    beginPath: record("beginPath"),
    roundRect: record("roundRect"),
    fill: record("fill"),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
}

let ctx: FakeCtx;
let analyser: {
  fftSize: number;
  smoothingTimeConstant: number;
  frequencyBinCount: number;
  getByteFrequencyData: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};
let audioCtxClose: ReturnType<typeof vi.fn>;
let streamSource: { connect: ReturnType<typeof vi.fn> };
let trackStop: ReturnType<typeof vi.fn>;
let getUserMedia: ReturnType<typeof vi.fn>;
let stream: MediaStream;

function fakeStream(): MediaStream {
  return { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
}

beforeEach(() => {
  vi.useFakeTimers();
  ctx = makeCtx();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never;
  HTMLCanvasElement.prototype.getBoundingClientRect = () =>
    ({ width: 100, height: 40, top: 0, left: 0, right: 100, bottom: 40, x: 0, y: 0 }) as DOMRect;

  analyser = {
    fftSize: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 256,
    getByteFrequencyData: vi.fn((data: Uint8Array) => data.fill(200)),
    disconnect: vi.fn(),
  };
  streamSource = { connect: vi.fn() };
  audioCtxClose = vi.fn();
  class FakeAudioContext {
    createMediaStreamSource = vi.fn(() => streamSource);
    createAnalyser = vi.fn(() => analyser);
    close = audioCtxClose;
  }
  (globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext;

  trackStop = vi.fn();
  stream = fakeStream();
  getUserMedia = vi.fn().mockResolvedValue(stream);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as { AudioContext?: unknown }).AudioContext;
});

/** Lets promise chains and one `updateRate` interval tick run. */
async function settle(ms = 0) {
  await flush(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("LiveWaveform", () => {
  it("draws flat idle bars, and requests no microphone, when neither active nor processing", async () => {
    const view = await mount(<LiveWaveform barWidth={3} barGap={1} />);

    // 100px wide / (3 + 1) per bar.
    expect(ctx.roundRect).toHaveBeenCalledTimes(25);
    expect(ctx.roundRect.mock.calls[0]).toEqual([0, 19, 3, 2, 1.5]);
    expect(getUserMedia).not.toHaveBeenCalled();
    await view.unmount();
  });

  it("draws square-cornered bars when the radius is zero", async () => {
    const view = await mount(<LiveWaveform barRadius={0} />);

    expect(ctx.roundRect).not.toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledTimes(25);
    await view.unmount();
  });

  it("scales the canvas for the device pixel ratio", async () => {
    const original = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
    const view = await mount(<LiveWaveform />);

    const canvas = view.container.querySelector("canvas")!;
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(80);
    expect(ctx.scale).toHaveBeenCalledWith(2, 2);

    await view.unmount();
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: original });
  });

  it("does nothing when the canvas has no 2d context", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
    const view = await mount(<LiveWaveform active />);

    expect(getUserMedia).not.toHaveBeenCalled();
    await view.unmount();
  });

  it("animates a moving wave on each frame while processing", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    const cancel = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancel);

    const view = await mount(<LiveWaveform processing />);
    const first = ctx.roundRect.mock.calls.map((call) => call[1]);
    expect(first).toHaveLength(25);

    ctx.roundRect.mockClear();
    await flush(() => frames[0](0));
    const second = ctx.roundRect.mock.calls.map((call) => call[1]);
    expect(second).toHaveLength(25);
    expect(second).not.toEqual(first);
    expect(getUserMedia).not.toHaveBeenCalled();

    await view.unmount();
    expect(cancel).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("opens the microphone when active, draws frequency bars, and releases everything on unmount", async () => {
    const onStreamReady = vi.fn();
    const onStreamEnd = vi.fn();
    const view = await mount(
      <LiveWaveform
        active
        fftSize={512}
        smoothingTimeConstant={0.5}
        updateRate={50}
        onStreamReady={onStreamReady}
        onStreamEnd={onStreamEnd}
      />,
    );
    await settle();

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(onStreamReady).toHaveBeenCalledWith(stream);
    expect(analyser.fftSize).toBe(512);
    expect(analyser.smoothingTimeConstant).toBe(0.5);
    expect(streamSource.connect).toHaveBeenCalledWith(analyser);

    ctx.roundRect.mockClear();
    await settle(50);
    expect(analyser.getByteFrequencyData).toHaveBeenCalledTimes(1);
    // 100px / 4 = 25 bars, each loud enough to be taller than the 2px idle bar.
    expect(ctx.roundRect).toHaveBeenCalledTimes(25);
    expect(ctx.roundRect.mock.calls.every((call) => (call[3] as number) > 2)).toBe(true);

    await view.unmount();
    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(onStreamEnd).toHaveBeenCalledTimes(1);
    expect(analyser.disconnect).toHaveBeenCalled();
    expect(audioCtxClose).toHaveBeenCalled();

    ctx.roundRect.mockClear();
    await settle(200);
    expect(ctx.roundRect).not.toHaveBeenCalled();
  });

  it("draws a scrolling volume history in scrolling mode", async () => {
    const view = await mount(
      <LiveWaveform active mode="scrolling" historySize={10} updateRate={10} barRadius={0} />,
    );
    await settle();

    ctx.fillRect.mockClear();
    await settle(10);
    // One interval tick, and the bars it draws are the history that fits in 25 slots.
    expect(ctx.fillRect.mock.calls.length).toBeGreaterThanOrEqual(10);
    // Loud input means the newest bar (rightmost) is taller than the pre-filled 1px ones.
    const heights = ctx.fillRect.mock.calls.map((call) => call[3] as number);
    expect(Math.max(...heights)).toBeGreaterThan(1);

    await view.unmount();
  });

  it("uses a stream handed to it instead of opening its own, and leaves that stream alone", async () => {
    const external = fakeStream();
    const onStreamEnd = vi.fn();
    const view = await mount(<LiveWaveform active stream={external} onStreamEnd={onStreamEnd} />);
    await settle();

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(streamSource.connect).toHaveBeenCalled();

    await view.unmount();
    expect(trackStop).not.toHaveBeenCalled();
    expect(onStreamEnd).not.toHaveBeenCalled();
  });

  it("reports a microphone failure as an Error", async () => {
    getUserMedia.mockRejectedValueOnce(new Error("denied"));
    const onError = vi.fn();
    const view = await mount(<LiveWaveform active onError={onError} />);
    await settle();

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "denied" }));
    await view.unmount();
  });

  it("wraps a non-Error rejection in an Error", async () => {
    getUserMedia.mockRejectedValueOnce("nope");
    const onError = vi.fn();
    const view = await mount(<LiveWaveform active onError={onError} />);
    await settle();

    const error = onError.mock.calls[0][0] as Error;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("nope");
    await view.unmount();
  });

  it("reports an unavailable microphone API", async () => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    const onError = vi.fn();
    const view = await mount(<LiveWaveform active onError={onError} />);
    await settle();

    expect((onError.mock.calls[0][0] as Error).message).toMatch(/Microphone access is unavailable/);
    await view.unmount();
  });

  it("reports a failure setting up the audio graph from a handed-in stream", async () => {
    (globalThis as { AudioContext?: unknown }).AudioContext = class {
      constructor() {
        throw new Error("no audio context");
      }
    };
    const onError = vi.fn();
    const view = await mount(<LiveWaveform active stream={fakeStream()} onError={onError} />);
    await settle();

    expect((onError.mock.calls[0][0] as Error).message).toBe("no audio context");
    await view.unmount();
  });

  it("stops a microphone that arrives after it was unmounted", async () => {
    let resolve!: (s: MediaStream) => void;
    getUserMedia.mockReturnValueOnce(new Promise<MediaStream>((r) => (resolve = r)));
    const view = await mount(<LiveWaveform active />);
    await view.unmount();

    await flush(() => resolve(stream));

    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(streamSource.connect).not.toHaveBeenCalled();
  });

  it("skips the edge fade when fadeEdges is off", async () => {
    const view = await mount(<LiveWaveform active fadeEdges={false} updateRate={10} />);
    await settle();
    await settle(10);

    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    await view.unmount();

    const faded = await mount(<LiveWaveform active updateRate={10} />);
    await settle();
    await settle(10);
    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(2);
    await faded.unmount();
  });

  it("sizes its wrapper from the height prop", async () => {
    const numeric = await mount(<LiveWaveform height={48} />);
    expect((numeric.container.firstElementChild as HTMLElement).style.height).toBe("48px");
    const text = await mount(<LiveWaveform height="3rem" className="extra" />);
    const wrapper = text.container.firstElementChild as HTMLElement;
    expect(wrapper.style.height).toBe("3rem");
    expect(wrapper.className).toContain("extra");
    await numeric.unmount();
    await text.unmount();
  });
});
