import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import { schema } from "../src/schema/index";
import {
  cardAnalysisText,
  cardAt,
  cardParts,
  cardSpeechSegments,
  cardSpeechText,
  createCardHoverActionsPlugin,
  DOCUMENT_CARD_PAUSE_MS,
  isReadingDocumentAloud,
  readModeShownText,
  toggleReadDocumentAloud,
} from "../src/editor/card-hover-actions";
import { requestSiteCardAi, SUMMARIZE_CARD_PROMPT } from "../src/editor/card-ai-client";

const hl = () => schema.marks.highlight!.create();
const ul = () => schema.marks.underline_mark!.create();

function card(withHighlight = true, withUnderline = false): PMNode {
  return schema.node("card", null, [
    schema.node("tag", null, schema.text("Warming causes extinction")),
    schema.node("cite_paragraph", null, schema.text("Smith 24, climate scientist")),
    schema.node(
      "card_body",
      null,
      withHighlight
        ? [
            schema.text("Rising temperatures "),
            schema.text("will collapse", [hl()]),
            schema.text(" most "),
            schema.text("ecosystems", [hl()]),
            schema.text(" by 2100."),
          ]
        : withUnderline
          ? [
              schema.text("Rising temperatures "),
              schema.text("will collapse", [ul()]),
              schema.text(" most ecosystems by 2100."),
            ]
          : [schema.text("Rising temperatures will collapse most ecosystems by 2100.")],
    ),
  ]);
}

describe("cardParts", () => {
  it("splits a card into tag, cite, body, highlighted and underlined runs", () => {
    expect(cardParts(card())).toEqual({
      tag: "Warming causes extinction",
      cite: "Smith 24, climate scientist",
      body: "Rising temperatures will collapse most ecosystems by 2100.",
      highlighted: "will collapse ecosystems",
      underlined: "",
    });
  });

  it("collects the underlined runs", () => {
    expect(cardParts(card(false, true))).toEqual({
      tag: "Warming causes extinction",
      cite: "Smith 24, climate scientist",
      body: "Rising temperatures will collapse most ecosystems by 2100.",
      highlighted: "",
      underlined: "will collapse",
    });
  });

  it("has no highlighted text when nothing is highlighted", () => {
    expect(cardParts(card(false)).highlighted).toBe("");
  });
});

describe("cardSpeechText", () => {
  it("reads the tag, the author's last name and the year, then only the highlighted text", () => {
    expect(cardSpeechText(cardParts(card()))).toBe(
      "Warming causes extinction. Smith 24. will collapse ecosystems",
    );
  });

  it("falls back to the underlined text when nothing is highlighted", () => {
    expect(cardSpeechText(cardParts(card(false, true)))).toBe(
      "Warming causes extinction. Smith 24. will collapse",
    );
  });

  it("reads nothing of the body when no text is highlighted or underlined", () => {
    expect(cardSpeechText(cardParts(card(false)))).toBe(
      "Warming causes extinction. Smith 24",
    );
  });

  it("reads a four-digit year as its two digits", () => {
    const fourDigit = schema.node("card", null, [
      schema.node("tag", null, schema.text("Warming causes extinction")),
      schema.node("cite_paragraph", null, schema.text("Smith 2024, climate scientist")),
      schema.node(
        "card_body",
        null,
        schema.text("Rising temperatures ", [hl()]),
      ),
    ]);
    expect(cardSpeechText(cardParts(fourDigit))).toBe(
      "Warming causes extinction. Smith 24. Rising temperatures",
    );
  });

  it("skips the citation when a card has none", () => {
    const noCite = schema.node("card", null, [
      schema.node("tag", null, schema.text("Warming causes extinction")),
      schema.node("card_body", null, schema.text("Rising temperatures.", [hl()])),
    ]);
    expect(cardSpeechText(cardParts(noCite))).toBe(
      "Warming causes extinction. Rising temperatures.",
    );
  });
});

describe("cardSpeechSegments", () => {
  it("splits the tag with the author and year from the highlighted text", () => {
    expect(cardSpeechSegments(cardParts(card()))).toEqual([
      { part: "cite", text: "Warming causes extinction. Smith 24" },
      { part: "text", text: "will collapse ecosystems" },
    ]);
  });

  it("leaves out a part with nothing to read", () => {
    expect(cardSpeechSegments(cardParts(card(false)))).toEqual([
      { part: "cite", text: "Warming causes extinction. Smith 24" },
    ]);
  });
});

describe("readModeShownText", () => {
  function cardDom(readMode: boolean): HTMLElement {
    const host = document.createElement("div");
    if (readMode) host.className = "pmd-read-mode";
    host.innerHTML =
      '<div class="pmd-card"><p class="pmd-tag">Tag</p>' +
      '<p class="pmd-card-body"><span class="pmd-rm-hide">Rising </span><mark class="pmd-rm-keep">will collapse</mark>' +
      '<span class="pmd-rm-hide"> most </span><mark class="pmd-rm-keep">ecosystems</mark></p>' +
      '<p class="pmd-undertag">undertag</p></div>';
    return host.querySelector<HTMLElement>(".pmd-card")!;
  }

  it("reads only what read mode shows of the body", () => {
    const el = cardDom(true);
    // jsdom draws no stylesheet; stand in for the browser's visibility check.
    const shown = (e: Element) => !e.closest(".pmd-rm-hide") && !e.closest(".pmd-undertag");
    const proto = Element.prototype as Element & { checkVisibility?: () => boolean };
    const original = proto.checkVisibility;
    proto.checkVisibility = function (this: Element) {
      return shown(this);
    };
    try {
      expect(readModeShownText(el)).toBe("will collapse ecosystems");
    } finally {
      if (original) proto.checkVisibility = original;
      else Reflect.deleteProperty(proto, "checkVisibility");
    }
  });

  it("is empty outside read mode, so the highlighted text is read", () => {
    expect(readModeShownText(cardDom(false))).toBe("");
  });
});

describe("cardAnalysisText", () => {
  it("sends tag, cite and body to the model", () => {
    expect(cardAnalysisText(cardParts(card()))).toBe(
      "Warming causes extinction\n\nSmith 24, climate scientist\n\nRising temperatures will collapse most ecosystems by 2100.",
    );
  });
});

describe("cardAt", () => {
  it("finds the card around a position and null outside one", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text("intro")), card()]);
    expect(cardAt(doc, 1)).toBeNull();
    const inside = doc.child(0).nodeSize + 2;
    expect(cardAt(doc, inside)?.type.name).toBe("card");
  });
});

describe("requestSiteCardAi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the summary prompt, and no prompt for flaws (the server default)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ result: " ok " }) }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await requestSiteCardAi("summary", "card text", "tag")).toBe("ok");
    expect(await requestSiteCardAi("flaws", "card text", "tag")).toBe("ok");

    const bodies = fetchMock.mock.calls.map((call) => JSON.parse((call as unknown as [string, RequestInit])[1].body as string));
    expect(bodies[0]).toEqual({ content: "card text", tag: "tag", prompt: SUMMARIZE_CARD_PROMPT });
    expect(bodies[1]).toEqual({ content: "card text", tag: "tag" });
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("/api/card-ai-analysis");
  });

  it("throws the server's error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: "Sign in to run a custom AI prompt." }) })),
    );
    await expect(requestSiteCardAi("summary", "x", "")).rejects.toThrow("Sign in to run a custom AI prompt.");
  });
});

describe("card hover actions plugin", () => {
  let view: EditorView | null = null;
  afterEach(() => {
    view?.destroy();
    view = null;
  });

  function mount(
    runAi = vi.fn(async () => "A short summary."),
    fetchVoice?: Parameters<typeof createCardHoverActionsPlugin>[0]["fetchVoice"],
    preloadVoice?: Parameters<typeof createCardHoverActionsPlugin>[0]["preloadVoice"],
  ) {
    const doc = schema.node("doc", null, [card()]);
    const place = document.createElement("div");
    document.body.appendChild(place);
    view = new EditorView(place, {
      state: EditorState.create({ doc, plugins: [createCardHoverActionsPlugin({ runAi, fetchVoice, preloadVoice })] }),
    });
    return { view, runAi };
  }

  function hover(target: Element, pointerType = "mouse") {
    const event = new MouseEvent("pointermove", { bubbles: true });
    Object.defineProperty(event, "pointerType", { value: pointerType });
    target.dispatchEvent(event);
  }

  const bar = () => document.querySelector<HTMLElement>(".pmd-card-actions")!;

  it("shows the buttons only while a mouse hovers a card", () => {
    const { view } = mount();
    const cardEl = view.dom.querySelector(".pmd-card")!;
    expect(bar().hasAttribute("data-open")).toBe(false);
    hover(cardEl, "touch");
    expect(bar().hasAttribute("data-open")).toBe(false);
    hover(cardEl);
    expect(bar().hasAttribute("data-open")).toBe(true);
    expect([...bar().querySelectorAll("button")].map((b) => b.dataset["action"])).toEqual(
      expect.arrayContaining(["summary", "flaws"]),
    );
  });

  it("runs the AI on the hovered card and shows the answer", async () => {
    const { view, runAi } = mount();
    hover(view.dom.querySelector(".pmd-card")!);
    bar().querySelector<HTMLButtonElement>('[data-action="summary"]')!.click();
    expect(runAi).toHaveBeenCalledWith("summary", expect.stringContaining("Rising temperatures"), "Warming causes extinction");
    await Promise.resolve();
    await Promise.resolve();
    const panel = document.querySelector<HTMLElement>(".pmd-card-ai-panel")!;
    expect(panel.hasAttribute("data-open")).toBe(true);
    expect(panel.textContent).toContain("A short summary.");
  });

  it("reads in the Kokoro voice by default and falls back to the browser's speech", async () => {
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn() });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        rate = 1;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      },
    );
    const fetchVoice = vi.fn(async () => null);
    const { view } = mount(undefined, fetchVoice);
    hover(view.dom.querySelector(".pmd-card")!);
    const speakBtn = bar().querySelector<HTMLButtonElement>('[data-action="speak"]')!;
    speakBtn.click();
    expect(fetchVoice).toHaveBeenCalledWith(
      expect.stringContaining("Warming causes extinction"),
      { provider: "kokoro", voice: "af_heart" },
      expect.any(AbortSignal),
      expect.any(Function),
    );
    expect(speakBtn.getAttribute("aria-pressed")).toBe("true");
    await Promise.resolve();
    await Promise.resolve();
    expect(speak).toHaveBeenCalledTimes(1);
    // No settings popover: speed and voice live in Settings.
    expect(document.querySelector(".pmd-read-settings")).toBeNull();
    expect(bar().querySelector('[data-action="settings"]')).toBeNull();
    vi.unstubAllGlobals();
  });

  it("follows a voice chosen in Settings", async () => {
    const { storeVoiceId } = await import("../src/editor/card-tts-client");
    const fetchVoice = vi.fn(async () => null);
    const { view } = mount(undefined, fetchVoice);
    storeVoiceId("deepgram:aura-luna-en");
    hover(view.dom.querySelector(".pmd-card")!);
    bar().querySelector<HTMLButtonElement>('[data-action="speak"]')!.click();
    expect(fetchVoice).toHaveBeenCalledWith(expect.any(String), { provider: "deepgram", voice: "aura-luna-en" }, expect.any(AbortSignal), expect.any(Function));
    localStorage.clear();
    storeVoiceId("kokoro:af_heart");
    localStorage.clear();
  });

  it("plays streamed Kokoro clips one after another", async () => {
    const played: string[] = [];
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: (b: Blob) => `blob:${b.size}`, revokeObjectURL: () => {} }));
    vi.stubGlobal(
      "Audio",
      class {
        playbackRate = 1;
        ended = false;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        onpause: (() => void) | null = null;
        constructor(public src: string) {}
        play() {
          played.push(this.src);
          queueMicrotask(() => {
            this.ended = true;
            this.onended?.();
          });
          return Promise.resolve();
        }
        pause() {}
      },
    );
    const fetchVoice = vi.fn(async () =>
      (async function* () {
        yield new Blob([new Uint8Array(1)]);
        yield new Blob([new Uint8Array(2)]);
      })(),
    );
    const { view } = mount(undefined, fetchVoice);
    hover(view.dom.querySelector(".pmd-card")!);
    const speakBtn = bar().querySelector<HTMLButtonElement>('[data-action="speak"]')!;
    speakBtn.click();
    await vi.waitFor(() => expect(speakBtn.getAttribute("aria-pressed")).toBe("false"));
    expect(played).toEqual(["blob:1", "blob:2"]);
    vi.unstubAllGlobals();
  });

  it("shows Kokoro's progress through the paragraph it is making, and hides it on Stop", () => {
    const events: unknown[] = [];
    const onEvent = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener("pmd-read-progress", onEvent);
    const fetchVoice = vi.fn(
      (
        _text: string,
        _voice: unknown,
        _signal: AbortSignal,
        onProgress?: (p: { index: number; count: number; fraction: number; cached: boolean }) => void,
      ) => {
        onProgress?.({ index: 1, count: 3, fraction: 0.42, cached: false });
        return new Promise<null>(() => {});
      },
    );
    const { view } = mount(undefined, fetchVoice);
    hover(view.dom.querySelector(".pmd-card")!);
    const speakBtn = bar().querySelector<HTMLButtonElement>('[data-action="speak"]')!;
    speakBtn.click();
    const pill = document.querySelector<HTMLElement>(".pmd-read-progress")!;
    expect(pill.hasAttribute("data-open")).toBe(true);
    expect(pill.textContent).toBe("Kokoro · paragraph 2 of 3 · 42%");
    expect(speakBtn.title).toContain("42%");
    speakBtn.click();
    expect(pill.hasAttribute("data-open")).toBe(false);
    expect(events.at(-1)).toBeNull();
    window.removeEventListener("pmd-read-progress", onEvent);
  });

  it("starts downloading the Kokoro voice on the first card hover, once", () => {
    const preloadVoice = vi.fn();
    const { view } = mount(undefined, vi.fn(async () => null), preloadVoice);
    const cardEl = view.dom.querySelector(".pmd-card")!;
    hover(cardEl);
    hover(cardEl);
    expect(preloadVoice).toHaveBeenCalledTimes(1);
    expect(preloadVoice).toHaveBeenCalledWith({ provider: "kokoro", voice: "af_heart" });
  });

  it("reads every card in the document with a pause between them, and stops", () => {
    vi.useFakeTimers();
    const spoken: string[] = [];
    const utterances: { onend: (() => void) | null }[] = [];
    vi.stubGlobal("speechSynthesis", {
      speak: (u: { text: string; onend: (() => void) | null }) => {
        spoken.push(u.text);
        utterances.push(u);
      },
      cancel: vi.fn(),
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        rate = 1;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      },
    );
    const second = card().copy(card().content.replaceChild(0, schema.node("tag", null, schema.text("Second card"))));
    const doc = schema.node("doc", null, [card(), card(false), second]);
    const place = document.createElement("div");
    document.body.appendChild(place);
    view = new EditorView(place, {
      state: EditorState.create({ doc, plugins: [createCardHoverActionsPlugin({ runAi: vi.fn() })] }),
    });
    expect(toggleReadDocumentAloud()).toBe(true);
    expect(isReadingDocumentAloud()).toBe(true);
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toContain("Warming causes extinction");
    expect(view.dom.querySelectorAll(".pmd-card-reading")).toHaveLength(1);
    utterances[0]!.onend!();
    // Pauses before the next card.
    expect(spoken).toHaveLength(1);
    vi.advanceTimersByTime(DOCUMENT_CARD_PAUSE_MS);
    // The un-highlighted middle card still reads its tag and cite.
    expect(spoken).toHaveLength(2);
    utterances[1]!.onend!();
    vi.advanceTimersByTime(DOCUMENT_CARD_PAUSE_MS);
    expect(spoken[2]).toContain("Second card");
    toggleReadDocumentAloud();
    expect(isReadingDocumentAloud()).toBe(false);
    expect(view.dom.querySelector(".pmd-card-reading")).toBeNull();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function stubBrowserSpeech() {
    const spoken: { text: string; rate: number; onend: (() => void) | null }[] = [];
    vi.stubGlobal("speechSynthesis", {
      speak: (u: { text: string; rate: number; onend: (() => void) | null }) => spoken.push(u),
      cancel: vi.fn(),
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        rate = 1;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      },
    );
    return spoken;
  }

  it("reads the tag and cite, then the highlighted text, each in its own voice and speed", async () => {
    const { storeReadSpeed, storeVoiceId } = await import("../src/editor/card-tts-client");
    localStorage.clear();
    const spoken = stubBrowserSpeech();
    storeVoiceId("browser", "cite");
    storeReadSpeed(1, "cite");
    storeVoiceId("browser");
    storeReadSpeed(3);
    const { view } = mount(undefined, vi.fn(async () => null));
    hover(view.dom.querySelector(".pmd-card")!);
    bar().querySelector<HTMLButtonElement>('[data-action="speak"]')!.click();
    expect(spoken.map((u) => [u.text, u.rate])).toEqual([["Warming causes extinction. Smith 24", 1]]);
    spoken[0]!.onend!();
    expect(spoken.map((u) => [u.text, u.rate])).toEqual([
      ["Warming causes extinction. Smith 24", 1],
      ["will collapse ecosystems", 3],
    ]);
    spoken[1]!.onend!();
    expect(bar().querySelector('[data-action="speak"]')!.getAttribute("aria-pressed")).toBe("false");
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("fetches the cite in its model voice and the highlighted text in its own", async () => {
    const { storeVoiceId } = await import("../src/editor/card-tts-client");
    localStorage.clear();
    storeVoiceId("deepgram:aura-luna-en", "cite");
    const fetchVoice = vi.fn(async () => null);
    const { view } = mount(undefined, fetchVoice);
    hover(view.dom.querySelector(".pmd-card")!);
    bar().querySelector<HTMLButtonElement>('[data-action="speak"]')!.click();
    expect(fetchVoice).toHaveBeenCalledWith(
      "Warming causes extinction. Smith 24",
      { provider: "deepgram", voice: "aura-luna-en" },
      expect.any(AbortSignal),
      expect.any(Function),
    );
    localStorage.clear();
  });

  it("opens the read-aloud player from the gear, sets voices there, and closes on Escape", async () => {
    const { readStoredVoiceId, readStoredSpeed } = await import("../src/editor/card-tts-client");
    localStorage.clear();
    const spoken = stubBrowserSpeech();
    const { view } = mount();
    hover(view.dom.querySelector(".pmd-card")!);
    bar().querySelector<HTMLButtonElement>('[data-action="read-settings"]')!.click();
    const player = document.querySelector<HTMLElement>(".pmd-read-player")!;
    expect(player).not.toBeNull();
    expect(player.querySelector('[data-part="cite"]')!.textContent).toContain("Tag, author & year");
    expect(player.querySelector('[data-part="text"]')!.textContent).toContain("Highlighted text");

    const citeVoice = player.querySelector<HTMLSelectElement>("#pmd-read-player-cite-voice")!;
    citeVoice.value = "deepgram:aura-orion-en";
    citeVoice.dispatchEvent(new Event("change"));
    expect(readStoredVoiceId("cite")).toBe("deepgram:aura-orion-en");
    expect(readStoredVoiceId("text")).toBe("kokoro:af_heart");
    const textSpeed = player.querySelector<HTMLInputElement>("#pmd-read-player-text-speed")!;
    textSpeed.value = "1.5";
    textSpeed.dispatchEvent(new Event("input"));
    expect(readStoredSpeed("text")).toBe(1.5);
    expect(player.querySelector('[data-part="text"]')!.textContent).toContain("1.5x");

    const buttons = [...player.querySelectorAll<HTMLButtonElement>("button")].map((b) => b.textContent);
    expect(buttons).toEqual(expect.arrayContaining(["Play whole document", "Play from this card", "Play this card", "Stop"]));
    [...player.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Play whole document")!.click();
    expect(isReadingDocumentAloud()).toBe(true);
    expect(spoken.length).toBeGreaterThan(0);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector(".pmd-read-player")).toBeNull();
    // Escape closed the player but left the read going.
    expect(isReadingDocumentAloud()).toBe(true);
    toggleReadDocumentAloud();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("keeps reading into the next file the host opens", async () => {
    const { READ_NEXT_FILE_EVENT, storeContinueFiles } = await import("../src/editor/card-tts-client");
    localStorage.clear();
    vi.useFakeTimers();
    const spoken = stubBrowserSpeech();
    storeContinueFiles(true);
    const plugin = createCardHoverActionsPlugin({ runAi: vi.fn() });
    const place = document.createElement("div");
    document.body.appendChild(place);
    view = new EditorView(place, { state: EditorState.create({ doc: schema.node("doc", null, [card()]), plugins: [plugin] }) });
    const asked = vi.fn((e: Event) => e.preventDefault());
    window.addEventListener(READ_NEXT_FILE_EVENT, asked);
    toggleReadDocumentAloud();
    spoken[0]!.onend!();
    vi.advanceTimersByTime(DOCUMENT_CARD_PAUSE_MS);
    expect(asked).toHaveBeenCalledTimes(1);
    expect(isReadingDocumentAloud()).toBe(false);
    // The host swaps in the next file's document; the reader starts on it.
    const next = card().copy(card().content.replaceChild(0, schema.node("tag", null, schema.text("Next file card"))));
    view.updateState(EditorState.create({ doc: schema.node("doc", null, [next]), plugins: [plugin] }));
    vi.advanceTimersByTime(1000);
    expect(isReadingDocumentAloud()).toBe(true);
    expect(spoken.at(-1)!.text).toContain("Next file card");
    toggleReadDocumentAloud();
    window.removeEventListener(READ_NEXT_FILE_EVENT, asked);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("removes its elements when the view is destroyed", () => {
    const { view: v } = mount();
    v.destroy();
    view = null;
    expect(document.querySelector(".pmd-card-actions")).toBeNull();
    expect(document.querySelector(".pmd-card-ai-panel")).toBeNull();
  });
});
