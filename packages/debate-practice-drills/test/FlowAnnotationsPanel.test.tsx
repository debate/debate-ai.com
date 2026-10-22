// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `FlowAnnotationsPanel`: validating and
 * dropping timestamped annotations (manual and from the playing video),
 * jumping back to one, and clearing.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVideoPlayerStore } from "@debate/videos";
import { FlowAnnotationsPanel } from "../src/panels/FlowAnnotationsPanel";
import { button } from "./helpers/dom";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

/** The real persistent player store, put into the state a test needs. */
function setPlayer(state: Partial<ReturnType<typeof useVideoPlayerStore.getState>>) {
  useVideoPlayerStore.setState(state);
}

let view: Mounted;
const text = () => view.container.textContent ?? "";
const field = (id: string) => view.container.querySelector(`#${id}`) as HTMLInputElement;

async function fill(values: Record<string, string>) {
  for (const [id, value] of Object.entries(values)) await type(field(id), value);
}

async function open() {
  view = await mount(createElement(FlowAnnotationsPanel));
}

beforeEach(() => {
  localStorage.clear();
  setPlayer({ activeVideoId: null, activeVideoTitle: null, isPlaying: false, getCurrentTimeRef: () => 95 } as never);
});

afterEach(async () => {
  await view.unmount();
});

describe("FlowAnnotationsPanel", () => {
  it.each([
    [{}, "Flow ID must be a whole number."],
    [{ "annotation-flow-id": "1" }, "Speech ID is required"],
    [{ "annotation-flow-id": "1", "annotation-speech-id": "1AC", "annotation-box-path": "a, b" }, "Box path must be comma-separated"],
  ])("validates the form (%#)", async (values, error) => {
    await open();
    await fill(values);
    await click(button(view.container, "Drop annotation"));
    expect(text()).toContain(error);
  });

  it("drops a manual-timestamp annotation, downloads and clears it", async () => {
    await open();
    expect(text()).toContain("No video is currently playing.");
    await click(button(view.container, "Manual"));
    await fill({
      "annotation-flow-id": "3",
      "annotation-speech-id": "1NC",
      "annotation-box-path": "0, 1",
      "annotation-manual-timestamp": "1:30",
      "annotation-speaker": "Jordan",
      "annotation-tag": "solvency",
      "annotation-note": "Solvency answer starts",
    });
    await click(button(view.container, "Drop annotation"));
    expect(text()).toContain("Solvency answer starts");
    expect(text()).toContain("1:30");
    expect(text()).not.toContain("No flow annotations yet.");

    await click(button(view.container, "Clear"));
    expect(text()).toContain("No flow annotations yet.");
  });

  it("rejects a bad manual timestamp", async () => {
    await open();
    await click(button(view.container, "Manual"));
    await fill({ "annotation-flow-id": "3", "annotation-speech-id": "1NC", "annotation-box-path": "0", "annotation-manual-timestamp": "soon" });
    await click(button(view.container, "Drop annotation"));
    expect(text()).toContain("Timestamp must be a valid m:ss");
  });

  it("stamps the playing video's position and jumps back to it", async () => {
    setPlayer({ activeVideoId: "vid12345678", activeVideoTitle: "TOC Finals" });
    await open();
    await fill({ "annotation-flow-id": "3", "annotation-speech-id": "2AC", "annotation-box-path": "0", "annotation-note": "Turn answered" });
    await click(button(view.container, "Drop annotation"));
    expect(text()).toContain("1:35");
    expect(text()).toContain("TOC Finals");

    // Jumping from another video switches the player back to this one.
    await flush(() => setPlayer({ activeVideoId: "otherVideo1", activeVideoTitle: "Other" }));
    await click(button(view.container, "Jump to"));
    expect(useVideoPlayerStore.getState().activeVideoId).toBe("vid12345678");
  });
});
