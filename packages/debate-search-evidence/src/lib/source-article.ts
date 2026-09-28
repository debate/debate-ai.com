/**
 * @fileoverview Fetches the full text of a card's source article from
 * qwksearch.
 *
 * qwksearch's `GET /api/doc/article` runs the page through `extract-webpage`
 * server side — readable body HTML plus a formatted citation (author, date,
 * title, publisher, link) — and caches the result. Doing it there rather than
 * here is the point: the browser cannot fetch an arbitrary publisher's page
 * across origins, and qwksearch already answers debate-ai.com's CORS
 * preflight for the embedded /doc workspace.
 *
 * `qwksearch-api-client` captures its base URL once, when its module first
 * evaluates (from `window.NEXT_PUBLIC_BASE_URL`, else this page's own origin).
 * Every call here passes `baseUrl` explicitly instead, so it reaches
 * qwksearch.com no matter which module loaded the client first.
 *
 * @module lib/source-article
 */

/** qwksearch's API root; the client appends each operation's path to it. */
export const QWKSEARCH_API_BASE = "https://qwksearch.com/api"

/**
 * The fields of qwksearch's `Article` the card panel uses — the same shape
 * research-agent-ui's `ArticleContent` renders.
 */
export interface SourceArticle {
  /** Readable body markup; sanitized by `ArticleContent` before rendering. */
  html?: string
  /** Formatted citation markup built by extract-webpage. */
  cite?: string
  title?: string
  url?: string
  author?: string
  date?: string
  source?: string
  /** A number, or the number as a string — the API has returned both. */
  word_count?: number | string
}

/** Thrown when qwksearch answers but has no readable text for the page. */
export class ArticleNotReadableError extends Error {
  constructor(url: string) {
    super(`No readable article text was found at ${url}`)
    this.name = "ArticleNotReadableError"
  }
}

/** Below this many characters of text the extraction is treated as failed. */
const MIN_ARTICLE_TEXT = 20

/**
 * Loads a source article's full text and citation through qwksearch.
 *
 * @param url - The card's source URL.
 * @param signal - Aborts the request when the reader moves to another card.
 * @returns The extracted article.
 * @throws {ArticleNotReadableError} When the page yields no readable text.
 * @throws {Error} When the request itself fails.
 */
export async function fetchSourceArticle(url: string, signal?: AbortSignal): Promise<SourceArticle> {
  const { getArticle } = await import("qwksearch-api-client")
  const { data, error } = await getArticle({
    baseUrl: QWKSEARCH_API_BASE,
    query: { url },
    signal,
  })
  if (error) {
    throw new Error(typeof error === "string" ? error : (error?.error ?? error?.message ?? "Article request failed"))
  }

  const article: (SourceArticle & { error?: unknown }) | undefined = data?.article
  const text = (article?.html ?? "").replace(/<[^>]*>/g, "").trim()
  if (!article || article.error || text.length < MIN_ARTICLE_TEXT) {
    throw new ArticleNotReadableError(url)
  }
  return { ...article, url: article.url || url }
}
