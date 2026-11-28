import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetStorage } from './helpers/memory-browser';

const mem = vi.hoisted(() => ({ sync: {} as Record<string, unknown>, local: {} as Record<string, unknown> }));
const extra = vi.hoisted(() => ({
  permissions: { request: vi.fn() },
  tabs: { create: vi.fn(async () => ({})) },
}));

vi.mock('wxt/browser', async () => {
  const { memoryBrowser } = await import('./helpers/memory-browser');
  return { browser: { ...memoryBrowser(mem), ...extra } };
});

import { browser } from 'wxt/browser';

import { openDocxInEditor, requestLinkPermission } from '@/src/docx-import/open-in-editor';

const fetchMock = vi.fn<typeof fetch>();
const DOCX_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]);

function docxResponse(init: { headers?: Record<string, string>; bytes?: Uint8Array; status?: number; url?: string } = {}) {
  const res = new Response((init.bytes ?? DOCX_BYTES) as BodyInit, { status: init.status ?? 200, headers: init.headers });
  if (init.url) Object.defineProperty(res, 'url', { value: init.url });
  return res;
}

const openedUrl = () => new URL((extra.tabs.create.mock.calls[0] as unknown as [{ url: string }])[0].url);

beforeEach(() => {
  resetStorage(mem);
  fetchMock.mockReset();
  extra.permissions.request.mockReset();
  extra.tabs.create.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('requestLinkPermission', () => {
  it('asks for the link site and resolves with the answer', async () => {
    extra.permissions.request.mockResolvedValue(true);
    expect(await requestLinkPermission('https://school.edu/files/case.docx')).toBe(true);
    expect(extra.permissions.request).toHaveBeenCalledWith({ origins: ['https://school.edu/*'] });
  });

  it('resolves false without prompting for a non-web link', async () => {
    expect(await requestLinkPermission('file:///tmp/case.docx')).toBe(false);
    expect(await requestLinkPermission('not a url')).toBe(false);
    expect(extra.permissions.request).not.toHaveBeenCalled();
  });

  it('treats a refused or throwing prompt as no permission', async () => {
    extra.permissions.request.mockRejectedValueOnce(new Error('denied'));
    expect(await requestLinkPermission('https://a.example/x.docx')).toBe(false);

    extra.permissions.request.mockImplementationOnce(() => {
      throw new Error('no gesture');
    });
    expect(await requestLinkPermission('https://a.example/x.docx')).toBe(false);
  });
});

describe('openDocxInEditor', () => {
  it('parks the fetched file and opens the receiver with its handoff id and file name', async () => {
    mem.sync.apiBase = 'https://staging.example.com/';
    fetchMock.mockResolvedValue(
      docxResponse({ headers: { 'content-disposition': 'attachment; filename="1AC Draft.docx"' } }),
    );

    await openDocxInEditor('https://school.edu/files/x.docx', Promise.resolve(true), { id: 4, index: 2 });

    expect(fetchMock).toHaveBeenCalledWith('https://school.edu/files/x.docx', { credentials: 'include' });
    const url = openedUrl();
    expect(url.origin + url.pathname).toBe('https://staging.example.com/import/docx');
    expect(url.searchParams.get('name')).toBe('1AC Draft.docx');
    expect(url.searchParams.get('url')).toBe('https://school.edu/files/x.docx');
    const handoff = url.searchParams.get('handoff')!;
    expect(handoff).toBeTruthy();
    const stored = Object.values(mem.local)[0] as { name: string; base64: string };
    expect(Object.keys(mem.local).some((key) => key.endsWith(handoff))).toBe(true);
    expect(stored.name).toBe('1AC Draft.docx');
    expect(atob(stored.base64)).toBe(String.fromCharCode(...DOCX_BYTES));
    expect(extra.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ active: true, index: 3, openerTabId: 4 }),
    );
  });

  it('names the file after the redirect target when there is no Content-Disposition', async () => {
    fetchMock.mockResolvedValue(docxResponse({ url: 'https://cdn.example.com/blob/Neg%20Block.docx' }));
    await openDocxInEditor('https://share.example.com/s/abc', Promise.resolve(true));
    expect(openedUrl().searchParams.get('name')).toBe('Neg Block.docx');
  });

  it('waits for the permission prompt before fetching, and fetches even if it was refused', async () => {
    let answer!: (granted: boolean) => void;
    const permission = new Promise<boolean>((resolve) => (answer = resolve));
    fetchMock.mockResolvedValue(docxResponse());

    const done = openDocxInEditor('https://a.example/x.docx', permission);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();

    answer(false);
    await done;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a failed response', () => docxResponse({ status: 403 })],
    ['a sign-in page instead of a docx', () => docxResponse({ bytes: new TextEncoder().encode('<html>log in</html>') })],
    ['a file too small to be a zip', () => docxResponse({ bytes: new Uint8Array([0x50, 0x4b]) })],
    ['a body declared larger than the limit', () => docxResponse({ headers: { 'content-length': String(26 * 1024 * 1024) } })],
  ])('opens the receiver with just the link for %s', async (_label, respond) => {
    fetchMock.mockResolvedValue(respond());

    await openDocxInEditor('https://a.example/files/Case%20File.docx', Promise.resolve(true));

    const url = openedUrl();
    expect(url.searchParams.has('handoff')).toBe(false);
    expect(url.searchParams.get('name')).toBe('Case File.docx');
    expect(url.searchParams.get('url')).toBe('https://a.example/files/Case%20File.docx');
    expect(mem.local).toEqual({});
  });

  it('opens the receiver with just the link when the fetch throws', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await openDocxInEditor('https://a.example/x.docx', Promise.resolve(false));
    expect(openedUrl().searchParams.has('handoff')).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });

  it('still opens the receiver when parking the file fails', async () => {
    fetchMock.mockResolvedValue(docxResponse());
    vi.spyOn(browser.storage.local, 'set').mockRejectedValueOnce(new Error('quota exceeded'));

    await openDocxInEditor('https://a.example/x.docx', Promise.resolve(true));

    expect(openedUrl().searchParams.has('handoff')).toBe(false);
    expect(console.warn).toHaveBeenCalledWith('Could not hand the .docx to Debate AI:', expect.any(Error));
  });

  it('opens the tab at the end of the strip, without an opener, when none is given', async () => {
    fetchMock.mockResolvedValue(docxResponse());
    await openDocxInEditor('https://a.example/x.docx', Promise.resolve(true));
    const [args] = extra.tabs.create.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(args).not.toHaveProperty('index');
    expect(args).not.toHaveProperty('openerTabId');
  });
});
