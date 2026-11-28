import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStorage } from './helpers/memory-browser';

type Listener = (...args: any[]) => any;

const h = vi.hoisted(() => {
  const mem = { sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> };
  const event = () => {
    const fns = new Set<Listener>();
    return {
      fns,
      addListener: (fn: Listener) => void fns.add(fn),
      removeListener: (fn: Listener) => void fns.delete(fn),
      fire: (...args: unknown[]) => [...fns].map((fn) => fn(...args)),
    };
  };
  return { mem, event, main: null as null | (() => void), browser: {} as Record<string, any> };
});

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  const base = memoryBrowser(h.mem);
  const storage = {
    local: base.storage.local,
    sync: { ...base.storage.sync, onChanged: h.event() },
  };
  Object.assign(h.browser, {
    action: { setPopup: vi.fn(async () => {}), onClicked: h.event() },
    runtime: {
      onInstalled: h.event(),
      onStartup: h.event(),
      onMessage: h.event(),
      onMessageExternal: h.event(),
      sendMessage: vi.fn(async () => {}),
    },
    storage,
    contextMenus: { removeAll: vi.fn(async () => {}), create: vi.fn(), onClicked: h.event() },
    tabs: { query: vi.fn(async () => [{ id: 1, url: 'https://example.com/' }]), onUpdated: h.event() },
    windows: { onRemoved: h.event() },
    alarms: { get: vi.fn(async () => undefined), create: vi.fn(async () => {}), onAlarm: h.event() },
  });
  return { browser: h.browser };
});

vi.mock('@/src/reader/panel', async (importActual) => ({
  ...(await importActual<typeof import('@/src/reader/panel')>()),
  openReaderForTab: vi.fn(async () => {}),
}));
vi.mock('@/src/reader/snapshot', async (importActual) => ({
  ...(await importActual<typeof import('@/src/reader/snapshot')>()),
  capturePageSnapshot: vi.fn(),
}));
vi.mock('@/src/timer/window', async (importActual) => ({
  ...(await importActual<typeof import('@/src/timer/window')>()),
  openTimerWindow: vi.fn(async () => {}),
  forgetTimerWindow: vi.fn(async () => {}),
}));
vi.mock('@/src/auth/session', async (importActual) => ({
  ...(await importActual<typeof import('@/src/auth/session')>()),
  refreshSession: vi.fn(async () => null),
  signOut: vi.fn(async () => {}),
}));
vi.mock('@/src/auth/sign-in-flow', () => ({ runSignInFlow: vi.fn(async () => ({ ok: true })) }));
vi.mock('@/src/auth/qwksearch-connect', async (importActual) => ({
  ...(await importActual<typeof import('@/src/auth/qwksearch-connect')>()),
  runQwkSearchConnectFlow: vi.fn(async () => ({ ok: true })),
}));
vi.mock('@/src/docx-import/open-in-editor', () => ({
  openDocxInEditor: vi.fn(async () => {}),
  requestLinkPermission: vi.fn(async () => true),
}));

vi.stubGlobal('defineBackground', (main: () => void) => {
  h.main = main;
  return { main };
});

const { default: background } = await import('@/entrypoints/background');
void background;

import { PageNotReadableError, capturePageSnapshot } from '@/src/reader/snapshot';
import { READER_SNAPSHOT_MESSAGE, READER_TAB_CHANGED_MESSAGE, openReaderForTab } from '@/src/reader/panel';
import { OPEN_TIMER_MESSAGE, forgetTimerWindow, openTimerWindow } from '@/src/timer/window';
import { SIGN_IN_MESSAGE, SIGN_OUT_MESSAGE, refreshSession, signOut } from '@/src/auth/session';
import { runSignInFlow } from '@/src/auth/sign-in-flow';
import { QWKSEARCH_CONNECT_MESSAGE, runQwkSearchConnectFlow } from '@/src/auth/qwksearch-connect';
import { openDocxInEditor, requestLinkPermission } from '@/src/docx-import/open-in-editor';
import { DOCX_HANDOFF_MESSAGE, OPEN_DOCX_MENU_ID } from '@/src/docx-import/handoff';
import { BULK_STORAGE_MESSAGE } from '@/src/storage/bulk-storage-bridge';

const b = h.browser;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Sends `message` to the worker the way the browser does, resolving with what it replies. */
async function send(message: unknown, sender: { tab?: { id?: number } } = {}) {
  const sendResponse = vi.fn();
  const [returned] = b.runtime.onMessage.fire(message, sender, sendResponse);
  await flush();
  return { returned, sendResponse };
}

function boot() {
  for (const area of [b.action.onClicked, b.runtime.onInstalled, b.runtime.onStartup, b.runtime.onMessage, b.runtime.onMessageExternal, b.storage.sync.onChanged, b.contextMenus.onClicked, b.tabs.onUpdated, b.windows.onRemoved, b.alarms.onAlarm]) {
    area.fns.clear();
  }
  h.main!();
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStorage(h.mem);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  boot();
});

describe('toolbar mode', () => {
  it('shows the popup by default and clears it for the timer and article modes', async () => {
    await flush();
    expect(b.action.setPopup).toHaveBeenLastCalledWith({ popup: 'popup.html' });

    h.mem.sync.toolbarAction = 'timer';
    b.storage.sync.onChanged.fire({ toolbarAction: { newValue: 'timer' } });
    await flush();
    expect(b.action.setPopup).toHaveBeenLastCalledWith({ popup: '' });
  });

  it('ignores storage changes to other settings', async () => {
    await flush();
    b.action.setPopup.mockClear();
    b.storage.sync.onChanged.fire({ autoCheck: { newValue: false } });
    await flush();
    expect(b.action.setPopup).not.toHaveBeenCalled();
  });

  it('opens the timer window on a toolbar click in timer mode', async () => {
    h.mem.sync.toolbarAction = 'timer';
    b.action.onClicked.fire({ id: 3 });
    await flush();
    expect(openTimerWindow).toHaveBeenCalledTimes(1);
    expect(openReaderForTab).not.toHaveBeenCalled();
  });

  it('toggles the article panel on the clicked tab in reader mode', async () => {
    h.mem.sync.toolbarAction = 'reader';
    const tab = { id: 3, url: 'https://example.com/post' };
    b.action.onClicked.fire(tab);
    await flush();
    expect(openReaderForTab).toHaveBeenCalledWith(tab);
    expect(openTimerWindow).not.toHaveBeenCalled();
  });

  it('falls back to the timer window when the page cannot show the panel', async () => {
    h.mem.sync.toolbarAction = 'reader';
    vi.mocked(openReaderForTab).mockRejectedValueOnce(new Error('chrome:// page'));
    b.action.onClicked.fire({ id: 3, url: 'chrome://extensions' });
    await flush();
    expect(openTimerWindow).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('install and startup', () => {
  it('creates the context menus once installed, replacing any old ones', async () => {
    b.runtime.onInstalled.fire();
    await flush();

    expect(b.contextMenus.removeAll).toHaveBeenCalled();
    const items = b.contextMenus.create.mock.calls.map(([item]: any[]) => item);
    expect(items.map((item: any) => item.id)).toEqual(['read-page-in-article-panel', OPEN_DOCX_MENU_ID]);
    expect(items[0].documentUrlPatterns).toEqual(['http://*/*', 'https://*/*']);
    expect(items[1].contexts).toEqual(['link']);
    expect(items[1].targetUrlPatterns).toContain('*://*/*.docx');
  });

  it('refreshes the account session on browser startup and every six hours', async () => {
    b.runtime.onStartup.fire();
    await flush();

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(b.alarms.create).toHaveBeenCalledWith('debate-account-session-refresh', { periodInMinutes: 360 });
  });

  it('does not stack a second refresh alarm when one is registered', async () => {
    b.alarms.get.mockResolvedValue({ name: 'debate-account-session-refresh' });
    b.alarms.create.mockClear();
    b.runtime.onInstalled.fire();
    await flush();
    expect(b.alarms.create).not.toHaveBeenCalled();
  });

  it('refreshes the session when its alarm fires, and only then', async () => {
    b.alarms.onAlarm.fire({ name: 'something-else' });
    expect(refreshSession).not.toHaveBeenCalled();
    b.alarms.onAlarm.fire({ name: 'debate-account-session-refresh' });
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });
});

describe('messages from extension pages', () => {
  it('opens the timer window without a reply', async () => {
    const { returned, sendResponse } = await send({ type: OPEN_TIMER_MESSAGE });
    expect(openTimerWindow).toHaveBeenCalled();
    expect(returned).toBeUndefined();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('ignores unknown and malformed messages, leaving the channel closed', async () => {
    for (const message of [{ type: 'nope' }, undefined, null, 'text']) {
      const { returned, sendResponse } = await send(message);
      expect(returned).toBeUndefined();
      expect(sendResponse).not.toHaveBeenCalled();
    }
  });

  it('runs sign-in and answers through sendResponse, keeping the channel open', async () => {
    vi.mocked(runSignInFlow).mockResolvedValueOnce({ ok: true, user: { id: 'u1' } });
    const { returned, sendResponse } = await send({ type: SIGN_IN_MESSAGE });
    expect(returned).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, user: { id: 'u1' } });
  });

  it('turns a thrown error into an error reply', async () => {
    vi.mocked(runSignInFlow).mockRejectedValueOnce(new Error('network down'));
    const { sendResponse } = await send({ type: SIGN_IN_MESSAGE });
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'network down' });

    vi.mocked(signOut).mockRejectedValueOnce('plain string');
    const second = await send({ type: SIGN_OUT_MESSAGE });
    expect(second.sendResponse).toHaveBeenCalledWith({ ok: false, error: 'plain string' });
  });

  it('signs out and runs the QwkSearch link flow on request', async () => {
    const out = await send({ type: SIGN_OUT_MESSAGE });
    expect(signOut).toHaveBeenCalled();
    expect(out.returned).toBe(true);

    vi.mocked(runQwkSearchConnectFlow).mockResolvedValueOnce({ ok: false, cancelled: true });
    const connect = await send({ type: QWKSEARCH_CONNECT_MESSAGE });
    expect(connect.sendResponse).toHaveBeenCalledWith({ ok: false, cancelled: true });
  });
});

describe('page snapshot requests', () => {
  const snapshot = { url: 'https://example.com/', title: 'T', html: '<p>hi</p>', selectionText: '', contentType: 'text/html' };

  it('captures the tab the panel is framed in', async () => {
    vi.mocked(capturePageSnapshot).mockResolvedValueOnce(snapshot);
    const { sendResponse } = await send({ type: READER_SNAPSHOT_MESSAGE }, { tab: { id: 42 } });
    expect(capturePageSnapshot).toHaveBeenCalledWith(42);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, snapshot });
  });

  it('falls back to the active tab for reader.html opened on its own', async () => {
    vi.mocked(capturePageSnapshot).mockResolvedValueOnce(snapshot);
    await send({ type: READER_SNAPSHOT_MESSAGE });
    expect(b.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(capturePageSnapshot).toHaveBeenCalledWith(1);
  });

  it('says so when there is no tab to read', async () => {
    b.tabs.query.mockResolvedValueOnce([]);
    const { sendResponse } = await send({ type: READER_SNAPSHOT_MESSAGE });
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'No page is open to read.' });
    expect(capturePageSnapshot).not.toHaveBeenCalled();
  });

  it('passes on the reason a page is not readable as it is, and wraps other failures', async () => {
    vi.mocked(capturePageSnapshot).mockRejectedValueOnce(new PageNotReadableError('This page cannot be read by extensions.'));
    const unreadable = await send({ type: READER_SNAPSHOT_MESSAGE }, { tab: { id: 1 } });
    expect(unreadable.sendResponse).toHaveBeenCalledWith({ ok: false, error: 'This page cannot be read by extensions.' });

    vi.mocked(capturePageSnapshot).mockRejectedValueOnce(new Error('tab closed'));
    const failed = await send({ type: READER_SNAPSHOT_MESSAGE }, { tab: { id: 1 } });
    expect(failed.sendResponse).toHaveBeenCalledWith({ ok: false, error: 'Could not read this page: tab closed' });

    vi.mocked(capturePageSnapshot).mockRejectedValueOnce('weird');
    const odd = await send({ type: READER_SNAPSHOT_MESSAGE }, { tab: { id: 1 } });
    expect(odd.sendResponse).toHaveBeenCalledWith({ ok: false, error: 'Could not read this page: weird' });
  });
});

describe('context menus', () => {
  it('toggles the panel from the "read this page" item', async () => {
    const tab = { id: 8, url: 'https://example.com/' };
    b.contextMenus.onClicked.fire({ menuItemId: 'read-page-in-article-panel' }, tab);
    await flush();
    expect(openReaderForTab).toHaveBeenCalledWith(tab);
  });

  it('asks for permission to the link site before importing a .docx link', async () => {
    const tab = { id: 8, index: 2 };
    b.contextMenus.onClicked.fire({ menuItemId: OPEN_DOCX_MENU_ID, linkUrl: 'https://school.edu/case.docx' }, tab);
    await flush();

    expect(requestLinkPermission).toHaveBeenCalledWith('https://school.edu/case.docx');
    const permission = vi.mocked(requestLinkPermission).mock.results[0].value;
    expect(openDocxInEditor).toHaveBeenCalledWith('https://school.edu/case.docx', permission, tab);
  });

  it('ignores the .docx item with no link, and unrelated items', async () => {
    b.contextMenus.onClicked.fire({ menuItemId: OPEN_DOCX_MENU_ID }, {});
    b.contextMenus.onClicked.fire({ menuItemId: 'other', linkUrl: 'https://a.example/x.docx' }, {});
    await flush();
    expect(openDocxInEditor).not.toHaveBeenCalled();
    expect(openReaderForTab).not.toHaveBeenCalled();
  });
});

describe('tabs and windows', () => {
  it('tells the open panel when a tab navigates, and not when only its status changes', async () => {
    b.tabs.onUpdated.fire(5, { status: 'loading' });
    expect(b.runtime.sendMessage).not.toHaveBeenCalled();

    b.tabs.onUpdated.fire(5, { url: 'https://example.com/next' });
    expect(b.runtime.sendMessage).toHaveBeenCalledWith({ type: READER_TAB_CHANGED_MESSAGE, tabId: 5 });
  });

  it('does not mind that no panel is listening', async () => {
    b.runtime.sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist'));
    expect(() => b.tabs.onUpdated.fire(5, { url: 'https://example.com/next' })).not.toThrow();
    await flush();
  });

  it('forgets the timer window when its window closes', () => {
    b.windows.onRemoved.fire(77);
    expect(forgetTimerWindow).toHaveBeenCalledWith(77);
  });
});

describe('messages from debate-ai.com', () => {
  const external = async (message: unknown) => {
    const sendResponse = vi.fn();
    const [returned] = b.runtime.onMessageExternal.fire(message, {}, sendResponse);
    const value = await returned;
    await flush();
    return { returned, value, sendResponse };
  };

  it('answers bulk storage requests from the page against storage.local', async () => {
    const set = await external({ type: BULK_STORAGE_MESSAGE, op: 'set', key: 'flows', value: '[1]' });
    expect(set.value).toEqual({ ok: true });
    expect(h.mem.local['bulk:flows']).toBe('[1]');

    const ping = await external({ type: BULK_STORAGE_MESSAGE, op: 'ping' });
    expect(ping.value).toEqual({ ok: true, unlimited: true });
  });

  it('hands a parked .docx to the page through sendResponse', async () => {
    const { returned, sendResponse } = await external({ type: DOCX_HANDOFF_MESSAGE, op: 'take', id: 'does-not-exist-123' });
    expect(returned).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'The Debate AI extension no longer has that file.' });
  });

  it('ignores anything else a web page sends', async () => {
    const { returned, sendResponse } = await external({ type: 'unrelated' });
    expect(returned).toBeUndefined();
    expect(sendResponse).not.toHaveBeenCalled();
  });
});
