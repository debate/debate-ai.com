/**
 * DOM behavior of the personal-dictionary section: renders the current
 * account-synced words, removes one on delete, and adds one via the input
 * — each change persisting back through `user-dictionary.ts`'s store.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildUserDictionarySection } from '../src/editor/user-dictionary-ui';
import { USER_DICTIONARY_STORAGE_KEY, loadUserDictionary, saveUserDictionary } from '../src/editor/user-dictionary';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

function words(section: HTMLElement): string[] {
  return [...section.querySelectorAll('.pmd-dictionary-word')].map((el) => el.textContent);
}

describe('buildUserDictionarySection', () => {
  it('shows an empty state when nothing is saved yet', () => {
    const section = buildUserDictionarySection();
    expect(words(section)).toEqual([]);
    expect(section.querySelector('.pmd-dictionary-empty')?.textContent).toBe('No words added yet.');
  });

  it('lists existing words alphabetically', () => {
    saveUserDictionary(new Set(['kritik', 'affirmative', 'counterplan']));
    const section = buildUserDictionarySection();
    expect(words(section)).toEqual(['affirmative', 'counterplan', 'kritik']);
    expect(section.querySelector('.pmd-dictionary-empty')).toBeNull();
  });

  it('removes a word on delete and persists the change', () => {
    saveUserDictionary(new Set(['kritik', 'counterplan']));
    const section = buildUserDictionarySection();
    const row = [...section.querySelectorAll('.pmd-dictionary-row')].find((r) =>
      r.querySelector('.pmd-dictionary-word')?.textContent === 'kritik',
    )!;
    row.querySelector<HTMLButtonElement>('.pmd-dictionary-delete')!.click();

    expect(words(section)).toEqual(['counterplan']);
    expect(loadUserDictionary()).toEqual(new Set(['counterplan']));
  });

  it('shows the empty state again once the last word is removed', () => {
    saveUserDictionary(new Set(['kritik']));
    const section = buildUserDictionarySection();
    section.querySelector<HTMLButtonElement>('.pmd-dictionary-delete')!.click();
    expect(section.querySelector('.pmd-dictionary-empty')?.textContent).toBe('No words added yet.');
    expect(localStorage.getItem(USER_DICTIONARY_STORAGE_KEY)).toBe('[]');
  });

  it('adds a word typed into the input via the Add button', () => {
    const section = buildUserDictionarySection();
    const input = section.querySelector<HTMLInputElement>('.pmd-dictionary-add-input')!;
    input.value = 'topicality';
    section.querySelector<HTMLButtonElement>('.pmd-dictionary-add-btn')!.click();

    expect(words(section)).toEqual(['topicality']);
    expect(loadUserDictionary()).toEqual(new Set(['topicality']));
    expect(input.value).toBe('');
  });

  it('adds a word on Enter in the input', () => {
    const section = buildUserDictionarySection();
    const input = section.querySelector<HTMLInputElement>('.pmd-dictionary-add-input')!;
    input.value = 'nonunique';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(words(section)).toEqual(['nonunique']);
    expect(loadUserDictionary()).toEqual(new Set(['nonunique']));
  });

  it('ignores adding a blank or whitespace-only word', () => {
    const section = buildUserDictionarySection();
    const input = section.querySelector<HTMLInputElement>('.pmd-dictionary-add-input')!;
    input.value = '   ';
    section.querySelector<HTMLButtonElement>('.pmd-dictionary-add-btn')!.click();

    expect(words(section)).toEqual([]);
    expect(localStorage.getItem(USER_DICTIONARY_STORAGE_KEY)).toBeNull();
  });

  it('trims surrounding whitespace off an added word', () => {
    const section = buildUserDictionarySection();
    const input = section.querySelector<HTMLInputElement>('.pmd-dictionary-add-input')!;
    input.value = '  spread  ';
    section.querySelector<HTMLButtonElement>('.pmd-dictionary-add-btn')!.click();

    expect(words(section)).toEqual(['spread']);
  });
});
