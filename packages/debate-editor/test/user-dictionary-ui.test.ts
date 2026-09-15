/**
 * DOM behavior of the personal-dictionary section: renders the current
 * account-synced words, removes one on delete, adds one via the input — each
 * change persisting back through `user-dictionary.ts`'s store — and shows a
 * per-word "Synced" / "Not yet synced" badge sourced from
 * `debate-data-sync`'s account-sync watcher.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildUserDictionarySection } from '../src/editor/user-dictionary-ui';
import {
  USER_DICTIONARY_STORAGE_KEY,
  loadUserDictionary,
  saveUserDictionary,
} from '../src/editor/user-dictionary';
import {
  TOOL_RECORD_AUTO_SYNC_INTERVAL_MS,
  markToolRecordsSynced,
  resetToolRecordAutoSync,
} from 'debate-data-sync/src/state/tool-record-auto-sync';

beforeEach(() => {
  localStorage.clear();
  resetToolRecordAutoSync();
});

afterEach(() => {
  localStorage.clear();
  resetToolRecordAutoSync();
});

function words(section: HTMLElement): string[] {
  return [...section.querySelectorAll('.pmd-dictionary-word')].map((el) => el.textContent);
}

function rowFor(section: HTMLElement, word: string): HTMLElement {
  return [...section.querySelectorAll<HTMLElement>('.pmd-dictionary-row')].find(
    (r) => r.querySelector('.pmd-dictionary-word')?.textContent === word,
  )!;
}

describe('buildUserDictionarySection', () => {
  it('shows an empty state when nothing is saved yet', () => {
    const { element, destroy } = buildUserDictionarySection();
    expect(words(element)).toEqual([]);
    expect(element.querySelector('.pmd-dictionary-empty')?.textContent).toBe('No words added yet.');
    destroy();
  });

  it('lists existing words alphabetically', () => {
    saveUserDictionary(new Set(['kritik', 'affirmative', 'counterplan']));
    const { element, destroy } = buildUserDictionarySection();
    expect(words(element)).toEqual(['affirmative', 'counterplan', 'kritik']);
    expect(element.querySelector('.pmd-dictionary-empty')).toBeNull();
    destroy();
  });

  it('removes a word on delete and persists the change', () => {
    saveUserDictionary(new Set(['kritik', 'counterplan']));
    const { element, destroy } = buildUserDictionarySection();
    rowFor(element, 'kritik').querySelector<HTMLButtonElement>('.pmd-dictionary-delete')!.click();

    expect(words(element)).toEqual(['counterplan']);
    expect(loadUserDictionary()).toEqual(new Set(['counterplan']));
    destroy();
  });

  it('shows the empty state again once the last word is removed', () => {
    saveUserDictionary(new Set(['kritik']));
    const { element, destroy } = buildUserDictionarySection();
    element.querySelector<HTMLButtonElement>('.pmd-dictionary-delete')!.click();
    expect(element.querySelector('.pmd-dictionary-empty')?.textContent).toBe('No words added yet.');
    expect(localStorage.getItem(USER_DICTIONARY_STORAGE_KEY)).toBe('[]');
    destroy();
  });

  it('adds a word typed into the input via the Add button', () => {
    const { element, destroy } = buildUserDictionarySection();
    const input = element.querySelector<HTMLInputElement>('.pmd-dictionary-add-input')!;
    input.value = 'topicality';
    element.querySelector<HTMLButtonElement>('.pmd-dictionary-add-btn')!.click();

    expect(words(element)).toEqual(['topicality']);
    expect(loadUserDictionary()).toEqual(new Set(['topicality']));
    expect(input.value).toBe('');
    destroy();
  });

  it('adds a word on Enter in the input', () => {
    const { element, destroy } = buildUserDictionarySection();
    const input = element.querySelector<HTMLInputElement>('.pmd-dictionary-add-input')!;
    input.value = 'nonunique';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(words(element)).toEqual(['nonunique']);
    expect(loadUserDictionary()).toEqual(new Set(['nonunique']));
    destroy();
  });

  it('ignores adding a blank or whitespace-only word', () => {
    const { element, destroy } = buildUserDictionarySection();
    const input = element.querySelector<HTMLInputElement>('.pmd-dictionary-add-input')!;
    input.value = '   ';
    element.querySelector<HTMLButtonElement>('.pmd-dictionary-add-btn')!.click();

    expect(words(element)).toEqual([]);
    expect(localStorage.getItem(USER_DICTIONARY_STORAGE_KEY)).toBeNull();
    destroy();
  });

  it('trims surrounding whitespace off an added word', () => {
    const { element, destroy } = buildUserDictionarySection();
    const input = element.querySelector<HTMLInputElement>('.pmd-dictionary-add-input')!;
    input.value = '  spread  ';
    element.querySelector<HTMLButtonElement>('.pmd-dictionary-add-btn')!.click();

    expect(words(element)).toEqual(['spread']);
    destroy();
  });
});

describe('buildUserDictionarySection sync status badge', () => {
  it('shows no badge before this collection has ever been baselined', () => {
    saveUserDictionary(new Set(['kritik']));
    const { element, destroy } = buildUserDictionarySection();
    expect(rowFor(element, 'kritik').querySelector('.pmd-dictionary-sync-badge')).toBeNull();
    destroy();
  });

  it('badges a word "Synced" once its exact value has reached the account', () => {
    saveUserDictionary(new Set(['kritik']));
    markToolRecordsSynced('spellcheckDictionary');
    const { element, destroy } = buildUserDictionarySection();

    const badge = rowFor(element, 'kritik').querySelector('.pmd-dictionary-sync-badge');
    expect(badge?.textContent).toBe('Synced');
    expect(badge?.className).toContain('pmd-dictionary-sync-badge--synced');
    destroy();
  });

  it('badges a word "Not yet synced" when it hasn\'t reached the account', () => {
    // Baselined with nothing in it yet — e.g. right after sign-in, before
    // this word's first flush.
    markToolRecordsSynced('spellcheckDictionary');
    saveUserDictionary(new Set(['kritik']));
    const { element, destroy } = buildUserDictionarySection();

    const badge = rowFor(element, 'kritik').querySelector('.pmd-dictionary-sync-badge');
    expect(badge?.textContent).toBe('Not yet synced');
    expect(badge?.className).toContain('pmd-dictionary-sync-badge--pending');
    destroy();
  });

  it('badges a newly added word "Not yet synced" immediately', () => {
    markToolRecordsSynced('spellcheckDictionary');
    const { element, destroy } = buildUserDictionarySection();
    const input = element.querySelector<HTMLInputElement>('.pmd-dictionary-add-input')!;
    input.value = 'topicality';
    element.querySelector<HTMLButtonElement>('.pmd-dictionary-add-btn')!.click();

    const badge = rowFor(element, 'topicality').querySelector('.pmd-dictionary-sync-badge');
    expect(badge?.textContent).toBe('Not yet synced');
    destroy();
  });

  it('refreshes a badge from "Not yet synced" to "Synced" once a background flush lands it', () => {
    vi.useFakeTimers();
    try {
      markToolRecordsSynced('spellcheckDictionary');
      saveUserDictionary(new Set(['kritik']));
      const { element, destroy } = buildUserDictionarySection();
      expect(rowFor(element, 'kritik').querySelector('.pmd-dictionary-sync-badge')?.textContent).toBe(
        'Not yet synced',
      );

      // Simulate the watcher's own flush landing the word, then let this
      // section's periodic refresh (same interval) pick it up.
      markToolRecordsSynced('spellcheckDictionary');
      vi.advanceTimersByTime(TOOL_RECORD_AUTO_SYNC_INTERVAL_MS);

      expect(rowFor(element, 'kritik').querySelector('.pmd-dictionary-sync-badge')?.textContent).toBe('Synced');
      destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops refreshing once destroyed', () => {
    vi.useFakeTimers();
    try {
      markToolRecordsSynced('spellcheckDictionary');
      saveUserDictionary(new Set(['kritik']));
      const { element, destroy } = buildUserDictionarySection();
      destroy();

      markToolRecordsSynced('spellcheckDictionary');
      vi.advanceTimersByTime(TOOL_RECORD_AUTO_SYNC_INTERVAL_MS * 2);

      // No live refresh after destroy — the badge stays whatever it was
      // (querying the pre-existing detached DOM must not throw).
      expect(rowFor(element, 'kritik').querySelector('.pmd-dictionary-sync-badge')?.textContent).toBe(
        'Not yet synced',
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
