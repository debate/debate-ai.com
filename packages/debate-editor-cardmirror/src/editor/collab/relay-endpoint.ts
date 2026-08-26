/** The official relay endpoint for BROWSER hosts — isolated so the
 *  LITE build aliases this to the empty variant (relay-endpoint-lite),
 *  compiling the hostname out. Safe to hardcode here: the relay stays
 *  on this domain permanently (user decision 2026-08-17). */
export const WEB_DEFAULT_RELAY_URL = 'https://scouting-assistant.up.railway.app/relay';
