import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The whole debate-ai.com app is far outside what this host page does; stand
// it in with the three things main.tsx calls.
const webview = vi.hoisted(() => ({
  configureHost: vi.fn(),
  applyStoredAppearance: vi.fn(),
}));
vi.mock('@debate/webview', () => ({
  ...webview,
  DebateApp: () => <main id="debate-app">app</main>,
}));

type Host = { openOnSite: (path: string) => void; framing: boolean; oneTap: boolean; serviceWorker: boolean };

/** Boots offline/main.tsx into a fresh #root and returns what it passed to configureHost. */
async function boot(): Promise<Host> {
  vi.resetModules();
  webview.configureHost.mockClear();
  webview.applyStoredAppearance.mockClear();
  document.body.innerHTML = '<div id="root"></div>';
  await act(async () => {
    await import('../offline/main');
  });
  return webview.configureHost.mock.calls[0][0] as Host;
}

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  delete (window as { __TAURI__?: unknown }).__TAURI__;
  vi.restoreAllMocks();
});

describe('offline host page', () => {
  it('configures the app for a page with no server behind it', async () => {
    const host = await boot();
    expect(host).toMatchObject({ framing: false, oneTap: false, serviceWorker: false });
    expect(webview.applyStoredAppearance).toHaveBeenCalledTimes(1);
  });

  it('renders the app and a link back to the wrapper settings', async () => {
    await boot();
    expect(document.getElementById('debate-app')).not.toBeNull();
    const link = document.querySelector('a[href="../settings.html"]');
    expect(link?.textContent).toBe('Offline · Change');
  });

  it('opens on the videos page when no route is in the fragment', async () => {
    await boot();
    expect(window.location.hash).toBe('#/videos');
  });

  it('keeps a route already in the fragment', async () => {
    window.history.replaceState(null, '', '/#/timer');
    await boot();
    expect(window.location.hash).toBe('#/timer');
  });

  it('opens site pages through the Tauri opener when it is there', async () => {
    const invoke = vi.fn(async () => undefined);
    (window as { __TAURI__?: unknown }).__TAURI__ = { core: { invoke } };
    const host = await boot();
    host.openOnSite('/pricing');
    expect(invoke).toHaveBeenCalledWith('plugin:opener|open_url', { url: 'https://site.test/pricing' });
  });

  it('falls back to a new window outside Tauri', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const host = await boot();
    host.openOnSite('/pricing');
    expect(open).toHaveBeenCalledWith('https://site.test/pricing', '_blank', 'noopener');
  });
});
