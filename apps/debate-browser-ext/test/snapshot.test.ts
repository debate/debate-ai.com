import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  scripting: undefined as undefined | { executeScript: ReturnType<typeof vi.fn> },
  tabs: { sendMessage: vi.fn(), executeScript: vi.fn() },
}));

vi.mock('wxt/browser', () => ({ browser: api }));

import {
  PAGE_SNAPSHOT_REQUEST,
  PageNotReadableError,
  capturePageSnapshot,
  collectPageSnapshot,
} from '@/src/reader/snapshot';

const snapshot = {
  url: 'https://news.test/a',
  title: 'A',
  html: '<html></html>',
  selectionText: '',
  contentType: 'text/html',
};

beforeEach(() => {
  api.scripting = { executeScript: vi.fn().mockResolvedValue([{ result: snapshot }]) };
  api.tabs.sendMessage.mockReset();
  api.tabs.executeScript.mockReset();
});

describe('collectPageSnapshot', () => {
  it('reads the page the way the reader sees it', () => {
    document.title = 'Deterrence works';
    document.body.innerHTML = '<article><p id="p">Selected words here.</p></article>';
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('p')!);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    const result = collectPageSnapshot();

    expect(result.url).toBe(window.location.href);
    expect(result.title).toBe('Deterrence works');
    expect(result.html).toContain('<article><p id="p">Selected words here.</p></article>');
    expect(result.selectionText).toBe('Selected words here.');
    expect(typeof result.contentType).toBe('string');
  });

  it('survives being serialized into the tab as code', () => {
    document.title = '';
    window.getSelection()!.removeAllRanges();
    const revived = new Function(`return (${collectPageSnapshot.toString()})()`)();
    expect(revived.title).toBe('');
    expect(revived.selectionText).toBe('');
    expect(revived.url).toBe(window.location.href);
  });
});

describe('capturePageSnapshot', () => {
  it('injects the collector with the scripting API', async () => {
    expect(await capturePageSnapshot(7)).toEqual(snapshot);
    expect(api.scripting!.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      func: collectPageSnapshot,
    });
  });

  it('injects code with the tabs API where there is no scripting API (MV2)', async () => {
    api.scripting = undefined;
    api.tabs.executeScript.mockResolvedValue([snapshot]);

    expect(await capturePageSnapshot(7)).toEqual(snapshot);

    const [tabId, details] = api.tabs.executeScript.mock.calls[0];
    expect(tabId).toBe(7);
    expect(details.code).toContain('window.location.href');
  });

  it('says the page cannot be read when the browser refuses injection and the page cannot answer', async () => {
    api.scripting!.executeScript.mockRejectedValue(new Error('Cannot access contents of url "chrome://settings"'));
    api.tabs.sendMessage.mockRejectedValue(new Error('no receiver'));

    const error = await capturePageSnapshot(7).catch((e) => e);

    expect(error).toBeInstanceOf(PageNotReadableError);
    expect(error.message).toMatch(/cannot be read by extensions/);
  });

  it('includes the browser\'s own message for other injection failures', async () => {
    api.scripting!.executeScript.mockRejectedValue(new Error('Tab was closed'));
    api.tabs.sendMessage.mockResolvedValue(undefined);

    await expect(capturePageSnapshot(7)).rejects.toThrow('Could not read this page: Tab was closed');
  });

  it('asks the page-tools content script when injection is not allowed', async () => {
    api.scripting!.executeScript.mockRejectedValue(new Error('Missing host permission for the tab'));
    api.tabs.sendMessage.mockResolvedValue(snapshot);

    expect(await capturePageSnapshot(7)).toEqual(snapshot);
    expect(api.tabs.sendMessage).toHaveBeenCalledWith(7, { type: PAGE_SNAPSHOT_REQUEST }, { frameId: 0 });
  });

  it('rejects an injection result that has no HTML', async () => {
    api.scripting!.executeScript.mockResolvedValue([{ result: null }]);
    await expect(capturePageSnapshot(7)).rejects.toThrow(PageNotReadableError);

    api.scripting!.executeScript.mockResolvedValue([]);
    await expect(capturePageSnapshot(7)).rejects.toThrow('returned nothing to read');
  });
});
