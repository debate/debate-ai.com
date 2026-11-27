import { NextResponse } from "next/server";
import { qwksearchOrigin } from "@debate-ai/qwksearch/lib/connect";
import { withRouteErrors } from "@/lib/api/route-errors";
import { getEnv } from "@/lib/env";
import { qwkSearchClient } from "@/lib/qwksearch/api-client";
import { parseReferenceArticleQuery, resolveReferenceArticle } from "@/lib/reference-article/resolve";

/** An article read from a reference's own link changes rarely; a day at the edge is plenty. */
const FOUND_SECONDS = 24 * 60 * 60;
/** "Not found" may be a search engine's bad moment, so it is remembered only briefly. */
const NOT_FOUND_SECONDS = 60 * 60;

function edgeCache(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}

/**
 * The article behind one bibliography entry, for the "Reading mode" button on
 * the docs' References side panel.
 *
 * GET `?url=&title=&authors=&year=&publication=&citation=` (the entry's own
 * link and/or what it says; at least a url, title or citation) →
 *
 * - `{ status: "found", via: "url" | "search", url, article, … }`: the entry's
 *   own link was read, or a search found a page whose title and text agree
 *   with the entry (`via: "search"`, with its `query` and `confidence`).
 * - `{ status: "not_found", queries, candidates, urlFailed? }`: nothing could
 *   be confirmed; `candidates` are unconfirmed search hits to offer as links.
 * - `{ error }` with 400 for a malformed request and 502 when QwkSearch did
 *   not answer at all.
 *
 * Open to signed-out readers. Every URL passes the SSRF gate in
 * `@debate-ai/reading-mode/references` before it goes to QwkSearch's
 * extractor, which does the fetching; answers are cached at the edge, found
 * for a day and not-found for an hour, errors never. The full pipeline is in
 * `lib/reference-article/resolve.ts`.
 */
export const GET = withRouteErrors("GET /api/reference-article", async (request: Request) => {
  const url = new URL(request.url);
  const parsed = parseReferenceArticleQuery(url.searchParams);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const cache = edgeCache();
  const key = new Request(`${url.origin}${url.pathname}?${[...url.searchParams].sort().map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}`, { method: "GET" });
  const cached = await cache?.match(key).catch(() => undefined);
  if (cached) return new Response(cached.body, cached);

  const qwk = qwkSearchClient(qwksearchOrigin(getEnv("QWKSEARCH_ORIGIN")), {
    apiKey: getEnv("QWKSEARCH_API_KEY")?.trim() || undefined,
  });
  const result = await resolveReferenceArticle(parsed.value, qwk);

  if (result.status === "error") {
    console.warn(`reference-article: ${result.error}`);
    return NextResponse.json(result, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  const seconds = result.status === "found" ? FOUND_SECONDS : NOT_FOUND_SECONDS;
  const response = NextResponse.json(result, { headers: { "Cache-Control": `public, max-age=${seconds}` } });
  await cache?.put(key, response.clone()).catch(() => undefined);
  return response;
});
