import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStorage } from './helpers/memory-browser';

const mem = vi.hoisted(() => ({ sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> }));

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  return { browser: memoryBrowser(mem) };
});

import {
  SESSION_TTL_MS,
  appendTimelog,
  clearTimelog,
  getDebateType,
  getSavedTimes,
  getTimelog,
  setDebateType,
  setSavedTimes,
  setTimelog,
  type SavedTimes,
} from '@/src/timer/storage';

const saved = (updated_ts: number): SavedTimes => ({
  updated_ts,
  aff: '4:00',
  neg: '3:30',
  type: 'Public Forum',
  count: '2',
});

beforeEach(() => {
  resetStorage(mem);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('debate type', () => {
  it('defaults to the first type and reads back what was set', async () => {
    expect(await getDebateType()).toBe(0);
    await setDebateType(3);
    expect(await getDebateType()).toBe(3);
  });

  it('ignores a stored value that is not a number', async () => {
    mem.local.debatetype = 'Public Forum';
    expect(await getDebateType()).toBe(0);
  });

  it('drops the resumable session when the type changes', async () => {
    await setSavedTimes(saved(Date.now()));
    expect(await getSavedTimes()).not.toBeNull();
    await setDebateType(2);
    expect(await getSavedTimes()).toBeNull();
  });
});

describe('saved session', () => {
  it('is null before anything is saved', async () => {
    expect(await getSavedTimes()).toBeNull();
  });

  it('resumes a session younger than the TTL and forgets an older one', async () => {
    const now = Date.now();
    await setSavedTimes(saved(now - SESSION_TTL_MS + 1000));
    expect(await getSavedTimes()).toEqual(saved(now - SESSION_TTL_MS + 1000));

    await setSavedTimes(saved(now - SESSION_TTL_MS - 1));
    expect(await getSavedTimes()).toBeNull();
  });
});

describe('timelog', () => {
  it('starts empty and appends entries in order', async () => {
    expect(await getTimelog()).toEqual([]);
    await appendTimelog({ type: 'Constructive', start: true, time: 1 });
    await appendTimelog({ type: 'Constructive', start: false, time: 2 });
    expect(await getTimelog()).toEqual([
      { type: 'Constructive', start: true, time: 1 },
      { type: 'Constructive', start: false, time: 2 },
    ]);
  });

  it('replaces and clears the log', async () => {
    await setTimelog([{ type: 'Rebuttal', start: true, time: 5 }]);
    expect(await getTimelog()).toHaveLength(1);
    await clearTimelog();
    expect(await getTimelog()).toEqual([]);
  });

  it('treats a corrupt stored value as empty', async () => {
    mem.local.timelog = 'garbage';
    expect(await getTimelog()).toEqual([]);
  });
});
