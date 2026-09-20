// @vitest-environment jsdom
/**
 * @fileoverview Covers SpeechRecordingMenu's "Share with Opponents" item.
 * It used to be a dead click — the handler was an empty function behind a
 * `TODO: Implement sharing` comment, so nothing happened no matter who
 * clicked it. This covers the fixed behavior: the item only shows once a
 * recording exists, and clicking it shares that recording with the given
 * participant emails (or tells the user to record first if the saved
 * recording has gone missing).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SpeechRecordingMenu } from "../src/recorder/SpeechRecordingPlayer";
import { click, flush, mount, pointerDown } from "./helpers/mount";

const tracks = [{ stop: vi.fn() }];

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => tracks } as unknown as MediaStream),
      enumerateDevices: vi.fn().mockResolvedValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  // LiveWaveform draws to a canvas jsdom cannot provide a context for.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const menuButtonOf = (container: HTMLElement) => container.querySelector("button") as HTMLButtonElement;

function findMenuItem(text: string): HTMLElement | undefined {
  return [...document.body.querySelectorAll("[role=menuitem]")].find((i) => i.textContent === text) as
    | HTMLElement
    | undefined;
}

describe("SpeechRecordingMenu — Share with Opponents", () => {
  it("is hidden when no recording has been saved for this speech", async () => {
    const view = await mount(<SpeechRecordingMenu speechName="1AC" />);
    await pointerDown(menuButtonOf(view.container));
    await flush(() => {});

    expect(findMenuItem("Share with Opponents")).toBeUndefined();
    await view.unmount();
  });

  it("shares the saved recording with the round's participants when clicked", async () => {
    localStorage.setItem(
      "debate-recording-1AC",
      JSON.stringify({
        speechName: "1AC",
        speechLabel: "1AC",
        recordedAt: new Date().toISOString(),
        audio: "data:audio/webm;base64,AAAA",
      }),
    );
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    const view = await mount(
      <SpeechRecordingMenu
        speechName="1AC"
        recordingKey="debate-recording-1AC"
        participantEmails={["aff@example.com", "judge@example.com"]}
      />,
    );
    await pointerDown(menuButtonOf(view.container));
    await flush(() => {});

    const item = findMenuItem("Share with Opponents");
    expect(item).toBeDefined();
    await click(item!);
    // shareRecording simulates a 500ms network delay before resolving.
    await flush(() => new Promise((resolve) => setTimeout(resolve, 600)));

    expect(alertSpy).toHaveBeenCalledWith("Shared with 2 participants");
    await view.unmount();
  });

  it("tells the user to record first when the saved recording is missing", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    const view = await mount(
      <SpeechRecordingMenu
        speechName="1AC"
        recordingKey="debate-recording-1AC"
        participantEmails={["aff@example.com"]}
      />,
    );
    await pointerDown(menuButtonOf(view.container));
    await flush(() => {});

    const item = findMenuItem("Share with Opponents")!;
    await click(item);
    await flush(() => {});

    expect(alertSpy).toHaveBeenCalledWith("Record this speech first, then share it with opponents.");
    await view.unmount();
  });
});
