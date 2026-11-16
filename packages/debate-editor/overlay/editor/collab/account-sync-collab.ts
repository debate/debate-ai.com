/**
 * Account sync drives collaboration on debate-ai.com — no settings to set.
 *
 * Upstream gates card sharing and co-editing behind the 'Enable
 * collaboration' toggle (`pairingEnabled`) and a user-typed display name
 * (`pairingDisplayName`), configured on the editor's Collaboration settings
 * tab. On debate-ai.com that tab is gone (see `settings-categories.ts` and
 * `settings-tabs.ts`): the signed-in account is the credential
 * (`account-sync.ts`), so this module keeps those two settings in step with
 * it instead:
 *
 *   - signed in  → collaboration on, display name = the account's name
 *                  (or the email's local part when the account has none);
 *   - signed out → left as they are; the relay refuses without a session
 *                  anyway, and turning the toggle off would hide a Receive
 *                  pill that fills again as soon as the user signs back in.
 *
 * Installed once by the React shell (`react/singleton.ts`) after the engine
 * and settings load, and re-applied whenever the account changes.
 */

import { accountSyncStatus, onAccountSyncChanged, type AccountSyncStatus } from './account-sync.js';

/** The slice of the settings store this module touches. */
export interface CollabSettingsStore {
  get(key: 'pairingEnabled'): boolean;
  get(key: 'pairingDisplayName'): string;
  set(key: 'pairingEnabled', value: boolean): void;
  set(key: 'pairingDisplayName', value: string): void;
}

/** The name collaborators see for this account: its name, else the email's local part. */
export function accountDisplayName(status: Pick<AccountSyncStatus, 'name' | 'email'>): string {
  const name = status.name.trim();
  if (name) return name;
  const email = status.email.trim();
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}

/** Bring the collaboration settings in line with the signed-in account. */
export function applyAccountSyncCollab(store: CollabSettingsStore, status: AccountSyncStatus): void {
  if (!status.signedIn) return;
  try {
    if (!store.get('pairingEnabled')) store.set('pairingEnabled', true);
    const name = accountDisplayName(status);
    if (name && store.get('pairingDisplayName') !== name) store.set('pairingDisplayName', name);
  } catch {
    /* settings store unavailable — collaboration falls back to its defaults */
  }
}

let uninstall: (() => void) | null = null;

/** Apply now and on every account change. Idempotent; returns an uninstaller. */
export function installAccountSyncCollab(store: CollabSettingsStore): () => void {
  if (uninstall) return uninstall;
  applyAccountSyncCollab(store, accountSyncStatus());
  const off = onAccountSyncChanged(() => applyAccountSyncCollab(store, accountSyncStatus()));
  uninstall = () => {
    off();
    uninstall = null;
  };
  return uninstall;
}
