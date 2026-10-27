import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCOUNT_SYNC_TOKEN,
  __resetAccountSyncForTests,
  accountSyncStatus,
  accountSyncToken,
  onAccountSyncChanged,
  refreshAccountSync,
  setAccountSyncSession,
} from '../src/editor/collab/account-sync';
import { webAccountStatus, webEntitlementToken, webRoutingCodeSync, onWebAccountChanged } from '../src/editor/collab/web-account';
import { WEB_DEFAULT_RELAY_URL } from '../src/editor/collab/relay-endpoint';
import { relayBaseUrl } from '../src/editor/collab/collab-relay';
import { buildAccountSyncEditor } from '../src/editor/collab/account-sync-ui';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('collaboration account sync', () => {
  beforeEach(() => {
    __resetAccountSyncForTests();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("points the editor at the app's own relay instead of Debate Decoded", () => {
    expect(WEB_DEFAULT_RELAY_URL).toBe('/api/collab-relay');
    expect(relayBaseUrl()).toBe('/api/collab-relay');
  });

  it('uses the signed-in account as the relay credential', async () => {
    const fetchMock = vi.fn(async () => json({ signedIn: true, email: 'ada@example.com', name: 'Ada' }));
    vi.stubGlobal('fetch', fetchMock);
    const status = await refreshAccountSync();
    expect(fetchMock).toHaveBeenCalledWith('/api/collab-relay/account', expect.objectContaining({ credentials: 'same-origin' }));
    expect(status).toMatchObject({ signedIn: true, email: 'ada@example.com', checked: true });
    expect(accountSyncToken()).toBe(ACCOUNT_SYNC_TOKEN);
    // The editor's own credential seams now read the account.
    expect(webEntitlementToken()).toBe(ACCOUNT_SYNC_TOKEN);
    expect(webRoutingCodeSync()).toBe('');
    expect(webAccountStatus()).toEqual({ connected: true, email: 'ada@example.com', routingCode: '', expiresAt: null });
  });

  it('has no credential when signed out', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ signedIn: false }, 401)));
    await refreshAccountSync();
    expect(accountSyncToken()).toBe('');
    expect(webEntitlementToken()).toBe('');
    expect(webAccountStatus().connected).toBe(false);
  });

  it('keeps the last answer when the check fails, and remembers it across visits', async () => {
    setAccountSyncSession({ email: 'ada@example.com', name: 'Ada' });
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('offline');
    }));
    await refreshAccountSync();
    expect(accountSyncStatus().signedIn).toBe(true);
    expect(JSON.parse(localStorage.getItem('debate-editor-account-sync') ?? '{}')).toMatchObject({ signedIn: true });
  });

  it('tells listeners (the card mailbox) when the account changes', () => {
    const viaSync = vi.fn();
    const viaWebAccount = vi.fn();
    onAccountSyncChanged(viaSync);
    const off = onWebAccountChanged(viaWebAccount);
    setAccountSyncSession({ email: 'ada@example.com' });
    setAccountSyncSession({ email: 'ada@example.com' }); // no change, no event
    setAccountSyncSession(null);
    expect(viaSync).toHaveBeenCalledTimes(2);
    expect(viaWebAccount).toHaveBeenCalledTimes(2);
    off();
    setAccountSyncSession({ email: 'bo@example.com' });
    expect(viaWebAccount).toHaveBeenCalledTimes(2);
  });

  it('shows which account is syncing in settings, or a sign-in link', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ signedIn: false }, 401)));
    const { el, cleanup } = buildAccountSyncEditor();
    await refreshAccountSync();
    expect(el.textContent).toContain('Not signed in');
    const signIn = el.querySelector('a')!;
    expect(signIn.hidden).toBe(false);
    expect(signIn.getAttribute('href')).toMatch(/^\/login\?callbackURL=/);
    expect(el.textContent).not.toMatch(/Debate Decoded|membership|connect code/i);

    setAccountSyncSession({ email: 'ada@example.com', name: 'Ada' });
    expect(el.textContent).toContain('Syncing as ada@example.com');
    expect(signIn.hidden).toBe(true);
    cleanup();
  });
});
