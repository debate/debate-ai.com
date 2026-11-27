/**
 * @fileoverview `GET /api/reference-article` end to end over a stubbed
 * QwkSearch: the request check, the response shape, caching headers, and that
 * an unsafe link never leaves the server.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { GET } = await import("@/app/api/reference-article/route");

const BODY = "The free exchange of information and ideas, the lifeblood of a liberal society, is daily becoming more constricted. ".repeat(6);
const request = (query: Record<string, string>) =>
  GET(new Request(`https://debate-ai.com/api/reference-article?${new URLSearchParams(query)}`));

let fetched: string[];

function stubQwkSearch(handler: (url: URL) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    fetched.push(`${url.pathname}?${decodeURIComponent(url.search.slice(1))}`);
    return handler(url);
  });
}

beforeEach(() => {
  fetched = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

describe("GET /api/reference-article", () => {
  it("rejects a request that names nothing", async () => {
    const response = await request({ authors: "Smith" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it("reads the cited link through QwkSearch's extractor and caches the answer", async () => {
    stubQwkSearch(() => Response.json({ article: { html: `<p>${BODY}</p>`, title: "A Letter", author: "Elliot Ackerman" } }));
    const response = await request({ url: "https://harpers.org/a-letter/", title: "A Letter on Justice and Open Debate" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(await response.json()).toMatchObject({
      status: "found",
      via: "url",
      url: "https://harpers.org/a-letter/",
      article: { title: "A Letter", author: "Elliot Ackerman", wordCount: expect.any(Number) },
    });
    expect(fetched).toEqual(["/api/doc/article?url=https://harpers.org/a-letter/"]);
  });

  it("searches when there is no link, and the not-found answer is cached only briefly", async () => {
    stubQwkSearch(() => Response.json({ results: [{ url: "https://blog.example.com/x", title: "Some other post", content: "debate" }] }));
    const response = await request({ title: "A Letter on Justice and Open Debate", authors: "Ackerman" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    const body = await response.json();
    expect(body.status).toBe("not_found");
    expect(body.candidates).toEqual([{ title: "Some other post", url: "https://blog.example.com/x" }]);
    expect(fetched[0]).toBe('/api/agent/search?q="A Letter on Justice and Open Debate" Ackerman');
  });

  it("does not send a private-network link to QwkSearch", async () => {
    stubQwkSearch(() => Response.json({ results: [] }));
    const response = await request({ url: "http://localhost:3000/admin" });
    expect(await response.json()).toMatchObject({ status: "not_found", urlFailed: { url: "http://localhost:3000/admin" } });
    expect(fetched.some((call) => call.includes("localhost"))).toBe(false);
  });

  it("answers 502, uncached, when QwkSearch is down", async () => {
    stubQwkSearch(() => new Response("bad gateway", { status: 502 }));
    const response = await request({ url: "https://harpers.org/down/" });
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ status: "error" });
  });
});
