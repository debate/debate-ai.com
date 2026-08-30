import { afterEach, describe, expect, it, vi } from "vitest";
import { playSoundEffect } from "../src/audio/sound-effects";

describe("playSoundEffect", () => {
  const originalAudio = (globalThis as any).Audio;

  afterEach(() => {
    if (originalAudio === undefined) {
      delete (globalThis as any).Audio;
    } else {
      (globalThis as any).Audio = originalAudio;
    }
  });

  it("returns an error when the Audio constructor is unavailable (SSR/node)", () => {
    delete (globalThis as any).Audio;
    const result = playSoundEffect("boop");
    expect(result).toEqual({ error: "Could not play sound" });
  });

  it("plays the sound and returns error: false on success", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    let constructedWith: string | undefined;
    (globalThis as any).Audio = vi.fn().mockImplementation(function (src: string) {
      constructedWith = src;
      return { play };
    });

    const result = playSoundEffect("buzz");

    expect(result).toEqual({ error: false });
    expect(play).toHaveBeenCalledTimes(1);
    expect(constructedWith).toMatch(/^data:audio\/mp3;base64,/);
  });

  it("builds a distinct data URI per sound effect name", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    const sources: string[] = [];
    (globalThis as any).Audio = vi.fn().mockImplementation(function (src: string) {
      sources.push(src);
      return { play };
    });

    playSoundEffect("bounce");
    playSoundEffect("shutter");

    expect(sources).toHaveLength(2);
    expect(sources[0]).not.toBe(sources[1]);
  });

  it("catches a synchronous throw from the Audio constructor and returns its message", () => {
    (globalThis as any).Audio = vi.fn().mockImplementation(function () {
      throw new Error("boom");
    });

    const result = playSoundEffect("bloop");

    expect(result).toEqual({ error: "boom" });
  });

  it("catches a synchronous throw from play() and returns its message", () => {
    (globalThis as any).Audio = vi.fn().mockImplementation(function () {
      return {
        play: () => {
          throw new Error("playback denied");
        },
      };
    });

    const result = playSoundEffect("finalBwong");

    expect(result).toEqual({ error: "playback denied" });
  });

  it("covers every declared sound effect name without throwing", () => {
    const play = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).Audio = vi.fn().mockImplementation(function () {
      return { play };
    });

    const names = [
      "boop",
      "buzz",
      "bounce",
      "shutter",
      "bloop",
      "finalBwong",
      "popDown",
      "popUpOff",
      "popUpOn",
    ] as const;

    for (const name of names) {
      expect(playSoundEffect(name)).toEqual({ error: false });
    }
    expect(play).toHaveBeenCalledTimes(names.length);
  });
});
