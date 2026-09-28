import { describe, expect, it } from 'vitest';

import {
  NotReadableError,
  articleToPlainText,
  extractArticle,
  isSearchResultsPage,
} from '@/src/article/extract';
import type { PageSnapshot } from '@/src/article/types';

const BODY = Array.from(
  { length: 4 },
  (_, i) =>
    `<p>${i} The resolution asks whether the policy should be adopted, and the affirmative bears the burden of proof, which is worth examining.</p>`,
).join('');

function snapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: 'https://example.com/news/story',
    title: 'Fallback Title',
    selectionText: '',
    html: `<html><head>
        <meta property="og:title" content="A Case for the Policy">
        <meta name="author" content="Jane Roe">
        <meta property="og:site_name" content="The Example Review">
      </head><body><div class="article-body">${BODY}</div></body></html>`,
    ...overrides,
  };
}

describe('extractArticle', () => {
  it('builds the article the panel renders', () => {
    const article = extractArticle(snapshot());
    expect(article.title).toBe('A Case for the Policy');
    expect(article.author).toBe('Jane Roe');
    expect(article.source).toBe('The Example Review');
    expect(article.cite).toContain('Jane Roe, "A Case for the Policy"');
    expect(article.html).toContain('the affirmative bears the burden');
    expect(article.word_count).toBeGreaterThan(20);
    expect(article.url).toBe('https://example.com/news/story');
  });

  it('falls back to the tab title when the page carries no metadata', () => {
    const article = extractArticle(
      snapshot({ html: `<html><body><div class="post">${BODY}</div></body></html>` }),
    );
    expect(article.title).toBe('Fallback Title');
  });

  it('refuses a search results page by name', () => {
    expect(() =>
      extractArticle(snapshot({ url: 'https://www.google.com/search?q=policy' })),
    ).toThrow(NotReadableError);
  });

  it('refuses a page with nothing to read, rather than showing its chrome', () => {
    expect(() =>
      extractArticle(snapshot({ html: '<html><body><div id="app"></div></body></html>' })),
    ).toThrow(NotReadableError);
  });
});

describe('isSearchResultsPage', () => {
  it('knows the engines whose results pages never extract', () => {
    expect(isSearchResultsPage('https://duckduckgo.com/?q=x')).toBe(true);
    expect(isSearchResultsPage('https://www.google.co.uk/search?q=x')).toBe(true);
  });

  it('leaves ordinary pages alone, including a site named search', () => {
    expect(isSearchResultsPage('https://example.com/search-for-truth')).toBe(false);
  });
});

describe('articleToPlainText', () => {
  it('strips tags and collapses whitespace, which is what a model is sent', () => {
    expect(
      articleToPlainText({ html: '<p>One</p>\n  <p>Two <b>three</b></p>' }, 100),
    ).toBe('One Two three');
  });

  it('caps the length', () => {
    expect(articleToPlainText({ html: '<p>abcdefghij</p>' }, 4)).toBe('abcd');
  });

  it('has nothing to send for an article with no body', () => {
    expect(articleToPlainText({}, 100)).toBe('');
  });
});
