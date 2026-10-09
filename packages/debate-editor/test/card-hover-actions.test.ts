import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import { schema } from "../src/schema/index";
import {
  cardAnalysisText,
  cardAt,
  cardParts,
  cardSpeechText,
  createCardHoverActionsPlugin,
} from "../src/editor/card-hover-actions";
import { requestSiteCardAi, SUMMARIZE_CARD_PROMPT } from "../src/editor/card-ai-client";

const hl = () => schema.marks.highlight!.create();

function card(withHighlight = true): PMNode {
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
        : [schema.text("Rising temperatures will collapse most ecosystems by 2100.")],
    ),
  ]);
}

describe("cardParts", () => {
  it("splits a card into tag, cite, body and highlighted runs", () => {
    expect(cardParts(card())).toEqual({
      tag: "Warming causes extinction",
      cite: "Smith 24, climate scientist",
      body: "Rising temperatures will collapse most ecosystems by 2100.",
      highlighted: "will collapse ecosystems",
    });
  });

  it("has no highlighted text when nothing is highlighted", () => {
    expect(cardParts(card(false)).highlighted).toBe("");
  });
});

describe("cardSpeechText", () => {
  it("reads the tag then only the highlighted text", () => {
    expect(cardSpeechText(cardParts(card()))).toBe("Warming causes extinction. will collapse ecosystems");
  });

  it("falls back to the whole body when nothing is highlighted", () => {
    expect(cardSpeechText(cardParts(card(false)))).toBe(
      "Warming causes extinction. Rising temperatures will collapse most ecosystems by 2100.",
    );
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

  function mount(runAi = vi.fn(async () => "A short summary.")) {
    const doc = schema.node("doc", null, [card()]);
    const place = document.createElement("div");
    document.body.appendChild(place);
    view = new EditorView(place, {
      state: EditorState.create({ doc, plugins: [createCardHoverActionsPlugin({ runAi })] }),
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

  it("removes its elements when the view is destroyed", () => {
    const { view: v } = mount();
    v.destroy();
    view = null;
    expect(document.querySelector(".pmd-card-actions")).toBeNull();
    expect(document.querySelector(".pmd-card-ai-panel")).toBeNull();
  });
});
