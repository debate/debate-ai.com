import { browser } from 'wxt/browser';

/** One entry per play/pause transition, matching the original js/timeline.js. */
export interface TimelogEntry {
  type: string;
  start: boolean;
  time: number;
}

/** Resumable session snapshot, matching the original js/timer.js `savedTimes`. */
export interface SavedTimes {
  updated_ts: number;
  aff: string;
  neg: string;
  type: string;
  count: string;
}

/** How long a saved session stays resumable (1 hour), as in the original. */
export const SESSION_TTL_MS = 3600 * 1000;

/** Timeline keeps only the last 2 hours, as in the original. */
export const TIMELINE_WINDOW_MS = 2 * 3600 * 1000;

export async function getDebateType(): Promise<number> {
  const { debatetype } = await browser.storage.local.get({ debatetype: 0 });
  return typeof debatetype === 'number' ? debatetype : 0;
}

export async function setDebateType(index: number): Promise<void> {
  // Changing the debate type also drops any resumable session, as before.
  await browser.storage.local.set({ debatetype: index, savedTimes: 0 });
}

export async function getSavedTimes(): Promise<SavedTimes | null> {
  const { savedTimes } = (await browser.storage.local.get('savedTimes')) as {
    savedTimes?: SavedTimes | 0;
  };
  if (
    savedTimes &&
    typeof savedTimes === 'object' &&
    savedTimes.updated_ts + SESSION_TTL_MS > Date.now()
  ) {
    return savedTimes;
  }
  return null;
}

export async function setSavedTimes(value: SavedTimes): Promise<void> {
  await browser.storage.local.set({ savedTimes: value });
}

export async function getTimelog(): Promise<TimelogEntry[]> {
  const { timelog } = await browser.storage.local.get({ timelog: [] });
  return Array.isArray(timelog) ? (timelog as TimelogEntry[]) : [];
}

export async function setTimelog(entries: TimelogEntry[]): Promise<void> {
  await browser.storage.local.set({ timelog: entries });
}

export async function appendTimelog(entry: TimelogEntry): Promise<void> {
  const entries = await getTimelog();
  entries.push(entry);
  await setTimelog(entries);
}

export async function clearTimelog(): Promise<void> {
  await browser.storage.local.set({ timelog: [] });
}
