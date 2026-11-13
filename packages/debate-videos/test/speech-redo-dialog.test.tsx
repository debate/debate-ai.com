// @vitest-environment jsdom
/**
 * @fileoverview The "Do the full speech" dialog: writes the speech on open,
 * shows it in the editor, keeps edits, regenerates, reports errors, and
 * sets the timer to the speech's length. The Debate Editor engine and the
 * timer's recorder are stubbed — they need a real browser.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@debate-ai/editor", () => ({
  EditorWithToolbar: (props: { content: string; contentKey: string; onChange?: (html: string) => void }) =>
    createElement(
      "div",
      { "data-testid": "editor", "data-key": props.contentKey },
      createElement("div", { "data-testid": "editor-html", dangerouslySetInnerHTML: { __html: props.content } }),
      createElement("button", { type: "button", onClick: () => props.onChange?.("<p>My edit</p>") }, "edit"),
    ),
}));

vi.mock("@debate-ai/timer", () => ({
  SpeechTimer: (props: { speeches: Array<{ name: string; time: number }>; time: number }) =>
    createElement("div", {
      "data-testid": "timer",
      "data-name": props.speeches[0]?.name,
      "data-minutes": props.speeches[0]?.time,
      "data-time": props.time,
    }),
  SpeechRecordingPlayer: (props: { speechName: string }) =>
    createElement("div", { "data-testid": "player", "data-name": props.speechName }),
}));

import { SpeechRedoDialog } from "../src/components/videos/watch/SpeechRedoDialog";
import type { RoundSpeech } from "../src/lib/round-speeches";
import { speechRedoStorageKey } from "../src/lib/speech-redo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const speeches: RoundSpeech[] = [
  { key: "1NC#1", label: "1NC", heading: "1NC", side: "neg", isSpeech: true, startSeconds: 0, parts: { transcript: "Five off." } },
  { key: "1AR#1", label: "1AR", heading: "1AR", side: "aff", isSpeech: true, startSeconds: 60, parts: { transcript: "Group spec." } },
];

const alternative = {
  title: "Impact turn the DA",
  approach: "turn",
  outline: ["Turn the disease DA"],
  tradeoff: "Less spec.",
  ballot: { winner: "aff" as const, affWinProbability: 60, rfd: "Turn." },
};

const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

describe("SpeechRedoDialog", () => {
  let container: HTMLDivElement;
  let root: Root;
  const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const button = (text: string) =>
    Array.from(document.querySelectorAll("button")).find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

  const render = (open = true) =>
    act(() =>
      root.render(
        createElement(SpeechRedoDialog, {
          open,
          onOpenChange: () => {},
          videoId: "vid",
          speeches,
          index: 1,
          alternativeIndex: 0,
          alternative,
          round: { format: "Policy" },
        }),
      ),
    );

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("writes the speech on open, shows it in the editor and keeps edits", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: "## The DA\n\n**Turn** it." }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render();
    expect(document.body.textContent).toContain("Writing the full 1AR");
    await flush();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.messages[0].content).toContain("## The prior speech: 1NC");
    expect(q("editor-html")?.innerHTML).toContain("<strong>Turn</strong>");

    // Timer is the policy 1AR's five minutes, under a redo-only recording name.
    expect(q("timer")?.dataset.minutes).toBe("5");
    expect(q("timer")?.dataset.time).toBe(String(5 * 60_000));
    expect(q("player")?.dataset.name).toBe("watch-redo:vid:1AR#1:1");

    act(() => button("edit").click());
    const stored = JSON.parse(window.localStorage.getItem(speechRedoStorageKey("vid", "1AR#1", alternative.title))!);
    expect(stored.html).toBe("<p>My edit</p>");
  });

  it("reopens a kept draft without asking again, and Write again replaces it", async () => {
    window.localStorage.setItem(
      speechRedoStorageKey("vid", "1AR#1", alternative.title),
      JSON.stringify({ html: "<p>Kept draft</p>", savedAt: 1 }),
    );
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: "Fresh speech" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render();
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(q("editor-html")?.textContent).toBe("Kept draft");
    const firstKey = q("editor")?.dataset.key;

    await act(async () => button("Write again").click());
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(q("editor-html")?.textContent?.trim()).toBe("Fresh speech");
    expect(q("editor")?.dataset.key).not.toBe(firstKey);
  });

  it("shows the proxy's error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Sign in to use AI features." }), { status: 401 })));
    render();
    await flush();
    await flush();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Sign in to use AI features.");
  });

  it("copies the speech as plain text", async () => {
    window.localStorage.setItem(
      speechRedoStorageKey("vid", "1AR#1", alternative.title),
      JSON.stringify({ html: "<h2>The DA</h2><p>Turn it.</p>", savedAt: 1 }),
    );
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    vi.stubGlobal("fetch", vi.fn());
    render();
    await flush();
    await act(async () => button("Copy").click());
    expect(writeText).toHaveBeenCalledWith("The DA\nTurn it.");
    expect(button("Copied")).toBeTruthy();
  });

  it("renders nothing while closed", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(false);
    expect(q("editor")).toBeNull();
  });
});
