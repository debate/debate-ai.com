// @vitest-environment jsdom
/**
 * @fileoverview `?entry=` deep links on Speech Documents — the link Settings →
 * Saved to your account puts on each sent-speech row. The named entry is
 * outlined, marked `aria-current` and scrolled into view; an id that isn't on
 * this device shows a note instead.
 */
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSpeechSendOpenHref } from "../../../src/lib/speech-send-log-client";
import { cleanup, flush, mount } from "../../helpers/dom";

type Entry = { id: string; text: string; preview: string; atEnd: boolean; sentAt: number };

const state = vi.hoisted(() => ({ entries: [] as Entry[], params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => state.params }));
vi.mock("@debate-ai/editor/engine", () => ({
  speechSendLogStore: {
    init: async () => {},
    list: () => state.entries,
    subscribe: () => () => {},
  },
}));
vi.mock("../../../src/lib/hooks/useSpeechSendLogSync", () => ({
  useSpeechSendLogSync: () => ({ synced: true, removeEntry: () => {}, clearAll: () => {} }),
}));

const { SpeechSendLogPanel } = await import("../../../src/routes/speech-documents/SpeechSendLogPanel");

const entry = (id: string, text: string): Entry => ({ id, text, preview: text, atEnd: false, sentAt: 1 });
const scrolled: Element[] = [];

async function open(search: string, entries: Entry[]) {
  state.entries = entries;
  state.params = new URLSearchParams(search);
  const view = mount(createElement(SpeechSendLogPanel));
  await flush();
  return view.container;
}

beforeEach(() => {
  scrolled.length = 0;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
});

afterEach(() => cleanup());

describe("buildSpeechSendOpenHref", () => {
  it("links to Speech Documents with the entry id encoded", () => {
    expect(buildSpeechSendOpenHref("send-1")).toBe("/speech-documents?entry=send-1");
    expect(buildSpeechSendOpenHref("x/y?z")).toBe("/speech-documents?entry=x%2Fy%3Fz");
  });
});

describe("SpeechSendLogPanel ?entry=", () => {
  it("outlines and scrolls to the linked entry only", async () => {
    const container = await open("entry=s2", [entry("s1", "First card"), entry("s2", "Second card"), entry("s3", "Third card")]);
    const linked = container.querySelectorAll('[data-linked="true"]');
    expect(linked).toHaveLength(1);
    expect(linked[0].getAttribute("aria-current")).toBe("true");
    expect(linked[0].textContent).toContain("Second card");
    expect(scrolled).toEqual([linked[0]]);
    expect(container.textContent).not.toContain("isn't on this device");
  });

  it("says when the linked entry isn't on this device", async () => {
    const container = await open("entry=gone", [entry("s1", "First card")]);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("isn't on this device");
    expect(container.querySelector('[data-linked="true"]')).toBeNull();
    expect(scrolled).toEqual([]);
  });

  it("does nothing special without the param", async () => {
    const container = await open("", [entry("s1", "First card")]);
    expect(container.querySelector('[data-linked="true"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(scrolled).toEqual([]);
  });
});

describe("SpeechSendLogPanel fallacy summary", () => {
  const summary = (container: HTMLElement) => container.querySelector('[data-testid="fallacy-frequency-summary"]');

  it("counts hints across the sent entries", async () => {
    const container = await open("", [
      entry("s1", "Either we act now or we fail."),
      entry("s2", "You are an idiot."),
      entry("s3", "Plain evidence."),
    ]);
    expect(container.textContent).toContain("Fallacy hints across your sent speeches");
    const text = summary(container)?.textContent ?? "";
    expect(text).toContain("3 speeches");
    expect(text).toContain("False dichotomy");
    expect(text).toContain("Ad hominem");
  });

  it("says when no sent entry trips a hint", async () => {
    const container = await open("", [entry("s1", "Plain evidence card.")]);
    expect(summary(container)?.textContent).toContain("No fallacy hints across 1 speech");
  });

  it("has no summary when nothing has been sent", async () => {
    const container = await open("", []);
    expect(container.textContent).not.toContain("Fallacy hints across your sent speeches");
    expect(summary(container)).toBeNull();
  });
});
