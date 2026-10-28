// @vitest-environment jsdom
/**
 * @fileoverview Render tests for `WordCountRoundsPanel`: live word counts
 * against each speech's limit, dictating a speech, saving a round to the
 * history, and clearing it.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listWordCountRounds } from "@debate-ai/round/src/state/wordCountRounds";
import { WordCountRoundsPanel } from "../src/panels/WordCountRoundsPanel";
import { button, buttons } from "./helpers/dom";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";
import { FakeRecognition, installSpeechRecognition } from "./helpers/speech-recognition";

let view: Mounted;
let uninstall: () => void;
const text = () => view.container.textContent ?? "";
const firstSpeech = () => view.container.querySelector("textarea") as HTMLTextAreaElement;

beforeEach(async () => {
  localStorage.clear();
  uninstall = installSpeechRecognition();
  view = await mount(createElement(WordCountRoundsPanel));
});

afterEach(async () => {
  await view.unmount();
  uninstall();
});

describe("WordCountRoundsPanel", () => {
  it("counts words against each speech's limit", async () => {
    expect(text()).toContain("0 / 600 words (600 left)");
    await type(firstSpeech(), "one two three");
    expect(text()).toContain("3 / 600 words (597 left)");
  });

  it("flags a speech over its limit", async () => {
    await type(firstSpeech(), Array.from({ length: 605 }, () => "word").join(" "));
    expect(text()).toContain("605 / 600 words (5 over)");
  });

  it("dictates into the speech being recorded", async () => {
    await click(buttons(view.container, "🎤 Record")[0]);
    expect(buttons(view.container, "Stop recording")).toHaveLength(1);
    await flush(() => FakeRecognition.emit("We affirm"));
    expect(firstSpeech().value).toContain("We affirm");
    await click(button(view.container, "Stop recording"));
    expect(buttons(view.container, "Stop recording")).toHaveLength(0);
  });

  it("shows a dictation error", async () => {
    await click(buttons(view.container, "🎤 Record")[0]);
    await flush(() => FakeRecognition.fail());
    expect(text().toLowerCase()).toContain("microphone");
  });

  it("needs a round id to save", async () => {
    await click(button(view.container, "Save round"));
    expect(text()).toContain("Round ID is required.");
  });

  it("saves a round to the history and clears it", async () => {
    await type(view.container.querySelector("#word-count-round-id") as HTMLInputElement, "round-4");
    await type(view.container.querySelector('input[placeholder="Speaker"]') as HTMLInputElement, "Dana");
    await type(firstSpeech(), "Thank you judge");
    await click(button(view.container, "Save round"));

    expect(text()).toContain("Round round-4");
    expect(listWordCountRounds().map((round) => round.roundId)).toEqual(["round-4"]);
    expect(firstSpeech().value).toBe("");

    await click(button(view.container, "Clear"));
    expect(text()).toContain("No word-count rounds yet.");
  });

  it("deletes the whole history at once", async () => {
    await type(view.container.querySelector("#word-count-round-id") as HTMLInputElement, "round-5");
    await type(firstSpeech(), "Text");
    await click(button(view.container, "Save round"));
    await click(button(view.container, "Delete all history"));
    expect(listWordCountRounds()).toEqual([]);
  });
});
