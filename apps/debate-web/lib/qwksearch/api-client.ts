/**
 * @fileoverview The QwkSearch HTTP API as this app uses it: quick search
 * (`GET /api/agent/search`) and server-side page extraction
 * (`GET /api/doc/article`, extract-webpage, cached on QwkSearch's side).
 *
 * Used by the admin "Original sources" run (`lib/admin/card-source-extraction.ts`)
 * and by the docs' reference reading mode (`lib/reference-article/resolve.ts`).
 *
 * @module lib/qwksearch/api-client
 */

/** Each QwkSearch request is given up after this long, unless the caller asks for less. */
export const QWKSEARCH_TIMEOUT_MS = 20_000;

/** What callers need from QwkSearch; routes pass the live one, tests a stub. */
export interface QwkSearchClient {
  search(query: string, options?: QwkRequestOptions): Promise<Array<{ title?: string; url?: string; content?: string }>>;
  article(url: string, options?: QwkRequestOptions): Promise<ExtractedArticle | null>;
}

export interface QwkRequestOptions {
  /** Give up after this many milliseconds (at most {@link QWKSEARCH_TIMEOUT_MS}). */
  timeoutMs?: number;
}

export interface ExtractedArticle {
  url: string;
  html: string;
  title?: string;
  author?: string;
  date?: string;
  source?: string;
  cite?: string;
}

async function getJson(fetchImpl: typeof fetch, url: string, apiKey?: string, requested?: number): Promise<unknown> {
  const timeoutMs = Math.max(1, Math.min(QWKSEARCH_TIMEOUT_MS, requested ?? QWKSEARCH_TIMEOUT_MS));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`QwkSearch answered HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw new Error(`QwkSearch timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/** The QwkSearch API over HTTP: `/api/agent/search` and `/api/doc/article`. */
export function qwkSearchClient(
  origin: string,
  { apiKey, fetchImpl = fetch }: { apiKey?: string; fetchImpl?: typeof fetch } = {},
): QwkSearchClient {
  const base = origin.replace(/\/+$/, "");
  return {
    async search(query, options) {
      const data = (await getJson(fetchImpl, `${base}/api/agent/search?q=${encodeURIComponent(query)}`, apiKey, options?.timeoutMs)) as {
        results?: unknown;
      };
      return Array.isArray(data?.results) ? (data.results as Array<{ title?: string; url?: string; content?: string }>) : [];
    },
    async article(url, options) {
      const data = (await getJson(fetchImpl, `${base}/api/doc/article?url=${encodeURIComponent(url)}`, apiKey, options?.timeoutMs)) as {
        article?: Record<string, unknown>;
      };
      const article = data?.article;
      if (!article || article.error || typeof article.html !== "string") return null;
      return {
        url: str(article.url) ?? url,
        html: article.html,
        title: str(article.title),
        author: str(article.author),
        date: str(article.date),
        source: str(article.source),
        cite: str(article.cite),
      };
    },
  };
}
