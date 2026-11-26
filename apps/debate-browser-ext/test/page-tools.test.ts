import { describe, expect, it } from 'vitest';

import { isEditableTarget, isSearchShortcut } from '@/src/page-tools/shortcut';
import {
  DEFAULT_SEARCH_ENGINE_ID,
  MAX_QUERY_CHARS,
  SEARCH_ENGINES,
  toSearchQuery,
} from '@/src/search/engines';

const key = (overrides: Partial<Parameters<typeof isSearchShortcut>[0]> = {}) => ({
  code: 'Backquote',
  key: '`',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  repeat: false,
  ...overrides,
});

describe('isSearchShortcut', () => {
  it('matches the key under Escape, with or without Shift', () => {
    expect(isSearchShortcut(key())).toBe(true);
    expect(isSearchShortcut(key({ key: '~' }))).toBe(true);
    // Same physical key on a layout where it types something else.
    expect(isSearchShortcut(key({ key: '^' }))).toBe(true);
  });

  it('ignores modified, repeated and composing presses, and other keys', () => {
    expect(isSearchShortcut(key({ ctrlKey: true }))).toBe(false);
    expect(isSearchShortcut(key({ metaKey: true }))).toBe(false);
    expect(isSearchShortcut(key({ repeat: true }))).toBe(false);
    expect(isSearchShortcut(key({ isComposing: true }))).toBe(false);
    expect(isSearchShortcut(key({ code: 'KeyA', key: 'a' }))).toBe(false);
  });
});

describe('isEditableTarget', () => {
  it('is true inside fields and editors, false elsewhere', () => {
    document.body.innerHTML =
      '<input id="i"><textarea id="t"></textarea><div contenteditable="true"><span id="e">x</span></div><p id="p">text</p>';
    expect(isEditableTarget(document.getElementById('i'))).toBe(true);
    expect(isEditableTarget(document.getElementById('t'))).toBe(true);
    expect(isEditableTarget(document.getElementById('e'))).toBe(true);
    expect(isEditableTarget(document.getElementById('p'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('search engines', () => {
  it('opens on Quick search, listed first', () => {
    expect(SEARCH_ENGINES[0].id).toBe(DEFAULT_SEARCH_ENGINE_ID);
    expect(SEARCH_ENGINES[0].url('fiat power', 'https://debate-ai.com')).toBe(
      'https://qwksearch.com/?q=fiat%20power',
    );
  });

  it('searches the configured deployment for cards', () => {
    const cards = SEARCH_ENGINES.find((engine) => engine.id === 'cards')!;
    expect(cards.url('a&b', 'http://localhost:3000/')).toBe('http://localhost:3000/research/cards?q=a%26b');
  });

  it('has unique ids', () => {
    expect(new Set(SEARCH_ENGINES.map((engine) => engine.id)).size).toBe(SEARCH_ENGINES.length);
  });
});

describe('toSearchQuery', () => {
  it('flattens whitespace', () => {
    expect(toSearchQuery('  nuclear\n\n deterrence  ')).toBe('nuclear deterrence');
  });

  it('caps long selections at a word boundary', () => {
    const query = toSearchQuery('word '.repeat(200));
    expect(query.length).toBeLessThanOrEqual(MAX_QUERY_CHARS);
    expect(query.endsWith('word')).toBe(true);
  });
});

describe('SEARCH_ENGINES urls', () => {
  const urlFor = (id: string, query: string, apiBase = 'https://debate-ai.com') =>
    SEARCH_ENGINES.find((engine) => engine.id === id)!.url(query, apiBase);

  it('has unique ids', () => {
    const ids = SEARCH_ENGINES.map((engine) => engine.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('encodes the query for every engine', () => {
    for (const engine of SEARCH_ENGINES) {
      const url = engine.url('a&b c/d?', 'https://debate-ai.com');
      expect(url).toContain('a%26b%20c%2Fd%3F');
      expect(() => new URL(url)).not.toThrow();
    }
  });

  it('sends Debate AI cards to the configured deployment, tolerating trailing slashes', () => {
    expect(urlFor('cards', 'nuclear war', 'https://example.test///')).toBe(
      'https://example.test/research/cards?q=nuclear%20war',
    );
    expect(urlFor('cards', 'x', 'https://example.test')).toBe('https://example.test/research/cards?q=x');
  });

  it('searches Quick search by default', () => {
    expect(urlFor(DEFAULT_SEARCH_ENGINE_ID, 'hegemony')).toBe('https://qwksearch.com/?q=hegemony');
  });

  it('points the web engines at their own results pages', () => {
    expect(new URL(urlFor('google', 'x')).hostname).toBe('www.google.com');
    expect(new URL(urlFor('scholar', 'x')).hostname).toBe('scholar.google.com');
    expect(new URL(urlFor('wikipedia', 'x')).searchParams.get('search')).toBe('x');
    expect(new URL(urlFor('youtube', 'x')).searchParams.get('search_query')).toBe('x');
  });
});
