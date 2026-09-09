// @vitest-environment jsdom
/**
 * @fileoverview Covers the microphone picker shown inside the speech timer: the
 * device-enumeration hook behind it and the mute toggle / device menu on top.
 *
 * jsdom exposes no `navigator.mediaDevices`, so it is installed as a small fake
 * whose device list and permission outcome each test controls.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MicSelector, useAudioDevices } from "../src/recorder/mic-selector";
import { click, flush, mount, pointerDown } from "./helpers/mount";

const DEVICES = [
  { deviceId: "mic-1", kind: "audioinput", label: "Built-in Mic (USB)", groupId: "g1" },
  { deviceId: "mic-2", kind: "audioinput", label: "Headset", groupId: "g2" },
  { deviceId: "spk-1", kind: "audiooutput", label: "Speakers", groupId: "g3" },
];

const tracks = [{ stop: vi.fn() }];
let getUserMedia: ReturnType<typeof vi.fn>;
let enumerateDevices: ReturnType<typeof vi.fn>;
let listeners: Record<string, () => void>;

beforeEach(() => {
  tracks[0].stop.mockClear();
  listeners = {};
  getUserMedia = vi
    .fn()
    .mockResolvedValue({ getTracks: () => tracks } as unknown as MediaStream);
  enumerateDevices = vi.fn().mockResolvedValue(DEVICES);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices,
      addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      },
      removeEventListener: (type: string) => {
        delete listeners[type];
      },
    },
  });
  // LiveWaveform draws to a canvas jsdom cannot provide a context for.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
});

afterEach(() => {
  vi.restoreAllMocks();
});

type Api = ReturnType<typeof useAudioDevices>;

function Probe({ onApi }: { onApi: (api: Api) => void }) {
  onApi(useAudioDevices());
  return null;
}

async function renderHook() {
  let api!: Api;
  const view = await mount(<Probe onApi={(next) => (api = next)} />);
  return {
    get current() {
      return api;
    },
    unmount: view.unmount,
  };
}

describe("useAudioDevices", () => {
  it("starts empty, idle, and without permission", async () => {
    const hook = await renderHook();
    expect(hook.current).toMatchObject({
      devices: [],
      loading: false,
      error: null,
      hasPermission: false,
    });
    await hook.unmount();
  });

  it("asks for permission before enumerating so labels are populated", async () => {
    const hook = await renderHook();
    await flush(() => hook.current.loadDevices());

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(enumerateDevices).toHaveBeenCalled();
    expect(hook.current.hasPermission).toBe(true);
    await hook.unmount();
  });

  it("releases the permission-probe stream immediately", async () => {
    const hook = await renderHook();
    await flush(() => hook.current.loadDevices());
    expect(tracks[0].stop).toHaveBeenCalled();
    await hook.unmount();
  });

  it("keeps only the audio inputs", async () => {
    const hook = await renderHook();
    await flush(() => hook.current.loadDevices());

    expect(hook.current.devices.map((d) => d.deviceId)).toEqual([
      "mic-1",
      "mic-2",
    ]);
    await hook.unmount();
  });

  it("strips the trailing bus annotation browsers append to labels", async () => {
    const hook = await renderHook();
    await flush(() => hook.current.loadDevices());
    expect(hook.current.devices[0].label).toBe("Built-in Mic");
    await hook.unmount();
  });

  it("names an unlabeled device after its id", async () => {
    enumerateDevices.mockResolvedValue([
      { deviceId: "abcd1234", kind: "audioinput", label: "", groupId: "g" },
    ]);
    const hook = await renderHook();
    await flush(() => hook.current.loadDevices());
    expect(hook.current.devices[0].label).toBe("Microphone abcd");
    await hook.unmount();
  });

  it("surfaces a denied-permission message instead of throwing", async () => {
    getUserMedia.mockRejectedValue(new Error("Permission denied"));
    const hook = await renderHook();
    await flush(() => hook.current.loadDevices());

    expect(hook.current.error).toBe("Permission denied");
    expect(hook.current.hasPermission).toBe(false);
    expect(hook.current.loading).toBe(false);
    await hook.unmount();
  });

  it("falls back to a generic message for a non-Error rejection", async () => {
    getUserMedia.mockRejectedValue("nope");
    const hook = await renderHook();
    await flush(() => hook.current.loadDevices());
    expect(hook.current.error).toBe("Microphone access denied");
    await hook.unmount();
  });

  it("re-enumerates when a microphone is plugged in or unplugged", async () => {
    const hook = await renderHook();
    expect(listeners.devicechange).toBeTypeOf("function");

    await flush(() => listeners.devicechange());
    expect(enumerateDevices).toHaveBeenCalled();
    await hook.unmount();
  });

  it("stops listening for device changes on unmount", async () => {
    const hook = await renderHook();
    await hook.unmount();
    expect(listeners.devicechange).toBeUndefined();
  });
});

describe("MicSelector", () => {
  const muteButtonOf = (container: HTMLElement) =>
    container.querySelectorAll("button")[0] as HTMLButtonElement;
  const menuButtonOf = (container: HTMLElement) =>
    container.querySelectorAll("button")[1] as HTMLButtonElement;

  it("renders a mute toggle and a device menu", async () => {
    const view = await mount(<MicSelector />);
    expect(view.container.querySelectorAll("button")).toHaveLength(2);
    await view.unmount();
  });

  it("labels the mute toggle by its current state", async () => {
    const view = await mount(<MicSelector muted />);
    expect(muteButtonOf(view.container).title).toBe("Unmute microphone");
    await view.rerender(<MicSelector muted={false} />);
    expect(muteButtonOf(view.container).title).toBe("Mute microphone");
    await view.unmount();
  });

  it("reports a mute toggle to the caller", async () => {
    const onMutedChange = vi.fn();
    const view = await mount(
      <MicSelector muted={false} onMutedChange={onMutedChange} />,
    );
    await click(muteButtonOf(view.container));
    expect(onMutedChange).toHaveBeenCalledWith(true);
    await view.unmount();
  });

  it("tracks its own mute state when uncontrolled", async () => {
    const view = await mount(<MicSelector />);
    await click(muteButtonOf(view.container));
    expect(muteButtonOf(view.container).title).toBe("Unmute microphone");
    await view.unmount();
  });

  it("can be disabled entirely", async () => {
    const view = await mount(<MicSelector disabled />);
    expect(
      [...view.container.querySelectorAll("button")].every((b) => b.disabled),
    ).toBe(true);
    await view.unmount();
  });

  it("passes an extra className to its container", async () => {
    const view = await mount(<MicSelector className="scale-90" />);
    expect(view.container.firstElementChild?.className).toContain("scale-90");
    await view.unmount();
  });

  it("loads the device list the first time the menu is opened", async () => {
    const view = await mount(<MicSelector />);
    expect(enumerateDevices).not.toHaveBeenCalled();

    await pointerDown(menuButtonOf(view.container));

    expect(enumerateDevices).toHaveBeenCalled();
    await view.unmount();
  });

  it("lists each microphone in the menu", async () => {
    const view = await mount(<MicSelector />);
    await pointerDown(menuButtonOf(view.container));
    await flush(() => {});

    const labels = [...document.body.querySelectorAll("[role=menuitem]")].map(
      (i) => i.textContent,
    );
    expect(labels).toContain("Built-in Mic");
    expect(labels).toContain("Headset");
    await view.unmount();
  });

  it("reports the microphone the user picks", async () => {
    const onValueChange = vi.fn();
    const view = await mount(<MicSelector onValueChange={onValueChange} />);
    await pointerDown(menuButtonOf(view.container));
    await flush(() => {});

    const headset = [...document.body.querySelectorAll("[role=menuitem]")].find(
      (i) => i.textContent === "Headset",
    ) as HTMLElement;
    await click(headset);

    expect(onValueChange).toHaveBeenCalledWith("mic-2");
    await view.unmount();
  });

  it("auto-selects the first microphone when none is chosen", async () => {
    const onValueChange = vi.fn();
    const view = await mount(<MicSelector onValueChange={onValueChange} />);
    await pointerDown(menuButtonOf(view.container));
    await flush(() => {});

    expect(onValueChange).toHaveBeenCalledWith("mic-1");
    await view.unmount();
  });

  it("says so when there are no microphones", async () => {
    enumerateDevices.mockResolvedValue([]);
    const view = await mount(<MicSelector />);
    await pointerDown(menuButtonOf(view.container));
    await flush(() => {});

    expect(document.body.textContent).toContain("No microphones found");
    await view.unmount();
  });
});
