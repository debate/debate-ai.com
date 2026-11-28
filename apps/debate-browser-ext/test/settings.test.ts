import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStorage, type MemoryStorage } from './helpers/memory-browser';

const storage = vi.hoisted<MemoryStorage>(() => ({ sync: {}, local: {} }));

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  return { browser: memoryBrowser(storage) };
});

import {
  DEFAULT_API_BASE,
  DEFAULT_SETTINGS,
  DEFAULT_SUMMARIZE_PROMPT,
  MAX_FOLLOWUP_QUESTIONS,
  MAX_TIMER_WINDOW,
  MIN_FOLLOWUP_QUESTIONS,
  MIN_TIMER_WINDOW,
  getSettings,
  saveSettings,
} from '@/src/settings/settings';

beforeEach(() => resetStorage(storage));

describe('getSettings', () => {
  it('returns the defaults when nothing has been saved', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid saved values', async () => {
    Object.assign(storage.sync, {
      apiBase: 'https://staging.example.com',
      skipDomains: 'a.com\nb.com',
      toolbarAction: 'reader',
      timerWindowWidth: 500,
      timerWindowHeight: 700,
      autoCheck: false,
      articleButton: false,
      searchShortcut: false,
      maxFollowupQuestions: 6,
      summarizePrompt: 'Be brief',
      citationStyle: 'apa',
    });
    expect(await getSettings()).toEqual({
      apiBase: 'https://staging.example.com',
      skipDomains: 'a.com\nb.com',
      toolbarAction: 'reader',
      timerWindowWidth: 500,
      timerWindowHeight: 700,
      autoCheck: false,
      articleButton: false,
      searchShortcut: false,
      maxFollowupQuestions: 6,
      summarizePrompt: 'Be brief',
      citationStyle: 'apa',
    });
  });

  it('repairs values that are out of range or the wrong type', async () => {
    Object.assign(storage.sync, {
      apiBase: '   ',
      skipDomains: 42,
      toolbarAction: 'sidebar',
      timerWindowWidth: 10,
      timerWindowHeight: 99999,
      maxFollowupQuestions: 'many',
      summarizePrompt: '   ',
      citationStyle: 'harvard',
    });
    const settings = await getSettings();
    expect(settings).toMatchObject({
      apiBase: DEFAULT_API_BASE,
      skipDomains: '',
      toolbarAction: 'popup',
      timerWindowWidth: MIN_TIMER_WINDOW.width,
      timerWindowHeight: MAX_TIMER_WINDOW.height,
      maxFollowupQuestions: DEFAULT_SETTINGS.maxFollowupQuestions,
      summarizePrompt: DEFAULT_SUMMARIZE_PROMPT,
      citationStyle: DEFAULT_SETTINGS.citationStyle,
    });
  });

  it('clamps and rounds numbers, including ones saved as strings', async () => {
    Object.assign(storage.sync, { timerWindowWidth: '480.6', maxFollowupQuestions: 100 });
    expect(await getSettings()).toMatchObject({
      timerWindowWidth: 481,
      maxFollowupQuestions: MAX_FOLLOWUP_QUESTIONS,
    });
    storage.sync.maxFollowupQuestions = -3;
    expect((await getSettings()).maxFollowupQuestions).toBe(MIN_FOLLOWUP_QUESTIONS);
  });

  it('treats only an explicit false as turning a switch off', async () => {
    Object.assign(storage.sync, { autoCheck: 0, articleButton: null, searchShortcut: false });
    expect(await getSettings()).toMatchObject({ autoCheck: true, articleButton: true, searchShortcut: false });
  });
});

describe('saveSettings', () => {
  it('stores only the keys it is given', async () => {
    await saveSettings({ autoCheck: false });
    expect(storage.sync).toEqual({ autoCheck: false });
  });

  it('trims the API base', async () => {
    await saveSettings({ apiBase: '  https://example.com  ' });
    expect(storage.sync.apiBase).toBe('https://example.com');
    expect((await getSettings()).apiBase).toBe('https://example.com');
  });

  it('does not touch the object the caller passed in', async () => {
    const patch = { apiBase: ' https://example.com ' };
    await saveSettings(patch);
    expect(patch.apiBase).toBe(' https://example.com ');
  });
});

