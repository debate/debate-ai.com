/**
 * @file ask-ai-providers.ts
 * @description The chats offered in the docs' "Ask AI" dropdown
 * (`AskAIButton` from `ask-ai-button`), in display order. Claude leads the
 * list: it replaced the standalone Claude button the Synergy Slayer pages
 * used to have beside the dropdown. Shared by the user docs, the reading-mode
 * header and the developer docs at /docs/dev.
 */
import type { ProviderOption } from 'ask-ai-button';

export const DOCS_AI_PROVIDERS: ProviderOption[] = [
  'claude',
  'qwksearch',
  'perplexity',
  'chatgpt',
  'gemini',
  'grok',
  'copilot',
  'mistral',
  'venice',
  'brave',
  'cursor',
];
