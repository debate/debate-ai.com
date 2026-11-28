import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStorage } from './helpers/memory-browser';

type Listener = (...args: any[]) => any;

const h = vi.hoisted(() => {
  const event = () => {
    const fns = new Set<Listener>();
    return {
      fns,
      addListener: (fn: Listener) => void fns.add(fn),
      removeListener: (fn: Listener) => void fns.delete(fn),
      fire: (...args: unknown[]) => [...fns].map((fn) => fn(...args)),
    };
  };
  return {
    mem: { sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> },
    event,
    onMessage: event(),
    onSyncChanged: event(),
    main: null as null | ((ctx: unknown) => void),
  };
});

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  const base = memoryBrowser(h.mem);
  return {
    browser: {
      runtime: { onMessage: h.onMessage },
      storage: { ...base.storage, sync: { ...base.storage.sync, onChanged: h.onSyncChanged } },
    },
  };
});

vi.mock('@/src/article/detect', () => ({ detectArticle: vi.fn() }));
vi.mock('@/src/article/remote', () => ({ youtubeVideoId: vi.fn(() => null) }));
vi.mock('@/src/page-tools/reading-button', () => ({ showReadingButton: vi.fn(), hideReadingButton: vi.fn() }));
vi.mock('@/src/page-tools/search-menu', () => ({ openSearchMenu: vi.fn(), closeSearchMenu: vi.fn() }));
vi.mock('@/src/reader/panel', () => ({ toggleReaderPanelInPage: vi.fn() }));

vi.stubGlobal('defineContentScript', (definition: { main: (ctx: unknown) => void }) => {
  h.main = definition.main;
  return definition;
});

const { default: contentScript } = await import('@/entrypoints/page-tools.content');

import { detectArticle } from '@/src/article/detect';
import { youtubeVideoId } from '@/src/article/remote';
import { hideReadingButton, showReadingButton } from '@/src/page-tools/reading-button';
import { closeSearchMenu, openSearchMenu } from '@/src/page-tools/search-menu';
import { toggleReaderPanelInPage } from '@/src/reader/panel';
import { PAGE_SNAPSHOT_REQUEST } from '@/src/reader/snapshot';

const flushSettings = () => vi.advanceTimersByTimeAsync(0);
const settle = () => vi.advanceTimersByTimeAsync(500);

let removers: Array<() => void>;
let invalidated: Array<() => void>;
let ctx: Record<string, any>;

function makeContext() {
  removers = [];
  invalidated = [];
  return {
    isInvalid: false,
    setTimeout: vi.fn((fn: () => void, ms: number) => window.setTimeout(fn, ms)),
    requestIdleCallback: vi.fn((fn: () => void) => void fn()),
    addEventListener: (target: EventTarget, type: string, fn: EventListener, options?: AddEventListenerOptions) => {
      target.addEventListener(type, fn, options);
      removers.push(() => target.removeEventListener(type, fn, options));
    },
    onInvalidated: (fn: () => void) => void invalidated.push(fn),
  };
}

async function start() {
  contentScript.main(ctx as never);
  await flushSettings();
}

function select(text: string) {
  document.body.innerHTML = `<p id="p">${text}</p>`;
  const range = document.createRange();
  range.selectNodeContents(document.getElementById('p')!);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

function pressKey(init: KeyboardEventInit = { code: 'Backquote', key: '`' }, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(youtubeVideoId).mockReturnValue(null);
  vi.mocked(detectArticle).mockReturnValue(null);
  resetStorage(h.mem);
  h.onMessage.fns.clear();
  h.onSyncChanged.fns.clear();
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
  ctx = makeContext();
  Range.prototype.getBoundingClientRect = () => ({ left: 10, top: 20, width: 30, height: 12 }) as DOMRect;
});

afterEach(() => {
  removers.forEach((remove) => remove());
  vi.useRealTimers();
});

describe('reading-mode button', () => {
  it('offers reading mode with the word count on an article, and opens the panel from it', async () => {
    vi.mocked(detectArticle).mockReturnValue({ wordCount: 1234 });
    await start();
    await settle();

    expect(showReadingButton).toHaveBeenCalledWith('Open in reading mode (1,234 words)', expect.any(Function));
    expect(detectArticle).toHaveBeenCalledWith(document, window.location.href);

    vi.mocked(showReadingButton).mock.calls[0][1]();
    expect(toggleReaderPanelInPage).toHaveBeenCalledTimes(1);
  });

  it('offers the transcript on a YouTube video without looking for an article', async () => {
    vi.mocked(youtubeVideoId).mockReturnValue('abc123');
    await start();
    await settle();

    expect(showReadingButton).toHaveBeenCalledWith('Read the transcript in reading mode', expect.any(Function));
    expect(detectArticle).not.toHaveBeenCalled();
  });

  it('shows nothing on a page that is not an article, then retries once for client-rendered pages', async () => {
    await start();
    await settle();
    expect(showReadingButton).not.toHaveBeenCalled();
    expect(hideReadingButton).toHaveBeenCalled();
    expect(detectArticle).toHaveBeenCalledTimes(1);

    vi.mocked(detectArticle).mockReturnValue({ wordCount: 2000 });
    await vi.advanceTimersByTimeAsync(3000);

    expect(detectArticle).toHaveBeenCalledTimes(2);
    expect(showReadingButton).toHaveBeenCalledWith('Open in reading mode (2,000 words)', expect.any(Function));
  });

  it('retries only once when the page never turns into an article', async () => {
    await start();
    await settle();
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(detectArticle).toHaveBeenCalledTimes(2);
    expect(showReadingButton).not.toHaveBeenCalled();
  });

  it('stays off when the setting is off', async () => {
    h.mem.sync.articleButton = false;
    vi.mocked(detectArticle).mockReturnValue({ wordCount: 5000 });
    await start();
    await settle();

    expect(showReadingButton).not.toHaveBeenCalled();
    expect(hideReadingButton).toHaveBeenCalled();
    expect(detectArticle).not.toHaveBeenCalled();
  });

  it('stays off once the extension has been reloaded under the page', async () => {
    ctx.isInvalid = true;
    vi.mocked(detectArticle).mockReturnValue({ wordCount: 5000 });
    await start();
    await settle();
    expect(showReadingButton).not.toHaveBeenCalled();
  });

  it('waits for an idle moment when the browser has one', async () => {
    (window as any).requestIdleCallback = () => 0;
    try {
      vi.mocked(detectArticle).mockReturnValue({ wordCount: 1500 });
      await start();
      await flushSettings();

      expect(ctx.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 });
      expect(showReadingButton).toHaveBeenCalled();
    } finally {
      delete (window as any).requestIdleCallback;
    }
  });

  it('checks again a second after a single-page-app route change, hiding the button meanwhile', async () => {
    await start();
    await settle();
    vi.mocked(hideReadingButton).mockClear();
    vi.mocked(detectArticle).mockClear();
    vi.mocked(detectArticle).mockReturnValue({ wordCount: 1100 });

    window.dispatchEvent(new Event('wxt:locationchange'));
    expect(hideReadingButton).toHaveBeenCalledTimes(1);
    expect(detectArticle).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000 + 500);
    expect(showReadingButton).toHaveBeenCalledWith('Open in reading mode (1,100 words)', expect.any(Function));
  });

  it('re-reads settings and rechecks when a relevant setting changes', async () => {
    vi.mocked(detectArticle).mockReturnValue({ wordCount: 1500 });
    await start();
    await settle();
    vi.mocked(showReadingButton).mockClear();
    vi.mocked(hideReadingButton).mockClear();

    h.mem.sync.articleButton = false;
    h.onSyncChanged.fire({ articleButton: { newValue: false } });
    await settle();

    expect(showReadingButton).not.toHaveBeenCalled();
    expect(hideReadingButton).toHaveBeenCalled();
  });

  it('ignores changes to settings it does not use', async () => {
    await start();
    await settle();
    vi.mocked(detectArticle).mockClear();

    h.onSyncChanged.fire({ autoCheck: { newValue: false } });
    await settle();
    expect(detectArticle).not.toHaveBeenCalled();
  });
});

describe('page snapshot requests', () => {
  it('answers the background worker with the page as it stands', async () => {
    document.title = 'A long read';
    await start();
    const sendResponse = vi.fn();

    const returned = h.onMessage.fire({ type: PAGE_SNAPSHOT_REQUEST }, {}, sendResponse)[0];

    expect(returned).toBeUndefined();
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ url: window.location.href, title: 'A long read', html: expect.stringContaining('<body') }),
    );
  });

  it('ignores every other message', async () => {
    await start();
    const sendResponse = vi.fn();
    h.onMessage.fire({ type: 'other' }, {}, sendResponse);
    h.onMessage.fire(undefined, {}, sendResponse);
    expect(sendResponse).not.toHaveBeenCalled();
  });
});

describe('backtick search', () => {
  it('opens the search menu on the selected text, anchored to the selection', async () => {
    h.mem.sync.apiBase = 'https://staging.example.com';
    await start();
    select('  carbon   tax\n works  ');

    const event = pressKey();
    await flushSettings();

    expect(event.defaultPrevented).toBe(true);
    expect(openSearchMenu).toHaveBeenCalledWith(
      'carbon tax works',
      expect.objectContaining({ left: 10, top: 20 }),
      'https://staging.example.com',
    );
  });

  it('does nothing without a selection, so the key keeps working', async () => {
    await start();
    document.body.innerHTML = '<p>no selection</p>';

    const event = pressKey();
    await flushSettings();

    expect(event.defaultPrevented).toBe(false);
    expect(openSearchMenu).not.toHaveBeenCalled();
  });

  it('leaves the key alone while typing in a field', async () => {
    await start();
    select('selected');
    const input = document.createElement('input');
    document.body.appendChild(input);

    const event = pressKey({ code: 'Backquote', key: '`' }, input);
    await flushSettings();

    expect(event.defaultPrevented).toBe(false);
    expect(openSearchMenu).not.toHaveBeenCalled();
  });

  it('ignores other keys and modified backticks', async () => {
    await start();
    select('selected');
    pressKey({ code: 'KeyA', key: 'a' });
    pressKey({ code: 'Backquote', key: '`', ctrlKey: true });
    await flushSettings();
    expect(openSearchMenu).not.toHaveBeenCalled();
  });

  it('does not search when the shortcut is turned off', async () => {
    h.mem.sync.searchShortcut = false;
    await start();
    select('selected');

    const event = pressKey();
    await flushSettings();

    expect(event.defaultPrevented).toBe(false);
    expect(openSearchMenu).not.toHaveBeenCalled();
  });

  it('honors a shortcut turned off after the settings first loaded, once they are re-read', async () => {
    await start();
    h.mem.sync.searchShortcut = false;
    h.onSyncChanged.fire({ searchShortcut: { newValue: false } });
    await settle();
    select('selected');

    pressKey();
    await flushSettings();
    expect(openSearchMenu).not.toHaveBeenCalled();
  });
});

describe('when the extension is invalidated', () => {
  it('takes its UI off the page', async () => {
    await start();
    invalidated.forEach((fn) => fn());
    expect(closeSearchMenu).toHaveBeenCalledTimes(1);
    expect(hideReadingButton).toHaveBeenCalled();
  });
});
