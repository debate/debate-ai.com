import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  USER_DICTIONARY_STORAGE_KEY,
  loadUserDictionary,
  parseUserDictionary,
  saveUserDictionary,
  serializeUserDictionary,
} from '../src/editor/user-dictionary';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('parseUserDictionary', () => {
  it('reads the current { id, word }[] shape', () => {
    const raw = JSON.stringify([
      { id: 'kritik', word: 'kritik' },
      { id: 'counterplan', word: 'counterplan' },
    ]);
    expect(parseUserDictionary(raw)).toEqual(new Set(['kritik', 'counterplan']));
  });

  it('reads the legacy bare string[] shape', () => {
    const raw = JSON.stringify(['kritik', 'counterplan']);
    expect(parseUserDictionary(raw)).toEqual(new Set(['kritik', 'counterplan']));
  });

  it('drops malformed entries instead of throwing', () => {
    const raw = JSON.stringify(['kritik', 42, null, {}, { word: '' }, { id: 'x' }, { word: 'topicality' }]);
    expect(parseUserDictionary(raw)).toEqual(new Set(['kritik', 'topicality']));
  });

  it('reads null, empty, non-array, and corrupt JSON as an empty dictionary', () => {
    expect(parseUserDictionary(null)).toEqual(new Set());
    expect(parseUserDictionary('')).toEqual(new Set());
    expect(parseUserDictionary('{}')).toEqual(new Set());
    expect(parseUserDictionary('not json')).toEqual(new Set());
  });

  it('deduplicates repeated words', () => {
    const raw = JSON.stringify(['kritik', 'kritik', { id: 'kritik', word: 'kritik' }]);
    expect(parseUserDictionary(raw)).toEqual(new Set(['kritik']));
  });
});

describe('serializeUserDictionary', () => {
  it('writes each word as its own { id, word } record with id === word', () => {
    const json = serializeUserDictionary(['kritik', 'counterplan']);
    expect(JSON.parse(json)).toEqual([
      { id: 'kritik', word: 'kritik' },
      { id: 'counterplan', word: 'counterplan' },
    ]);
  });

  it('round-trips through parseUserDictionary', () => {
    const words = new Set(['kritik', 'counterplan', "O'Brien"]);
    expect(parseUserDictionary(serializeUserDictionary(words))).toEqual(words);
  });
});

describe('loadUserDictionary', () => {
  it('returns an empty set, and writes nothing, when nothing is saved yet', () => {
    expect(loadUserDictionary()).toEqual(new Set());
    expect(localStorage.getItem(USER_DICTIONARY_STORAGE_KEY)).toBeNull();
  });

  it('reads an already-current-shape dictionary without rewriting it', () => {
    const current = serializeUserDictionary(['kritik']);
    localStorage.setItem(USER_DICTIONARY_STORAGE_KEY, current);
    expect(loadUserDictionary()).toEqual(new Set(['kritik']));
    expect(localStorage.getItem(USER_DICTIONARY_STORAGE_KEY)).toBe(current);
  });

  it('migrates a legacy bare string[] dictionary to { id, word }[] in place', () => {
    localStorage.setItem(USER_DICTIONARY_STORAGE_KEY, JSON.stringify(['kritik', 'counterplan']));
    expect(loadUserDictionary()).toEqual(new Set(['kritik', 'counterplan']));
    const stored = JSON.parse(localStorage.getItem(USER_DICTIONARY_STORAGE_KEY)!);
    expect(stored).toEqual([
      { id: 'kritik', word: 'kritik' },
      { id: 'counterplan', word: 'counterplan' },
    ]);
  });

  it('rewrites a corrupt store as an explicit empty array', () => {
    localStorage.setItem(USER_DICTIONARY_STORAGE_KEY, 'not json');
    expect(loadUserDictionary()).toEqual(new Set());
    expect(localStorage.getItem(USER_DICTIONARY_STORAGE_KEY)).toBe('[]');
  });
});

describe('saveUserDictionary', () => {
  it('writes the current shape, readable back by loadUserDictionary', () => {
    saveUserDictionary(new Set(['kritik', 'counterplan']));
    expect(loadUserDictionary()).toEqual(new Set(['kritik', 'counterplan']));
  });

  it('overwrites whatever was stored before, legacy shape included', () => {
    localStorage.setItem(USER_DICTIONARY_STORAGE_KEY, JSON.stringify(['old-word']));
    saveUserDictionary(new Set(['new-word']));
    expect(parseUserDictionary(localStorage.getItem(USER_DICTIONARY_STORAGE_KEY))).toEqual(new Set(['new-word']));
  });
});
