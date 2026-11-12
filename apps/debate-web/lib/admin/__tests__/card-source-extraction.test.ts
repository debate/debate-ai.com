/**
 * @fileoverview The admin "Original sources" run: picking a search query
 * from a cite, matching a search result to the card, the page loop that
 * skips finished cards, and the progress counts.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "../../database/schema";
import { applySchema } from "../../database/__tests__/schema-sql";
import { debateCards } from "../../database/schema";
import type { CardTextBucket } from "../../search/card-text-store";
import {
  cardSourceKey,
  extractCardSource,
  extractCardSourcesPage,
  matchScore,
  qwkSearchClient,
  type QwkSearchClient,
  readCardSourceStats,
  resetEnsuredCardSourceTable,
  searchQueryForCite,
} from "../card-source-extraction";

const ARTICLE_WORDS =
  "Nuclear deterrence remains stable because rival arsenals guarantee retaliation, and modernization programs across several powers reinforce that guarantee rather than undermining strategic balance between adversaries. Analysts warn however that hypersonic delivery vehicles compress decision windows dramatically, raising accidental escalation risks during regional crises where leaders face ambiguous warnings.";

function page(text: string) {
  return `<p>${text}</p><p>${"Additional context paragraph explaining background details thoroughly. ".repeat(6)}</p>`;
}

function memoryBucket(): CardTextBucket & { objects: Map<string, string> } {
  const objects = new Map<string, string>();
  return {
    objects,
    async put(key, value) {
      objects.set(key, value);
    },
    async get(key) {
      const value = objects.get(key);
      return value === undefined ? null : { text: async () => value };
    },
  };
}

function stubQwk(pages: Record<string, string>, results: Array<{ url: string; title?: string; content?: string }> = []) {
  const calls: string[] = [];
  const qwk: QwkSearchClient = {
    async search(query) {
      calls.push(`search:${query}`);
      return results;
    },
    async article(url) {
      calls.push(`article:${url}`);
      if (url.includes("boom")) throw new Error("QwkSearch answered HTTP 502");
      return pages[url] ? { url, html: pages[url], title: `Title of ${url}` } : null;
    },
  };
  return { qwk, calls };
}

async function freshDb() {
  const client = createClient({ url: ":memory:" });
  await applySchema(client);
  return drizzle(client, { schema });
}

function card(id: number, overrides: Partial<typeof debateCards.$inferInsert> = {}) {
  return {
    id,
    tag: `Tag ${id}`,
    cite: "Smith 21",
    fullcite: "",
    spoken: "",
    fulltext: ARTICLE_WORDS,
    markup: "",
    sourceUrl: "",
    year: 2024,
    event: "ld",
    ...overrides,
  };
}

beforeEach(() => resetEnsuredCardSourceTable());

describe("searchQueryForCite", () => {
  it("prefers the quoted title plus the author's surname", () => {
    expect(
      searchQueryForCite("Smith 21", 'Smith 21 [John Smith, professor at Yale, "The Future of Deterrence," Foreign Affairs, 3-4-2021]'),
    ).toBe('"The Future of Deterrence" Smith');
  });

  it("handles curly quotes", () => {
    expect(searchQueryForCite("Lee 19 [Ann Lee, “Hypersonic Weapons and Crisis Stability”, RAND, 2019]")).toBe(
      '"Hypersonic Weapons and Crisis Stability" Lee',
    );
  });

  it("falls back to the cite's words without URLs, dates or brackets", () => {
    expect(searchQueryForCite("Jones 20 [Bob Jones, Brookings, hypersonic arms control report, 5/6/2020]")).toBe(
      "Jones 20 Bob Jones, Brookings, hypersonic arms control report,",
    );
  });

  it("returns null when there is nothing to search for", () => {
    expect(searchQueryForCite("")).toBeNull();
    expect(searchQueryForCite("AT 20")).toBeNull();
  });
});

describe("matchScore", () => {
  it("is high for the page a card was cut from and low for an unrelated one", () => {
    const card = ARTICLE_WORDS.slice(0, 200);
    expect(matchScore(card, page(ARTICLE_WORDS))).toBeGreaterThan(0.9);
    expect(matchScore(card, "Recipes for summer salads with fresh tomatoes and basil")).toBeLessThan(0.1);
    expect(matchScore("", ARTICLE_WORDS)).toBe(0);
  });
});

describe("extractCardSource", () => {
  const base = { id: 1, cite: "Smith 21", fullcite: "", spoken: "", fulltext: ARTICLE_WORDS };

  it("extracts the cited URL without searching", async () => {
    const { qwk, calls } = stubQwk({ "https://a.org/x": page(ARTICLE_WORDS) });
    const result = await extractCardSource({ ...base, sourceUrl: "https://a.org/x" }, qwk);
    expect(result).toMatchObject({ status: "extracted", via: "cite", url: "https://a.org/x" });
    expect(result.matchScore).toBeGreaterThan(0.9);
    expect(calls).toEqual(["article:https://a.org/x"]);
  });

  it("searches by the cite when there is no URL and keeps the result that matches the card", async () => {
    const { qwk, calls } = stubQwk(
      { "https://wrong.org": page("Gardening tips for spring planting season with soil preparation advice"), "https://right.org": page(ARTICLE_WORDS) },
      [{ url: "https://wrong.org", title: "Gardening" }, { url: "https://right.org", title: "Deterrence" }],
    );
    const result = await extractCardSource(
      { ...base, sourceUrl: "", fullcite: 'Smith 21 [John Smith, "The Future of Deterrence," 2021]' },
      qwk,
    );
    expect(result).toMatchObject({ status: "extracted", via: "search", url: "https://right.org" });
    expect(calls[0]).toBe('search:"The Future of Deterrence" Smith');
  });

  it("falls back to a search when the cited page is unreadable", async () => {
    const { qwk } = stubQwk({ "https://right.org": page(ARTICLE_WORDS) }, [{ url: "https://right.org" }]);
    const result = await extractCardSource({ ...base, sourceUrl: "https://dead.org", fullcite: "Smith 21 deterrence hypersonic report" }, qwk);
    expect(result).toMatchObject({ status: "extracted", via: "search", url: "https://right.org" });
  });

  it("records not_found when no result matches the card", async () => {
    const { qwk } = stubQwk(
      { "https://wrong.org": page("Gardening tips for spring planting season with soil preparation advice") },
      [{ url: "https://wrong.org" }],
    );
    const result = await extractCardSource({ ...base, sourceUrl: "", fullcite: "Smith 21 deterrence report" }, qwk);
    expect(result.status).toBe("not_found");
    expect(result.stored).toBeUndefined();
  });

  it("records failed, without throwing, when QwkSearch errors", async () => {
    const { qwk } = stubQwk({});
    const result = await extractCardSource({ ...base, sourceUrl: "https://boom.org" }, qwk);
    expect(result).toMatchObject({ status: "failed", error: "QwkSearch answered HTTP 502" });
  });
});

describe("extractCardSourcesPage", () => {
  it("stores each source in R2, skips finished cards on the next run, and counts progress", async () => {
    const db = await freshDb();
    await db.insert(debateCards).values([
      card(1, { sourceUrl: "https://a.org/1" }),
      card(2, { sourceUrl: "", fullcite: "Smith 21 deterrence hypersonic report", event: "pf" }),
      card(3, { sourceUrl: "https://boom.org/3", year: 2023 }),
    ]);
    const bucket = memoryBucket();
    const { qwk } = stubQwk({ "https://a.org/1": page(ARTICLE_WORDS), "https://b.org/2": page(ARTICLE_WORDS) }, [
      { url: "https://b.org/2" },
    ]);

    const first = await extractCardSourcesPage(db, bucket, qwk, { afterId: 0, limit: 10, now: 50 });
    expect(first).toMatchObject({ processed: 3, extracted: 2, viaCite: 1, viaSearch: 1, failed: 1, nextAfterId: 3, done: true });
    expect(JSON.parse(bucket.objects.get(cardSourceKey(1))!)).toMatchObject({ url: "https://a.org/1", via: "cite" });
    expect(bucket.objects.has(cardSourceKey(3))).toBe(false);

    const again = await extractCardSourcesPage(db, bucket, qwk, { afterId: 0, limit: 10 });
    expect(again.processed).toBe(0);
    const retry = await extractCardSourcesPage(db, bucket, qwk, { afterId: 0, limit: 10, retryFailed: true });
    expect(retry.processed).toBe(1);

    expect(await readCardSourceStats(db)).toMatchObject({
      total: 3,
      withUrl: 2,
      extracted: 2,
      viaCite: 1,
      viaSearch: 1,
      failed: 1,
      years: [2024, 2023],
      events: ["ld", "pf"],
    });
    expect(await readCardSourceStats(db, { year: 2024, event: "ld" })).toMatchObject({ total: 1, withUrl: 1, extracted: 1 });
  });

  it("honours the year and format filter and pages by id", async () => {
    const db = await freshDb();
    await db.insert(debateCards).values([card(1), card(2, { year: 2023 }), card(3), card(4)]);
    const { qwk } = stubQwk({});
    const result = await extractCardSourcesPage(db, memoryBucket(), qwk, { afterId: 0, limit: 2, year: 2024 });
    expect(result).toMatchObject({ processed: 2, nextAfterId: 3, done: false });
  });
});

describe("qwkSearchClient", () => {
  it("calls the search and article endpoints with the API key", async () => {
    const seen: Array<{ url: string; auth: string | null }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      seen.push({ url, auth: new Headers(init?.headers).get("authorization") });
      const body = url.includes("/agent/search")
        ? { results: [{ url: "https://x.org", title: "X" }] }
        : { article: { html: "<p>hi</p>", title: "X" } };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
    const client = qwkSearchClient("https://qwk.test/", { apiKey: "k", fetchImpl });
    expect(await client.search("a b")).toEqual([{ url: "https://x.org", title: "X" }]);
    expect(await client.article("https://x.org")).toMatchObject({ url: "https://x.org", html: "<p>hi</p>" });
    expect(seen).toEqual([
      { url: "https://qwk.test/api/agent/search?q=a%20b", auth: "Bearer k" },
      { url: "https://qwk.test/api/doc/article?url=https%3A%2F%2Fx.org", auth: "Bearer k" },
    ]);
  });
});
