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

// Signed out: the account sync is covered in `WordCountRoundsPanel.sync.test.tsx`.
vi.mock("../src/round/word-count-rounds-client", () => ({
  listSavedWordCountRounds: async () => null,
  saveWordCountRoundToAccount: async () => {},
  deleteSavedWordCountRoundFromAccount: async () => {},
}));

let view: Mounted;
let uninstall: () => void;
const text = () => view.container.textContent ?? "";
const firstSpeech = () => view.container.querySelector("textarea") as HTMLTextAreaElement;

let confirmSpy: ReturnType<typeof vi.fn<(message?: string) => boolean>>;

beforeEach(async () => {
  localStorage.clear();
  confirmSpy = vi.fn<(message?: string) => boolean>(() => true);
  window.confirm = confirmSpy;
  uninstall = installSpeechRecognition();
  view = await mount(createElement(WordCountRoundsPanel));
});

afterEach(async () => {
  await view.unmount();
  uninstall();
});

describe("WordCountRoundsPanel", () => {
  it("says rounds stay in this browser when signed out", () => {
    expect(text()).toContain("Saved rounds stay in this browser. Sign in to keep them in your account.");
  });

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
    expect(confirmSpy).toHaveBeenLastCalledWith("Delete your 1 saved round from this browser?");
    expect(listWordCountRounds()).toEqual([]);
  });

  it("asks before deleting a round and keeps it when cancelled", async () => {
    await type(view.container.querySelector("#word-count-round-id") as HTMLInputElement, "round-6");
    await type(firstSpeech(), "Text");
    await click(button(view.container, "Save round"));
    expect(text()).toContain("Round history · 1");
    expect(button(view.container, "Clear").title).toBe("Delete round round-6");

    confirmSpy.mockReturnValue(false);
    await click(button(view.container, "Clear"));
    expect(confirmSpy).toHaveBeenLastCalledWith('Delete round "round-6" from this browser?');
    await click(button(view.container, "Delete all history"));
    expect(listWordCountRounds().map((round) => round.roundId)).toEqual(["round-6"]);
    expect(text()).toContain("Round round-6");
  });
});

describe("WordCountRoundsPanel fallacy hints", () => {
  it("shows no hints for a clean speech", async () => {
    await type(firstSpeech(), "We affirm because the plan saves lives.");
    expect(view.container.querySelector('[data-testid="fallacy-hints"]')).toBeNull();
  });

  it("flags fallacy-like phrasing and clears when it is removed", async () => {
    await type(firstSpeech(), "Either we ban it or we lose everything.");
    expect(text()).toContain("Possible fallacies (1)");
    expect(text()).toContain("False dichotomy");
    await type(firstSpeech(), "We should weigh the options.");
    expect(view.container.querySelector('[data-testid="fallacy-hints"]')).toBeNull();
  });
});

describe("WordCountRoundsPanel fallacy frequency", () => {
  const summary = () => view.container.querySelector('[data-testid="fallacy-frequency-summary"]')?.textContent ?? "";

  it("says there is nothing to scan before a round is saved", () => {
    expect(text()).toContain("Fallacy hints across your rounds");
    expect(summary()).toContain("No saved speeches yet");
  });

  it("counts hints from saved rounds only, not the draft being typed", async () => {
    await type(firstSpeech(), "You are a liar and either we act or we fail.");
    expect(summary()).toContain("No saved speeches yet");

    await type(view.container.querySelector("#word-count-round-id") as HTMLInputElement, "r1");
    await click(button(view.container, "Save round"));
    expect(summary()).toContain("2 hints across 1 speech");
    expect(summary()).toContain("Round r1 · ");

    await click(button(view.container, "Clear"));
    expect(summary()).toContain("No saved speeches yet");
  });
});
