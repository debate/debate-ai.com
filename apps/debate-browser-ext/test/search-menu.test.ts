import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeSearchMenu, openSearchMenu } from '@/src/page-tools/search-menu';
import { DEFAULT_SEARCH_ENGINE_ID, SEARCH_ENGINES } from '@/src/search/engines';

const HOST = 'debate-ai-search-menu';
const BASE = 'https://debate-ai.com';

const host = () => document.getElementById(HOST);
const press = (key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event;
};

let open: ReturnType<typeof vi.fn>;

beforeEach(() => {
  open = vi.fn();
  vi.stubGlobal('open', open);
  document.body.innerHTML = '';
});

afterEach(() => {
  closeSearchMenu();
  vi.unstubAllGlobals();
});

const engineAt = (index: number) => SEARCH_ENGINES[(index + SEARCH_ENGINES.length) % SEARCH_ENGINES.length];
const defaultIndex = SEARCH_ENGINES.findIndex((engine) => engine.id === DEFAULT_SEARCH_ENGINE_ID);

describe('openSearchMenu', () => {
  it('mounts one host element, replacing a menu that is already open', () => {
    openSearchMenu('first', null, BASE);
    const firstHost = host();
    expect(firstHost).not.toBeNull();

    openSearchMenu('second', null, BASE);
    expect(document.querySelectorAll(`#${HOST}`)).toHaveLength(1);
    expect(host()).not.toBe(firstHost);
  });

  it('keeps its contents in a closed shadow root', () => {
    openSearchMenu('q', null, BASE);
    expect(host()!.shadowRoot).toBeNull();
    expect(host()!.textContent).toBe('');
  });

  it('searches the default engine on Enter and closes', () => {
    openSearchMenu('hegemony decline', null, BASE);

    const event = press('Enter');

    expect(open).toHaveBeenCalledWith(
      engineAt(defaultIndex).url('hegemony decline', BASE),
      '_blank',
      'noopener',
    );
    expect(event.defaultPrevented).toBe(true);
    expect(host()).toBeNull();
  });

  it('moves the selection with the arrow keys and wraps around', () => {
    openSearchMenu('q', null, BASE);
    press('ArrowDown');
    press('Enter');
    expect(open).toHaveBeenLastCalledWith(engineAt(defaultIndex + 1).url('q', BASE), '_blank', 'noopener');

    openSearchMenu('q', null, BASE);
    press('ArrowUp');
    press('Enter');
    expect(open).toHaveBeenLastCalledWith(engineAt(defaultIndex - 1).url('q', BASE), '_blank', 'noopener');

    openSearchMenu('q', null, BASE);
    for (let i = 0; i < SEARCH_ENGINES.length; i += 1) press('ArrowDown');
    press('Enter');
    expect(open).toHaveBeenLastCalledWith(engineAt(defaultIndex).url('q', BASE), '_blank', 'noopener');
  });

  it('closes on Escape without searching', () => {
    openSearchMenu('q', null, BASE);
    press('Escape');
    expect(host()).toBeNull();
    expect(open).not.toHaveBeenCalled();
  });

  it('keeps the keys it does not use for the page', () => {
    openSearchMenu('q', null, BASE);
    const event = press('a');
    expect(event.defaultPrevented).toBe(false);
    expect(host()).not.toBeNull();
  });

  it('keeps the keys it uses from reaching the page\'s own handlers', () => {
    const pageHandler = vi.fn();
    document.addEventListener('keydown', pageHandler);
    openSearchMenu('q', null, BASE);
    press('ArrowDown');
    document.removeEventListener('keydown', pageHandler);
    expect(pageHandler).not.toHaveBeenCalled();
  });

  it('closes when the page is clicked outside the menu, and not when the menu is', () => {
    openSearchMenu('q', null, BASE);
    host()!.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(host()).not.toBeNull();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    expect(host()).toBeNull();
  });

  it('closes on scroll', () => {
    openSearchMenu('q', null, BASE);
    document.dispatchEvent(new Event('scroll'));
    expect(host()).toBeNull();
  });

  it('stops listening to the keyboard once closed', () => {
    openSearchMenu('q', null, BASE);
    closeSearchMenu();
    press('Enter');
    expect(open).not.toHaveBeenCalled();
  });
});
