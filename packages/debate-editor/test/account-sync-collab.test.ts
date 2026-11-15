import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetAccountSyncForTests, setAccountSyncSession } from '../src/editor/collab/account-sync';
import {
  accountDisplayName,
  applyAccountSyncCollab,
  installAccountSyncCollab,
  type CollabSettingsStore,
} from '../src/editor/collab/account-sync-collab';
import { DEBATE_EDITOR_SETTINGS_TABS } from '../src/editor/settings-tabs';

function memoryStore(initial: { pairingEnabled: boolean; pairingDisplayName: string }) {
  const values = { ...initial };
  const store = {
    get: (key: keyof typeof values) => values[key],
    set: (key: keyof typeof values, value: never) => {
      (values as Record<string, unknown>)[key] = value;
    },
  } as unknown as CollabSettingsStore;
  return { store, values };
}

const signedIn = (name: string, email = 'ada@example.com') => ({ signedIn: true, name, email, checked: true });

describe('collaboration follows the signed-in account', () => {
  beforeEach(() => __resetAccountSyncForTests());
  afterEach(() => __resetAccountSyncForTests());

  it('turns collaboration on and uses the account name', () => {
    const { store, values } = memoryStore({ pairingEnabled: false, pairingDisplayName: 'Old name' });
    applyAccountSyncCollab(store, signedIn('Ada Lovelace'));
    expect(values).toEqual({ pairingEnabled: true, pairingDisplayName: 'Ada Lovelace' });
  });

  it('falls back to the email local part when the account has no name', () => {
    expect(accountDisplayName({ name: ' ', email: 'grace@example.com' })).toBe('grace');
  });

  it('leaves settings alone when signed out', () => {
    const { store, values } = memoryStore({ pairingEnabled: false, pairingDisplayName: '' });
    applyAccountSyncCollab(store, { signedIn: false, name: '', email: '', checked: true });
    expect(values).toEqual({ pairingEnabled: false, pairingDisplayName: '' });
  });

  it('re-applies when the account changes', () => {
    const { store, values } = memoryStore({ pairingEnabled: false, pairingDisplayName: '' });
    const off = installAccountSyncCollab(store);
    setAccountSyncSession({ name: 'Ada', email: 'ada@example.com' });
    expect(values).toEqual({ pairingEnabled: true, pairingDisplayName: 'Ada' });
    setAccountSyncSession({ name: 'Grace', email: 'grace@example.com' });
    expect(values.pairingDisplayName).toBe('Grace');
    off();
  });

  it('has no Collaboration tab in the host settings sidebar', () => {
    expect(DEBATE_EDITOR_SETTINGS_TABS.map((t) => t.id)).not.toContain('pairing');
  });
});
