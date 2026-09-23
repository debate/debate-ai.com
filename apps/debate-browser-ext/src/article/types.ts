/**
 * The reading-mode article the side panel shows, and the raw page snapshot it
 * is built from.
 *
 * `Article` deliberately mirrors research-agent-ui's `Article`
 * (qwksearch-research-agent/packages/research-agent-ui/src/types/research.ts),
 * which the panel this was ported from renders. Keeping the shape identical is
 * what lets the ported components come across unchanged — and what would let
 * the panel read a server-extracted article later without touching the UI.
 */

export interface Article {
  /** Reading-mode body, already sanitized. */
  html?: string;
  /** Rendered citation line (`Author, "Title," Source, Date`). */
  cite?: string;
  title?: string;
  url?: string;
  author?: string;
  date?: string;
  source?: string;
  word_count?: number;
  followUpQuestions?: string[];
}

/** One turn of the panel's Q&A with the article. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

/**
 * What the background worker reads out of the tab being read, before any
 * extraction happens.
 *
 * The whole document is taken rather than a server fetch of the URL: the tab
 * already holds the page as the reader actually sees it — past the paywall
 * they are logged in through, past the cookie wall, with the client-rendered
 * body present — which is the difference between "works on any page" and
 * "works on pages that serve their article to an anonymous crawler".
 */
export interface PageSnapshot {
  url: string;
  title: string;
  html: string;
  /** Text the reader had selected when they opened the panel, if any. */
  selectionText: string;
}
