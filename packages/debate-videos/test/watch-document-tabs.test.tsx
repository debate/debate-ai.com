// @vitest-environment jsdom
/**
 * @fileoverview The documents beside a video: summary and speeches tabs,
 * markdown rendering, the speeches' table of contents, and the auto-scroll
 * checkbox.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { highlightHtml, renderDocumentMarkdown } from "../src/lib/document-markdown";
import { AUTO_SCROLL_STORAGE_KEY, WatchSidePanel } from "../src/components/watch/WatchSidePanel";
import type { VideoDocument } from "../src/lib/video-documents";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("renderDocumentMarkdown", () => {
  it("renders the markdown a summary is written in", () => {
    const html = renderDocumentMarkdown("**Aff** wins on *T*.\n\n- solvency\n- framing\n\n[card](https://example.com/c)");
    expect(html).toContain("<strong>Aff</strong>");
    expect(html).toContain("<em>T</em>");
    expect(html).toMatch(/<ul>\s*<li>solvency<\/li>/);
    expect(html).toContain('href="https://example.com/c"');
    expect(html).toContain('target="_blank"');
  });

  it("keeps single newlines as line breaks", () => {
    expect(renderDocumentMarkdown("line one\nline two")).toContain("<br>");
  });

  it("shows raw HTML as text and drops unsafe URLs", () => {
    const html = renderDocumentMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[x](javascript:alert(1)) ![i](javascript:alert(2))',
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("javascript:");
  });
});

describe("highlightHtml", () => {
  it("marks matches in text but never inside tags or entities", () => {
    const html = renderDocumentMarkdown("[amp link](https://amp.example.com) & more AMP");
    const marked = highlightHtml(html, "amp");
    expect(marked).toContain('href="https://amp.example.com"');
    expect(marked).toContain("&amp;");
    expect(marked).toContain("<mark>amp</mark> link");
    expect(marked).toContain("<mark>AMP</mark>");
  });

  it("is a no-op for an empty search", () => {
    expect(highlightHtml("<p>x</p>", "  ")).toBe("<p>x</p>");
  });
});

const summary: VideoDocument = {
  videoId: "vid1",
  kind: "summary",
  body: "The **neg** won on the *kritik*.",
  author: "editor",
};

const speeches: VideoDocument = {
  videoId: "vid1",
  kind: "transcript",
  body: "## 1AC (0:00)\nPlan text.\n\n## 1NC (8:00)\nThree off.\n\n## 2AC (17:00)\nAnswers.",
  author: "editor",
};

describe("WatchSidePanel documents", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(documents: VideoDocument[], currentTime = 0) {
    act(() => {
      root.render(
        createElement(WatchSidePanel, {
          sentences: [],
          captionsLoading: false,
          documents,
          currentTime,
          onSeek: () => {},
        }),
      );
    });
  }

  const tabLabels = () =>
    Array.from(container.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent);

  it("shows a lone summary as a named tab, rendered as markdown", () => {
    render([summary]);
    expect(tabLabels()).toEqual(["Summary"]);
    expect(container.querySelector("strong")?.textContent).toBe("neg");
    expect(container.querySelector("em")?.textContent).toBe("kritik");
  });

  it("puts speeches and summary side by side as tabs", () => {
    render([summary, speeches]);
    expect(tabLabels()).toEqual(["Speeches", "Summary"]);
  });

  it("opens speeches with a table of contents that marks the speech playing", () => {
    render([speeches], 9 * 60);
    const toc = container.querySelector('nav[aria-label="Table of contents"]');
    expect(toc).not.toBeNull();
    const entries = Array.from(toc!.querySelectorAll("li button")).map((b) => b.textContent);
    expect(entries).toEqual(["1AC0:00", "1NC8:00", "2AC17:00"]);
    expect(toc!.querySelector('[aria-current="true"]')?.textContent).toBe("1NC8:00");
  });

  it("remembers turning auto-scroll off", () => {
    render([speeches]);
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox?.checked).toBe(true);
    act(() => checkbox!.click());
    expect(checkbox!.checked).toBe(false);
    expect(window.localStorage.getItem(AUTO_SCROLL_STORAGE_KEY)).toBe("off");

    act(() => root.unmount());
    root = createRoot(container);
    render([speeches]);
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);
  });
});
