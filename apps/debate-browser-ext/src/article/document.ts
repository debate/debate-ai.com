/**
 * The article panel's article, as a document in the reader's debate-ai.com
 * account.
 *
 * "Save to account" stores the page as one of the reader's REASON Docs — the
 * same per-user documents `/reason-editor` lists (`POST /api/doc/documents`) —
 * so an article read in the panel is waiting in the signed-in app, with its
 * citation and link, the next time the reader opens it on any device.
 *
 * Pure: this only builds the HTML. Sending it is src/article/save.ts, which is
 * kept apart so this can be tested without a browser.
 */
import { escapeHtml, renderMarkdown } from '@/src/ai/markdown';

import type { Article, ChatMessage } from './types';

/** What `POST /api/doc/documents` is given. */
export interface SavedArticleDocument {
  title: string;
  content: string;
  format: 'html';
}

/** Longest title stored — the document list shows it on one line. */
const MAX_TITLE_LENGTH = 200;

function documentTitle(article: Article): string {
  const title = (article.title || article.source || article.url || 'Saved article').trim();
  return title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH - 1)}…` : title;
}

/** Only web links become `href`s — the URL came from a page, not from us. */
function safeHref(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

/**
 * The document for `article`: title, citation, source link, the panel's Q&A
 * (when there was any), then the reading-mode body.
 *
 * The body is `article.html`, which `toReadingMode` has already reduced to an
 * allowlist of tags and attributes; everything else here is escaped or is the
 * renderer's own markup.
 */
export function buildSavedArticleDocument(
  article: Article,
  chatHistory: readonly ChatMessage[] = [],
): SavedArticleDocument {
  const title = documentTitle(article);
  const parts: string[] = [`<h1>${escapeHtml(title)}</h1>`];

  if (article.cite) parts.push(`<p><strong>${escapeHtml(article.cite)}</strong></p>`);

  const href = safeHref(article.url);
  if (href) {
    parts.push(`<p><a href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>`);
  }

  if (chatHistory.length > 0) {
    parts.push('<h2>Notes from the article panel</h2>');
    for (const message of chatHistory) {
      parts.push(
        message.role === 'user'
          ? `<p><strong>Q: ${escapeHtml(message.content)}</strong></p>`
          : renderMarkdown(message.content),
      );
    }
    parts.push('<hr>');
  }

  if (article.html) parts.push(article.html);

  return { title, content: parts.join('\n'), format: 'html' };
}
