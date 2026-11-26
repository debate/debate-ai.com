import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStorage } from './helpers/memory-browser';

const mem = vi.hoisted(() => ({ sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> }));
const api = vi.hoisted(() => ({
  runtime: {
    sendMessage: vi.fn(),
    getURL: (path: string) => `chrome-extension://abc${path}`,
    getContexts: undefined as undefined | ReturnType<typeof vi.fn>,
  },
  windows: { update: vi.fn(), create: vi.fn() },
  extension: { getViews: vi.fn() },
}));

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  return { browser: Object.assign(memoryBrowser(mem), api) };
});

import {
  OPEN_TIMER_MESSAGE,
  forgetTimerWindow,
  openTimerWindow,
  requestTimerWindow,
} from '@/src/timer/window';

const TIMER_URL = 'chrome-extension://abc/timer.html';

beforeEach(() => {
  resetStorage(mem);
  api.runtime.sendMessage.mockReset();
  api.runtime.getContexts = undefined;
  api.extension.getViews.mockReset().mockReturnValue([]);
  api.windows.update.mockReset().mockResolvedValue({});
  api.windows.create.mockReset().mockResolvedValue({ id: 11 });
});

it('asks the background worker to raise the timer', async () => {
  await requestTimerWindow();
  expect(api.runtime.sendMessage).toHaveBeenCalledWith({ type: OPEN_TIMER_MESSAGE });
});

describe('openTimerWindow', () => {
  it('opens a popup window sized from settings and remembers its id', async () => {
    mem.sync.timerWindowWidth = 500;
    mem.sync.timerWindowHeight = 600;

    await openTimerWindow();

    expect(api.windows.create).toHaveBeenCalledWith({
      url: TIMER_URL,
      type: 'popup',
      width: 500,
      height: 600,
      focused: true,
    });
    expect(mem.local.timerWindowId).toBe(11);
  });

  it('does not remember a window that came back without an id', async () => {
    api.windows.create.mockResolvedValue(undefined);
    await openTimerWindow();
    expect(mem.local).not.toHaveProperty('timerWindowId');
  });

  it('focuses the remembered window when it still shows the timer (MV3 contexts)', async () => {
    mem.local.timerWindowId = 5;
    api.runtime.getContexts = vi.fn().mockResolvedValue([{}]);

    await openTimerWindow();

    expect(api.runtime.getContexts).toHaveBeenCalledWith({
      contextTypes: ['TAB'],
      windowIds: [5],
      documentUrls: [TIMER_URL],
    });
    expect(api.windows.update).toHaveBeenCalledWith(5, { focused: true });
    expect(api.windows.create).not.toHaveBeenCalled();
  });

  it('opens a fresh window when the remembered id now names an ordinary window', async () => {
    mem.local.timerWindowId = 5;
    api.runtime.getContexts = vi.fn().mockResolvedValue([]);

    await openTimerWindow();

    expect(api.windows.update).not.toHaveBeenCalled();
    expect(api.windows.create).toHaveBeenCalledTimes(1);
    expect(mem.local.timerWindowId).toBe(11);
  });

  it('checks the window\'s views where there are no contexts (MV2)', async () => {
    mem.local.timerWindowId = 5;
    api.extension.getViews.mockReturnValue([{ location: { href: `${TIMER_URL}#x` } }]);

    await openTimerWindow();

    expect(api.extension.getViews).toHaveBeenCalledWith({ windowId: 5 });
    expect(api.windows.update).toHaveBeenCalledWith(5, { focused: true });
  });

  it('does not take a window with another page for the timer (MV2)', async () => {
    mem.local.timerWindowId = 5;
    api.extension.getViews.mockReturnValue([{ location: { href: 'chrome-extension://abc/options.html' } }]);

    await openTimerWindow();

    expect(api.windows.update).not.toHaveBeenCalled();
    expect(api.windows.create).toHaveBeenCalledTimes(1);
  });

  it('opens a fresh window when the check itself throws', async () => {
    mem.local.timerWindowId = 5;
    api.runtime.getContexts = vi.fn().mockRejectedValue(new Error('nope'));

    await openTimerWindow();

    expect(api.windows.create).toHaveBeenCalledTimes(1);
  });

  it('opens a fresh window when the window closes between the check and the focus', async () => {
    mem.local.timerWindowId = 5;
    api.runtime.getContexts = vi.fn().mockResolvedValue([{}]);
    api.windows.update.mockRejectedValue(new Error('No window with id: 5'));

    await openTimerWindow();

    expect(api.windows.create).toHaveBeenCalledTimes(1);
    expect(mem.local.timerWindowId).toBe(11);
  });
});

describe('forgetTimerWindow', () => {
  it('forgets only the window that was remembered', async () => {
    mem.local.timerWindowId = 5;
    await forgetTimerWindow(6);
    expect(mem.local.timerWindowId).toBe(5);
    await forgetTimerWindow(5);
    expect(mem.local).not.toHaveProperty('timerWindowId');
  });

  it('ignores a stored id that is not a number', async () => {
    mem.local.timerWindowId = 'x';
    await forgetTimerWindow(5);
    expect(mem.local.timerWindowId).toBe('x');
  });
});
