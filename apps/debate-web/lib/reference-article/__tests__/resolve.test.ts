/**
 * @fileoverview The docs' reference reading mode: reading the entry's own
 * link, searching when it has none (or it fails), refusing unsafe URLs and
 * wrong articles, the time budget, and request parsing.
 */
import { describe, expect, it } from "vitest";
import { describeReferenceCitation } from "@debate-ai/reading-mode/references";
import type { ExtractedArticle, QwkSearchClient } from "@/lib/qwksearch/api-client";
import { parseReferenceArticleQuery, resolveReferenceArticle } from "../resolve";

const HARPERS =
  'Ackerman, Elliot, et al. “A Letter on Justice and Open Debate.” <em>Harper’s Magazine</em>, July 7, 2020. <a href="https://harpers.org/a-letter-on-justice-and-open-debate/">harpers.org/a-letter-on-justice-and-open-debate/</a>.';
const BOOK =
  "Afary, Janet, and Kevin B. Anderson. <em>Foucault and the Iranian Revolution: Gender and the Seductions of Islamism</em>. Chicago: University of Chicago Press, 2005.";

const BODY = "The free exchange of information and ideas, the lifeblood of a liberal society, is daily becoming more constricted. ".repeat(6);
const body = (text = BODY) => `<p>${text}</p>`;

function article(url: string, title: string, html = body()): ExtractedArticle {
  return { url, title, html };
}

type Pages = Record<string, ExtractedArticle | null | Error>;

function stub(pages: Pages, searches: Record<string, Array<{ url: string; title?: string; content?: string }> | Error> = {}) {
  const calls: string[] = [];
  const qwk: QwkSearchClient = {
    async search(query) {
      calls.push(`search:${query}`);
      const result = searches[query] ?? [];
      if (result instanceof Error) throw result;
      return result;
    },
    async article(url) {
      calls.push(`article:${url}`);
      const page = pages[url] ?? null;
      if (page instanceof Error) throw page;
      return page;
    },
  };
  return { qwk, calls };
}

const harpers = describeReferenceCitation(HARPERS, { authors: "Ackerman", year: "2020" });
const book = describeReferenceCitation(BOOK, { authors: "Afary & Anderson", year: "2005" });
const TITLE_QUERY = '"A Letter on Justice and Open Debate" Ackerman';

describe("resolveReferenceArticle with a link", () => {
  it("reads the entry's own URL and goes no further", async () => {
    const { qwk, calls } = stub({
      "https://harpers.org/a-letter-on-justice-and-open-debate/": article("https://harpers.org/a-letter-on-justice-and-open-debate/", "A Letter"),
    });
    const result = await resolveReferenceArticle(harpers, qwk);
    expect(result).toMatchObject({ status: "found", via: "url", url: "https://harpers.org/a-letter-on-justice-and-open-debate/" });
    expect(calls).toEqual(["article:https://harpers.org/a-letter-on-justice-and-open-debate/"]);
  });

  it("never sends an unsafe URL to the extractor, and says why it was skipped", async () => {
    const { qwk, calls } = stub({}, {});
    const result = await resolveReferenceArticle({ ...harpers, url: "http://169.254.169.254/latest/meta-data" }, qwk);
    expect(calls.some((call) => call.startsWith("article:http://169"))).toBe(false);
    expect(result).toMatchObject({
      status: "not_found",
      urlFailed: { url: "http://169.254.169.254/latest/meta-data", reason: expect.stringContaining("private network") },
    });
  });

  it("falls back to search when the link is dead, naming the dead link and the query", async () => {
    const found = "https://archive.example.org/letter";
    const { qwk, calls } = stub(
      {
        "https://harpers.org/a-letter-on-justice-and-open-debate/": new Error("QwkSearch answered HTTP 502"),
        [found]: article(found, "A Letter on Justice and Open Debate | Harper’s Magazine"),
      },
      { [TITLE_QUERY]: [{ url: found, title: "A Letter on Justice and Open Debate", content: "Elliot Ackerman" }] },
    );
    const result = await resolveReferenceArticle(harpers, qwk);
    expect(result).toMatchObject({
      status: "found",
      via: "search",
      url: found,
      query: TITLE_QUERY,
      urlFailed: { url: "https://harpers.org/a-letter-on-justice-and-open-debate/", reason: "QwkSearch answered HTTP 502" },
    });
    expect(calls[0]).toBe("article:https://harpers.org/a-letter-on-justice-and-open-debate/");
  });

  it("treats a page with no readable text as a failed link", async () => {
    const { qwk } = stub({ "https://harpers.org/a-letter-on-justice-and-open-debate/": article("https://harpers.org/x", "Paywall", "<p>Subscribe</p>") });
    const result = await resolveReferenceArticle(harpers, qwk);
    expect(result).toMatchObject({ status: "not_found", urlFailed: { reason: expect.stringContaining("No readable text") } });
  });
});

describe("resolveReferenceArticle by search", () => {
  const noLink = { ...harpers, url: "" };

  it("finds an entry with no link by title and author, and reports what it used", async () => {
    const hit = "https://harpers.org/a-letter-on-justice-and-open-debate/";
    const { qwk, calls } = stub(
      { [hit]: article(hit, "A Letter on Justice and Open Debate") },
      {
        [TITLE_QUERY]: [
          { url: "https://en.wikipedia.org/wiki/Open_debate", title: "Open debate", content: "unrelated" },
          { url: hit, title: "A Letter on Justice and Open Debate | Harper’s Magazine", content: "Elliot Ackerman" },
        ],
      },
    );
    const result = await resolveReferenceArticle(noLink, qwk);
    expect(result).toMatchObject({ status: "found", via: "search", url: hit, query: TITLE_QUERY });
    expect(result.status === "found" && result.confidence).toBeGreaterThan(0.9);
    expect(calls[0]).toBe(`search:${TITLE_QUERY}`);
    expect(calls).toContain(`article:${hit}`);
  });

  it("does not show a wrong article: an unconfirmed page is only a candidate link", async () => {
    const wrong = "https://blog.example.com/why-debate-matters";
    const { qwk } = stub(
      { [wrong]: article(wrong, "Why open debate matters", body("Debate and justice are discussed in many universities across the country. ".repeat(10))) },
      { [TITLE_QUERY]: [{ url: wrong, title: "Why open debate matters", content: "justice" }] },
    );
    const result = await resolveReferenceArticle(noLink, qwk);
    expect(result.status).toBe("not_found");
    expect(result).toMatchObject({ candidates: [{ title: "Why open debate matters", url: wrong }] });
  });

  it("tries the second query when the first finds nothing", async () => {
    const hit = "https://example.com/foucault";
    const secondQuery = "Foucault and the Iranian Revolution: Gender and the Seductions of Islamism 2005";
    const { qwk, calls } = stub(
      { [hit]: article(hit, "Foucault and the Iranian Revolution: Gender and the Seductions of Islamism") },
      { [secondQuery]: [{ url: hit, title: "Foucault and the Iranian Revolution", content: "Afary Anderson" }] },
    );
    const result = await resolveReferenceArticle(book, qwk);
    expect(result).toMatchObject({ status: "found", via: "search", url: hit, query: secondQuery });
    expect(calls.filter((call) => call.startsWith("search:"))).toHaveLength(2);
  });

  it("skips private-network search hits entirely", async () => {
    const { qwk, calls } = stub({}, { [TITLE_QUERY]: [{ url: "http://192.168.0.1/letter", title: "A Letter on Justice and Open Debate" }] });
    const result = await resolveReferenceArticle(noLink, qwk);
    expect(result).toMatchObject({ status: "not_found", candidates: [] });
    expect(calls.some((call) => call.startsWith("article:"))).toBe(false);
  });

  it("answers error, not not_found, when the service never answers", async () => {
    const down = new Error("QwkSearch timed out after 10000ms");
    const { qwk } = stub({}, { [TITLE_QUERY]: down, 'A Letter on Justice and Open Debate Harper’s Magazine 2020': down });
    const result = await resolveReferenceArticle(noLink, qwk);
    expect(result).toMatchObject({ status: "error", error: expect.stringContaining("timed out") });
  });

  it("stops calling once the time budget is spent", async () => {
    let clock = 0;
    const { qwk, calls } = stub({}, { [TITLE_QUERY]: [] });
    const slow: QwkSearchClient = {
      search: async (query, options) => {
        clock += 39_000;
        return qwk.search(query, options);
      },
      article: qwk.article,
    };
    const result = await resolveReferenceArticle(noLink, slow, { now: () => clock });
    expect(result.status).toBe("not_found");
    expect(calls).toEqual([`search:${TITLE_QUERY}`]);
  });

  it("has nothing to search for with no title and a bare byline", async () => {
    const { qwk, calls } = stub({});
    const result = await resolveReferenceArticle({ title: "", authors: "", year: "", publication: "", citation: "", url: "" }, qwk);
    expect(result).toMatchObject({ status: "not_found", queries: [], candidates: [] });
    expect(calls).toEqual([]);
  });
});

describe("parseReferenceArticleQuery", () => {
  it("accepts a link alone, or a title, and cleans control characters", () => {
    expect(parseReferenceArticleQuery(new URLSearchParams({ url: "https://a.test/x" }))).toMatchObject({ ok: true });
    const parsed = parseReferenceArticleQuery(new URLSearchParams({ title: "A\u0000  title\nhere", year: "2020", authors: "Smith" }));
    expect(parsed).toMatchObject({ ok: true, value: { title: "A title here", year: "2020", authors: "Smith" } });
  });

  it("refuses an empty request and over-long fields, and drops a malformed year", () => {
    expect(parseReferenceArticleQuery(new URLSearchParams({ authors: "Smith" })).ok).toBe(false);
    expect(parseReferenceArticleQuery(new URLSearchParams({ title: "x".repeat(301) }))).toMatchObject({ ok: false, error: "title is too long." });
    expect(parseReferenceArticleQuery(new URLSearchParams({ title: "T", year: "n.d." }))).toMatchObject({ ok: true, value: { year: "" } });
  });
});
