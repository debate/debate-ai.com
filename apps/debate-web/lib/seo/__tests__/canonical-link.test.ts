/**
 * @fileoverview The Worker's self-referencing canonical link.
 */

import { afterEach, describe, expect, it } from "vitest";

import { canonicalLinkTag, canonicalUrlFor, shouldAddCanonical, withCanonicalLink } from "../canonical-link";
import { setSiteOriginReader } from "../site-url";

afterEach(() => setSiteOriginReader(null));

describe("canonicalUrlFor", () => {
  it("names the canonical origin whatever host the request came in on", () => {
    expect(canonicalUrlFor("https://debate-ai.com/videos")).toBe("https://d.ebate.app/videos");
    expect(canonicalUrlFor("http://d.ebate.app/videos")).toBe("https://d.ebate.app/videos");
  });

  it("follows a configured origin", () => {
    setSiteOriginReader((name) => (name === "CANONICAL_SITE_URL" ? "https://example.test" : undefined));
    expect(canonicalUrlFor("https://d.ebate.app/videos")).toBe("https://example.test/videos");
  });

  it("drops trailing and repeated slashes, keeping the root", () => {
    expect(canonicalUrlFor("https://d.ebate.app/videos/")).toBe("https://d.ebate.app/videos");
    expect(canonicalUrlFor("https://d.ebate.app//docs//features/")).toBe("https://d.ebate.app/docs/features");
    expect(canonicalUrlFor("https://d.ebate.app/")).toBe("https://d.ebate.app/");
  });

  it("drops filters and tracking parameters", () => {
    expect(canonicalUrlFor("https://d.ebate.app/videos?year=2025&style=1&utm_source=x")).toBe(
      "https://d.ebate.app/videos",
    );
  });

  it("keeps a section, which names a different page", () => {
    expect(canonicalUrlFor("https://d.ebate.app/news?section=forums&ref=nav")).toBe(
      "https://d.ebate.app/news?section=forums",
    );
    expect(canonicalUrlFor("https://d.ebate.app/news?section=%3Cscript%3E")).toBe("https://d.ebate.app/news");
  });

  it("gives intentionally unindexed paths none", () => {
    for (const url of [
      "https://d.ebate.app/api/videos",
      "https://d.ebate.app/api",
      "https://d.ebate.app/videos/mini/abc",
      "https://d.ebate.app/docs/dev/setup",
    ]) {
      expect(canonicalUrlFor(url), url).toBeNull();
    }
    expect(canonicalUrlFor("https://d.ebate.app/apiary")).toBe("https://d.ebate.app/apiary");
  });
});

describe("shouldAddCanonical", () => {
  const html = (init?: ResponseInit) =>
    new Response("<html></html>", { ...init, headers: { "content-type": "text/html; charset=utf-8", ...init?.headers } });
  const get = new Request("https://d.ebate.app/videos");

  it("accepts a successful HTML page", () => {
    expect(shouldAddCanonical(get, html())).toBe(true);
  });

  it("skips errors, redirects, non-HTML and noindex responses", () => {
    expect(shouldAddCanonical(get, html({ status: 404 }))).toBe(false);
    expect(shouldAddCanonical(get, new Response(null, { status: 308, headers: { location: "/" } }))).toBe(false);
    expect(shouldAddCanonical(get, new Response("{}", { headers: { "content-type": "application/json" } }))).toBe(false);
    expect(shouldAddCanonical(get, html({ headers: { "x-robots-tag": "noindex" } }))).toBe(false);
    expect(shouldAddCanonical(new Request("https://d.ebate.app/videos", { method: "POST" }), html())).toBe(false);
  });
});

/**
 * A stand-in for Cloudflare's HTMLRewriter over a whole (unstreamed) string:
 * enough to check which elements the module listens to and what it inserts.
 */
class FakeRewriter {
  private handlers: Array<{ selector: string; element: (el: unknown) => void }> = [];
  on(selector: string, handlers: { element(el: unknown): void }) {
    this.handlers.push({ selector, element: handlers.element });
    return this;
  }
  transform(response: Response): Response {
    const body = (response as unknown as { __html: string }).__html;
    const tokens = body.split(/(<head>|<\/head>|<link rel="canonical"[^>]*>)/);
    let out = "";
    let endHandlers: Array<(end: { before(content: string): void }) => void> = [];
    for (const token of tokens) {
      if (token === "<head>") {
        out += token;
        for (const h of this.handlers.filter((h) => h.selector === "head"))
          h.element({ onEndTag: (fn: (end: { before(content: string): void }) => void) => endHandlers.push(fn) });
      } else if (token === "</head>") {
        for (const fn of endHandlers) fn({ before: (content) => (out += content) });
        endHandlers = [];
        out += token;
      } else if (token.startsWith('<link rel="canonical"')) {
        for (const h of this.handlers.filter((h) => h.selector.startsWith("link"))) h.element({});
        out += token;
      } else {
        out += token;
      }
    }
    return new Response(out, { headers: response.headers });
  }
}

function page(html: string): Response {
  const response = new Response(html, { headers: { "content-type": "text/html" } });
  return Object.assign(response, { __html: html });
}

describe("withCanonicalLink", () => {
  const request = new Request("https://debate-ai.com/videos?year=2025");

  it("adds the canonical to <head> when the page has none", async () => {
    const out = withCanonicalLink(request, page("<html><head><title>x</title></head><body></body></html>"), FakeRewriter);
    expect(await out.text()).toBe(
      `<html><head><title>x</title>${canonicalLinkTag("https://d.ebate.app/videos")}</head><body></body></html>`,
    );
  });

  it("keeps a canonical the page declared in <head>", async () => {
    const html = '<html><head><link rel="canonical" href="https://d.ebate.app/videos/x"></head><body></body></html>';
    const out = withCanonicalLink(request, page(html), FakeRewriter);
    expect(await out.text()).toBe(html);
  });

  it("still adds one when the page's canonical was streamed into the body", async () => {
    const out = withCanonicalLink(
      request,
      page('<html><head></head><body><link rel="canonical" href="https://d.ebate.app/videos"></body></html>'),
      FakeRewriter,
    );
    expect(await out.text()).toContain(`${canonicalLinkTag("https://d.ebate.app/videos")}</head>`);
  });

  it("is a no-op outside the Workers runtime", () => {
    const response = page("<html><head></head></html>");
    expect(withCanonicalLink(request, response, undefined)).toBe(response);
  });
});
