import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SOUND_EFFECT_LEVEL,
  isSoundEffectLevel,
  playUISoundEffect,
  readSoundEffectLevel,
  setSoundEffectLevel,
  SOUND_EFFECT_LEVEL_KEY,
  subscribeSoundEffectLevel,
} from "../src/audio/sound-effect-preferences";

describe("sound-effect-preferences", () => {
  const store = new Map<string, string>();
  let changeListeners: (() => void)[];
  let playMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store.clear();
    changeListeners = [];
    // The node test environment has no localStorage or window; the
    // module reads both, so stand in for the bits it uses.
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
    });
    vi.stubGlobal("window", {
      addEventListener: (event: string, handler: () => void) => {
        if (event === "sound-effect-level-change") changeListeners.push(handler);
      },
      removeEventListener: () => {},
      dispatchEvent: () => {
        changeListeners.forEach((handler) => handler());
        return true;
      },
    });
    // `setSoundEffectLevel` broadcasts with `new Event(...)`.
    vi.stubGlobal(
      "Event",
      class {
        constructor(public type: string) {}
      },
    );
    // The Audio constructor `playUISoundEffect` ultimately goes through.
    playMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal(
      "Audio",
      vi.fn().mockImplementation(function () {
        return { play: playMock };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to 'all' when nothing is stored", () => {
    expect(DEFAULT_SOUND_EFFECT_LEVEL).toBe("all");
    expect(readSoundEffectLevel()).toBe("all");
  });

  it("reads a stored level back", () => {
    store.set(SOUND_EFFECT_LEVEL_KEY, "minimal");
    expect(readSoundEffectLevel()).toBe("minimal");
  });

  it("ignores a stored value that is not a level", () => {
    store.set(SOUND_EFFECT_LEVEL_KEY, "loud");
    expect(readSoundEffectLevel()).toBe("all");
  });

  it("validates level strings", () => {
    expect(isSoundEffectLevel("all")).toBe(true);
    expect(isSoundEffectLevel("minimal")).toBe(true);
    expect(isSoundEffectLevel("off")).toBe(true);
    expect(isSoundEffectLevel("loud")).toBe(false);
    expect(isSoundEffectLevel(null)).toBe(false);
  });

  it("stores a level and notifies subscribers", () => {
    const seen: string[] = [];
    const unsubscribe = subscribeSoundEffectLevel(() => {
      seen.push(readSoundEffectLevel());
    });
    setSoundEffectLevel("minimal");
    setSoundEffectLevel("off");
    unsubscribe();
    expect(seen).toEqual(["minimal", "off"]);
    expect(store.get(SOUND_EFFECT_LEVEL_KEY)).toBe("off");
  });

  it("clears the stored level when set back to the default", () => {
    setSoundEffectLevel("minimal");
    expect(store.get(SOUND_EFFECT_LEVEL_KEY)).toBe("minimal");
    setSoundEffectLevel("all");
    expect(store.has(SOUND_EFFECT_LEVEL_KEY)).toBe(false);
    expect(readSoundEffectLevel()).toBe("all");
  });

  it("plays every effect when the level is 'all'", () => {
    setSoundEffectLevel("all");
    playUISoundEffect("boop");
    playUISoundEffect("bounce");
    playUISoundEffect("shutter");
    expect(playMock).toHaveBeenCalledTimes(3);
  });

  it("plays only the minimal effects when the level is 'minimal'", () => {
    setSoundEffectLevel("minimal");
    playUISoundEffect("finalBwong");
    playUISoundEffect("popUpOn");
    playUISoundEffect("boop");
    playUISoundEffect("bounce");
    playUISoundEffect("shutter");
    expect(playMock).toHaveBeenCalledTimes(2);
  });

  it("plays nothing when the level is 'off'", () => {
    setSoundEffectLevel("off");
    playUISoundEffect("finalBwong");
    playUISoundEffect("boop");
    expect(playMock).not.toHaveBeenCalled();
  });
});
