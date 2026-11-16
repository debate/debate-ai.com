// @vitest-environment jsdom
/**
 * @fileoverview `?round=` deep links on the Word Count page — the link
 * Settings → Saved to your account puts on each word-count round. The named
 * round is outlined, marked `aria-current` and scrolled into view; an id that
 * isn't on this device shows a note, which goes away once the account merge
 * brings the round in.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WordCountRoundRecord } from "@debate-ai/round/src/state/wordCountRounds";
import { buildWordCountRoundOpenHref } from "../src/state/savedWordCountRounds";
import { flush, mount, type Mounted } from "./helpers/mount";
import { installSpeechRecognition } from "./helpers/speech-recognition";

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }));
const client = vi.hoisted(() => ({
  listSavedWordCountRounds: vi.fn<() => Promise<WordCountRoundRecord[] | null>>(),
  saveWordCountRoundToAccount: vi.fn(async () => {}),
  deleteSavedWordCountRoundFromAccount: vi.fn(async () => {}),
}));
vi.mock("../src/round/word-count-rounds-client", () => client);

const round = (roundId: string, text = `Speech for ${roundId}`): WordCountRoundRecord => ({
  roundId,
  styleKey: "practicePublicForum",
  submittedSpeeches: [{ name: "AC", speaker: "Sam", text }],
  createdAt: 1,
  updatedAt: 1,
});

let view: Mounted | null = null;
let uninstall: () => void = () => {};
const scrolled: Element[] = [];

async function open(search: string, local: WordCountRoundRecord[], account: WordCountRoundRecord[] | null = null) {
  localStorage.setItem("wordCountRounds", JSON.stringify(local));
  client.listSavedWordCountRounds.mockResolvedValue(account);
  nav.params = new URLSearchParams(search);
  const { WordCountRoundsPanel } = await import("../src/panels/WordCountRoundsPanel");
  view = await mount(createElement(WordCountRoundsPanel));
  await flush(async () => {});
  return view.container;
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  scrolled.length = 0;
  uninstall = installSpeechRecognition();
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
});

afterEach(async () => {
  await view?.unmount();
  view = null;
  uninstall();
});

describe("buildWordCountRoundOpenHref", () => {
  it("links to the Word Count page with the round id encoded", () => {
    expect(buildWordCountRoundOpenHref("round-1")).toBe("/word-count?round=round-1");
    expect(buildWordCountRoundOpenHref("Quarters / Aff #2")).toBe("/word-count?round=Quarters%20%2F%20Aff%20%232");
  });
});

describe("WordCountRoundsPanel ?round=", () => {
  it("outlines and scrolls to the linked round only", async () => {
    const container = await open("round=r2", [round("r1"), round("r2"), round("r3")]);
    const linked = container.querySelectorAll('[data-linked="true"]');
    expect(linked).toHaveLength(1);
    expect(linked[0].getAttribute("aria-current")).toBe("true");
    expect(linked[0].textContent).toContain("Round r2");
    expect(scrolled).toEqual([linked[0]]);
    expect(container.textContent).not.toContain("isn't on this device");
  });

  it("says when the linked round isn't on this device, without highlighting anything", async () => {
    const container = await open("round=missing", [round("r1")]);
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "The linked word-count round isn't on this device",
    );
    expect(container.querySelector('[data-linked="true"]')).toBeNull();
    expect(scrolled).toEqual([]);
  });

  it("highlights a round the account merge brings in, and drops the note", async () => {
    const container = await open("round=from-laptop", [round("r1")], [round("from-laptop")]);
    const linked = container.querySelector('[data-linked="true"]');
    expect(linked?.textContent).toContain("Round from-laptop");
    expect(scrolled).toEqual([linked]);
    expect(container.textContent).not.toContain("The linked word-count round isn't on this device");
  });

  it("does nothing special without the param", async () => {
    const container = await open("", [round("r1")]);
    expect(container.querySelector('[data-linked="true"]')).toBeNull();
    expect(container.textContent).not.toContain("isn't on this device");
    expect(scrolled).toEqual([]);
  });
});
