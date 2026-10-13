/**
 * The search engines the extension can send selected text to, from the
 * backtick search menu (src/page-tools/search-menu.ts).
 *
 * Quick search (QwkSearch, the research agent the app frames at
 * `/research/docs`) is first and is the default: pressing the shortcut and
 * then Enter searches it. The rest are the places a debater most often looks
 * a phrase up — the team's own cut cards, the open web, scholarship, news.
 */

export interface SearchEngine {
  id: string;
  label: string;
  /** The results page for `query`. `apiBase` is the debate-ai.com deployment from Settings. */
  url: (query: string, apiBase: string) => string;
}

const q = encodeURIComponent;

export const SEARCH_ENGINES: readonly SearchEngine[] = [
  { id: 'quick', label: 'Quick search', url: (query) => `https://qwksearch.com/?q=${q(query)}` },
  {
    id: 'cards',
    label: 'Debate AI cards',
    url: (query, apiBase) => `${apiBase.replace(/\/+$/, '')}/research/cards?q=${q(query)}`,
  },
  { id: 'google', label: 'Google', url: (query) => `https://www.google.com/search?q=${q(query)}` },
  {
    id: 'scholar',
    label: 'Google Scholar',
    url: (query) => `https://scholar.google.com/scholar?q=${q(query)}`,
  },
  {
    id: 'news',
    label: 'Google News',
    url: (query) => `https://news.google.com/search?q=${q(query)}`,
  },
  { id: 'bing', label: 'Bing', url: (query) => `https://www.bing.com/search?q=${q(query)}` },
  { id: 'duckduckgo', label: 'DuckDuckGo', url: (query) => `https://duckduckgo.com/?q=${q(query)}` },
  { id: 'brave', label: 'Brave Search', url: (query) => `https://search.brave.com/search?q=${q(query)}` },
  {
    id: 'wikipedia',
    label: 'Wikipedia',
    url: (query) => `https://en.wikipedia.org/w/index.php?search=${q(query)}`,
  },
  {
    id: 'youtube',
    label: 'YouTube',
    url: (query) => `https://www.youtube.com/results?search_query=${q(query)}`,
  },
];

/** The engine the menu opens on. */
export const DEFAULT_SEARCH_ENGINE_ID = 'quick';

/** Longest selection sent as a query; longer ones are cut at a word boundary. */
export const MAX_QUERY_CHARS = 300;

/** Selected text as a single-line query, trimmed to {@link MAX_QUERY_CHARS}. */
export function toSearchQuery(selection: string): string {
  const flat = selection.replace(/\s+/g, ' ').trim();
  if (flat.length <= MAX_QUERY_CHARS) return flat;
  const cut = flat.slice(0, MAX_QUERY_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > MAX_QUERY_CHARS / 2 ? cut.slice(0, lastSpace) : cut).trim();
}
