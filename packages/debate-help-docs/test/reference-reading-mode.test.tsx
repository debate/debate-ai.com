/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Reading aloud and exporting load their engines from the editor package, which is
// assembled from a submodule; none of it runs in these tests.
vi.mock("../components/guides/voice-read-button", () => ({ VoiceReadButton: () => null }));
vi.mock("../components/guides/export-menu", () => ({ ExportMenu: () => null }));
vi.mock("../components/guides/card-voice", () => ({
  readCardsAloud: async () => {},
  readCardAloud: async () => {},
  stopCardVoice: () => {},
}));

import { ReferencesPanelButton } from "../components/guides/references-panel";
import {
  REFERENCE_ARTICLE_ENDPOINT,
  clearReferenceArticleAnswers,
  describeItem,
  referenceArticleRequest,
} from "../components/guides/reference-reading-mode";
import type { ReferenceItem } from "../components/guides/references-panel-items";
import { TooltipProvider } from "../components/ui/tooltip";

const WITH_LINK =
  'Ackerman, Elliot, et al. “A Letter on Justice and Open Debate.” <em>Harper’s Magazine</em>, July 7, 2020. <a href="https://harpers.org/a-letter-on-justice-and-open-debate/">harpers.org/a-letter-on-justice-and-open-debate/</a>.';
const NO_LINK =
  "Afary, Janet, and Kevin B. Anderson. <em>Foucault and the Iranian Revolution: Gender and the Seductions of Islamism</em>. Chicago: University of Chicago Press, 2005.";

const BODY = "The free exchange of information and ideas, the lifeblood of a liberal society, is daily becoming more constricted.";

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
let page: HTMLElement | null = null;

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
  await act(async () => root?.unmount());
  container?.remove();
  page?.remove();
  root = container = page = null;
  document.body.innerHTML = "";
  clearReferenceArticleAnswers();
  vi.unstubAllGlobals();
});

/** A docs page citing two sources, with the References panel opened over it. */
async function openPanel(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  page = document.createElement("div");
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

const panel = () => document.querySelector<HTMLElement>("[data-references-panel]")!;
const readerButtons = () => [...panel().querySelectorAll<HTMLButtonElement>("button[data-reference-reading-mode]")];
const reader = () => document.querySelector<HTMLElement>("[data-reading-mode-nested]");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Answers the article endpoint from `answer`; the reader's other requests (suggested questions) get a 404. */
function articleServer(answer: () => Response | Promise<Response>) {
  return vi.fn(async (input: RequestInfo | URL) => (String(input).startsWith(REFERENCE_ARTICLE_ENDPOINT) ? answer() : json({}, 404)));
}

const articleCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.map((call) => String(call[0])).filter((url) => url.startsWith(REFERENCE_ARTICLE_ENDPOINT));

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("describing a reference for the server", () => {
  const item = (citationHtml: string, authors: string, year: string): ReferenceItem => ({
    href: "",
    number: "1",
    citation: citationHtml,
    card: "",
    spoken: "",
    authors,
    year,
    label: `${authors} (${year})`,
    links: [],
    paragraph: null,
  });

  it("sends the link, title, authors, year and publication, and leaves empty fields out", () => {
    const request = referenceArticleRequest(describeItem(item(WITH_LINK, "Ackerman", "2020")));
    expect(request.startsWith(`${REFERENCE_ARTICLE_ENDPOINT}?`)).toBe(true);
    const params = new URL(request, "https://debate-ai.com").searchParams;
    expect(params.get("url")).toBe("https://harpers.org/a-letter-on-justice-and-open-debate/");
    expect(params.get("title")).toBe("A Letter on Justice and Open Debate");
    expect(params.get("authors")).toBe("Ackerman");
    expect(params.get("year")).toBe("2020");
    expect(params.get("publication")).toBe("Harper’s Magazine");

    const noLink = new URL(referenceArticleRequest(describeItem(item(NO_LINK, "Afary & Anderson", "2005"))), "https://debate-ai.com").searchParams;
    expect(noLink.has("url")).toBe(false);
    expect(noLink.get("title")).toContain("Foucault and the Iranian Revolution");
  });
});

describe("Reading mode on the References panel", () => {
  it("puts a Reading mode button at the top of every reference card", async () => {
    await openPanel(vi.fn());
    const buttons = readerButtons();
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      const card = button.closest("li")!;
      expect(card.firstElementChild?.nextElementSibling?.contains(button)).toBe(true);
      expect(button.textContent).toContain("Reading mode");
      expect(button.getAttribute("aria-label")).toContain("Reading mode");
    }
    expect(buttons[0]!.getAttribute("aria-label")).toContain("Ackerman 2020");
  });

  it("reads the cited link in the shared reading mode modal and says where it came from", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const fetchMock = articleServer(async () => {
      await gate;
      return json({
        status: "found",
        via: "url",
        url: "https://harpers.org/a-letter-on-justice-and-open-debate/",
        article: {
          title: "A Letter on Justice and Open Debate",
          author: "Elliot Ackerman",
          html: `<p>${BODY}</p><script>window.pwned = true</script><img src="x" onerror="window.pwned = true"><a href="javascript:alert(1)">bad</a>`,
          wordCount: 18,
        },
      });
    });
    await openPanel(fetchMock);

    await act(async () => readerButtons()[0]!.click());
    expect(reader()!.getAttribute("role")).toBe("dialog");
    expect(reader()!.getAttribute("aria-label")).toBe("Reading mode: A Letter on Justice and Open Debate");
    expect(reader()!.textContent).toContain("Reading harpers.org…");
    expect(reader()!.querySelector("[data-reading-mode-content]")).toBeNull();
    release();
    await flush();

    const [request] = articleCalls(fetchMock) as [string];
    const params = new URL(request, "https://debate-ai.com").searchParams;
    expect(params.get("url")).toBe("https://harpers.org/a-letter-on-justice-and-open-debate/");

    const text = reader()!.querySelector("[data-reading-mode-content]")!;
    expect(text.textContent).toContain(BODY);
    expect(text.textContent).toContain("Elliot Ackerman");
    expect(text.innerHTML).not.toMatch(/script|onerror|javascript:/);
    expect((window as unknown as { pwned?: boolean }).pwned).toBeUndefined();

    const banner = reader()!.querySelector("[data-reference-reader-source=url]")!;
    expect(banner.textContent).toContain("Read from the cited link");
    expect(banner.querySelector("a")!.getAttribute("href")).toBe("https://harpers.org/a-letter-on-justice-and-open-debate/");
    expect(banner.textContent).not.toContain("Found by search");
    // The same tools as reading mode elsewhere.
    expect(reader()!.textContent).toContain("Ask about this article");
  });

  it("flags an article found by search, with the query and the URL it used", async () => {
    const fetchMock = articleServer(() =>
      json({
        status: "found",
        via: "search",
        url: "https://archive.example.org/foucault-iran",
        query: '"Foucault and the Iranian Revolution" Afary',
        confidence: 0.92,
        article: { title: "Foucault and the Iranian Revolution", html: `<p>${BODY}</p>`, wordCount: 18 },
      }),
    );
    await openPanel(fetchMock);
    await act(async () => readerButtons()[1]!.click());
    await flush();

    const [request] = articleCalls(fetchMock) as [string];
    expect(new URL(request, "https://debate-ai.com").searchParams.has("url")).toBe(false);

    const banner = reader()!.querySelector("[data-reference-reader-source=search]")!;
    expect(banner.textContent).toContain("Found by search, not from a cited link");
    expect(banner.textContent).toContain('"Foucault and the Iranian Revolution" Afary');
    expect(banner.textContent).toContain("92% match");
    expect(banner.textContent).toContain("check it is the right one");
    expect(banner.querySelector("a")!.getAttribute("href")).toBe("https://archive.example.org/foucault-iran");
  });

  it("says it could not find the article, with manual links and unconfirmed hits, and shows no article", async () => {
    const fetchMock = articleServer(() =>
      json({
        status: "not_found",
        queries: ['"A Letter on Justice and Open Debate" Ackerman'],
        urlFailed: { url: "https://harpers.org/a-letter-on-justice-and-open-debate/", reason: "QwkSearch answered HTTP 502" },
        candidates: [{ title: "Some other post about debate", url: "https://blog.example.com/debate" }],
      }),
    );
    await openPanel(fetchMock);
    await act(async () => readerButtons()[0]!.click());
    await flush();

    const dialog = reader()!;
    expect(dialog.querySelector("[data-reference-reader-state=empty]")!.textContent).toContain("Could not find the article");
    expect(dialog.querySelector("[data-reading-mode-content]")).toBeNull();
    expect(dialog.textContent).toContain("Nothing is shown rather than the wrong article");
    expect(dialog.textContent).toContain("QwkSearch answered HTTP 502");

    const hrefs = [...dialog.querySelectorAll<HTMLAnchorElement>("[data-reference-manual-search] a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "https://harpers.org/a-letter-on-justice-and-open-debate/",
      "https://www.google.com/search?q=%22A%20Letter%20on%20Justice%20and%20Open%20Debate%22%20Ackerman",
      "https://qwksearch.com/?q=%22A%20Letter%20on%20Justice%20and%20Open%20Debate%22%20Ackerman",
    ]);
    const candidate = dialog.querySelector("[data-reference-candidates] a")!;
    expect(candidate.getAttribute("href")).toBe("https://blog.example.com/debate");
    expect(dialog.querySelector("[data-reference-candidates]")!.textContent).toContain("not confirmed");
  });

  it("shows an error with Try again when the request fails", async () => {
    let attempts = 0;
    const fetchMock = articleServer(() =>
      ++attempts === 1
        ? json({ error: "The article service did not answer." }, 502)
        : json({ status: "found", via: "url", url: "https://harpers.org/a/", article: { html: `<p>${BODY}</p>`, wordCount: 18 } }),
    );
    await openPanel(fetchMock);
    await act(async () => readerButtons()[0]!.click());
    await flush();

    const alert = reader()!.querySelector("[role=alert]")!;
    expect(alert.textContent).toContain("Could not load the article");
    expect(alert.textContent).toContain("The article service did not answer.");

    const retry = [...alert.querySelectorAll("button")].find((b) => b.textContent?.includes("Try again"))!;
    await act(async () => retry.click());
    await flush();
    expect(articleCalls(fetchMock)).toHaveLength(2);
    expect(reader()!.querySelector("[data-reading-mode-content]")!.textContent).toContain(BODY);
  });

  it("Escape closes the reader first and leaves the panel open, then closes the panel", async () => {
    const fetchMock = articleServer(() => json({ status: "not_found", queries: [], candidates: [] }));
    await openPanel(fetchMock);
    await act(async () => readerButtons()[1]!.click());
    await flush();
    expect(reader()).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(reader()).toBeNull();
    expect(document.querySelector("[data-references-panel]")).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(document.querySelector("[data-references-panel]")).toBeNull();
  });

  it("remembers an answer, so reopening the same reference does not ask the server again", async () => {
    const fetchMock = articleServer(() =>
      json({ status: "found", via: "url", url: "https://harpers.org/a/", article: { html: `<p>${BODY}</p>`, wordCount: 18 } }),
    );
    await openPanel(fetchMock);
    await act(async () => readerButtons()[0]!.click());
    await flush();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    await act(async () => readerButtons()[0]!.click());
    await flush();
    expect(articleCalls(fetchMock)).toHaveLength(1);
    expect(reader()!.querySelector("[data-reading-mode-content]")!.textContent).toContain(BODY);
  });
});
