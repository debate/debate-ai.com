/** LITE variant of llm-endpoints: no provider hostnames exist in the
 *  build. callLlm is unreachable in Lite (commands hidden, setting
 *  force-disabled); if something ever got here anyway, an empty URL
 *  fails the request without contacting anything. */
export const ANTHROPIC_MESSAGES_URL = '';
export const OPENROUTER_CHAT_URL = '';
