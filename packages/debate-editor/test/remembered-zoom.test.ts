import { afterEach, describe, expect, it } from 'vitest';
import {
  initialZoomPct,
  loadRememberedZoom,
  rememberedZoomKey,
  saveRememberedZoom,
} from '../src/editor/remembered-zoom';

const signIn = (email: string) =>
  localStorage.setItem(
    'debate-editor-account-sync',
    JSON.stringify({ signedIn: true, email, name: '' }),
  );

describe('remembered editor zoom', () => {
  afterEach(() => localStorage.clear());

  it('falls back to the default until the user zooms', () => {
    expect(loadRememberedZoom()).toBeNull();
    expect(initialZoomPct(100)).toBe(100);
  });

  it('remembers the last zoom for every editor opened later', () => {
    saveRememberedZoom(140);
    expect(loadRememberedZoom()).toBe(140);
    expect(initialZoomPct(100)).toBe(140);
    saveRememberedZoom(90);
    expect(initialZoomPct(100)).toBe(90);
  });

  it('keeps a separate zoom per signed-in account', () => {
    saveRememberedZoom(120);
    signIn('A@Example.com');
    expect(rememberedZoomKey()).toBe('debate-editor-zoom:a@example.com');
    expect(loadRememberedZoom()).toBeNull();
    saveRememberedZoom(160);
    signIn('b@example.com');
    expect(loadRememberedZoom()).toBeNull();
    signIn('a@example.com');
    expect(loadRememberedZoom()).toBe(160);
    localStorage.removeItem('debate-editor-account-sync');
    expect(loadRememberedZoom()).toBe(120);
  });

  it('ignores unusable stored values', () => {
    localStorage.setItem(rememberedZoomKey(), 'nope');
    expect(initialZoomPct(100)).toBe(100);
    saveRememberedZoom(Number.NaN);
    expect(localStorage.getItem(rememberedZoomKey())).toBe('nope');
  });
});
