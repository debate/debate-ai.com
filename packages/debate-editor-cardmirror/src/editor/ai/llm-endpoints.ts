/** The AI provider endpoints — isolated so the LITE build can alias
 *  this module to the empty variant, compiling the hostnames out of
 *  the bundle entirely (llm-endpoints-lite.ts + vite.config). */
export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
