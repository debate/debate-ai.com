/**
 * The reader's own model API keys.
 *
 * Kept in `storage.local` rather than the `storage.sync` the rest of the
 * extension's settings use: `storage.sync` is uploaded to the signed-in
 * browser profile's account and synced to every device on it, which is not
 * somewhere a paid API key should end up without the reader asking for that.
 * The cost is that keys do not follow the reader to another computer, which is
 * the right trade and is said plainly on the Options page.
 */
import { browser } from 'wxt/browser';

import { BYO_KEY_PROVIDERS, type AiProviderId } from './providers';

/** One `storage.local` key per provider. */
type KeyProviderId = Exclude<AiProviderId, 'account'>;

export type ApiKeys = Partial<Record<KeyProviderId, string>>;

const STORAGE_KEY = 'aiApiKeys';

/** Every stored key, by provider. Missing and blank entries are left out. */
export async function getApiKeys(): Promise<ApiKeys> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const raw = stored[STORAGE_KEY];
  if (!raw || typeof raw !== 'object') return {};
  const keys: ApiKeys = {};
  for (const provider of BYO_KEY_PROVIDERS) {
    const value = (raw as Record<string, unknown>)[provider.id];
    if (typeof value === 'string' && value.trim()) keys[provider.id as KeyProviderId] = value.trim();
  }
  return keys;
}

/** The key for one provider, or `undefined` when none is stored. */
export async function getApiKey(provider: AiProviderId): Promise<string | undefined> {
  if (provider === 'account') return undefined;
  return (await getApiKeys())[provider as KeyProviderId];
}

/**
 * Replaces the stored keys with `keys`. A blank value removes that provider's
 * key rather than storing an empty string, so "clear this field and save" is
 * how the reader deletes a key.
 */
export async function saveApiKeys(keys: ApiKeys): Promise<void> {
  const next: ApiKeys = {};
  for (const provider of BYO_KEY_PROVIDERS) {
    const value = keys[provider.id as KeyProviderId];
    if (typeof value === 'string' && value.trim()) next[provider.id as KeyProviderId] = value.trim();
  }
  await browser.storage.local.set({ [STORAGE_KEY]: next });
}
