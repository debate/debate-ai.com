/**
 * Is there an article on this page worth opening in reading mode?
 *
 * Runs on every page from the page-tools content script
 * (entrypoints/page-tools.content.ts), so it is two passes, cheapest first:
 *
 * 1. A regex word count over the page's raw text. Most pages a debater opens
 *    (search results, feeds, apps, dashboards) fall short of the threshold
 *    here and never reach the extractor.
 * 2. The same reading-mode extractor the article panel uses (./readability,
 *    the port of `extract-webpage`), so only the
 *    article body counts — not the navigation, comments and footer that
 *    pad out the raw text. It works on its own clone, so the page is untouched.
 *
 * Nothing leaves the browser: both passes run locally, in the page.
 */
import { isSearchResultsPage } from './extract';
import { toReadingMode } from './readability';

/** An article must be longer than this, in words, to get the reading-mode button. */
export const ARTICLE_MIN_WORDS = 1000;

/** Words in `text`, by whitespace-separated runs. */
export function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

/**
 * The extracted article's word count when the page holds an article of more
 * than {@link ARTICLE_MIN_WORDS} words, or `null` when it doesn't.
 */
export function detectArticle(doc: Document, url: string): { wordCount: number } | null {
  if (!/^https?:/i.test(url) || isSearchResultsPage(url)) return null;
  const body = doc.body;
  if (!body) return null;
  if (countWords(body.textContent ?? '') <= ARTICLE_MIN_WORDS) return null;

  const reading = toReadingMode(doc, url);
  if (!reading || reading.wordCount <= ARTICLE_MIN_WORDS) return null;
  return { wordCount: reading.wordCount };
}
