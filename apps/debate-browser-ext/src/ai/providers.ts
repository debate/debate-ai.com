/**
 * Where the panel's "Ask" and "Suggest" answers come from.
 *
 * Two kinds of provider, and the difference matters to the reader:
 *
 * - **Your debate-ai.com account** — no key to paste. The request goes to the
 *   deployment's own `/api/reason-ai` with the extension's session token, and
 *   the server holds the model key. Requires being signed in (src/auth).
 * - **Your own key** — OpenRouter, OpenAI, Anthropic or Google Gemini, called
 *   directly from the extension with a key the reader pasted into Options.
 *   The key never leaves this browser: it is stored in `storage.local` (not
 *   `storage.sync`, which would copy it to the user's Google account) and is
 *   sent to that provider's API and to nothing else.
 *
 * Each provider's origin is in the manifest's `host_permissions`, which is
 * what lets an extension page call it without a CORS preflight.
 */

export type AiProviderId = 'account' | 'openrouter' | 'openai' | 'anthropic' | 'google';

export interface AiProvider {
  id: AiProviderId;
  label: string;
  /** Where the reader gets a key, shown next to the key field in Options. */
  keyUrl?: string;
  /** Model id used when the reader has not named one. */
  defaultModel: string;
  /** A placeholder that shows the shape of a valid key. */
  keyPlaceholder?: string;
}

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: 'account',
    label: 'My Debate AI account',
    defaultModel: '',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (my key)',
    keyUrl: 'https://openrouter.ai/keys',
    defaultModel: 'anthropic/claude-sonnet-4.5',
    keyPlaceholder: 'sk-or-v1-…',
  },
  {
    id: 'openai',
    label: 'OpenAI (my key)',
    keyUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o-mini',
    keyPlaceholder: 'sk-…',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (my key)',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-sonnet-4-5',
    keyPlaceholder: 'sk-ant-…',
  },
  {
    id: 'google',
    label: 'Google Gemini (my key)',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-2.5-flash',
    keyPlaceholder: 'AIza…',
  },
];

/** Providers the reader supplies a key for — i.e. everything but the account. */
export const BYO_KEY_PROVIDERS = AI_PROVIDERS.filter((provider) => provider.id !== 'account');

export function getProvider(id: AiProviderId): AiProvider {
  return AI_PROVIDERS.find((provider) => provider.id === id) ?? AI_PROVIDERS[0];
}

/** Whether `id` names a provider at all — `storage` can hold anything. */
export function isAiProviderId(id: unknown): id is AiProviderId {
  return AI_PROVIDERS.some((provider) => provider.id === id);
}

/** Origins the manifest must grant, so Options can say which and why. */
export const PROVIDER_ORIGINS: Record<Exclude<AiProviderId, 'account'>, string> = {
  openrouter: 'https://openrouter.ai',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
};
