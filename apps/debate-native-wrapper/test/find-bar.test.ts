import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// src-tauri/src/find_bar.js is injected into every page by find_bar.rs; run it
// here the same way, in jsdom (which has no CSS Custom Highlight API, so the
// current match shows as the selection).
const script = readFileSync(path.resolve(import.meta.dirname, '../src-tauri/src/find_bar.js'), 'utf8');

type FindBar = { open(): void; close(): void; isOpen(): boolean };
const bar = () => (window as unknown as { __nativeFindBar: FindBar }).__nativeFindBar;
const shadow = () => document.getElementById('native-find-bar')!.shadowRoot!;
const input = () => shadow().querySelector('input')!;
const count = () => shadow().querySelector('.count')!.textContent;

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function type(text: string) {
  input().value = text;
  input().dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  vi.useFakeTimers();
  delete (window as unknown as { __nativeFindBar?: FindBar }).__nativeFindBar;
  document.documentElement.querySelector('#native-find-bar')?.remove();
  document.body.innerHTML =
    '<p>Nuclear war causes <b>extinc</b>tion.</p><p>Extinction outweighs.</p><script>var extinction</script>';
  new Function(script)();
});

afterEach(() => {
  bar().close();
  vi.useRealTimers();
});

describe('find bar', () => {
  it('opens on Ctrl+F and on Cmd+F', () => {
    press('f', { ctrlKey: true });
    vi.runAllTimers();
    expect(bar().isOpen()).toBe(true);
    bar().close();
    press('f', { metaKey: true });
    vi.runAllTimers();
    expect(bar().isOpen()).toBe(true);
  });

  it('leaves Ctrl+F to a page that handles it itself', () => {
    // Registered after the find bar, as a page's own listener would be.
    window.addEventListener('keydown', (event) => event.preventDefault());
    press('f', { ctrlKey: true });
    vi.runAllTimers();
    expect(bar().isOpen()).toBe(false);
  });

  it('counts matches across inline elements, case-insensitively, skipping scripts', () => {
    bar().open();
    type('extinction');
    expect(count()).toBe('1 of 2');
    expect(String(window.getSelection())).toBe('extinction');
  });

  it('steps with Enter and Shift+Enter, wrapping around', () => {
    bar().open();
    type('extinction');
    press('Enter', {}, input());
    expect(count()).toBe('2 of 2');
    expect(String(window.getSelection())).toBe('Extinction');
    press('Enter', {}, input());
    expect(count()).toBe('1 of 2');
    press('Enter', { shiftKey: true }, input());
    expect(count()).toBe('2 of 2');
  });

  it('says when nothing matches', () => {
    bar().open();
    type('dedev');
    expect(count()).toBe('No results');
  });

  it('closes on Escape and keeps typed keys from the page', () => {
    const pageKeys = vi.fn();
    window.addEventListener('keydown', pageKeys);
    bar().open();
    press('Backspace', {}, input());
    expect(pageKeys).not.toHaveBeenCalled();
    press('Escape', {}, input());
    expect(bar().isOpen()).toBe(false);
  });

  it('prefills the selected text', () => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector('b')!);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    bar().open();
    expect(input().value).toBe('extinc');
    expect(count()).toBe('1 of 2');
  });
});
