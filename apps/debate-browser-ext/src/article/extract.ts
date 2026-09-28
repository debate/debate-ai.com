/**
 * Page snapshot → the `Article` the panel renders.
 *
 * Runs in the side panel rather than the background worker for a mundane
 * reason: an MV3 service worker has no `DOMParser`, and every step here needs
 * a document. The worker's job is only to hand over the snapshot.
 */
import { buildCite, extractCiteMetadata } from './cite';
import { toReadingMode } from './readability';
import type { Article, PageSnapshot } from './types';

/** Pages that have no article to extract, however well-formed they are. */
const NOT_ARTICLES = [
  /^https?:\/\/(www\.)?google\.[^/]+\/search/i,
  /^https?:\/\/(www\.)?bing\.com\/search/i,
  /^https?:\/\/(www\.)?duckduckgo\.com\/\?/i,
  /^https?:\/\/(www\.)?search\.brave\.com\//i,
  /^https?:\/\/(www\.)?ecosia\.org\/search/i,
];

export class NotReadableError extends Error {}

/** Whether a URL is a search results page, which never extracts usefully. */
export function isSearchResultsPage(url: string): boolean {
  return NOT_ARTICLES.some((pattern) => pattern.test(url));
}

/**
 * Builds the reading-mode article for a snapshotted tab.
 *
 * Throws {@link NotReadableError} — rather than returning a half-empty article
 * — when the page has no article body to show, so the panel can say "there is
 * nothing to read here" instead of rendering the site's navigation.
 */
export function extractArticle(snapshot: PageSnapshot): Article {
  if (isSearchResultsPage(snapshot.url)) {
    throw new NotReadableError('Search results pages have no article to read.');
  }

  const doc = new DOMParser().parseFromString(snapshot.html, 'text/html');
  const reading = toReadingMode(doc, snapshot.url);
  if (!reading) {
    throw new NotReadableError(
      'No article text found on this page — it may be an app, a feed, or a page that has not finished loading.',
    );
  }

  const metadata = extractCiteMetadata(doc, snapshot.url);
  const title = metadata.title || snapshot.title;

  return {
    url: snapshot.url,
    title,
    author: metadata.author,
    date: metadata.date,
    source: metadata.source,
    cite: buildCite({ ...metadata, title }),
    html: reading.html,
    word_count: reading.wordCount,
  };
}

/**
 * The article body as plain text, capped, which is what actually gets sent to
 * a model. Tags are stripped rather than sent because they are a large share
 * of the characters and none of the meaning.
 */
export function articleToPlainText(article: Article, maxLength: number): string {
  return (article.html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
