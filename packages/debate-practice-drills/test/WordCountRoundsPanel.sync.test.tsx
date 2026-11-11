// @vitest-environment jsdom
/**
 * @fileoverview `WordCountRoundsPanel` signed in: the save-location line says
 * rounds are in the account, a round adopted from another device is listed
 * with a dismissible notice, and a saved round is sent to the account.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WordCountRoundRecord } from "@debate-ai/round/src/state/wordCountRounds";
import { button } from "./helpers/dom";
import { click, mount, type, type Mounted } from "./helpers/mount";
import { installSpeechRecognition } from "./helpers/speech-recognition";

const client = vi.hoisted(() => ({
  listSavedWordCountRounds: vi.fn<() => Promise<WordCountRoundRecord[] | null>>(),
  saveWordCountRoundToAccount: vi.fn<(record: WordCountRoundRecord) => Promise<void>>(),
  deleteSavedWordCountRoundFromAccount: vi.fn<(roundId: string) => Promise<void>>(),
}));
vi.mock("../src/round/word-count-rounds-client", () => client);

let view: Mounted;
let uninstall: () => void;
const text = () => view.container.textContent ?? "";

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.resetModules();
  client.saveWordCountRoundToAccount.mockResolvedValue(undefined);
  client.deleteSavedWordCountRoundFromAccount.mockResolvedValue(undefined);
  client.listSavedWordCountRounds.mockResolvedValue([
    {
      roundId: "from-laptop",
      styleKey: "practicePublicForum",
      submittedSpeeches: [{ name: "AC", speaker: "Sam", text: "We affirm." }],
      createdAt: 1,
      updatedAt: 2,
    },
  ]);
  uninstall = installSpeechRecognition();
  const { WordCountRoundsPanel } = await import("../src/panels/WordCountRoundsPanel");
  view = await mount(createElement(WordCountRoundsPanel));
});

afterEach(async () => {
  await view.unmount();
  uninstall();
});

describe("WordCountRoundsPanel signed in", () => {
  it("says rounds are saved to the account and lists the adopted round with a notice", async () => {
    expect(text()).toContain("Saved rounds are stored in your account and show up on your other devices.");
    expect(text()).toContain("Round from-laptop");
    const notice = view.container.querySelector('[role="status"]');
    expect(notice?.textContent).toContain("Synced round from-laptop from another device.");

    await click(button(view.container, "Dismiss"));
    expect(view.container.querySelector('[role="status"]')).toBeNull();
  });

  it("sends a newly saved round to the account", async () => {
    await type(view.container.querySelector("#word-count-round-id") as HTMLInputElement, "round-9");
    await type(view.container.querySelector("textarea") as HTMLTextAreaElement, "Thank you judge");
    await click(button(view.container, "Save round"));

    expect(client.saveWordCountRoundToAccount).toHaveBeenCalledTimes(1);
    const sent = client.saveWordCountRoundToAccount.mock.calls[0][0];
    expect(sent.roundId).toBe("round-9");
    expect(sent.submittedSpeeches[0]?.text).toBe("Thank you judge");
  });
});
