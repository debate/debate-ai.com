/**
 * Where the panel's "Ask" and "Suggest" answers come from.
 *
 * The extension has no API keys of its own. It reuses the OpenRouter or
 * Anthropic key the reader saved in the Debate AI app's own settings
 * (Settings → Preferences → "Your own AI key"; see ./app-key), and without
 * one it asks through the reader's debate-ai.com account:
 *
 * - **Your own key, from the app's settings** — OpenRouter or Anthropic,
 *   called directly from the extension. The key is sent to that provider's API
 *   and to nothing else.
 * - **Your debate-ai.com account** — no key at all. The request goes to the
 *   deployment's own `/api/reason-ai` with the extension's session token, and
 *   the server holds the model key. Requires being signed in (src/auth).
 *
 * Each provider's origin is in the manifest's `host_permissions`, which is
 * what lets an extension page call it without a CORS preflight.
 */

export type AiProviderId = 'account' | 'openrouter' | 'anthropic';

export interface AiProvider {
  id: AiProviderId;
  label: string;
  /** Model id the extension asks this provider for. */
  defaultModel: string;
}

export const AI_PROVIDERS: AiProvider[] = [
  { id: 'account', label: 'My Debate AI account', defaultModel: '' },
  {
    id: 'openrouter',
    label: 'My OpenRouter key (from Debate AI settings)',
    defaultModel: 'anthropic/claude-sonnet-4.5',
  },
  {
    id: 'anthropic',
    label: 'My Anthropic key (from Debate AI settings)',
    defaultModel: 'claude-sonnet-4-5',
  },
];

export function getProvider(id: AiProviderId): AiProvider {
  return AI_PROVIDERS.find((provider) => provider.id === id) ?? AI_PROVIDERS[0];
}

/** Origins the manifest must grant for the key-based providers. */
export const PROVIDER_ORIGINS: Record<Exclude<AiProviderId, 'account'>, string> = {
  openrouter: 'https://openrouter.ai',
  anthropic: 'https://api.anthropic.com',
};
