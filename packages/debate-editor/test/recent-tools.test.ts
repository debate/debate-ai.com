import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordWorkspaceVisit } from '../src/editor/recent-tools';

const STORAGE_KEY = 'recent-tools';
const CHANGE_EVENT = 'recent-tools-changed';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetchOk() {
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('recordWorkspaceVisit', () => {
  it('writes the href as the sole entry when nothing was stored yet', () => {
    stubFetchOk();

    recordWorkspaceVisit('/research');

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['/research']);
  });

  it('moves a repeat visit to the front instead of duplicating it', () => {
    stubFetchOk();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['/coach', '/research', '/drills']));

    recordWorkspaceVisit('/research');

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['/research', '/coach', '/drills']);
  });

  it('caps the stored list at 5 entries', () => {
    stubFetchOk();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(['/a', '/b', '/c', '/d', '/e']),
    );

    recordWorkspaceVisit('/f');

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['/f', '/a', '/b', '/c', '/d']);
  });

  it('is a no-op write when the href is already most recent', () => {
    stubFetchOk();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['/research', '/coach']));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    recordWorkspaceVisit('/research');

    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it('tolerates malformed stored JSON by treating it as empty', () => {
    stubFetchOk();
    localStorage.setItem(STORAGE_KEY, 'not json');

    recordWorkspaceVisit('/research');

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['/research']);
  });

  it('dispatches the same-tab change event other instances listen for', () => {
    stubFetchOk();
    const handler = vi.fn();
    window.addEventListener(CHANGE_EVENT, handler);

    recordWorkspaceVisit('/research');

    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(CHANGE_EVENT, handler);
  });

  it('PUTs a keepalive recordRecentTool op to /api/settings', () => {
    const fetchMock = stubFetchOk();

    recordWorkspaceVisit('/research');

    expect(fetchMock).toHaveBeenCalledWith('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recordRecentTool: '/research' }),
      keepalive: true,
    });
  });

  it('never throws when the account sync fetch rejects', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);

    expect(() => recordWorkspaceVisit('/research')).not.toThrow();
    // Let the rejected promise's `.catch` microtask settle before the test
    // ends, so an unhandled-rejection failure would still surface here.
    await Promise.resolve();
    await Promise.resolve();
  });

  it('still applies the local write when fetch itself throws synchronously', () => {
    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('no network');
    }));

    expect(() => recordWorkspaceVisit('/research')).not.toThrow();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(['/research']);
  });
});
