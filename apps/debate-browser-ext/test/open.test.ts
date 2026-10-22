import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Where the extension's "open" buttons send a new tab: the Options page, which
 * hosts the bundled app, on a hash route.
 */
const create = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: { create },
    runtime: { getURL: (path: string) => `chrome-extension://test${path}` },
  },
}));

import {
  LOCAL_APP_ROUTE,
  openExtensionSettings,
  openLocalApp,
} from '@/src/settings/open';

describe('settings/open', () => {
  beforeEach(() => create.mockClear());

  it('opens the bundled app on the Research editor by default', () => {
    openLocalApp();
    expect(LOCAL_APP_ROUTE).toBe('/research/docs');
    expect(create).toHaveBeenCalledWith({
      url: 'chrome-extension://test/options.html#/research/docs',
    });
  });

  it('opens the bundled app on another route', () => {
    openLocalApp('/videos');
    expect(create).toHaveBeenCalledWith({ url: 'chrome-extension://test/options.html#/videos' });
  });

  it('still opens the Browser extension settings tab', () => {
    openExtensionSettings();
    expect(create).toHaveBeenCalledWith({
      url: 'chrome-extension://test/options.html#/settings?category=browser-extension',
    });
  });
});
