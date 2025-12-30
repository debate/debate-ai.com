/**
 * Quote View Helper - converts Tiptap documents to quote cards HTML
 * This creates a derived HTML view on top of Tiptap doc for displaying quotes/cards
 */

import type { JSONContent } from '@tiptap/core';
import DOMPurify from 'isomorphic-dompurify';

export interface QuoteCard {
  id: string;
  summary: string | null;
  author: string | null;
  year: string | number | null;
  cite: string | null;
  url: string | null;
  html: string;
  words: number;
}

/**
 * Parse HTML content to extract quote cards from blockquotes and marked text
 */
export function htmlToCards(html: string, fileName?: string): {
  outline: QuoteCard[];
  metadata: { fileName?: string; cardCount: number; totalWords: number };
} {
  // Create a DOM parser to extract blockquotes and marked sections
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const cards: QuoteCard[] = [];
  let cardIndex = 0;

  // Extract blockquotes as cards
  const blockquotes = doc.querySelectorAll('blockquote');
  blockquotes.forEach((blockquote) => {
    const card = parseBlockquoteCard(blockquote, cardIndex++);
    if (card) cards.push(card);
  });

  // Also extract marked/highlighted sections as potential cards
  const markedSections = extractMarkedSections(doc, cardIndex);
  cards.push(...markedSections);

  const totalWords = cards.reduce((sum, card) => sum + card.words, 0);

  return {
    outline: cards,
    metadata: {
      fileName,
      cardCount: cards.length,
      totalWords,
    },
  };
}

/**
 * Parse a blockquote element into a quote card
 */
function parseBlockquoteCard(blockquote: Element, index: number): QuoteCard | null {
  const html = blockquote.innerHTML;
  const text = blockquote.textContent || '';

  if (!text.trim()) return null;

  // Try to extract summary (first line or first bold/strong text)
  const firstStrong = blockquote.querySelector('strong, b');
  const summary = firstStrong?.textContent || text.split('\n')[0] || 'Quote';

  // Try to extract author and year from cite or em elements
  const cite = blockquote.querySelector('cite');
  const em = blockquote.querySelector('em');
  const citeText = cite?.textContent || em?.textContent || '';

  const { author, year } = extractAuthorAndYear(citeText);

  // Extract URL if present
  const link = blockquote.querySelector('a');
  const url = link?.getAttribute('href') || null;

  const words = countWords(text);

  return {
    id: `quote-card-${index}`,
    summary: summary.substring(0, 100), // Limit summary length
    author,
    year,
    cite: citeText || null,
    url,
    html,
    words,
  };
}

/**
 * Extract sections with mark/highlight tags as potential cards
 */
function extractMarkedSections(doc: Document, startIndex: number): QuoteCard[] {
  const cards: QuoteCard[] = [];
  const markedElements = doc.querySelectorAll('mark, .highlight');

  markedElements.forEach((mark, idx) => {
    const text = mark.textContent || '';
    if (text.trim().length < 10) return; // Skip very short marks

    const words = countWords(text);

    // Try to find context around the mark (parent paragraph)
    const parent = mark.closest('p, div');
    const html = parent?.innerHTML || mark.innerHTML;

    cards.push({
      id: `quote-card-${startIndex + idx}`,
      summary: text.substring(0, 100),
      author: null,
      year: null,
      cite: null,
      url: null,
      html,
      words,
    });
  });

  return cards;
}

/**
 * Extract author name and year from citation text
 * Expects formats like "Author, Year" or "Author (Year)"
 */
function extractAuthorAndYear(citeText: string): {
  author: string | null;
  year: number | string | null;
} {
  if (!citeText) return { author: null, year: null };

  // Try to extract year (4-digit number or 'ND' for no date)
  const yearMatch = citeText.match(/\b(\d{4}|'?\d{2}|ND|No Date)\b/i);
  let year: number | string | null = null;

  if (yearMatch) {
    const yearStr = yearMatch[1];
    if (yearStr.match(/^'\d{2}$/)) {
      // Handle '24 format
      year = 2000 + parseInt(yearStr.substring(1));
    } else if (yearStr.match(/^\d{2}$/)) {
      // Handle two-digit years
      const shortYear = parseInt(yearStr);
      year = shortYear < 26 ? 2000 + shortYear : 1900 + shortYear;
    } else if (yearStr.match(/^\d{4}$/)) {
      year = parseInt(yearStr);
    } else {
      year = yearStr; // ND or No Date
    }
  }

  // Extract author (text before year or comma)
  let author = citeText.replace(/\(.*?\)/g, '').replace(/\d{4}/g, '').trim();
  author = author.split(',')[0].trim();

  // Limit author name to first 3 words
  if (author) {
    const words = author.split(/\s+/);
    if (words.length > 3) {
      author = words.slice(0, 3).join(' ');
    }
  }

  return {
    author: author || null,
    year,
  };
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Encode HTML attribute values
 */
function encodeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(value: string): string {
  return encodeHtmlAttr(value);
}

/**
 * Build quote cards HTML from a Tiptap JSON document
 */
export function buildQuoteCardsHtml(
  html: string,
  fileName?: string
): {
  html: string;
  metadata: { fileName?: string; cardCount: number; totalWords: number };
} {
  // Parse HTML to extract cards
  const { outline, metadata } = htmlToCards(html, fileName);

  if (outline.length === 0) {
    return {
      html: '<div class="quote-view-empty"><p>No quote cards detected in this document.</p><p>Add blockquotes or highlighted text to see quote cards here.</p></div>',
      metadata,
    };
  }

  // Generate HTML for each card
  const cardsHtml = outline
    .map((card) => {
      return `
        <section class="quote-card" data-quote-id="${card.id}">
          <div class="quote-card-toolbar">
            <button type="button" data-role="copy" class="quote-card-btn copy-btn" title="Copy card to clipboard">
              📋 Copy
            </button>
            <button type="button" data-role="ai-analyze" class="quote-card-btn ai-btn" title="Analyze with AI">
              🤖 AI analyze
            </button>
          </div>
          <blockquote class="tiptap-fancy-blockquote" data-type="custom-blockquote"
            data-summary="${encodeHtmlAttr(card.summary || '')}"
            data-author="${encodeHtmlAttr(card.author || '')}"
            data-year="${encodeHtmlAttr(String(card.year || ''))}"
            data-cite="${encodeHtmlAttr(card.cite || '')}"
            data-url="${encodeHtmlAttr(card.url || '')}"
            data-words="${card.words}">
            <header class="quote-card-header">
              <h4 class="quote-summary">${escapeHtml(card.summary || '')}</h4>
              ${
                card.author || card.year || card.cite
                  ? `<div class="quote-meta">
                ${card.author ? `<span class="quote-author">${escapeHtml(card.author)}</span>` : ''}
                ${card.year ? `<span class="quote-year">${escapeHtml(String(card.year))}</span>` : ''}
                ${card.cite && card.cite !== card.author ? `<span class="quote-cite">${escapeHtml(card.cite)}</span>` : ''}
              </div>`
                  : ''
              }
            </header>
            <div class="quote-body">
              ${card.html}
            </div>
            <footer class="quote-footer">
              <span class="quote-words">${card.words} word${card.words !== 1 ? 's' : ''}</span>
              ${card.url ? `<a href="${encodeHtmlAttr(card.url)}" target="_blank" rel="noopener noreferrer" class="quote-link">🔗 Source</a>` : ''}
            </footer>
          </blockquote>
        </section>
      `;
    })
    .join('\n');

  const sanitizedHtml = DOMPurify.sanitize(`<div class="quote-view">${cardsHtml}</div>`);

  return {
    html: sanitizedHtml,
    metadata,
  };
}
