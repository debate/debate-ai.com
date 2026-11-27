import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FAVORITE_REFERENCES_EVENT,
  FAVORITE_REFERENCES_STORAGE_KEY,
  MAX_FAVORITE_REFERENCES,
  favoriteReferenceId,
  isFavoriteReference,
  readFavoriteReferences,
  removeFavoriteReference,
  subscribeFavoriteReferences,
  toFavoriteReference,
  toggleFavoriteReference,
} from '../src/favorites';
import type { ReferenceDescription } from '../src/references';

const HARPERS: ReferenceDescription = {
  title: 'A Letter on Justice and Open Debate',
  authors: 'Ackerman',
  year: '2020',
  publication: 'Harper’s Magazine',
  citation: 'Ackerman, Elliot, et al. “A Letter on Justice and Open Debate.” Harper’s Magazine, July 7, 2020.',
  url: 'https://harpers.org/a-letter-on-justice-and-open-debate/',
};
const BOOK: ReferenceDescription = {
  title: 'Foucault and the Iranian Revolution',
  authors: 'Afary & Anderson',
  year: '2005',
  publication: '',
  citation: 'Afary, Janet, and Kevin B. Anderson. Foucault and the Iranian Revolution. Chicago: University of Chicago Press, 2005.',
  url: '',
};

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('favoriteReferenceId', () => {
  it('is the same for the same link however it is written', () => {
    const a = favoriteReferenceId({ url: 'https://www.harpers.org/a-letter/#top', citation: 'one' });
    const b = favoriteReferenceId({ url: 'http://harpers.org/a-letter', citation: 'two' });
    expect(a).toBe(b);
    expect(a).toMatch(/^ref-[0-9a-z]+$/);
  });

  it('falls back to the citation text, ignoring case, punctuation and spacing', () => {
    const a = favoriteReferenceId({ citation: 'Afary, Janet. “Foucault.”  2005' });
    const b = favoriteReferenceId({ citation: 'afary janet foucault 2005' });
    expect(a).toBe(b);
    expect(a).not.toBe(favoriteReferenceId({ citation: 'afary janet foucault 2006' }));
  });
});

describe('toFavoriteReference', () => {
  it('keeps what is known, leaves empty fields out, and only keeps a docs page', () => {
    const favorite = toFavoriteReference(BOOK, '/docs/journal/x/references', 1234);
    expect(favorite).toEqual({
      id: favoriteReferenceId({ citation: BOOK.citation }),
      citation: BOOK.citation,
      title: BOOK.title,
      authors: 'Afary & Anderson',
      year: '2005',
      page: '/docs/journal/x/references',
      savedAt: 1234,
    });
    expect(toFavoriteReference(HARPERS, '/elsewhere', 1).page).toBeUndefined();
    expect(toFavoriteReference(HARPERS, undefined, 1).url).toBe(HARPERS.url);
  });
});

describe('the favorites store', () => {
  it('stars and un-stars a source, newest first, and says whether it is a favorite afterwards', () => {
    const a = toFavoriteReference(HARPERS, '/docs/a', 100);
    const b = toFavoriteReference(BOOK, '/docs/b', 200);
    expect(readFavoriteReferences()).toEqual([]);
    expect(toggleFavoriteReference(a)).toBe(true);
    expect(toggleFavoriteReference(b)).toBe(true);
    expect(readFavoriteReferences().map((f) => f.id)).toEqual([b.id, a.id]);
    expect(isFavoriteReference(a.id)).toBe(true);

    expect(toggleFavoriteReference(a)).toBe(false);
    expect(isFavoriteReference(a.id)).toBe(false);
    expect(readFavoriteReferences().map((f) => f.id)).toEqual([b.id]);

    removeFavoriteReference(b.id);
    removeFavoriteReference('missing');
    expect(readFavoriteReferences()).toEqual([]);
  });

  it('stores a JSON array of records with an id, the shape the account sync mirrors', () => {
    toggleFavoriteReference(toFavoriteReference(HARPERS, '/docs/a', 100));
    const stored = JSON.parse(localStorage.getItem(FAVORITE_REFERENCES_STORAGE_KEY)!);
    expect(Array.isArray(stored)).toBe(true);
    expect(stored[0]).toMatchObject({ id: expect.any(String), citation: HARPERS.citation, url: HARPERS.url, savedAt: 100 });
  });

  it('reads damaged data as no favorites and skips records that are not favorites', () => {
    localStorage.setItem(FAVORITE_REFERENCES_STORAGE_KEY, '{not json');
    expect(readFavoriteReferences()).toEqual([]);
    localStorage.setItem(FAVORITE_REFERENCES_STORAGE_KEY, JSON.stringify([{ id: 'a' }, null, 4, { id: 'ok', citation: 'c', savedAt: 5 }]));
    expect(readFavoriteReferences()).toEqual([{ id: 'ok', citation: 'c', savedAt: 5 }]);
  });

  it('keeps at most the newest MAX_FAVORITE_REFERENCES', () => {
    const many = Array.from({ length: MAX_FAVORITE_REFERENCES }, (_, i) => ({ id: `r${i}`, citation: 'c', savedAt: 1000 + i }));
    localStorage.setItem(FAVORITE_REFERENCES_STORAGE_KEY, JSON.stringify(many));
    toggleFavoriteReference(toFavoriteReference(BOOK, undefined, 99_999));
    const after = readFavoriteReferences();
    expect(after).toHaveLength(MAX_FAVORITE_REFERENCES);
    expect(after[0]!.savedAt).toBe(99_999);
    expect(after.some((f) => f.id === 'r0')).toBe(false);
  });

  it('reports the previous state when the browser refuses to store', () => {
    const favorite = toFavoriteReference(HARPERS, undefined, 1);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(toggleFavoriteReference(favorite)).toBe(false);
  });
});

describe('subscribeFavoriteReferences', () => {
  it('fires after a write here and after a storage event for the key, and stops when unsubscribed', () => {
    const onChange = vi.fn();
    const stop = subscribeFavoriteReferences(onChange);

    toggleFavoriteReference(toFavoriteReference(HARPERS, undefined, 1));
    expect(onChange).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new StorageEvent('storage', { key: FAVORITE_REFERENCES_STORAGE_KEY }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'somethingElse' }));
    expect(onChange).toHaveBeenCalledTimes(2);

    stop();
    window.dispatchEvent(new Event(FAVORITE_REFERENCES_EVENT));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
