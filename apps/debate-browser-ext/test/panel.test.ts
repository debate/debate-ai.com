import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const browserMock = vi.hoisted(() => ({
  runtime: { getURL: vi.fn((path: string) => `chrome-extension://abc${path}`) },
  scripting: { executeScript: vi.fn() } as { executeScript?: ReturnType<typeof vi.fn> },
  tabs: { create: vi.fn(async () => ({})), executeScript: vi.fn() },
}));

vi.mock('wxt/browser', () => ({ browser: browserMock }));

import {
  READER_CLOSE_MESSAGE,
  READER_LAYOUT_MESSAGE,
  openReaderForTab,
  openReaderTab,
  requestReaderPanelClose,
  requestReaderPanelLayout,
  toggleReaderPanel,
  toggleReaderPanelInPage,
} from '@/src/reader/panel';

const FRAME = 'debate-ai-reader-overlay';
const LOCK = 'debate-ai-reader-scroll-lock';

const frame = () => document.getElementById(FRAME) as HTMLIFrameElement | null;
const scrollLocked = () => document.getElementById(LOCK) !== null;
const display = (el: HTMLElement) => el.style.getPropertyValue('display');

function postFromPanel(data: unknown, source: MessageEventSource | null = frame()!.contentWindow) {
  window.dispatchEvent(new MessageEvent('message', { data, source }));
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  browserMock.scripting.executeScript = vi.fn();
  browserMock.tabs.create.mockClear();
  browserMock.tabs.executeScript.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the in-page overlay (toggleReaderPanelInPage)', () => {
  it('injects a full-page frame onto the extension page and locks page scrolling', () => {
    expect(toggleReaderPanelInPage()).toBe(true);

    const el = frame()!;
    expect(el.tagName).toBe('IFRAME');
    expect(el.src).toBe('chrome-extension://abc/reader.html');
    expect(el.dataset.layout).toBe('full');
    expect(el.style.getPropertyValue('position')).toBe('fixed');
    expect(el.style.getPropertyPriority('width')).toBe('important');
    expect(el.style.getPropertyValue('width')).toBe('100vw');
    expect(el.getAttribute('allow')).toBe('clipboard-write');
    expect(scrollLocked()).toBe(true);
  });

  it('hides the frame on the second call, keeping it alive, and shows it again on the third', () => {
    toggleReaderPanelInPage();
    const el = frame()!;

    expect(toggleReaderPanelInPage()).toBe(false);
    expect(display(el)).toBe('none');
    expect(scrollLocked()).toBe(false);

    expect(toggleReaderPanelInPage()).toBe(true);
    expect(display(el)).toBe('block');
    expect(scrollLocked()).toBe(true);
    expect(document.querySelectorAll(`#${FRAME}`)).toHaveLength(1);
  });

  it('hides itself when the panel asks to close, and ignores a close from any other window', () => {
    toggleReaderPanelInPage();

    postFromPanel({ type: READER_CLOSE_MESSAGE }, window);
    expect(display(frame()!)).toBe('block');

    postFromPanel({ type: READER_CLOSE_MESSAGE });
    expect(display(frame()!)).toBe('none');
    expect(scrollLocked()).toBe(false);
  });

  it('switches to the side layout and releases the scroll lock, then back to full', () => {
    toggleReaderPanelInPage();

    postFromPanel({ type: READER_LAYOUT_MESSAGE, layout: 'side' });
    expect(frame()!.dataset.layout).toBe('side');
    expect(frame()!.style.getPropertyValue('width')).toBe('min(460px, 100vw)');
    expect(frame()!.style.getPropertyValue('left')).toBe('auto');
    expect(scrollLocked()).toBe(false);

    postFromPanel({ type: READER_LAYOUT_MESSAGE, layout: 'full' });
    expect(frame()!.dataset.layout).toBe('full');
    expect(scrollLocked()).toBe(true);
  });

  it('ignores an unknown layout and unrelated messages', () => {
    toggleReaderPanelInPage();

    postFromPanel({ type: READER_LAYOUT_MESSAGE, layout: 'floating' });
    postFromPanel({ type: 'something-else' });
    postFromPanel(null);

    expect(frame()!.dataset.layout).toBe('full');
    expect(display(frame()!)).toBe('block');
  });

  it('does not lock scrolling when re-shown in the side layout', () => {
    toggleReaderPanelInPage();
    postFromPanel({ type: READER_LAYOUT_MESSAGE, layout: 'side' });
    toggleReaderPanelInPage();
    toggleReaderPanelInPage();

    expect(display(frame()!)).toBe('block');
    expect(scrollLocked()).toBe(false);
  });
});

describe('toggleReaderPanel', () => {
  it('runs the overlay in the tab through the scripting API and reports whether it is showing', async () => {
    browserMock.scripting.executeScript!.mockImplementation(
      async ({ func, args }: { func: (...a: unknown[]) => unknown; args: unknown[] }) => [{ result: func(...args) }],
    );

    expect(await toggleReaderPanel(5)).toBe(true);
    expect(browserMock.scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 5 },
        args: ['chrome-extension://abc/reader.html', READER_CLOSE_MESSAGE, READER_LAYOUT_MESSAGE],
      }),
    );
    expect(await toggleReaderPanel(5)).toBe(false);
  });

  it('reports false when the injection returns no result', async () => {
    browserMock.scripting.executeScript!.mockResolvedValue([]);
    expect(await toggleReaderPanel(5)).toBe(false);
  });

  it('falls back to injecting serialized code on MV2, which has no scripting API', async () => {
    browserMock.scripting.executeScript = undefined;
    browserMock.tabs.executeScript.mockImplementation(async (_tabId: number, { code }: { code: string }) => [
      new Function(`return ${code}`)(),
    ]);

    expect(await toggleReaderPanel(9)).toBe(true);
    expect(browserMock.tabs.executeScript).toHaveBeenCalledWith(9, { code: expect.stringContaining('"chrome-extension://abc/reader.html"') });
    expect(frame()?.src).toBe('chrome-extension://abc/reader.html');
  });
});

describe('openReaderTab', () => {
  it('opens the panel page reading the encoded URL', async () => {
    await openReaderTab('https://example.com/a b.pdf?x=1&y=2');
    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://abc/reader.html?url=https%3A%2F%2Fexample.com%2Fa%20b.pdf%3Fx%3D1%26y%3D2',
    });
  });
});

describe('openReaderForTab', () => {
  it('opens a PDF in its own panel tab without injecting', async () => {
    await openReaderForTab({ id: 1, url: 'https://example.com/paper.pdf' });
    expect(browserMock.scripting.executeScript).not.toHaveBeenCalled();
    expect(browserMock.tabs.create).toHaveBeenCalledTimes(1);
  });

  it('overlays an ordinary page', async () => {
    browserMock.scripting.executeScript!.mockResolvedValue([{ result: true }]);
    await openReaderForTab({ id: 1, url: 'https://example.com/post' });
    expect(browserMock.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(browserMock.tabs.create).not.toHaveBeenCalled();
  });

  it('opens a panel tab when the page cannot be injected into', async () => {
    browserMock.scripting.executeScript!.mockRejectedValue(new Error('Cannot access contents of the page'));
    await openReaderForTab({ id: 1, url: 'https://example.com/post' });
    expect(browserMock.tabs.create).toHaveBeenCalledWith({
      url: expect.stringContaining('reader.html?url=https%3A%2F%2Fexample.com%2Fpost'),
    });
  });

  it('rethrows when injection fails on a page with no web URL to fall back to', async () => {
    browserMock.scripting.executeScript!.mockRejectedValue(new Error('chrome:// is off limits'));
    await expect(openReaderForTab({ id: 1, url: 'chrome://extensions' })).rejects.toThrow('chrome:// is off limits');
    expect(browserMock.tabs.create).not.toHaveBeenCalled();
  });

  it('rejects when there is no tab id and no web URL', async () => {
    await expect(openReaderForTab({})).rejects.toThrow('No tab to read.');
  });

  it('falls back to a panel tab when there is a URL but no tab id', async () => {
    await openReaderForTab({ url: 'https://example.com/post' });
    expect(browserMock.tabs.create).toHaveBeenCalledTimes(1);
  });
});

describe('requests from inside the framed panel', () => {
  it('posts the layout and close requests to the framing page', () => {
    const parent = { postMessage: vi.fn(), close: vi.fn() };
    vi.spyOn(window, 'parent', 'get').mockReturnValue(parent as unknown as Window);

    requestReaderPanelLayout('side');
    requestReaderPanelClose();

    expect(parent.postMessage).toHaveBeenNthCalledWith(1, { type: READER_LAYOUT_MESSAGE, layout: 'side' }, '*');
    expect(parent.postMessage).toHaveBeenNthCalledWith(2, { type: READER_CLOSE_MESSAGE }, '*');
  });

  it('does nothing about layout, and closes its own tab, when it is not framed', () => {
    const postMessage = vi.spyOn(window, 'postMessage');
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});

    requestReaderPanelLayout('full');
    requestReaderPanelClose();

    expect(postMessage).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
