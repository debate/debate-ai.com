/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../components/guides/voice-read-button", () => ({ VoiceReadButton: () => null }));
vi.mock("../components/guides/export-menu", () => ({ ExportMenu: () => null }));
vi.mock("../components/guides/card-voice", () => ({
  readCardsAloud: async () => {},
  readCardAloud: async () => {},
  stopCardVoice: () => {},
}));

import { FAVORITE_REFERENCES_STORAGE_KEY, readFavoriteReferences } from "@debate-ai/reading-mode/favorites";
import {
  COPIED_FEEDBACK_MS,
  REFERENCE_COPY_ATTRIBUTE,
  REFERENCE_FAVORITE_ATTRIBUTE,
  referenceCopyText,
} from "../components/guides/reference-card-actions";
import { ReferencesPanelButton } from "../components/guides/references-panel";
import { clearReferenceArticleAnswers } from "../components/guides/reference-reading-mode";
import { TooltipProvider } from "../components/ui/tooltip";

const WITH_LINK =
  'Ackerman, Elliot, et al. “A Letter on Justice and Open Debate.” <em>Harper’s Magazine</em>, July 7, 2020. <a href="https://harpers.org/a-letter-on-justice-and-open-debate/">harpers.org/a-letter-on-justice-and-open-debate/</a>.';
const NO_LINK =
  "Afary, Janet, and Kevin B. Anderson. <em>Foucault and the Iranian Revolution: Gender and the Seductions of Islamism</em>. Chicago: University of Chicago Press, 2005.";

function citation(id: string, number: string, html: string, authors: string, year: string) {
  const a = document.createElement("a");
  a.className = "citation-link";
  a.href = `/docs/journal/synergy-slayer-critiques/references#ref-${id}`;
  a.textContent = `${authors} (${year})`;
  a.setAttribute("data-citation-number", number);
  a.setAttribute("data-citation", html);
  a.setAttribute("data-citation-card", "<p>A summary of the card.</p>");
  a.setAttribute("data-citation-authors", authors);
  a.setAttribute("data-citation-year", year);
  return a;
}

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(async () => {
  vi.useRealTimers();
  await act(async () => root?.unmount());
  container?.remove();
  root = container = null;
  document.body.innerHTML = "";
  localStorage.clear();
  clearReferenceArticleAnswers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openPanel() {
  const page = document.createElement("div");
  page.className = "synergy-slayer-doc";
  const paragraph = document.createElement("p");
  paragraph.append(
    citation("ackerman-2020", "1", WITH_LINK, "Ackerman", "2020"),
    " and ",
    citation("afary-2005", "2", NO_LINK, "Afary & Anderson", "2005"),
  );
  page.append(paragraph);
  document.body.append(page);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <TooltipProvider>
        <ReferencesPanelButton />
      </TooltipProvider>,
    ),
  );
  await act(async () => container!.querySelector<HTMLButtonElement>("button[aria-haspopup=dialog]")!.click());
}

const cards = () => [...document.querySelectorAll<HTMLElement>("[data-references-panel] li[data-reference-index]")];
const copyButton = (card: number) => cards()[card]!.querySelector<HTMLButtonElement>(`button[${REFERENCE_COPY_ATTRIBUTE}]`)!;
const favoriteButton = (card: number) => cards()[card]!.querySelector<HTMLButtonElement>(`button[${REFERENCE_FAVORITE_ATTRIBUTE}]`)!;

describe("referenceCopyText", () => {
  it("is the citation, then the link on its own line when the citation does not already contain it", () => {
    expect(referenceCopyText({ citation: "Afary 2005.", url: "" })).toBe("Afary 2005.");
    expect(referenceCopyText({ citation: "Ackerman 2020.", url: "https://harpers.org/a/" })).toBe("Ackerman 2020.\nhttps://harpers.org/a/");
    expect(referenceCopyText({ citation: "Ackerman 2020. https://harpers.org/a/", url: "https://harpers.org/a/" })).toBe(
      "Ackerman 2020. https://harpers.org/a/",
    );
  });
});

describe("the icon row on every References panel card", () => {
  it("has Reading mode, Copy and Favorite, in that order, as compact labelled icon buttons", async () => {
    await openPanel();
    expect(cards()).toHaveLength(2);
    for (const card of cards()) {
      const row = card.querySelector("[data-reference-card-toolbar]")!;
      const buttons = [...row.querySelectorAll("button")];
      expect(buttons).toHaveLength(3);
      expect(buttons[0]!.hasAttribute("data-reference-reading-mode")).toBe(true);
      expect(buttons[1]!.hasAttribute(REFERENCE_COPY_ATTRIBUTE)).toBe(true);
      expect(buttons[2]!.hasAttribute(REFERENCE_FAVORITE_ATTRIBUTE)).toBe(true);
      for (const button of buttons) {
        expect(button.textContent).toBe("");
        expect(button.querySelector("svg")).not.toBeNull();
        expect(button.getAttribute("aria-label")).toBeTruthy();
        expect(button.className).toContain("size-7");
      }
    }
    expect(copyButton(0).getAttribute("aria-label")).toBe("Copy reference: Ackerman 2020");
    expect(favoriteButton(1).getAttribute("aria-label")).toBe("Add to favorites: Afary & Anderson 2005");
  });
});

describe("Copy", () => {
  it("copies the citation and its link, shows Copied, then goes back", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await openPanel();
    vi.useFakeTimers();

    await act(async () => copyButton(0).click());
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = (writeText.mock.calls[0] as unknown as [string])[0];
    expect(copied).toContain("Ackerman, Elliot, et al. “A Letter on Justice and Open Debate.”");
    expect(copied.split("\n").at(-1)).toBe("https://harpers.org/a-letter-on-justice-and-open-debate/");
    expect(copyButton(0).getAttribute(REFERENCE_COPY_ATTRIBUTE)).toBe("copied");
    expect(copyButton(0).getAttribute("aria-label")).toBe("Copied");
    expect(cards()[0]!.querySelector("[role=status]")!.textContent).toBe("Copied");
    expect(copyButton(1).getAttribute(REFERENCE_COPY_ATTRIBUTE)).toBe("idle");

    await act(async () => {
      vi.advanceTimersByTime(COPIED_FEEDBACK_MS + 50);
    });
    expect(copyButton(0).getAttribute(REFERENCE_COPY_ATTRIBUTE)).toBe("idle");
    expect(cards()[0]!.querySelector("[role=status]")!.textContent).toBe("");
  });

  it("copies just the citation when the reference has no link", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await openPanel();
    await act(async () => copyButton(1).click());
    const copied = (writeText.mock.calls[0] as unknown as [string])[0];
    expect(copied).toContain("Foucault and the Iranian Revolution");
    expect(copied).not.toContain("http");
  });

  it("says so when the clipboard cannot be written", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denied"))) } });
    document.execCommand = vi.fn(() => false);
    await openPanel();
    await act(async () => copyButton(0).click());
    expect(copyButton(0).getAttribute(REFERENCE_COPY_ATTRIBUTE)).toBe("failed");
    expect(copyButton(0).getAttribute("aria-label")).toBe("Could not copy");
  });
});

describe("Favorite", () => {
  it("toggles the star, saves the reference to the favorites store, and removes it again", async () => {
    await openPanel();
    expect(favoriteButton(0).getAttribute("aria-pressed")).toBe("false");

    await act(async () => favoriteButton(0).click());
    expect(favoriteButton(0).getAttribute("aria-pressed")).toBe("true");
    expect(favoriteButton(0).getAttribute("aria-label")).toBe("Remove from favorites: Ackerman 2020");
    expect(favoriteButton(1).getAttribute("aria-pressed")).toBe("false");

    const [saved] = readFavoriteReferences();
    expect(saved).toMatchObject({
      citation: expect.stringContaining("A Letter on Justice and Open Debate"),
      url: "https://harpers.org/a-letter-on-justice-and-open-debate/",
      title: "A Letter on Justice and Open Debate",
      authors: "Ackerman",
      year: "2020",
    });
    expect(JSON.parse(localStorage.getItem(FAVORITE_REFERENCES_STORAGE_KEY)!)).toHaveLength(1);

    await act(async () => favoriteButton(0).click());
    expect(favoriteButton(0).getAttribute("aria-pressed")).toBe("false");
    expect(readFavoriteReferences()).toEqual([]);
  });

  it("shows a reference already starred (from another page, tab or an account sync) as on", async () => {
    await openPanel();
    expect(favoriteButton(1).getAttribute("aria-pressed")).toBe("false");
    await act(async () => favoriteButton(1).click());
    // Another tab or a sync merge removes it and only the storage event reaches this one.
    localStorage.setItem(FAVORITE_REFERENCES_STORAGE_KEY, "[]");
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: FAVORITE_REFERENCES_STORAGE_KEY }));
    });
    expect(favoriteButton(1).getAttribute("aria-pressed")).toBe("false");
  });
});
