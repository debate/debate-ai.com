// @vitest-environment jsdom
/**
 * @fileoverview Covers the shared audio-player engine that plays back saved
 * speech recordings: the provider's imperative API, the hooks that read it, and
 * the transport controls built on top (play button, scrubber, clocks, speed).
 *
 * jsdom implements no media playback, so `play`/`pause`/`load` and the readonly
 * media properties are stubbed on HTMLMediaElement. Everything above that — the
 * state machine, the persisted speed preference, the formatting — is the real
 * module.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AudioPlayerButton,
  AudioPlayerDuration,
  AudioPlayerProvider,
  AudioPlayerSpeed,
  AudioPlayerSpeedButtonGroup,
  AudioPlayerTime,
  useAudioPlayer,
  useAudioPlayerTime,
} from "../src/recorder/audio-player";
import { click, flush, frames, mount, pointerDown } from "./helpers/mount";

const SPEED_KEY = "debate-playback-speed";

const ITEM = { id: "1ac", src: "blob:/recordings/1ac" };
const OTHER = { id: "1nc", src: "blob:/recordings/1nc" };

let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;
let load: ReturnType<typeof vi.fn>;

/** Overrides a readonly media property for the whole element prototype. */
function stubMediaProperty(name: string, value: unknown) {
  Object.defineProperty(HTMLMediaElement.prototype, name, {
    configurable: true,
    get: () => value,
  });
}

beforeEach(() => {
  localStorage.clear();
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  load = vi.fn();
  Object.defineProperties(HTMLMediaElement.prototype, {
    play: { configurable: true, writable: true, value: play },
    pause: { configurable: true, writable: true, value: pause },
    load: { configurable: true, writable: true, value: load },
  });
  stubMediaProperty("duration", 125);
  stubMediaProperty("readyState", 4);
  stubMediaProperty("networkState", 1);
  stubMediaProperty("error", null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

type Api = ReturnType<typeof useAudioPlayer>;

/** Reads the player API out of the provider so a test can drive it directly. */
function ApiProbe({ onApi }: { onApi: (api: Api) => void }) {
  onApi(useAudioPlayer());
  return null;
}

async function renderPlayer(children: React.ReactNode, initialRate?: number) {
  let api!: Api;
  const view = await mount(
    <AudioPlayerProvider initialPlaybackRate={initialRate}>
      <ApiProbe onApi={(next) => (api = next)} />
      {children}
    </AudioPlayerProvider>,
  );
  return {
    ...view,
    get api() {
      return api;
    },
    get audio() {
      return view.container.querySelector("audio") as HTMLAudioElement;
    },
  };
}

describe("AudioPlayerProvider", () => {
  it("renders a hidden audio element for the whole tree to share", async () => {
    const view = await renderPlayer(null);
    expect(view.audio).not.toBeNull();
    expect(view.audio.className).toContain("hidden");
    await view.unmount();
  });

  it("starts at normal speed with no item loaded", async () => {
    const view = await renderPlayer(null);
    expect(view.api.playbackRate).toBe(1);
    expect(view.api.activeItem).toBeNull();
    await view.unmount();
  });

  it("honors an explicit initial playback rate", async () => {
    const view = await renderPlayer(null, 1.5);
    expect(view.audio.playbackRate).toBe(1.5);
    await view.unmount();
  });

  it("prefers the last speed the listener chose over the prop", async () => {
    localStorage.setItem(SPEED_KEY, "2");
    const view = await renderPlayer(null, 1.5);
    expect(view.audio.playbackRate).toBe(2);
    await view.unmount();
  });

  it("ignores a corrupt stored speed", async () => {
    localStorage.setItem(SPEED_KEY, "not-a-number");
    const view = await renderPlayer(null);
    expect(view.audio.playbackRate).toBe(1);
    await view.unmount();
  });

  it("ignores a non-positive stored speed", async () => {
    localStorage.setItem(SPEED_KEY, "0");
    const view = await renderPlayer(null, 1.25);
    expect(view.audio.playbackRate).toBe(1.25);
    await view.unmount();
  });
});

describe("AudioPlayerProvider transport", () => {
  it("loads a new recording into the shared element", async () => {
    const view = await renderPlayer(null);
    await flush(() => view.api.setActiveItem(ITEM));

    expect(view.audio.src).toContain(ITEM.src);
    expect(load).toHaveBeenCalled();
    await view.unmount();
  });

  it("does not reload the recording that is already loaded", async () => {
    const view = await renderPlayer(null);
    await flush(() => view.api.setActiveItem(ITEM));
    load.mockClear();

    await flush(() => view.api.setActiveItem({ ...ITEM }));

    expect(load).not.toHaveBeenCalled();
    await view.unmount();
  });

  it("drops the source when the item is cleared", async () => {
    const view = await renderPlayer(null);
    await flush(() => view.api.setActiveItem(ITEM));
    await flush(() => view.api.setActiveItem(null));

    expect(view.audio.hasAttribute("src")).toBe(false);
    await view.unmount();
  });

  it("keeps the chosen speed across a track change", async () => {
    const view = await renderPlayer(null);
    await flush(() => view.api.setPlaybackRate(1.5));
    await flush(() => view.api.setActiveItem(ITEM));

    expect(view.audio.playbackRate).toBe(1.5);
    await view.unmount();
  });

  it("plays the currently loaded recording", async () => {
    const view = await renderPlayer(null);
    await flush(() => view.api.play());
    expect(play).toHaveBeenCalled();
    await view.unmount();
  });

  it("switches to another recording and plays it", async () => {
    const view = await renderPlayer(null);
    await flush(() => view.api.play(ITEM));
    await flush(() => view.api.play(OTHER));

    expect(view.audio.src).toContain(OTHER.src);
    expect(play).toHaveBeenCalledTimes(2);
    await view.unmount();
  });

  it("pauses playback", async () => {
    const view = await renderPlayer(null);
    await flush(() => view.api.play());
    await flush(() => view.api.pause());
    expect(pause).toHaveBeenCalled();
    await view.unmount();
  });

  it("seeks to a position", async () => {
    const view = await renderPlayer(null);
    await flush(() => view.api.seek(42));
    expect(view.audio.currentTime).toBe(42);
    await view.unmount();
  });

  it("remembers a speed change for the next recording", async () => {
    const view = await renderPlayer(null);
    await flush(() => view.api.setPlaybackRate(1.75));

    expect(view.audio.playbackRate).toBe(1.75);
    expect(localStorage.getItem(SPEED_KEY)).toBe("1.75");
    await view.unmount();
  });

  it("reports which recording is active", async () => {
    const view = await renderPlayer(null);
    await flush(() => view.api.setActiveItem(ITEM));
    // The active item is published on the player's animation-frame loop.
    await frames();

    expect(view.api.isItemActive(ITEM.id)).toBe(true);
    expect(view.api.isItemActive(OTHER.id)).toBe(false);
    await view.unmount();
  });
});

describe("audio player hooks outside a provider", () => {
  it("tells the developer useAudioPlayer needs a provider", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(mount(<ApiProbe onApi={() => {}} />)).rejects.toThrow(
      /cannot be called outside of AudioPlayerProvider/,
    );
    error.mockRestore();
  });

  it("tells the developer useAudioPlayerTime needs a provider", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    function TimeProbe() {
      useAudioPlayerTime();
      return null;
    }
    await expect(mount(<TimeProbe />)).rejects.toThrow(
      /cannot be called outside of AudioPlayerProvider/,
    );
    error.mockRestore();
  });
});

describe("AudioPlayerTime and AudioPlayerDuration", () => {
  it("starts the clock at zero", async () => {
    const view = await renderPlayer(<AudioPlayerTime data-testid="time" />);
    expect(view.container.querySelector("[data-testid=time]")?.textContent).toBe(
      "0:00",
    );
    await view.unmount();
  });

  it("formats the duration as minutes and seconds", async () => {
    const view = await renderPlayer(
      <AudioPlayerDuration data-testid="duration" />,
    );
    await frames();

    expect(
      view.container.querySelector("[data-testid=duration]")?.textContent,
    ).toBe("2:05");
    await view.unmount();
  });

  it("adds an hours field for a recording over an hour", async () => {
    stubMediaProperty("duration", 3725);
    const view = await renderPlayer(
      <AudioPlayerDuration data-testid="duration" />,
    );
    await frames();

    expect(
      view.container.querySelector("[data-testid=duration]")?.textContent,
    ).toBe("1:02:05");
    await view.unmount();
  });

  it("shows a placeholder until the duration is known", async () => {
    stubMediaProperty("duration", Number.NaN);
    const view = await renderPlayer(
      <AudioPlayerDuration data-testid="duration" />,
    );
    expect(
      view.container.querySelector("[data-testid=duration]")?.textContent,
    ).toBe("--:--");
    await view.unmount();
  });
});

describe("AudioPlayerButton", () => {
  const buttonOf = (container: HTMLElement) =>
    container.querySelector("button") as HTMLButtonElement;

  it("offers Play before anything is playing", async () => {
    const view = await renderPlayer(<AudioPlayerButton />);
    expect(buttonOf(view.container).getAttribute("aria-label")).toBe("Play");
    await view.unmount();
  });

  it("plays the loaded recording when clicked", async () => {
    const view = await renderPlayer(<AudioPlayerButton />);
    await click(buttonOf(view.container));
    expect(play).toHaveBeenCalled();
    await view.unmount();
  });

  it("plays its own item when given one", async () => {
    const view = await renderPlayer(<AudioPlayerButton item={ITEM} />);
    await click(buttonOf(view.container));
    expect(view.audio.src).toContain(ITEM.src);
    await view.unmount();
  });
});

describe("AudioPlayerSpeed", () => {
  it("labels the speed control for screen readers", async () => {
    const view = await renderPlayer(<AudioPlayerSpeed />);
    expect(
      view.container.querySelector("[aria-label='Playback speed']"),
    ).not.toBeNull();
    await view.unmount();
  });

  it("offers the speeds as a menu", async () => {
    const view = await renderPlayer(<AudioPlayerSpeed speeds={[1, 2]} />);
    await pointerDown(view.container.querySelector("button") as HTMLButtonElement);

    const items = [...document.body.querySelectorAll("[role=menuitem]")];
    expect(items.map((i) => i.textContent)).toEqual([
      "Normal",
      "200% Speed  ",
    ]);
    await view.unmount();
  });

  it("applies the speed the listener picks", async () => {
    const view = await renderPlayer(<AudioPlayerSpeed speeds={[1, 2]} />);
    await pointerDown(view.container.querySelector("button") as HTMLButtonElement);

    const items = [...document.body.querySelectorAll("[role=menuitem]")];
    await click(items[1]);

    expect(view.audio.playbackRate).toBe(2);
    await view.unmount();
  });
});

describe("AudioPlayerSpeedButtonGroup", () => {
  it("renders one button per speed", async () => {
    const view = await renderPlayer(
      <AudioPlayerSpeedButtonGroup speeds={[0.5, 1, 2]} />,
    );
    expect(
      [...view.container.querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["0.5x", "1x", "2x"]);
    await view.unmount();
  });

  it("applies the speed the listener picks", async () => {
    const view = await renderPlayer(
      <AudioPlayerSpeedButtonGroup speeds={[0.5, 1, 2]} />,
    );
    await click(view.container.querySelectorAll("button")[2]);
    expect(view.audio.playbackRate).toBe(2);
    await view.unmount();
  });

  it("groups the buttons for assistive tech", async () => {
    const view = await renderPlayer(<AudioPlayerSpeedButtonGroup />);
    expect(
      view.container.querySelector("[role=group]")?.getAttribute("aria-label"),
    ).toBe("Playback speed controls");
    await view.unmount();
  });
});

